/**
 * @file LoginForm.tsx
 * @description 登录表单：useActionState 驱动原生 form 提交，先本地 zod 校验再调用 Server Action
 * loginAction；按状态码映射错误（401 账号密码错误 / 403 账号禁用），成功后写入 AuthProvider、
 * 弹出 toast 并跳转到 redirect 参数指定的安全地址（含 redirect 时顶部展示回跳提示条）。
 * 内部 LoginContent 依赖 useSearchParams，由 LoginForm 用 Suspense 包裹导出。
 */
"use client";

import { useActionState, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Info } from "lucide-react";
import { messages } from "@/texts";
import { PasswordToggle } from "@/components/ui/PasswordToggle";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
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
import { loginSchema, type LoginField } from "@/shared/validation/auth";

/**
 * 登录表单的 useActionState 状态：字段级错误 + 表单级错误
 */
interface LoginState {
  /** 邮箱字段错误 */
  emailError: string | null;

  /** 密码字段错误 */
  pwdError: string | null;

  /** 表单级错误（整体失败提示） */
  formError: string | null;
}

/** 表单初始状态：无任何错误 */
const initialState: LoginState = { emailError: null, pwdError: null, formError: null };

/**
 * 将通用校验反馈结果转换为 LoginState 结构
 * @param feedback {@link FeedbackResult} 字段/表单错误集合
 * @returns 供 useActionState 使用的 {@link LoginState}
 */
function toLoginState(feedback: FeedbackResult<LoginField>): LoginState {
  return {
    emailError: feedback.fields.email ?? null,
    pwdError: feedback.fields.password ?? null,
    formError: feedback.form,
  };
}

/**
 * 登录表单主体，依赖 useSearchParams，必须由 Suspense 包裹（见 {@link LoginForm}）
 */
function LoginContent() {
  const searchParams = useSearchParams();

  const { setMe } = useAuth();
  const router = useRouter();

  /** URL redirect 参数原值，缺省回首页 */
  const redirectRaw = searchParams.get("redirect") || "/";

  /** 经白名单校验后的安全跳转地址，防开放重定向 */
  const safeR = safeRedirect(redirectRaw);

  /** 密码是否明文显示 */
  const [showPassword, setShowPassword] = useState(false);

  /** 邮箱/密码输入值（受控） */
  const [values, setValues] = useState({ email: "", password: "" });

  /** 是否携带 redirect 参数，用于展示回跳提示条 */
  const hasRedirect = searchParams.has("redirect");

  /** 登录失败错误回显规则：401 表单级提示、403 邮箱字段级提示，其余走兜底文案 */
  const loginErrorRules: ErrorFeedbackOptions<LoginField> = {
    fields: ["email", "password"],
    fallback: messages.feedback.session.loginFailed,
    byStatus: {
      401: { fields: {}, form: messages.auth.emailOrPwdError },
      403: { fields: { email: messages.auth.accountDisabled }, form: null },
    },
  };

  /**
   * 表单提交 action：trim 邮箱 → zod 本地校验（失败聚焦首个错误字段）→
   * 调用 loginAction → 失败按状态码回显；成功写入用户态、toast 并 replace 到安全地址
   */
  const [formState, formAction] = useActionState<LoginState, FormData>(async (_prev, formData) => {
    const email = (formData.get("email") as string)?.trim() ?? "";
    const password = (formData.get("password") as string) ?? "";

    const invalid = validateForm(
      loginSchema,
      { email, password },
      { messages: { email: messages.auth.invalidEmail, password: messages.auth.emptyPwd } },
    );
    if (hasFeedback(invalid)) {
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

      setMe(result.data.user);
      notify.success(messages.feedback.session.loggedIn);

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
      {/* 标题区：登录标题 + 副标题 */}
      <div className="mb-10">
        <h1 className="auth-title">{messages.auth.loginTitle}</h1>
        <p className="auth-subtitle">{messages.auth.loginSubtitle}</p>
      </div>

      {/* 回跳提示条：URL 带 redirect 参数时展示 */}
      {hasRedirect && (
        <Alert variant="info" icon={<Info size={18} strokeWidth={2.5} />} className="mb-5">
          {messages.auth.redirectNotice}
        </Alert>
      )}

      {/* 表单级错误提示 */}
      {formState.formError && (
        <Alert variant="error" className="mb-5">
          {formState.formError}
        </Alert>
      )}

      {/* 登录表单：邮箱 + 密码（可切换明文）+ 提交按钮 */}
      <form action={formAction} noValidate className="auth-form-stack">
        <FormField label={messages.auth.email} required error={formState.emailError ?? undefined}>
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

        <FormField label={messages.auth.password} required error={formState.pwdError ?? undefined}>
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder={messages.auth.pwdPlaceholder}
            autoComplete="current-password"
            value={values.password}
            onChange={(e) => setValues((prev) => ({ ...prev, password: e.target.value }))}
            leftIcon={<Lock size={18} strokeWidth={2.5} />}
            rightElement={<PasswordToggle show={showPassword} onToggle={setShowPassword} />}
            error={!!formState.pwdError}
          />
        </FormField>

        <SubmitButton className="mt-2 w-full">{messages.auth.loginSubmit}</SubmitButton>
      </form>

      {/* 注册入口链接 */}
      <div className="auth-switch">
        {messages.auth.noAccount}
        <Link href="/register" className="auth-switch-link">
          {messages.auth.registerNow}
        </Link>
      </div>
    </div>
  );
}

/**
 * 登录表单对外入口：Suspense 包裹以支持 useSearchParams 的流式渲染
 */
export function LoginForm() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
