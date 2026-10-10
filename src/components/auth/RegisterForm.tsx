"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, UserPlus, X } from "lucide-react";
import auth from "@/texts/auth";
import feedback from "@/texts/feedback";
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
} from "@/lib/form-feedback";
import { registerAction } from "@server/auth/auth.controller";
import { loadAuthValidation, peekAuthValidation } from "@/lib/validation-loader";
import type { FieldId, FieldState } from "@shared";

const initialField: FieldState = { value: "", isTouched: false, isValid: null, error: null };

interface RegisterState {
  error: string | null;
}

const initialState: RegisterState = { error: null };

const fieldOrder: readonly FieldId[] = ["firstName", "username", "email", "password"];

export function RegisterForm() {
  const router = useRouter();

  const [fields, setFields] = useState<Record<FieldId, FieldState>>({
    firstName: { ...initialField },
    username: { ...initialField },
    email: { ...initialField },
    password: { ...initialField },
  });

  const [showPassword, setShowPassword] = useState(false);

  const fieldMessage: Record<FieldId, string> = {
    firstName: auth.errNameLength,
    username: auth.errUsername,
    email: auth.invalidEmail,
    password: auth.errPassword,
  };

  const updateField = (id: FieldId, value: string) => {
    const registerSchema = peekAuthValidation()?.registerSchema;

    setFields((prev) => {
      const next = { ...prev };
      if (value.length === 0) {
        next[id] = { value: "", isTouched: false, isValid: null, error: null };
      } else {
        const error = registerSchema
          ? validateFieldValue(registerSchema.shape[id], value, fieldMessage[id])
          : null;
        next[id] = { value, isTouched: true, isValid: error === null, error };
      }
      return next;
    });
  };

  const applyFieldErrors = (errors: FieldErrors<FieldId>) => {
    setFields((prev) => {
      const next = { ...prev };
      for (const id of fieldOrder) {
        const error = errors[id];
        if (error === undefined) continue;
        next[id] = { ...next[id], isTouched: true, isValid: false, error };
      }
      return next;
    });
  };

  const registerErrorRules: ErrorFeedbackOptions<FieldId> = {
    fields: fieldOrder,
    fallback: feedback.session.registerFailed,
    byStatus: {
      409: { fields: {}, form: auth.duplicateAccount },
    },
  };

  const [formState, formAction] = useActionState<RegisterState, FormData>(
    async (_prev, formData) => {
      const firstName = (formData.get("firstName") as string)?.trim() ?? "";
      const username = (formData.get("username") as string)?.trim() ?? "";
      const email = (formData.get("email") as string)?.trim() ?? "";
      const password = (formData.get("password") as string) ?? "";

      const { registerSchema } = await loadAuthValidation();

      const invalid = validateForm(
        registerSchema,
        { firstName, username, email, password },
        { fieldTexts: fieldMessage, knownFields: fieldOrder },
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
        notify.success(feedback.session.registered);

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

  const renderStatusIcon = (id: FieldId) => {
    const f = fields[id];
    if (f.isValid === false) {
      return <X size={16} className="text-state-error" strokeWidth={3} />;
    }
    return null;
  };

  return (
    <div className="auth-card">
      <div className="mb-10">
        <h1 className="auth-title">{auth.registerTitle}</h1>
        <p className="auth-subtitle">{auth.registerSubtitle}</p>
      </div>

      {formState.error && (
        <Alert variant="error" className="mb-4">
          {formState.error}
        </Alert>
      )}

      <form
        action={formAction}
        noValidate
        className="auth-form-stack"
        onFocus={() => void loadAuthValidation()}
      >
        <FormField label={auth.firstName} required error={fields.firstName.error ?? undefined}>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            placeholder={auth.firstNamePlaceholder}
            maxLength={50}
            autoComplete="nickname"
            value={fields.firstName.value}
            onChange={(e) => updateField("firstName", e.target.value)}
            leftIcon={<User size={18} strokeWidth={2.5} />}
            rightElement={<span>{renderStatusIcon("firstName")}</span>}
            error={fields.firstName.isValid === false}
          />
        </FormField>

        <FormField
          label={auth.username}
          required
          hint={auth.usernameHint}
          error={fields.username.error ?? undefined}
        >
          <Input
            id="username"
            name="username"
            type="text"
            placeholder={auth.usernamePlaceholder}
            maxLength={30}
            autoComplete="username"
            value={fields.username.value}
            onChange={(e) => updateField("username", e.target.value)}
            leftIcon={<UserPlus size={18} strokeWidth={2.5} />}
            rightElement={<span>{renderStatusIcon("username")}</span>}
            error={fields.username.isValid === false}
          />
        </FormField>

        <FormField label={auth.email} required error={fields.email.error ?? undefined}>
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
            error={fields.email.isValid === false}
          />
        </FormField>

        <FormField
          label={auth.password}
          required
          hint={auth.passwordHint}
          error={fields.password.error ?? undefined}
        >
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder={auth.passwordPlaceholderMin}
            autoComplete="new-password"
            value={fields.password.value}
            onChange={(e) => updateField("password", e.target.value)}
            leftIcon={<Lock size={18} strokeWidth={2.5} />}
            rightElement={<PasswordToggle show={showPassword} onToggle={setShowPassword} />}
            error={fields.password.isValid === false}
          />

          <PasswordStrength password={fields.password.value} />
        </FormField>

        <SubmitButton className="mt-2 w-full">{auth.registerSubmit}</SubmitButton>
      </form>

      <div className="auth-switch">
        {auth.hasAccount}
        <Link href="/login" className="auth-switch-link">
          {auth.loginNow}
        </Link>
      </div>
    </div>
  );
}
