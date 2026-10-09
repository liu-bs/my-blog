/**
 * @file forms.ts
 * @description 注册/资料表单的字段级状态类型，供前端表单 Hook（如 useField 模式）统一管理
 *              每个受控字段的值、触碰状态与校验结果。
 */

/** 表单支持的字段标识：firstName-名 / username-用户名 / email-邮箱 / password-密码 */
export type FieldId = "firstName" | "username" | "email" | "password";

/**
 * 单个表单字段的受控状态
 */
export interface FieldState {
  /** 字段当前值，初始为空字符串 */
  value: string;

  /** 是否已被用户触碰（失焦后置 true，错误提示只在触碰后展示） */
  touched: boolean;

  /** 校验结果：true-通过 / false-失败 / null-尚未校验（初始态，不展示任何状态样式） */
  valid: boolean | null;

  /** 校验错误文案，无错误时为 null */
  error: string | null;
}
