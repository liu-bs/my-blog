"use client";

import { useActionState, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Info } from "lucide-react";
import auth from "@/texts/auth";
import feedback from "@/texts/feedback";
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
} from "@/lib/form-feedback";
import { useAuth } from "@/components/AuthProvider";
import { loginAction } from "@server/auth/auth.controller";
import { safeRedirect } from "@/lib/url";
import { loadAuthValidation } from "@/lib/validation-loader";
import type { LoginField } from "@/shared/validation/auth";

interface LoginState {
  emailError: string | null;

  passwordError: string | null;

  formError: string | null;
}

const initialState: LoginState = { emailError: null, passwordError: null, formError: null };

function toLoginState(feedback: FeedbackResult<LoginField>): LoginState {
  return {
    emailError: feedback.fields.email ?? null,
    passwordError: feedback.fields.password ?? null,
    formError: feedback.form,
  };
}

function LoginContent() {
  const searchParams = useSearchParams();

  const { setMe } = useAuth();
  const router = useRouter();

  const redirectRaw = searchParams.get("redirect") || "/";

  const safeR = safeRedirect(redirectRaw);

  const [showPassword, setShowPassword] = useState(false);

  const [values, setValues] = useState({ email: "", password: "" });

  const hasRedirect = searchParams.has("redirect");

  const loginErrorRules: ErrorFeedbackOptions<LoginField> = {
    fields: ["email", "password"],
    fallback: feedback.session.loginFailed,
    byStatus: {
      401: { fields: {}, form: auth.emailOrPasswordError },
      403: { fields: { email: auth.accountDisabled }, form: null },
    },
  };

  const [formState, formAction] = useActionState<LoginState, FormData>(async (_prev, formData) => {
    const email = (formData.get("email") as string)?.trim() ?? "";
    const password = (formData.get("password") as string) ?? "";

    const { loginSchema } = await loadAuthValidation();

    const invalid = validateForm(
      loginSchema,
      { email, password },
      { fieldTexts: { email: auth.invalidEmail, password: auth.emptyPassword } },
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
      notify.success(feedback.session.loggedIn);

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
        <h1 className="auth-title">{auth.loginTitle}</h1>
        <p className="auth-subtitle">{auth.loginSubtitle}</p>
      </div>

      {hasRedirect && (
        <Alert variant="info" icon={<Info size={18} strokeWidth={2.5} />} className="mb-5">
          {auth.redirectNotice}
        </Alert>
      )}

      {formState.formError && (
        <Alert variant="error" className="mb-5">
          {formState.formError}
        </Alert>
      )}

      <form
        action={formAction}
        noValidate
        className="auth-form-stack"
        onFocus={() => void loadAuthValidation()}
      >
        <FormField label={auth.email} required error={formState.emailError ?? undefined}>
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

        <FormField label={auth.password} required error={formState.passwordError ?? undefined}>
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder={auth.passwordPlaceholder}
            autoComplete="current-password"
            value={values.password}
            onChange={(e) => setValues((prev) => ({ ...prev, password: e.target.value }))}
            leftIcon={<Lock size={18} strokeWidth={2.5} />}
            rightElement={<PasswordToggle show={showPassword} onToggle={setShowPassword} />}
            error={!!formState.passwordError}
          />
        </FormField>

        <SubmitButton className="mt-2 w-full">{auth.loginSubmit}</SubmitButton>
      </form>

      <div className="auth-switch">
        {auth.noAccount}
        <Link href="/register" className="auth-switch-link">
          {auth.registerNow}
        </Link>
      </div>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
