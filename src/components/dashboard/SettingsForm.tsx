/**
 * @file SettingsForm.tsx
 * @description 账号设置页：个人资料/修改密码双 Tab（键盘方向键可切换，role=tablist）。
 *              资料表单经 Server Action 更新后 refreshMe 同步全局用户（服务端同步评论作者名与文章 authorName）；
 *              密码表单本地校验（必填/长度/新旧相同/两次一致）后调 Server Action，
 *              成功后登出并跳转登录页要求重新认证
 */
"use client";

import { useActionState, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { MapPin, Globe, Info, Check, Lock, Image as ImageIcon } from "lucide-react";
import { PasswordToggle } from "@/components/ui/PasswordToggle";
import { entityName, msg } from "@/lib/message";
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
import { getInitials } from "@/lib/format";
import { changePasswordFieldsSchema, updateProfileSchema } from "@/shared/validation/auth";
import type { ChangePasswordField, ProfileField } from "@shared";

/** 表单级错误（非字段级），展示为顶部 Alert */
type FormError = { error: string | null };

/** 设置页 Tab 标识 */
type SettingsTab = "profile" | "password";

/** Tab 顺序（键盘导航用） */
const SETTINGS_TABS: readonly SettingsTab[] = ["profile", "password"];

/** 密码表单字段顺序（聚焦首个错误字段用） */
const PWD_FIELDS: readonly ChangePasswordField[] = [
  "currentPassword",
  "newPassword",
  "confirmPassword",
];

/**
 * SettingsForm 账号设置表单
 */
export function SettingsForm() {
  const router = useRouter();

  const t = useTranslations("settings");

  const tCommon = useTranslations("common");

  /** 全局登录用户与刷新方法（保存资料后同步 Header 等处的用户信息） */
  const { user, refreshMe, setMe } = useAuth();

  /** 当前激活 Tab */
  const [tab, setTab] = useState<SettingsTab>("profile");

  /** tablist 键盘导航（左右方向键切换） */
  const tabKeyNav = useTablistKeyboard(SETTINGS_TABS, setTab);

  /** 名字 */
  const [firstName, setFirstName] = useState("");

  /** 姓氏 */
  const [lastName, setLastName] = useState("");

  /** 头像 URL */
  const [avatar, setAvatar] = useState("");

  /** 个人简介 */
  const [bio, setBio] = useState("");

  /** 所在地 */
  const [location, setLocation] = useState("");

  /** 个人网站 */
  const [website, setWebsite] = useState("");

  /** 当前密码 */
  const [currentPwd, setCurrentPwd] = useState("");

  /** 新密码 */
  const [newPwd, setNewPwd] = useState("");

  /** 确认新密码 */
  const [confirmPwd, setConfirmPwd] = useState("");

  /** 当前密码可见性 */
  const [showCurrent, setShowCurrent] = useState(false);

  /** 新密码可见性 */
  const [showNew, setShowNew] = useState(false);

  /** 确认密码可见性 */
  const [showConfirm, setShowConfirm] = useState(false);

  /** 资料表单字段错误 */
  const [profileErrors, setProfileErrors] = useState<FieldErrors<ProfileField>>({});

  /** 密码表单字段错误 */
  const [pwdErrors, setPwdErrors] = useState<FieldErrors<ChangePasswordField>>({});

  /** URL 类字段（头像/网站）是否失焦过：失焦后才做实时校验，避免输入中途报错 */
  const [urlTouched, setUrlTouched] = useState<Partial<Record<"avatar" | "website", boolean>>>({});

  /** 登录用户数据就绪/变化时回填资料表单 */
  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setAvatar(user.avatar ?? "");
    setBio(user.bio ?? "");
    setLocation(user.location ?? "");
    setWebsite(user.website ?? "");
  }, [user]);

  /** 资料提交错误解析规则 */
  const profileErrorRules: ErrorFeedbackOptions<ProfileField> = {
    fields: ["firstName", "lastName", "avatar", "bio", "location", "website"],
    fallback: msg("update", "failed", { entity: entityName("profile") }),
  };

  /** 密码提交错误解析规则：401 映射为"当前密码不正确"字段错误 */
  const pwdErrorRules: ErrorFeedbackOptions<ChangePasswordField> = {
    fields: PWD_FIELDS,
    fallback: msg("common", "actionFailed"),
    byStatus: {
      401: { fields: { currentPassword: t("pwdIncorrect") }, form: null },
    },
  };

  /**
   * 资料保存 Server Action：服务端校验并更新资料，
   * 成功后 refreshMe 拉取最新用户（服务端会同步更新历史评论的作者名与文章 authorName），
   * 失败解析字段错误并聚焦首个错误项
   */
  const [profileState, profileAction] = useActionState<FormError, FormData>(
    async (_prev, formData) => {
      const profile = {
        firstName: (formData.get("firstName") as string)?.trim() ?? "",
        lastName: (formData.get("lastName") as string)?.trim() ?? "",
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
        } catch {
          notify.error(new Error("operationFailed"));
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

  /**
   * 修改密码 Server Action：先本地校验（必填/最短长度/新旧不能相同/两次输入一致），
   * 通过后调服务端改密；成功后清空全局用户与本地登录态缓存，跳转登录页强制重新登录
   */
  const [pwdState, pwdAction] = useActionState<FormError, FormData>(
    async (_prev, formData) => {
      const currentPassword = (formData.get("currentPwd") as string) ?? "";
      const newPassword = (formData.get("newPwd") as string) ?? "";
      const confirmPassword = (formData.get("confirmPwd") as string) ?? "";

      const errors: FieldErrors<ChangePasswordField> = {};
      const currentError = validateFieldValue(
        changePasswordFieldsSchema.shape.currentPassword,
        currentPassword,
        t("pwdRequired"),
      );
      if (currentError) errors.currentPassword = currentError;

      const lengthError = validateFieldValue(
        changePasswordFieldsSchema.shape.newPassword,
        newPassword,
        t("pwdTooShort"),
      );
      if (lengthError) errors.newPassword = lengthError;

      if (newPassword && newPassword === currentPassword) errors.newPassword = t("pwdSame");
      if (newPassword !== confirmPassword) errors.confirmPassword = t("pwdMismatch");

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
        notify.success(msg("session", "passwordChanged"));

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

  /** 用户名首字母缩写，用于头像兜底展示 */
  const userInitials = getInitials(firstName, lastName);

  const avatarUrl = avatar.trim();

  /** 头像 URL 实时校验结果 */
  const avatarLiveError = validateFieldValue(
    updateProfileSchema.shape.avatar,
    avatarUrl,
    t("avatarInvalid"),
  );

  /** 头像错误：优先提交错误，其次失焦后的实时校验错误 */
  const avatarError = profileErrors.avatar ?? (urlTouched.avatar ? avatarLiveError : undefined);

  /** 网站 URL 实时校验结果 */
  const websiteLiveError = validateFieldValue(
    updateProfileSchema.shape.website,
    website,
    t("websiteInvalid"),
  );

  /** 网站错误：优先提交错误，其次失焦后的实时校验错误 */
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
          {t("tabProfile")}
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
          {t("tabPassword")}
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
                  label={t("avatarUrl")}
                  hint={t("avatarHint")}
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label={t("firstName")}
                required
                error={profileErrors.firstName ?? undefined}
              >
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={50}
                  error={!!profileErrors.firstName}
                />
              </FormField>
              <FormField label={t("lastName")} required error={profileErrors.lastName ?? undefined}>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={50}
                  error={!!profileErrors.lastName}
                />
              </FormField>
            </div>

            <FormField label={t("bio")} hint={t("bioHint")} error={profileErrors.bio ?? undefined}>
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
                label={t("location")}
                hint={tCommon("optional")}
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
                label={t("website")}
                hint={tCommon("optional")}
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
                {t("saveChanges")}
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
              label={t("currentPwd")}
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
              label={t("newPwd")}
              hint={t("newPwdHint")}
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
              label={t("confirmPwd")}
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
                {t("updatePwd")}
              </SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
