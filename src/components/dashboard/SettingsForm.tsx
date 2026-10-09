/**
 * @file SettingsForm.tsx
 * @description 账户设置表单：在「个人资料 / 修改密码」两标签间切换，基于 useActionState 提交，含字段实时校验、错误回填与焦点定位
 * @usage 客户端组件；依赖 useAuth 读取当前用户并回填资料；改密成功后清空登录态并跳转登录页
 */
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

/** useActionState 统一返回形状：表单级错误消息 */
type FormError = { error: string | null };

/** 设置页标签标识 */
type SettingsTab = "profile" | "password";

/** 标签顺序，供键盘左右切换按此序列移动焦点 */
const SETTINGS_TABS: readonly SettingsTab[] = ["profile", "password"];

/** 改密表单涉及的字段名，用于错误回填规则 */
const PWD_FIELDS: readonly ChangePasswordField[] = [
  "currentPassword",
  "newPassword",
  "confirmPassword",
];

/**
 * 账户设置表单
 * @returns 含标签切换、资料表单与改密表单的视图
 */
export function SettingsForm() {
  /** Next 路由实例，改密成功后用于跳转 */
  const router = useRouter();

  /** 当前登录用户与刷新/设置本地用户态的方法 */
  const { user, refreshMe, setMe } = useAuth();

  /** 当前激活的设置标签 */
  const [tab, setTab] = useState<SettingsTab>("profile");

  /** tablist 键盘导航事件处理器（方向键切换 tab） */
  const tabKeyNav = useTablistKeyboard(SETTINGS_TABS, setTab);

  /** 资料：显示名（内部会拆分为名/姓） */
  const [displayName, setDisplayName] = useState("");

  /** 资料：头像 URL */
  const [avatar, setAvatar] = useState("");

  /** 资料：个人简介 */
  const [bio, setBio] = useState("");

  /** 资料：所在地 */
  const [location, setLocation] = useState("");

  /** 资料：个人网站 */
  const [website, setWebsite] = useState("");

  /** 改密：当前密码 */
  const [currentPwd, setCurrentPwd] = useState("");

  /** 改密：新密码 */
  const [newPwd, setNewPwd] = useState("");

  /** 改密：确认新密码 */
  const [confirmPwd, setConfirmPwd] = useState("");

  /** 是否明文显示当前密码 */
  const [showCurrent, setShowCurrent] = useState(false);

  /** 是否明文显示新密码 */
  const [showNew, setShowNew] = useState(false);

  /** 是否明文显示确认密码 */
  const [showConfirm, setShowConfirm] = useState(false);

  /** 资料表单各字段的错误信息 */
  const [profileErrors, setProfileErrors] = useState<FieldErrors<ProfileField>>({});

  /** 改密表单各字段的错误信息 */
  const [pwdErrors, setPwdErrors] = useState<FieldErrors<ChangePasswordField>>({});

  /** 头像/网站 URL 是否已失焦（失焦后才展示本地实时校验错误） */
  const [urlTouched, setUrlTouched] = useState<Partial<Record<"avatar" | "website", boolean>>>({});

  /**
   * 用户数据就绪后，将现有资料回填到各表单字段
   */
  useEffect(() => {
    if (!user) return;
    setDisplayName(joinName(user.firstName, user.lastName));
    setAvatar(user.avatar ?? "");
    setBio(user.bio ?? "");
    setLocation(user.location ?? "");
    setWebsite(user.website ?? "");
  }, [user]);

  /** 资料提交错误映射规则：可回填字段与兜底文案 */
  const profileErrorRules: ErrorFeedbackOptions<ProfileField> = {
    fields: ["firstName", "avatar", "bio", "location", "website"],
    fallback: formatTemplate(messages.feedback.update.failed, { entity: entityName("profile") }),
  };

  /** 改密提交错误映射规则：401 时定向提示当前密码错误 */
  const pwdErrorRules: ErrorFeedbackOptions<ChangePasswordField> = {
    fields: PWD_FIELDS,
    fallback: messages.feedback.common.actionFailed,
    byStatus: {
      401: { fields: { currentPassword: messages.settings.pwdIncorrect }, form: null },
    },
  };

  /**
   * 资料更新 action：拆分显示名为名/姓后调用 updateProfileAction，
   * 成功刷新本地用户态并提示，失败按规则回填字段错误并定位首个无效项
   */
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

  /**
   * 修改密码 action：先本地校验三字段（必填/长度/新旧不同/两次一致），通过后调用后端；
   * 成功则清空登录态并跳转登录页，失败按状态码回填字段错误
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

  /** 由当前显示名拆分出的名/姓，用于生成头像首字母 */
  const nameParts = splitName(displayName);

  /** 头像占位首字母 */
  const userInitials = getInitials(nameParts.firstName, nameParts.lastName);

  /** 去除空白后的头像地址 */
  const avatarUrl = avatar.trim();

  /** 头像地址的实时校验错误（失焦前不展示） */
  const avatarLiveError = validateFieldValue(
    updateProfileSchema.shape.avatar,
    avatarUrl,
    messages.settings.avatarInvalid,
  );

  /** 头像最终展示错误：后端回填优先，否则失焦后取本地校验 */
  const avatarError = profileErrors.avatar ?? (urlTouched.avatar ? avatarLiveError : undefined);

  /** 网站地址的实时校验错误 */
  const websiteLiveError = validateFieldValue(
    updateProfileSchema.shape.website,
    website,
    messages.settings.websiteInvalid,
  );

  /** 网站最终展示错误：后端回填优先，否则失焦后取本地校验 */
  const websiteError = profileErrors.website ?? (urlTouched.website ? websiteLiveError : undefined);

  return (
    <div className="animate-fade-in">
      {/* 标签切换栏（tablist）：个人资料 / 修改密码 */}
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

      {/* 「个人资料」面板：头像/显示名/简介/位置/网站编辑与保存 */}
      {tab === "profile" && (
        <div role="tabpanel" id="settings-panel-profile" aria-labelledby="settings-tab-profile">
          <form action={profileAction} noValidate className="form-stack">
            {/* 表单级错误提示 */}
            {profileState.error && (
              <Alert variant="error" icon={<Info size={16} strokeWidth={2.5} />} className="shake">
                {profileState.error}
              </Alert>
            )}

            {/* 头像预览 + 头像 URL 输入行 */}
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

            {/* 显示名字段（必填） */}
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

            {/* 个人简介多行文本域（含字数计数） */}
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

            {/* 位置 / 网站 两列并排 */}
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

            {/* 保存按钮（右对齐） */}
            <div className="flex justify-end pt-4">
              <SubmitButton>
                <Check size={16} strokeWidth={2.5} />
                {messages.settings.saveChanges}
              </SubmitButton>
            </div>
          </form>
        </div>
      )}

      {/* 「修改密码」面板：当前密码/新密码/确认密码，成功后登出并跳转 */}
      {tab === "password" && (
        <div role="tabpanel" id="settings-panel-password" aria-labelledby="settings-tab-password">
          <form action={pwdAction} noValidate className="form-stack">
            {/* 表单级错误提示 */}
            {pwdState.error && (
              <Alert variant="error" icon={<Info size={16} strokeWidth={2.5} />} className="shake">
                {pwdState.error}
              </Alert>
            )}

            {/* 当前密码字段（含显隐切换） */}
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

            {/* 新密码字段（含密码强度条与显隐切换） */}
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

            {/* 确认新密码字段 */}
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

            {/* 更新密码按钮（右对齐） */}
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
