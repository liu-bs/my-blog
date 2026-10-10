"use client";

import { useActionState, useState, useEffect } from "react";
import { formatTemplate, messages } from "@/texts";
import { useRouter } from "next/navigation";
import { MapPin, Globe, Info, Check, Lock, Image as ImageIcon, User } from "lucide-react";
import { PasswordToggle } from "@/components/ui/PasswordToggle";
import { entityName } from "@/lib/message";
import { notify } from "@/lib/toast";
import {
  actionFailure,
  focusFirstInvalid,
  resolveSubmitError,
  validateFieldValue,
  type ErrorFeedbackOptions,
  type FieldErrors,
} from "@/lib/formFeedback";
import { Avatar } from "@/components/ui/Avatar";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { useAuth } from "@/components/AuthProvider";
import { useTablistKeyboard } from "@/hooks/useTablistKeyboard";
import { clearAuthStatus } from "@/lib/authStatus";
import { updateProfileAction, changePasswordAction } from "@server/auth/auth.controller";
import { getInitials, joinName, splitName } from "@shared/format";
import { changePasswordFieldsSchema, updateProfileSchema } from "@/shared/validation/auth";
import type { ChangePasswordField, ProfileField } from "@shared";

type FormError = { error: string | null };

type SettingsTab = "profile" | "password";

const SETTINGS_TABS: readonly SettingsTab[] = ["profile", "password"];

const PWD_FIELDS: readonly ChangePasswordField[] = [
  "currentPassword",
  "newPassword",
  "confirmPassword",
];

