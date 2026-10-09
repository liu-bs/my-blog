/**
 * @file RegisterForm.tsx
 * @description 注册表单：四个字段（名/用户名/邮箱/密码）带实时逐字段校验（输入即校验、清空即重置），
 * 密码附带强度指示与明文切换；提交经 useActionState 调用 Server Action registerAction，
 * 本地 zod 全量校验失败或接口报错（409 账号重复）时回显字段级/表单级错误，成功后跳转 /login。
 */
"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, UserPlus, X } from "lucide-react";
import { messages } from "@/texts";
import { PasswordToggle } from "@/components/ui/PasswordToggle";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
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

/** 字段初始状态：未输入、未触碰、未校验 */
const initialField: FieldState = { value: "", touched: false, valid: null, error: null };

/**
 * 注册表单的 useActionState 状态
 */
interface RegisterState {
  /** 表单级错误信息 */
  error: string | null;
}

/** 表单初始状态：无错误 */
const initialState: RegisterState = { error: null };

/** 字段渲染/错误聚焦顺序 */
const fieldOrder: readonly FieldId[] = ["firstName", "username", "email", "password"];

/** 各字段对应的 zod 校验子 schema，用于输入时逐字段校验 */
const fieldSchemas = {
  firstName: registerSchema.shape.firstName,
  username: registerSchema.shape.username,
  email: registerSchema.shape.email,
  password: registerSchema.shape.password,
};

/**
 * 注册表单
 */
export function RegisterForm() {
  const router = useRouter();

  // 四个受控字段的状态集合，初始均为空白
  const [fields, setFields] = useState<Record<FieldId, FieldState>>({
    firstName: { ...initialField },
    username: { ...initialField },
    email: { ...initialField },
    password: { ...initialField },
  });

  /** 密码是否明文显示 */
  const [showPassword, setShowPassword] = useState(false);

  /** 各字段校验失败时的提示文案 */
  const fieldMessage: Record<FieldId, string> = {
    firstName: messages.auth.errNameLength,
    username: messages.auth.errUsername,
    email: messages.auth.invalidEmail,
    password: messages.auth.errPassword,
  };

  /**
   * 输入时更新字段：空值重置为初始态；非空则即时用对应子 schema 校验并记录 valid/error
   * @param id 字段标识
   * @param value 输入值
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
   * 将提交失败返回的字段错误批量写入各字段状态（不覆盖未返回错误的字段）
   * @param errors 字段ID到错误文案的映射
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

  /** 注册失败错误回显规则：409 映射为表单级"账号已存在"，其余走兜底文案 */
  const registerErrorRules: ErrorFeedbackOptions<FieldId> = {
    fields: fieldOrder,
    fallback: messages.feedback.session.registerFailed,
    byStatus: {
      409: { fields: {}, form: messages.auth.duplicateAccount },
    },
  };

  /**
   * 表单提交 action：trim 各输入 → registerSchema 全量校验（失败回写字段错误并聚焦首个）→
   * 调用 registerAction（lastName 固定传空串）→ 成功 toast 并 replace 到 /login
   */
  const [formState, formAction] = useActionState<RegisterState, FormData>(
    async (_prev, formData) => {
      const firstName = (formData.get("firstName") as string)?.trim() ?? "";
      const username = (formData.get("username") as string)?.trim() ?? "";
      const email = (formData.get("email") as string)?.trim() ?? "";
      const password = (formData.get("password") as string) ?? "";

      const invalid = validateForm(
        registerSchema,
        { firstName, username, email, password },
        { messages: fieldMessage, knownFields: fieldOrder },
      );
      if (hasFeedback(invalid)) {
        applyFieldErrors(invalid.fields);
        focusFirstInvalid();
        return { error: invalid.form };
      }

      try {
        const result = await registerAction({ firstName, lastName: "", username, email, password });

        if (!result.ok) {
          const failed = resolveSubmitError(actionFailure(result), registerErrorRules);
          applyFieldErrors(failed.fields);
          focusFirstInvalid();
          return { error: failed.form };
        }
        notify.success(messages.feedback.session.registered);

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
   * 渲染字段右侧校验状态图标：仅校验失败时显示红色 X
   * @param id 字段标识
   * @returns 状态图标元素或 null
   */
  const renderStatusIcon = (id: FieldId) => {
    const f = fields[id];
    if (f.valid === false) {
      return <X size={16} className="text-state-error" strokeWidth={3} />;
    }
    return null;
  };

  return (
    <div className="auth-card">
      {/* 标题区：注册标题 + 副标题 */}
      <div className="mb-10">
        <h1 className="auth-title">{messages.auth.registerTitle}</h1>
        <p className="auth-subtitle">{messages.auth.registerSubtitle}</p>
      </div>

      {/* 表单级错误提示 */}
      {formState.error && (
        <Alert variant="error" className="mb-4">
          {formState.error}
        </Alert>
      )}

      {/* 注册表单：名 / 用户名 / 邮箱 / 密码（强度条 + 明文切换）+ 提交按钮 */}
      <form action={formAction} noValidate className="auth-form-stack">
        <FormField
          label={messages.auth.firstName}
          required
          error={fields.firstName.error ?? undefined}
        >
          <Input
            id="firstName"
            name="firstName"
            type="text"
            placeholder={messages.auth.firstNamePlaceholder}
            maxLength={50}
            autoComplete="nickname"
            value={fields.firstName.value}
            onChange={(e) => updateField("firstName", e.target.value)}
            leftIcon={<User size={18} strokeWidth={2.5} />}
            rightElement={<span>{renderStatusIcon("firstName")}</span>}
            error={fields.firstName.valid === false}
          />
        </FormField>

        <FormField
          label={messages.auth.username}
          required
          hint={messages.auth.usernameHint}
          error={fields.username.error ?? undefined}
        >
          <Input
            id="username"
            name="username"
            type="text"
            placeholder={messages.auth.usernamePlaceholder}
            maxLength={30}
            autoComplete="username"
            value={fields.username.value}
            onChange={(e) => updateField("username", e.target.value)}
            leftIcon={<UserPlus size={18} strokeWidth={2.5} />}
            rightElement={<span>{renderStatusIcon("username")}</span>}
            error={fields.username.valid === false}
          />
        </FormField>

        <FormField label={messages.auth.email} required error={fields.email.error ?? undefined}>
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
          />
        </FormField>

        <FormField
          label={messages.auth.password}
          required
          hint={messages.auth.passwordHint}
          error={fields.password.error ?? undefined}
        >
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder={messages.auth.pwdPlaceholderMin}
            autoComplete="new-password"
            value={fields.password.value}
            onChange={(e) => updateField("password", e.target.value)}
            leftIcon={<Lock size={18} strokeWidth={2.5} />}
            rightElement={<PasswordToggle show={showPassword} onToggle={setShowPassword} />}
            error={fields.password.valid === false}
          />

          {/* 密码强度指示条 */}
          <PasswordStrength password={fields.password.value} />
        </FormField>

        <SubmitButton className="mt-2 w-full">{messages.auth.registerSubmit}</SubmitButton>
      </form>

      {/* 登录入口链接 */}
      <div className="auth-switch">
        {messages.auth.hasAccount}
        <Link href="/login" className="auth-switch-link">
          {messages.auth.loginNow}
        </Link>
      </div>
    </div>
  );
}
