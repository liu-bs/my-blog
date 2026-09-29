/**
 * @file PasswordToggle.tsx
 * @description 密码可见性切换按钮，配合受控的密码输入框使用
 */
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * PasswordToggle 组件入参
 */
interface PasswordToggleProps {
  /** 当前是否明文显示密码，由调用方受控维护 */
  show: boolean;

  /** 切换回调，参数为切换后的目标状态（非事件对象） */
  onToggle: (show: boolean) => void;
}

/**
 * PasswordToggle 密码可见性切换
 * @param props {@link PasswordToggleProps}
 * @returns 一个纯受控的图标按钮：明文中显示 EyeOff，隐藏时显示 Eye
 * @warning 自身不持有状态，show 与 onToggle 必须由父级成对提供
 */
export function PasswordToggle({ show, onToggle }: PasswordToggleProps) {
  const t = useTranslations("auth");
  return (
    // type="button" 避免在表单内意外触发提交；aria-label 随状态切换以告知读屏当前动作
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
