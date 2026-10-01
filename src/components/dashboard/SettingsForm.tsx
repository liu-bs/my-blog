/**
 * @file SettingsForm.tsx
 * @description 账号设置页表单：内含「个人资料」与「修改密码」两个 Tab，各自独立维护状态与提交。
 * 资料表单提交成功后刷新全局用户信息（AuthProvider.refreshMe），使站内头像/昵称即时同步；
 * 改密表单提交成功后因服务端递增 tokenVersion 已使旧令牌失效，必须清空本地登录态并跳转登录页重新登录。
 * @warning 两个表单都通过 useActionState 绑定 Server Action，本文件不直接调用接口层
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

/** useActionState 返回的状态结构，仅承载表单级错误信息（字段错误另行用 state 保存） */
type FormError = { error: string | null };

/** 设置页的两个 Tab 标识 */
type SettingsTab = "profile" | "password";

/** Tab 固定顺序，供左右方向键漫游使用（模块级常量保证引用稳定） */
const SETTINGS_TABS: readonly SettingsTab[] = ["profile", "password"];

/** 改密表单需要做错误映射与重置的字段清单，顺序与表单字段展示顺序一致 */
const PWD_FIELDS: readonly ChangePasswordField[] = [
  "currentPassword",
  "newPassword",
  "confirmPassword",
];

/**
 * SettingsForm 账号设置表单
 * @description 无外部入参，用户数据来自 AuthProvider；资料与改密两个 Tab 的状态彼此独立，切换 Tab 不会丢失已填内容
 * @returns 包含 Tab 切换与两个表单的设置面板
 */
