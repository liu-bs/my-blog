/**
 * @file LoginForm.tsx
 * @description 邮箱 + 密码登录表单：本地 zod 先行校验，再调用登录 Server Action；
 *              失败时将错误码映射为字段级 / 表单级文案，成功后刷新全局用户态并按 redirect 参数回跳。
 *              外层用 Suspense 包裹是因为内部通过 useSearchParams 读取 redirect，需配合 Suspense 边界
 */
"use client";

import { useActionState, useState, Suspense } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Mail, Lock, Clock, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { PasswordToggle } from "@/components/ui/PasswordToggle";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { msg } from "@/lib/message";
import { notify } from "@/lib/toast";
import {
  actionFailure,
  focusFirstInvalid,
  hasFeedback,
  resolveSubmitError,
  validateForm,
  type ErrorFeedbackOptions,
  type FeedbackResult,
} from "@/lib/formFeedback";
import { useAuth } from "@/components/AuthProvider";
import { loginAction } from "@server/auth/auth.controller";
import { safeRedirect } from "@/lib/url";
import { loginSchema } from "@/shared/validation/auth";

/**
 * 登录表单的提交结果状态
 * @description 由 useActionState 持有并驱动 UI：字段级错误渲染在对应输入框下，表单级错误渲染在顶部 Alert
 */
interface LoginState {
  /** 邮箱字段错误文案，null 表示无错误 */
  emailError: string | null;

  /** 密码字段错误文案，null 表示无错误 */
  pwdError: string | null;

  /** 与具体字段无关的表单级错误文案，null 表示无错误 */
  formError: string | null;
}

/** 登录表单可校验的字段集合，用于把后端返回的错误路径收敛为本地状态 */
type LoginField = "email" | "password";

/** 登录表单初始状态：三项均无错误 */
const initialState: LoginState = { emailError: null, pwdError: null, formError: null };

/**
 * 把通用的表单反馈结果转换为登录表单专用的状态结构
 * @description resolveSubmitError / validateForm 返回的是泛化的 fields + form，这里做一次适配，
 *              使 useActionState 的返回值可以直接被 UI 解构使用
 * @param feedback 通用反馈结果，fields 为字段级错误映射
 * @returns 登录表单状态
 */
function toLoginState(feedback: FeedbackResult<LoginField>): LoginState {
  return {
    emailError: feedback.fields.email ?? null,
    pwdError: feedback.fields.password ?? null,
    formError: feedback.form,
  };
}

/**
 * LoginContent 登录表单实际内容
 * @description 从 useSearchParams 抽离出来单独成组件，才能被 Suspense 边界包住（App Router 的静态渲染要求）。
 *              提交流程：本地 schema 校验 → 调 loginAction → 失败走错误映射、成功则 refreshMe + 跳转
 * @returns 登录卡片（标题、可选提示、表单、限流说明与注册入口）
 */
