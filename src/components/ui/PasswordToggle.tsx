/**
 * @file PasswordToggle.tsx
 * @description 密码显隐切换按钮，按当前显示状态切换 Eye/EyeOff 图标与无障碍标签；
 * 通常作为 Input 的 rightElement 嵌入登录、注册等密码输入框
 */
import { Eye, EyeOff } from "lucide-react";
import { messages } from "@/texts";

/** PasswordToggle 组件入参 */
interface PasswordToggleProps {
  /** 当前密码是否明文可见 */
  show: boolean;

  /** 点击切换回调，参数为切换后的目标显示状态 */
  onToggle: (show: boolean) => void;
}

/**
 * 密码显隐切换按钮
 * @param props {@link PasswordToggleProps}
 */
export function PasswordToggle({ show, onToggle }: PasswordToggleProps) {
  return (
    /* type=button 防止在 form 内误触发提交；点击后回传取反状态 */
    <button
      type="button"
      onClick={() => onToggle(!show)}
      aria-label={show ? messages.auth.hidePassword : messages.auth.showPassword}
      className="pwd-toggle"
    >
      {/* 可见时显示"划掉的眼睛"，隐藏时显示普通眼睛 */}
      {show ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
    </button>
  );
}
