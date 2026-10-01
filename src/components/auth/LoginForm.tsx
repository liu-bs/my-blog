/**
 * @file LoginForm.tsx
 * @description 登录表单组件：useActionState 提交 loginAction，先经 loginSchema 前端校验，失败聚焦首个错误字段；服务端失败按状态码映射文案（401 邮箱或密码错误、403 账号禁用）；成功后 setMe 直写用户并跳转 redirect 参数（safeRedirect 校验防开放重定向）
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
 * 登录表单错误状态
 */
interface LoginState {
  /** 邮箱字段错误文案 */
  emailError: string | null;

  /** 密码字段错误文案 */
  pwdError: string | null;

  /** 表单级错误文案（与具体字段无关，如账号密码不匹配） */
  formError: string | null;
}

/** 登录表单字段标识 */
type LoginField = "email" | "password";

/** 初始表单状态：无任何错误 */
const initialState: LoginState = { emailError: null, pwdError: null, formError: null };

/**
 * 将统一校验/提交错误反馈转换为登录表单错误状态
 * @param feedback formFeedback 错误反馈结果
 * @returns 表单错误状态 {@link LoginState}
 */
function toLoginState(feedback: FeedbackResult<LoginField>): LoginState {
  return {
    emailError: feedback.fields.email ?? null,
    pwdError: feedback.fields.password ?? null,
    formError: feedback.form,
  };
}

/**
 * 登录表单主体
 * @description 内部使用 useSearchParams 读取 redirect 参数，因此由外层 Suspense 包裹
 */
function LoginContent() {
  const t = useTranslations("auth");

  /** URL 查询参数，用于读取登录后回跳地址 */
  const searchParams = useSearchParams();

  /** 认证上下文的用户写入方法，登录成功后直接写入避免重复请求 */
  const { setMe } = useAuth();
  const router = useRouter();

  /** redirect 原始参数，缺省回首页 */
  const redirectRaw = searchParams.get("redirect") || "/";

  /** 经 safeRedirect 校验的回跳地址，仅允许站内路径防开放重定向 */
  const safeR = safeRedirect(redirectRaw);

  /** 密码是否明文显示 */
  const [showPassword, setShowPassword] = useState(false);

  /** 受控的邮箱/密码输入值 */
  const [values, setValues] = useState({ email: "", password: "" });

  /** URL 是否带 redirect 参数，用于展示「登录后跳转」提示 */
  const hasRedirect = searchParams.has("redirect");

  /**
   * 登录失败错误映射规则
   * 401 → 表单级「邮箱或密码错误」；403 → 邮箱字段「账号已被禁用」；其余走兜底文案
   */
  const loginErrorRules: ErrorFeedbackOptions<LoginField> = {
    fields: ["email", "password"],
    fallback: msg("session", "loginFailed"),
    byStatus: {
      401: { fields: {}, form: t("emailOrPwdError") },
      403: { fields: { email: t("accountDisabled") }, form: null },
    },
  };

  /**
   * 表单提交动作：前端 zod 校验 → 调用 loginAction
   * 成功：setMe 写入用户并跳转校验后的回跳地址；失败：按规则映射字段/表单错误并聚焦首个错误字段
   */
  const [formState, formAction] = useActionState<LoginState, FormData>(async (_prev, formData) => {
    const email = (formData.get("email") as string)?.trim() ?? "";
    const password = (formData.get("password") as string) ?? "";

    const invalid = validateForm(
      loginSchema,
      { email, password },
      { messages: { email: t("invalidEmail"), password: t("emptyPwd") } },
    );
    if (hasFeedback(invalid)) {
      // 校验失败：聚焦首个错误字段并回显错误
      focusFirstInvalid();
      return toLoginState(invalid);
    }

    try {
      const result = await loginAction({ email, password });

      if (!result.ok) {
        const failed = resolveSubmitError(actionFailure(result), loginErrorRules);
        focusFirstInvalid();
        return toLoginState(failed);
      }
      // 登录成功：直接写入用户（不再重复请求 getMe），提示并跳转
      setMe(result.data.user);
      notify.success(msg("session", "loggedIn"));

      router.replace(safeR);
      return initialState;
    } catch (err) {
      const failed = resolveSubmitError(err, loginErrorRules);
      focusFirstInvalid();
      return toLoginState(failed);
    }
  }, initialState);

  return (
    <div className="auth-card">
      <div className="mb-10">
        <h1 className="auth-title">{t("loginTitle")}</h1>
        <p className="auth-subtitle">{t("loginSubtitle")}</p>
      </div>

      {/* 带 redirect 参数时提示登录后将跳转的目标页面 */}
      {hasRedirect && (
        <Alert variant="info" icon={<Info size={18} strokeWidth={2.5} />} className="mb-5">
          {t("redirectNotice")}
        </Alert>
      )}

      {/* 表单级错误提示（如账号密码不匹配） */}
      {formState.formError && (
        <Alert variant="error" className="mb-5">
          {formState.formError}
        </Alert>
      )}

      <form action={formAction} noValidate className="auth-form-stack">
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

        <div className="text-right">
          <span
            className="text-(length:--type-2xs) text-muted"
            aria-disabled="true"
            title={t("forgotPwd")}
          >
            {t("forgotPwd")}
          </span>
        </div>

        <SubmitButton className="mt-2 w-full">{t("loginSubmit")}</SubmitButton>
      </form>

      <div className="auth-rate-hint">
        <Clock size={14} strokeWidth={2.5} />
        <span>{t("rateLimit")}</span>
      </div>

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
 * LoginForm 登录表单
 * @description useSearchParams 需要 Suspense 边界包裹，避免静态渲染中断
 */
export function LoginForm() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
