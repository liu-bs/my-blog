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

const initialField: FieldState = { value: "", touched: false, valid: null, error: null };

interface RegisterState {

  error: string | null;
}

const initialState: RegisterState = { error: null };

const fieldOrder: readonly FieldId[] = ["firstName", "username", "email", "password"];

const fieldSchemas = {
  firstName: registerSchema.shape.firstName,
  username: registerSchema.shape.username,
  email: registerSchema.shape.email,
  password: registerSchema.shape.password,
};

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
    firstName: messages.auth.errNameLength,
    username: messages.auth.errUsername,
    email: messages.auth.invalidEmail,
    password: messages.auth.errPassword,
  };

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

  const registerErrorRules: ErrorFeedbackOptions<FieldId> = {
    fields: fieldOrder,
    fallback: messages.feedback.session.registerFailed,
    byStatus: {
      409: { fields: {}, form: messages.auth.duplicateAccount },
    },
  };

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

  const renderStatusIcon = (id: FieldId) => {
    const f = fields[id];
    if (f.valid === false) {
      return <X size={16} className="text-state-error" strokeWidth={3} />;
    }
    return null;
  };

  return (
    <div className="auth-card">

      <div className="mb-10">
        <h1 className="auth-title">{messages.auth.registerTitle}</h1>
        <p className="auth-subtitle">{messages.auth.registerSubtitle}</p>
      </div>

      {formState.error && (
        <Alert variant="error" className="mb-4">
          {formState.error}
        </Alert>
      )}

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

          <PasswordStrength password={fields.password.value} />
        </FormField>

        <SubmitButton className="mt-2 w-full">{messages.auth.registerSubmit}</SubmitButton>
      </form>

      <div className="auth-switch">
        {messages.auth.hasAccount}
        <Link href="/login" className="auth-switch-link">
          {messages.auth.loginNow}
        </Link>
      </div>
    </div>
  );
}
