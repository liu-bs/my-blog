/**
 * @file primitives.ts
 * @description 骨架屏公共样式原语：统一的微光占位类名与行高容器构造器，供各页面骨架组件复用
 * @usage 仅用于加载态占位渲染，不含交互逻辑；新增骨架组件应优先复用此处常量以保持视觉一致
 */

/** 骨架微光占位基础类：统一背景色与脉冲动画 */
export const BAR = "bg-skeleton animate-pulse";

/**
 * 构造一行文本占位的容器类名（水平 flex + 指定行高 + 垂直居中）
 * @param h 行高相关的 Tailwind 尺寸类（如 "h-[27px]"）
 * @returns 组合后的 className 字符串
 */
export const line = (h: string) => `flex ${h} items-center`;

/** 页面主标题占位行容器（响应式行高，移动端略矮） */
export const PAGE_TITLE_LINE = line("h-[37.5px] max-md:h-[30px]");

/** 页面副标题占位行容器 */
export const PAGE_SUBTITLE_LINE = line("h-[27.2px]");