export function SettingsForm() {
  const router = useRouter();

  const t = useTranslations("settings");

  const tCommon = useTranslations("common");

  /** 全局登录态：user 用于回填表单，refreshMe 用于改资料后同步，setMe 用于改密后置空登录态 */
  const { user, refreshMe, setMe } = useAuth();

  /** 当前选中的 Tab */
  const [tab, setTab] = useState<SettingsTab>("profile");

  /** tablist 容器的键盘漫游：← → / Home / End 切换 tab 并同步选中面板 */
  const tabKeyNav = useTablistKeyboard(SETTINGS_TABS, setTab);

  /** 资料表单：名 */
  const [firstName, setFirstName] = useState("");

  /** 资料表单：姓 */
  const [lastName, setLastName] = useState("");

  /** 资料表单：头像地址 */
  const [avatar, setAvatar] = useState("");

  /** 资料表单：个人简介 */
  const [bio, setBio] = useState("");

  /** 资料表单：所在地 */
  const [location, setLocation] = useState("");

  /** 资料表单：个人网站 */
  const [website, setWebsite] = useState("");

  /** 改密表单：当前密码 */
  const [currentPwd, setCurrentPwd] = useState("");

  /** 改密表单：新密码 */
  const [newPwd, setNewPwd] = useState("");

  /** 改密表单：确认新密码 */
  const [confirmPwd, setConfirmPwd] = useState("");

  /** 当前密码是否明文可见 */
  const [showCurrent, setShowCurrent] = useState(false);

  /** 新密码是否明文可见 */
  const [showNew, setShowNew] = useState(false);

  /** 确认密码是否明文可见 */
  const [showConfirm, setShowConfirm] = useState(false);

  /** 资料表单的字段级错误 */
  const [profileErrors, setProfileErrors] = useState<FieldErrors<ProfileField>>({});

  /** 改密表单的字段级错误 */
  const [pwdErrors, setPwdErrors] = useState<FieldErrors<ChangePasswordField>>({});

  /** 记录 avatar/website 是否失焦过，用于「失焦后才对 URL 做实时校验」，避免用户输入途中就报错 */
  const [urlTouched, setUrlTouched] = useState<Partial<Record<"avatar" | "website", boolean>>>({});

  /** 登录用户就绪（或变更）时把资料字段回填到表单，保证首屏与服务端最新值一致 */
  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setAvatar(user.avatar ?? "");
    setBio(user.bio ?? "");
    setLocation(user.location ?? "");
    setWebsite(user.website ?? "");
  }, [user]);

  /** 资料提交失败的错误映射规则：错误落在已知字段上则就近提示，否则回退为通用表单提示 */
  const profileErrorRules: ErrorFeedbackOptions<ProfileField> = {
    fields: ["firstName", "lastName", "avatar", "bio", "location", "website"],
    fallback: msg("update", "failed", { entity: entityName("profile") }),
  };

  /** 改密提交失败的错误映射规则：401 表示当前密码错误，直接落到 currentPassword 字段而非表单级提示 */
  const pwdErrorRules: ErrorFeedbackOptions<ChangePasswordField> = {
    fields: PWD_FIELDS,
    fallback: msg("common", "actionFailed"),
    byStatus: {
      401: { fields: { currentPassword: t("pwdIncorrect") }, form: null },
    },
  };

  /** 资料表单的 action：收集 FormData → 调用 updateProfileAction → 成功后刷新全局用户信息 */
  const [profileState, profileAction] = useActionState<FormError, FormData>(
    async (_prev, formData) => {
      // 各字段去除首尾空白后组装为入参，空串交由服务端按「清空/未填」语义处理
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
        // 资料已更新，拉取最新用户信息以同步全站展示；刷新失败不影响「更新成功」这一事实，仅额外提示
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
   * 改密表单的 action：先本地校验三个密码字段的一致性，再调用 changePasswordAction
   * @description 校验含：当前密码必填、新密码长度、新旧密码不得相同、两次新密码必须一致；
   * 服务端改密成功后会递增 tokenVersion 使所有旧令牌失效，因此这里必须清空本地登录态并跳转登录页
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
      // 新旧密码相同与两次输入不一致都在本地拦截，减少无效请求
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

        // 改密使 tokenVersion 递增，旧 JWT 已全部失效，必须登出状态并引导重新登录
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

  /** 头像占位展示用的姓名首字母缩写 */
  const userInitials = getInitials(firstName, lastName);

  /** 去除空白后的头像地址，作为预览与校验的统一输入 */
  const avatarUrl = avatar.trim();

  /** 头像地址的实时校验结果（未失焦时仅备用，不直接展示） */
  const avatarLiveError = validateFieldValue(
    updateProfileSchema.shape.avatar,
    avatarUrl,
    t("avatarInvalid"),
  );
  /** 头像最终展示的错误：提交返回的字段错误优先，其次为失焦后的实时校验结果 */
  const avatarError = profileErrors.avatar ?? (urlTouched.avatar ? avatarLiveError : undefined);

  /** 个人网站的实时校验结果（未失焦时仅备用，不直接展示） */
  const websiteLiveError = validateFieldValue(
    updateProfileSchema.shape.website,
    website,
    t("websiteInvalid"),
  );
  /** 个人网站最终展示的错误：提交返回的字段错误优先，其次为失焦后的实时校验结果 */
  const websiteError = profileErrors.website ?? (urlTouched.website ? websiteLiveError : undefined);

  return (
    <div className="animate-fade-in">
      {/* 资料/改密切换分组 */}
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

      {/* 个人资料表单 */}
      {tab === "profile" && (
        <div
          role="tabpanel"
          id="settings-panel-profile"
          aria-labelledby="settings-tab-profile"
        >
          <form action={profileAction} noValidate className="form-stack">
          {/* 表单级错误（无法归入具体字段时的兜底提示） */}
          {profileState.error && (
            <Alert variant="error" icon={<Info size={16} strokeWidth={2.5} />} className="shake">
              {profileState.error}
            </Alert>
          )}

          {/* 头像预览 + 头像地址输入 */}
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
                    // 直接剔除所有空白字符，避免粘贴地址时混入换行/空格导致 404
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

          {/* 名 / 姓 并排 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t("firstName")} required error={profileErrors.firstName ?? undefined}>
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

          {/* 个人简介，含字数计数 */}
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
            {/* 简介字数实时统计，上限与服务端 280 字限制保持一致 */}
            <div className="mt-1 text-right meta-text">{bio.length} / 280</div>
          </FormField>

          {/* 所在地 / 个人网站 并排 */}
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

      {/* 修改密码表单 */}
      {tab === "password" && (
        <div
          role="tabpanel"
          id="settings-panel-password"
          aria-labelledby="settings-tab-password"
        >
          <form action={pwdAction} noValidate className="form-stack">
          {/* 表单级错误（无法归入具体字段时的兜底提示） */}
          {pwdState.error && (
            <Alert variant="error" icon={<Info size={16} strokeWidth={2.5} />} className="shake">
              {pwdState.error}
            </Alert>
          )}

          {/* 当前密码 */}
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

          {/* 新密码，附强度提示 */}
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

          {/* 确认新密码 */}
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
