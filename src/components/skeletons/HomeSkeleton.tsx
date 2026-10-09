/**
 * @file HomeSkeleton.tsx
 * @description 首页加载骨架屏：还原「Hero 主视觉 + 文章卡片网格」布局，用于 SSR/数据未就绪时的占位
 * @usage 仅展示静态占位，无交互；整棵子树以 aria-hidden 屏蔽辅助技术读取
 */
import { Container } from "@/components/ui/Container";
import { BAR, line } from "@/components/skeletons/primitives";

/** Hero 区小标题（眉标）占位行 */
const HERO_KICKER_LINE = line("h-[22.4px]");

/** Hero 主标题占位行 */
const HERO_HEADLINE_LINE = line("h-[69.12px]");

/** Hero 引导段落占位行 */
const HERO_LEAD_LINE = line("h-[30.6px]");

/** Hero 代码窗口内的单行代码占位行 */
const CODE_LINE = line("h-[23.8px]");

/** 代码窗口每行代码的宽度类，模拟真实代码长短参差 */
const CODE_LINES = [
  "w-2/5",
  "ml-4 w-3/5",
  "ml-4 w-1/2",
  "ml-8 w-2/3",
  "ml-8 w-1/3",
  "ml-4 w-1/2",
  "w-2/5",
  "ml-4 w-1/2",
];

/** 卡片分类标签占位行 */
const CAT_LINE = line("h-[22.4px]");

/** 卡片标题占位行 */
const TITLE_LINE = line("h-[27px]");

/** 卡片摘要占位行 */
const SUMMARY_LINE = line("h-[24px]");

/** 卡片底部元信息占位行 */
const META_LINE = line("h-[18px]");

/**
 * 单张首页文章卡片骨架（封面 + 分类 + 标题 + 摘要 + 作者元信息）
 * @returns 卡片占位节点
 */
function HomeCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex h-full flex-col gap-4">
        {/* 卡片封面图占位 */}
        <div className={`${BAR} aspect-16/10 w-full shrink-0 rounded-md`} />

        {/* 卡片文本信息列 */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* 分类标签行 */}
          <div className="row-sm">
            <span className={CAT_LINE}>
              <span className={`${BAR} block h-3 w-16 rounded-xs`} />
            </span>
          </div>

          {/* 文章标题行 */}
          <h2 className="line-clamp-2 section-title tracking-[-0.01em]">
            <span className={TITLE_LINE}>
              <span className={`${BAR} block h-4 w-4/5 rounded-xs`} />
            </span>
          </h2>

          {/* 文章摘要行 */}
          <p className="line-clamp-2 text-(length:--type-sm) leading-normal text-body">
            <span className={SUMMARY_LINE}>
              <span className={`${BAR} block h-3.5 w-full rounded-xs`} />
            </span>
          </p>

          {/* 作者头像与元信息行（底部对齐） */}
          <div className="mt-auto flex items-center gap-2 meta-text">
            <span className={`${BAR} size-5 shrink-0 rounded-full`} />
            <span className={META_LINE}>
              <span className={`${BAR} block h-3 w-20 rounded-xs`} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 首页整体骨架屏
 * @returns 包含 Hero 区与文章卡网格的占位树
 */
export function HomeSkeleton() {
  return (
    <div aria-hidden="true">
      {/* Hero 主视觉区 */}
      <section className="hero-section">
        <Container>
          <div className="grid grid-cols-1 items-center gap-(--space-10) max-lg:gap-10 lg:grid-cols-[1fr_480px]">
            {/* Hero 左侧文案列 */}
            <div className="max-w-152 max-lg:max-w-none">
              {/* 眉标行（圆点 + 文本） */}
              <div className="m-0 mb-8 row-sm flex">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full hero-dot" />
                <span className={HERO_KICKER_LINE}>
                  <span className={`${BAR} block h-3 w-24 rounded-xs`} />
                </span>
              </div>

              {/* 主标题 */}
              <h1 className="m-0 mb-8">
                <span className="hero-headline text-heading">
                  <span className={HERO_HEADLINE_LINE}>
                    <span className={`${BAR} block h-10 w-4/5 rounded-md`} />
                  </span>
                </span>
              </h1>

              {/* 引导段落 */}
              <p className="m-0 mb-10 hero-lead text-body">
                <span className={HERO_LEAD_LINE}>
                  <span className={`${BAR} block h-4 w-full rounded-xs`} />
                </span>
              </p>

              {/* 底部操作按钮组占位 */}
              <div className="flex flex-wrap items-center gap-5 border-t border-stroke pt-8">
                <span className={`${BAR} h-10 w-28 rounded-md`} />
                <span className={`${BAR} h-10 w-28 rounded-md`} />
              </div>
            </div>

            {/* Hero 右侧装饰性代码窗口 */}
            <div className="hero-code-window overflow-hidden">
              {/* 代码窗口标题栏（红黄绿按钮 + 文件名） */}
              <div className="row-sm border-b border-stroke px-5 py-3.5 hero-titlebar">
                <span className="h-3 w-3 shrink-0 rounded-full hero-dot-close" />
                <span className="h-3 w-3 shrink-0 rounded-full hero-dot-minimize" />
                <span className="h-3 w-3 shrink-0 rounded-full hero-dot-maximize" />

                <span className="ml-auto">
                  <span className={CODE_LINE}>
                    <span className={`${BAR} block h-3 w-40 rounded-xs`} />
                  </span>
                </span>
              </div>

              {/* 代码窗口正文：按 CODE_LINES 宽度逐行渲染代码占位 */}
              <div className="px-6 py-5 max-md:px-4 max-md:py-4">
                {CODE_LINES.map((width, i) => (
                  <span key={i} className={CODE_LINE}>
                    <span className={`${BAR} block h-3 rounded-xs ${width}`} />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* 最新文章卡片区 */}
      <section className="page-section">
        <Container>
          {/* 区块头部（标题 + 说明 + 右侧按钮） */}
          <div className="page-header flex items-end justify-between gap-4">
            <div>
              <h2 className="section-title">
                <span className={TITLE_LINE}>
                  <span className={`${BAR} block h-4 w-28 rounded-xs`} />
                </span>
              </h2>

              <p className="mt-2 text-(length:--type-xs) leading-normal text-muted">
                <span className={line("h-[21px]")}>
                  <span className={`${BAR} block h-3.5 w-44 rounded-xs`} />
                </span>
              </p>
            </div>

            <span className={`${BAR} h-8 w-20 shrink-0 rounded-md`} />
          </div>

          {/* 文章卡片网格：固定渲染 6 张占位卡 */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <HomeCardSkeleton key={i} />
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}