function LoginContent() {
  const t = useTranslations("auth");

  const searchParams = useSearchParams();

  const { refreshMe } = useAuth();
  const router = useRouter();

  /** 原始 redirect 参数，可能来自外部拼接，因此后续必须经 safeRedirect 清洗 */
  const redirectRaw = searchParams.get("redirect") || "/";

  /** 清洗后的安全回跳路径（站内路径，且排除 login / register 自身） */
  const safeR = safeRedirect(redirectRaw);

  /** 密码明文 / 掩码切换开关 */
  const [showPassword, setShowPassword] = useState(false);

  /** 受控输入值，仅用于回显；真正的提交数据取自 FormData */
  const [values, setValues] = useState({ email: "", password: "" });

  /** 是否带 redirect 参数进入，用于决定是否展示「登录后将返回原页面」的提示 */
  const hasRedirect = searchParams.has("redirect");

  /** 错误码到文案的映射规则：兜底用全局文案，401 归为「邮箱或密码错误」，403 归属到邮箱字段提示账号被禁用 */
  const loginErrorRules: ErrorFeedbackOptions<LoginField> = {
    fields: ["email", "password"],
    fallback: msg("session", "loginFailed"),
    byStatus: {
      401: { fields: {}, form: t("emailOrPwdError") },
      403: { fields: { email: t("accountDisabled") }, form: null },
    },
  };

  /**
   * 登录提交动作
   * @description 使用 useActionState 托管，天然带 pending 态（SubmitButton 读取）。
   *              先本地校验拦截明显非法输入，减少一次网络往返；服务端失败时把错误码翻译为字段 / 表单文案，
   *              并通过 focusFirstInvalid 把焦点推到第一个出错字段上（无障碍）。
   *              成功后刷新用户上下文，refreshMe 失败只提示不阻断（cookie 已写入，跳转仍可继续）
   * @param _prev 上一次的状态，登录场景不需要基于它做增量，因此忽略
   * @param formData 原生表单数据，字段名与输入框 name 一一对应
   * @returns 下一次渲染使用的登录表单状态
   */
  const [formState, formAction] = useActionState<LoginState, FormData>(async (_prev, formData) => {
    const email = (formData.get("email") as string)?.trim() ?? "";
    const password = (formData.get("password") as string) ?? "";

    // 第一道：本地 schema 校验，错误文案替换为登录场景专属措辞
    const invalid = validateForm(
      loginSchema,
      { email, password },
      { messages: { email: t("invalidEmail"), password: t("emptyPwd") } },
    );
    if (hasFeedback(invalid)) {
      focusFirstInvalid();
      return toLoginState(invalid);
    }

    try {
      const result = await loginAction({ email, password });
      // 业务层失败（如密码错误 / 账号禁用）：走错误码映射
      if (!result.ok) {
        const failed = resolveSubmitError(actionFailure(result), loginErrorRules);
        focusFirstInvalid();
        return toLoginState(failed);
      }
      try {
        await refreshMe();
      } catch {
        // 用户态刷新失败不影响登录本身，仅提示一次
        notify.error(msg("session", "loginFailed"));
      }
      notify.success(msg("session", "loggedIn"));

      router.replace(safeR);
      return initialState;
    } catch (err) {
      // 网络层 / 未知异常，同样统一收敛为表单反馈
      const failed = resolveSubmitError(err, loginErrorRules);
      focusFirstInvalid();
      return toLoginState(failed);
    }
  }, initialState);

  return (
    <div className="auth-card">
      {/* 标题区 */}
      <div className="mb-10">
        <h1 className="auth-title">{t("loginTitle")}</h1>
        <p className="auth-subtitle">{t("loginSubtitle")}</p>
      </div>

      {/* 带 redirect 进入时的说明，解释登录后的跳转去向 */}
      {hasRedirect && (
        <Alert variant="info" icon={<Info size={18} strokeWidth={2.5} />} className="mb-5">
          {t("redirectNotice")}
        </Alert>
      )}

      {/* 表单级错误（如账号密码不匹配、账号被禁用） */}
      {formState.formError && (
        <Alert variant="error" className="mb-5">
          {formState.formError}
        </Alert>
      )}

      {/* noValidate 关闭浏览器原生校验，统一交给 zod 处理以保证错误文案可本地化 */}
      <form action={formAction} noValidate className="auth-form-stack">
        {/* 邮箱字段：错误态由 emailError 驱动 */}
        <FormField label={t("email")} required error={formState.emailError ?? undefined}>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="user@example.com"
            autoComplete="email"
            value={values.email}
            onChange={(e) => setValues((prev) => ({ ...prev, email: e.target.value }))}
            leftIcon={<Mail size={18} strokeWidth={2.5} />}
            error={!!formState.emailError}
          />
        </FormField>

        {/* 密码字段：type 随 showPassword 在明文与掩码间切换 */}
        <FormField label={t("password")} required error={formState.pwdError ?? undefined}>
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder={t("pwdPlaceholder")}
            autoComplete="current-password"
            value={values.password}
            onChange={(e) => setValues((prev) => ({ ...prev, password: e.target.value }))}
            leftIcon={<Lock size={18} strokeWidth={2.5} />}
            rightElement={<PasswordToggle show={showPassword} onToggle={setShowPassword} />}
            error={!!formState.pwdError}
          />
        </FormField>

        {/* 忘记密码：功能尚未开放，用 aria-disabled 表明不可用而非直接隐藏，保留入口预期 */}
        <div className="text-right">
          <span
            className="text-(length:--type-2xs) text-muted"
            aria-disabled="true"
            title={t("forgotPwd")}
          >
            {t("forgotPwd")}
          </span>
        </div>

        {/* 提交按钮：pending 态由 useActionState 自动提供 */}
        <SubmitButton className="mt-2 w-full">{t("loginSubmit")}</SubmitButton>
      </form>

      {/* 限流提示：登录接口有频率限制，提前告知用户 */}
      <div className="auth-rate-hint">
        <Clock size={14} strokeWidth={2.5} />
        <span>{t("rateLimit")}</span>
      </div>

      {/* 跳转注册页 */}
      <div className="auth-switch">
        {t("noAccount")}
        <Link href="/register" className="auth-switch-link">
          {t("registerNow")}
        </Link>
      </div>
    </div>
  );
}

/**
 * LoginForm 登录表单入口
 * @description 仅作为 Suspense 边界的外壳：LoginContent 内部使用 useSearchParams，
 *              必须被 Suspense 包裹才能通过 App Router 的静态渲染检查
 * @returns 带 Suspense 边界的登录表单
 */
export function LoginForm() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