export function SettingsForm() {

  const router = useRouter();

  const { user, refreshMe, setMe } = useAuth();

  const [tab, setTab] = useState<SettingsTab>("profile");

  const tabKeyNav = useTablistKeyboard(SETTINGS_TABS, setTab);

  const [displayName, setDisplayName] = useState("");

  const [avatar, setAvatar] = useState("");

  const [bio, setBio] = useState("");

  const [location, setLocation] = useState("");

  const [website, setWebsite] = useState("");

  const [currentPwd, setCurrentPwd] = useState("");

  const [newPwd, setNewPwd] = useState("");

  const [confirmPwd, setConfirmPwd] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);

  const [showNew, setShowNew] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);

  const [profileErrors, setProfileErrors] = useState<FieldErrors<ProfileField>>({});

  const [pwdErrors, setPwdErrors] = useState<FieldErrors<ChangePasswordField>>({});

  const [urlTouched, setUrlTouched] = useState<Partial<Record<"avatar" | "website", boolean>>>({});

  useEffect(() => {
    if (!user) return;
    setDisplayName(joinName(user.firstName, user.lastName));
    setAvatar(user.avatar ?? "");
    setBio(user.bio ?? "");
    setLocation(user.location ?? "");
    setWebsite(user.website ?? "");
  }, [user]);

  const profileErrorRules: ErrorFeedbackOptions<ProfileField> = {
    fields: ["firstName", "avatar", "bio", "location", "website"],
    fallback: formatTemplate(messages.feedback.update.failed, { entity: entityName("profile") }),
  };

  const pwdErrorRules: ErrorFeedbackOptions<ChangePasswordField> = {
    fields: PWD_FIELDS,
    fallback: messages.feedback.common.actionFailed,
    byStatus: {
      401: { fields: { currentPassword: messages.settings.pwdIncorrect }, form: null },
    },
  };

  const [profileState, profileAction] = useActionState<FormError, FormData>(
    async (_prev, formData) => {
      const displayName = (formData.get("displayName") as string)?.trim() ?? "";
      const { firstName, lastName } = splitName(displayName);
      const profile = {
        firstName,
        lastName,
        avatar: (formData.get("avatar") as string)?.trim() ?? "",
        bio: (formData.get("bio") as string)?.trim() ?? "",
        location: (formData.get("location") as string)?.trim() ?? "",
        website: (formData.get("website") as string)?.trim() ?? "",
      };
      try {
        const result = await updateProfileAction(profile);
        if (!result.ok) {
          const failed = resolveSubmitError(actionFailure(result), profileErrorRules);
          setProfileErrors(failed.fields);
          focusFirstInvalid();
          return { error: failed.form };
        }

        try {
          await refreshMe();
        } catch (err) {
          notify.error(err, messages.common.operationFailed);
        }
        setProfileErrors({});
        notify.updated("profile");
        return { error: null };
      } catch (err) {
        const failed = resolveSubmitError(err, profileErrorRules);
        setProfileErrors(failed.fields);
        focusFirstInvalid();
        return { error: failed.form };
      }
    },
    { error: null },
  );

  const [pwdState, pwdAction] = useActionState<FormError, FormData>(
    async (_prev, formData) => {
      const currentPassword = (formData.get("currentPwd") as string) ?? "";
      const newPassword = (formData.get("newPwd") as string) ?? "";
      const confirmPassword = (formData.get("confirmPwd") as string) ?? "";

      const errors: FieldErrors<ChangePasswordField> = {};
      const currentError = validateFieldValue(
        changePasswordFieldsSchema.shape.currentPassword,
        currentPassword,
        messages.settings.pwdRequired,
      );
      if (currentError) errors.currentPassword = currentError;

      const lengthError = validateFieldValue(
        changePasswordFieldsSchema.shape.newPassword,
        newPassword,
        messages.settings.pwdTooShort,
      );
      if (lengthError) errors.newPassword = lengthError;

      if (newPassword && newPassword === currentPassword)
        errors.newPassword = messages.settings.pwdSame;
      if (newPassword !== confirmPassword) errors.confirmPassword = messages.settings.pwdMismatch;

      if (Object.keys(errors).length > 0) {
        setPwdErrors(errors);
        focusFirstInvalid();
        return { error: null };
      }
      setPwdErrors({});

      try {
        const result = await changePasswordAction({ currentPassword, newPassword });
        if (!result.ok) {
          const failed = resolveSubmitError(actionFailure(result), pwdErrorRules);
          setPwdErrors(failed.fields);
          focusFirstInvalid();
          return { error: failed.form };
        }

        setMe(null);
        clearAuthStatus();
        notify.success(messages.feedback.session.passwordChanged);

        router.replace("/login");
        return { error: null };
      } catch (err) {
        const failed = resolveSubmitError(err, pwdErrorRules);
        setPwdErrors(failed.fields);
        focusFirstInvalid();
        return { error: failed.form };
      }
    },
    { error: null },
  );

  const nameParts = splitName(displayName);

  const userInitials = getInitials(nameParts.firstName, nameParts.lastName);

  const avatarUrl = avatar.trim();

  const avatarLiveError = validateFieldValue(
    updateProfileSchema.shape.avatar,
    avatarUrl,
    messages.settings.avatarInvalid,
  );

  const avatarError = profileErrors.avatar ?? (urlTouched.avatar ? avatarLiveError : undefined);

  const websiteLiveError = validateFieldValue(
    updateProfileSchema.shape.website,
    website,
    messages.settings.websiteInvalid,
  );

  const websiteError = profileErrors.website ?? (urlTouched.website ? websiteLiveError : undefined);

  return (
    <div className="animate-fade-in">

      <div className="mb-8 segmented" role="tablist" onKeyDown={tabKeyNav}>
        <button
          type="button"
          id="settings-tab-profile"
          data-tab="profile"
          role="tab"
          aria-selected={tab === "profile"}
          aria-controls="settings-panel-profile"
          tabIndex={tab === "profile" ? 0 : -1}
          onClick={() => setTab("profile")}
          className={`segmented-item ${tab === "profile" ? "segmented-item-on" : ""}`}
        >
          {messages.settings.tabProfile}
        </button>
        <button
          type="button"
          id="settings-tab-password"
          data-tab="password"
          role="tab"
          aria-selected={tab === "password"}
          aria-controls="settings-panel-password"
          tabIndex={tab === "password" ? 0 : -1}
          onClick={() => setTab("password")}
          className={`segmented-item ${tab === "password" ? "segmented-item-on" : ""}`}
        >
          {messages.settings.tabPassword}
        </button>
      </div>

      {tab === "profile" && (
        <div role="tabpanel" id="settings-panel-profile" aria-labelledby="settings-tab-profile">
          <form action={profileAction} noValidate className="form-stack">

            {profileState.error && (
              <Alert variant="error" icon={<Info size={16} strokeWidth={2.5} />} className="shake">
                {profileState.error}
              </Alert>
            )}

            <div className="flex items-center gap-6">
              <Avatar
                initials={userInitials}
                src={avatarUrl && !avatarError ? avatarUrl : undefined}
                size="lg"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <FormField
                  label={messages.settings.avatarUrl}
                  hint={messages.settings.avatarHint}
                  error={avatarError ?? undefined}
                >
                  <Input
                    id="avatar"
                    name="avatar"
                    type="text"
                    value={avatar}
                    onChange={(e) => {
                      setAvatar(e.target.value.replace(/\s+/g, ""));
                      if (profileErrors.avatar)
                        setProfileErrors((prev) => ({ ...prev, avatar: undefined }));
                    }}
                    onFocus={() => setUrlTouched((prev) => ({ ...prev, avatar: false }))}
                    onBlur={() => setUrlTouched((prev) => ({ ...prev, avatar: true }))}
                    maxLength={500}
                    error={!!avatarError}
                    leftIcon={<ImageIcon size={18} strokeWidth={2.5} />}
                    placeholder="https://example.com/avatar.jpg"
                  />
                </FormField>
              </div>
            </div>

            <FormField
              label={messages.settings.firstName}
              required
              error={profileErrors.firstName ?? undefined}
            >
              <Input
                id="displayName"
                name="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                error={!!profileErrors.firstName}
                leftIcon={<User size={18} strokeWidth={2.5} />}
              />
            </FormField>

            <FormField label={messages.settings.bio} error={profileErrors.bio ?? undefined}>
              <textarea
                id="bio"
                name="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                rows={4}
                aria-invalid={!!profileErrors.bio}
                className="input-focus textarea-field"
              />

              <div className="mt-1 text-right meta-text">{bio.length} / 280</div>
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label={messages.settings.location}
                hint={messages.common.optional}
                error={profileErrors.location ?? undefined}
              >
                <Input
                  id="location"
                  name="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={100}
                  error={!!profileErrors.location}
                  leftIcon={<MapPin size={18} strokeWidth={2.5} />}
                />
              </FormField>
              <FormField
                label={messages.settings.website}
                hint={messages.common.optional}
                error={websiteError ?? undefined}
              >
                <Input
                  id="website"
                  name="website"
                  type="text"
                  value={website}
                  onChange={(e) => {
                    setWebsite(e.target.value);
                    if (profileErrors.website)
                      setProfileErrors((prev) => ({ ...prev, website: undefined }));
                  }}
                  onBlur={() => setUrlTouched((prev) => ({ ...prev, website: true }))}
                  maxLength={200}
                  error={!!websiteError}
                  leftIcon={<Globe size={18} strokeWidth={2.5} />}
                />
              </FormField>
            </div>

            <div className="flex justify-end pt-4">
              <SubmitButton>
                <Check size={16} strokeWidth={2.5} />
                {messages.settings.saveChanges}
              </SubmitButton>
            </div>
          </form>
        </div>
      )}

      {tab === "password" && (
        <div role="tabpanel" id="settings-panel-password" aria-labelledby="settings-tab-password">
          <form action={pwdAction} noValidate className="form-stack">

            {pwdState.error && (
              <Alert variant="error" icon={<Info size={16} strokeWidth={2.5} />} className="shake">
                {pwdState.error}
              </Alert>
            )}

            <FormField
              label={messages.settings.currentPwd}
              required
              error={pwdErrors.currentPassword ?? undefined}
            >
              <Input
                id="currentPwd"
                name="currentPwd"
                type={showCurrent ? "text" : "password"}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                autoComplete="current-password"
                error={!!pwdErrors.currentPassword}
                leftIcon={<Lock size={18} strokeWidth={2.5} />}
                rightElement={<PasswordToggle show={showCurrent} onToggle={setShowCurrent} />}
              />
            </FormField>

            <FormField
              label={messages.settings.newPwd}
              hint={messages.settings.newPwdHint}
              required
              error={pwdErrors.newPassword ?? undefined}
            >
              <Input
                id="newPwd"
                name="newPwd"
                type={showNew ? "text" : "password"}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoComplete="new-password"
                error={!!pwdErrors.newPassword}
                leftIcon={<Lock size={18} strokeWidth={2.5} />}
                rightElement={<PasswordToggle show={showNew} onToggle={setShowNew} />}
              />
              <PasswordStrength password={newPwd} />
            </FormField>

            <FormField
              label={messages.settings.confirmPwd}
              required
              error={pwdErrors.confirmPassword ?? undefined}
            >
              <Input
                id="confirmPwd"
                name="confirmPwd"
                type={showConfirm ? "text" : "password"}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                autoComplete="new-password"
                error={!!pwdErrors.confirmPassword}
                leftIcon={<Lock size={18} strokeWidth={2.5} />}
                rightElement={<PasswordToggle show={showConfirm} onToggle={setShowConfirm} />}
              />
            </FormField>

            <div className="flex justify-end pt-4">
              <SubmitButton>
                <Check size={16} strokeWidth={2.5} />
                {messages.settings.updatePwd}
              </SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
