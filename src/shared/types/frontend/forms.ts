/**
 * @file forms.ts
 * @description 客户端表单状态类型。用于注册等表单的前端即时校验反馈，
 *              只描述「单个字段的输入状态」，不含服务端返回的字段级错误（那部分见 ValidationErrorDetail）。
 */

/**
 * 注册表单可校验的字段名
 * @description 与注册表单实际渲染的输入项一一对应，供泛型化的字段状态管理复用
 */
export type FieldId = "firstName" | "lastName" | "username" | "email" | "password";

/**
 * 单个表单字段的即时状态
 * @description 驱动输入框的边框颜色与下方错误文案展示；`valid` 用三态而非布尔，
 *              是因为「用户尚未输入」时不应提前报错（null 表示未校验、不展示错误）
 */
export interface FieldState {
  /** 当前输入值 */
  value: string;

  /** 是否已被用户触碰（blur 过），未触碰时不展示校验错误以免打扰输入 */
  touched: boolean;

  /** 校验结果：true 通过、false 不通过、null 尚未校验（如输入为空） */
  valid: boolean | null;

  /** 错误文案，为空表示无错误 */
  error: string | null;
}
