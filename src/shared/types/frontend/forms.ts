/**
 * @file forms.ts
 * @description 前端表单状态类型：受控表单的字段标识与单个字段的运行时状态
 */

/** 注册/登录表单的字段标识 */
export type FieldId = "firstName" | "lastName" | "username" | "email" | "password";

/**
 * 单个表单字段的运行时状态
 */
export interface FieldState {
  /** 字段当前值 */
  value: string;

  /** 用户是否已触碰过该字段（失焦后才开始展示错误） */
  touched: boolean;

  /** 校验结果：true-通过 false-未通过 null-未校验 */
  valid: boolean | null;

  /** 校验错误文案，无错误时为 null */
  error: string | null;
}
