/**
 * @file primitives.ts
 * @description 骨架屏基础原子：BAR 为脉冲背景条类名，line 生成行内垂直对齐容器，PAGE_TITLE_LINE/PAGE_SUBTITLE_LINE 为页头标题/副标题占位行，供各 skeleton 复用
 */
export const BAR = "bg-skeleton animate-pulse";

export const line = (h: string) => `flex ${h} items-center`;

export const PAGE_TITLE_LINE = line("h-[37.5px] max-md:h-[30px]");

export const PAGE_SUBTITLE_LINE = line("h-[27.2px]");
