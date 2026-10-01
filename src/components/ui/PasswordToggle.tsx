/**
 * @file PasswordToggle.tsx
 * @description 密码明文/密文切换按钮：受控组件，show 由父组件管理，点击回调切换并同时更新 aria-label 与眼睛图标
 */
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * PasswordToggle 组件入参
 */
interface PasswordToggleProps {
  /** 当前是否明文显示密码 */
  show: boolean;

  /** 切换回调，参数为切换后的明文显示状态 */
  onToggle: (show: boolean) => void;
}

/**
 * PasswordToggle 密码可见切换
 * @param props {@link PasswordToggleProps} 受控的明文状态与切换回调
 */
export function PasswordToggle({ show, onToggle }: PasswordToggleProps) {
  const t = useTranslations("auth");
  return (
    <button
      type="button"
      onClick={() => onToggle(!show)}
      aria-label={show ? t("hidePassword") : t("showPassword")}
      className="pwd-toggle"
    >
      {show ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
    </button>
  );
}
