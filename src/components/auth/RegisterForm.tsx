/**
 * @file RegisterForm.tsx
 * @description 注册表单：五字段（姓 / 名 / 用户名 / 邮箱 / 密码）即时校验 + 强度提示，
 *              提交走 registerAction，成功后提示并跳转登录页（本流程不做自动登录，与后端「注册即返回会话」的策略解耦）。
 *              字段校验规则全部复用共享层 registerSchema，避免前后端规则漂移
 */
"use client";

import { useActionState, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Mail, Lock, Clock, User, UserPlus, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { PasswordToggle } from "@/components/ui/PasswordToggle";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { msg } from "@/lib/message";
import { notify } from "@/lib/toast";
import {
  actionFailure,
  focusFirstInvalid,
  hasFeedback,
  resolveSubmitError,
  validateFieldValue,
  validateForm,
  type ErrorFeedbackOptions,
  type FieldErrors,
} from "@/lib/formFeedback";
import { registerAction } from "@server/auth/auth.controller";
import { registerSchema } from "@/shared/validation/auth";
import type { FieldId, FieldState } from "@shared";

/** 单个字段的初始状态：无值、未触碰、未校验 */
const initialField: FieldState = { value: "", touched: false, valid: null, error: null };

/**
 * 注册表单的提交结果状态
 * @description 字段级错误存放在 fields 中，这里只承载与字段无关的表单级错误
 */
interface RegisterState {
  /** 表单级错误文案，null 表示无错误（如「该邮箱已注册」） */
  error: string | null;
}

/** 注册表单初始状态 */
const initialState: RegisterState = { error: null };

/** 字段遍历顺序，同时决定焦点跳转到第一个非法字段时的先后次序 */
const fieldOrder: readonly FieldId[] = ["firstName", "lastName", "username", "email", "password"];

/**
 * 各字段对应的 zod 子 schema
 * @description 从 registerSchema 里取出单字段校验器，供输入过程中的即时校验使用，
 *              保证即时校验与提交校验用的是同一份规则
 */
const fieldSchemas = {
  firstName: registerSchema.shape.firstName,
  lastName: registerSchema.shape.lastName,
  username: registerSchema.shape.username,
  email: registerSchema.shape.email,
  password: registerSchema.shape.password,
};

/**
 * RegisterForm 注册表单
 * @description 每个字段独立维护 {@link FieldState}（值 / 是否触碰 / 校验结果），
 *              输入过程中实时给出边框色与右侧对勾 / 叉号反馈；提交阶段的错误由 useActionState 回填。
 *              注册成功只跳转登录页，不在此处写入登录态
 * @returns 注册卡片（标题、表单、限流说明与登录入口）
 */
export function RegisterForm() {
  const router = useRouter();

  const t = useTranslations("auth");

  /** 五个字段的即时状态集合，key 与 formData 字段名一致 */
  const [fields, setFields] = useState<Record<FieldId, FieldState>>({
    firstName: { ...initialField },
    lastName: { ...initialField },
    username: { ...initialField },
    email: { ...initialField },
    password: { ...initialField },
  });

  /** 密码明文 / 掩码切换开关 */
  const [showPassword, setShowPassword] = useState(false);

  /** 各字段即时校验失败时的文案，取自 auth 命名空间，覆盖 schema 的默认提示 */
  const fieldMessage: Record<FieldId, string> = {
    firstName: t("errNameLength"),
    lastName: t("errNameLength"),
    username: t("errUsername"),
    email: t("invalidEmail"),
    password: t("errPassword"),
  };

  /**
   * 更新单个字段的值并即时校验
   * @description 清空输入时回归初始态而不是标记为非法，避免用户删空后立刻看到报错；
   *              其余情况一律置 touched 并记录校验结果，让反馈即时生效
   * @param id 字段名
   * @param value 新输入值
   */
  const updateField = (id: FieldId, value: string) => {
    setFields((prev) => {
      const next = { ...prev };
      if (value.length === 0) {
        next[id] = { value: "", touched: false, valid: null, error: null };
      } else {
        const error = validateFieldValue(fieldSchemas[id], value, fieldMessage[id]);
        next[id] = { value, touched: true, valid: error === null, error };
      }
      return next;
    });
  };

  /**
   * 把提交阶段返回的字段错误批量回填到表单状态
   * @description 只覆盖 errors 中确实存在的字段，避免把已通过校验的字段重置；
   *              按 fieldOrder 遍历可保证回填顺序稳定
   * @param errors 服务端 / 本地 schema 返回的字段错误映射
   */
  const applyFieldErrors = (errors: FieldErrors<FieldId>) => {
    setFields((prev) => {
      const next = { ...prev };
      for (const id of fieldOrder) {
        const error = errors[id];
        if (error === undefined) continue;
        next[id] = { ...next[id], touched: true, valid: false, error };
      }
      return next;
    });
  };

  /** 错误码到文案的映射规则：409 冲突即账号（邮箱 / 用户名）已被占用，归属为表单级错误 */
  const registerErrorRules: ErrorFeedbackOptions<FieldId> = {
    fields: fieldOrder,
    fallback: msg("session", "registerFailed"),
    byStatus: {
      409: { fields: {}, form: t("duplicateAccount") },
    },
  };

  /**
   * 注册提交动作
   * @description 完成后端 DTO 的字段清洗（统一 trim）后先做本地全量校验，再调 registerAction；
   *              失败时按状态码映射文案（字段级回填 + 表单级提示）并把焦点推到首个非法字段；
   *              成功则提示「注册成功」并跳转登录页 —— 刻意不做自动登录，让用户显式走一次登录以获得明确的会话起始
   * @param _prev 上一次状态，注册流程无需基于它做增量
   * @param formData 原生表单数据
   * @returns 下一次渲染使用的注册表单状态
   */
  const [formState, formAction] = useActionState<RegisterState, FormData>(
    async (_prev, formData) => {
      const firstName = (formData.get("firstName") as string)?.trim() ?? "";
      const lastName = (formData.get("lastName") as string)?.trim() ?? "";
      const username = (formData.get("username") as string)?.trim() ?? "";
      const email = (formData.get("email") as string)?.trim() ?? "";
      const password = (formData.get("password") as string) ?? "";

      // 第一道：本地全量校验，knownFields 限定只把已知字段的错误落到字段上
      const invalid = validateForm(
        registerSchema,
        { firstName, lastName, username, email, password },
        { messages: fieldMessage, knownFields: fieldOrder },
      );
      if (hasFeedback(invalid)) {
        applyFieldErrors(invalid.fields);
        focusFirstInvalid();
        return { error: invalid.form };
      }

      try {
        const result = await registerAction({ firstName, lastName, username, email, password });
        // 业务层失败（如账号冲突）：走错误码映射
        if (!result.ok) {
          const failed = resolveSubmitError(actionFailure(result), registerErrorRules);
          applyFieldErrors(failed.fields);
          focusFirstInvalid();
          return { error: failed.form };
        }
        notify.success(msg("session", "registered"));

        router.replace("/login");
        return { error: null };
      } catch (err) {
        const failed = resolveSubmitError(err, registerErrorRules);
        applyFieldErrors(failed.fields);
        focusFirstInvalid();
        return { error: failed.form };
      }
    },
    initialState,
  );

  /**
   * 渲染字段右侧的校验状态图标
   * @description valid 为三态：null（未校验）不渲染任何图标，避免用户尚未输入时就出现否定暗示
   * @param id 字段名
   * @returns 通过时返回对勾，失败时返回叉号，未校验返回 null
   */
  const renderStatusIcon = (id: FieldId) => {
    const f = fields[id];
    if (f.valid === null) return null;
    return f.valid ? (
      <Check size={16} className="text-state-success" strokeWidth={3} />
    ) : (
      <X size={16} className="text-state-error" strokeWidth={3} />
    );
  };

  return (
    <div className="auth-card">
      {/* 标题区 */}
      <div className="mb-10">
        <h1 className="auth-title">{t("registerTitle")}</h1>
        <p className="auth-subtitle">{t("registerSubtitle")}</p>
      </div>

      {/* 表单级错误（如账号已被占用） */}
      {formState.error && (
        <Alert variant="error" className="mb-4">
          {formState.error}
        </Alert>
      )}

      {/* noValidate 关闭浏览器原生校验，统一交给 zod 以复用本地化文案 */}
      <form action={formAction} noValidate className="auth-form-stack">
        {/* 姓 / 名：宽屏并排，窄屏堆叠；maxLength 与 schema 上限保持一致 */}
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <FormField label={t("firstName")} required error={fields.firstName.error ?? undefined}>
            <Input
              id="firstName"
              name="firstName"
              type="text"
              placeholder="Alex"
              maxLength={50}
              autoComplete="given-name"
              value={fields.firstName.value}
              onChange={(e) => updateField("firstName", e.target.value)}
              leftIcon={<User size={18} strokeWidth={2.5} />}
              rightElement={<span>{renderStatusIcon("firstName")}</span>}
              error={fields.firstName.valid === false}
              success={fields.firstName.valid === true}
            />
          </FormField>

          <FormField label={t("lastName")} required error={fields.lastName.error ?? undefined}>
            <Input
              id="lastName"
              name="lastName"
              type="text"
              placeholder="Shu"
              maxLength={50}
              autoComplete="family-name"
              value={fields.lastName.value}
              onChange={(e) => updateField("lastName", e.target.value)}
              leftIcon={<User size={18} strokeWidth={2.5} />}
              rightElement={<span>{renderStatusIcon("lastName")}</span>}
              error={fields.lastName.valid === false}
              success={fields.lastName.valid === true}
            />
          </FormField>
        </div>

        {/* 用户名：全局唯一，hint 提前说明命名约束 */}
        <FormField
          label={t("username")}
          required
          hint={t("usernameHint")}
          error={fields.username.error ?? undefined}
        >
          <Input
            id="username"
            name="username"
            type="text"
            placeholder="Hui"
            maxLength={30}
            autoComplete="username"
            value={fields.username.value}
            onChange={(e) => updateField("username", e.target.value)}
            leftIcon={<UserPlus size={18} strokeWidth={2.5} />}
            rightElement={<span>{renderStatusIcon("username")}</span>}
            error={fields.username.valid === false}
            success={fields.username.valid === true}
          />
        </FormField>

        {/* 邮箱：登录凭据，注册时即要求唯一 */}
        <FormField label={t("email")} required error={fields.email.error ?? undefined}>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="user@example.com"
            autoComplete="email"
            value={fields.email.value}
            onChange={(e) => updateField("email", e.target.value)}
            leftIcon={<Mail size={18} strokeWidth={2.5} />}
            rightElement={<span>{renderStatusIcon("email")}</span>}
            error={fields.email.valid === false}
            success={fields.email.valid === true}
          />
        </FormField>

        {/* 密码：下方叠加强度条，实时给出弱 / 中 / 强提示 */}
        <FormField label={t("password")} required error={fields.password.error ?? undefined}>
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder={t("pwdPlaceholderMin")}
            autoComplete="new-password"
            value={fields.password.value}
            onChange={(e) => updateField("password", e.target.value)}
            leftIcon={<Lock size={18} strokeWidth={2.5} />}
            rightElement={<PasswordToggle show={showPassword} onToggle={setShowPassword} />}
            error={fields.password.valid === false}
            success={fields.password.valid === true}
          />
          <PasswordStrength password={fields.password.value} />
        </FormField>

        {/* 提交按钮：pending 态由 useActionState 自动提供 */}
        <SubmitButton className="mt-2 w-full">{t("registerSubmit")}</SubmitButton>
      </form>

      {/* 限流提示：注册接口有频率限制，提前告知用户 */}
      <div className="auth-rate-hint">
        <Clock size={14} strokeWidth={2.5} />
        <span>{t("rateLimit")}</span>
      </div>

      {/* 跳转登录页 */}
      <div className="auth-switch">
        {t("hasAccount")}
        <Link href="/login" className="auth-switch-link">
          {t("loginNow")}
        </Link>
      </div>
    </div>
  );
}
