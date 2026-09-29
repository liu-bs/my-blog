/**
 * @file primitives.ts
 * @description 骨架屏复用的原子样式常量与工厂函数：各页面骨架都由「占位条 + 精确行高容器」两层组合而成，
 * 把这两层抽到这里是为了让所有骨架共用同一套高亮动画与行高基准，从而与真实排版逐行对齐、避免加载切换时抖动
 */

/** 骨架占位条的基础样式：底色 + 呼吸动画。所有骨架块都以它打底 */
export const BAR = "bg-skeleton animate-pulse";

/**
 * 生成「预留指定行高」的行容器样式
 * @param h 行高对应的任意 Tailwind 高度类（如 h-[27px]），应为真实文本的行盒高度
 * @returns 固定高度且垂直居中的 flex 行样式
 * @description 高度写成任意值而非语义类，是为了与真实文本的 line-height 逐像素对齐，补偿占位条自身的视觉高度
 */
export const line = (h: string) => `flex ${h} items-center`;

/** 页面标题行：对应 page-title 的行盒高度，移动端切换为更矮的行高 */
export const PAGE_TITLE_LINE = line("h-[37.5px] max-md:h-[30px]");

/** 页面副标题行：对应 page-subtitle 的行盒高度 */
export const PAGE_SUBTITLE_LINE = line("h-[27.2px]");
