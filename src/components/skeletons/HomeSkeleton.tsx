/**
 * @file HomeSkeleton.tsx
 * @description 首页路由级骨架：对应「Hero 区（文案 + 代码窗口） + 文章卡片网格」两段结构，
 * 高度与真实排版对齐，使首页数据到达后不发生明显位移
 */
import { Container } from "@/components/ui/Container";
import { BAR, line } from "@/components/skeletons/primitives";

/** Hero 区 eyebrow 小标题行 */
const HERO_KICKER_LINE = line("h-[22.4px]");

/** Hero 主标题行，对应 h1 的大字号行盒 */
const HERO_HEADLINE_LINE = line("h-[69.12px]");

/** Hero 引导段落行 */
const HERO_LEAD_LINE = line("h-[30.6px]");

/** 代码窗口内每一行的高度 */
const CODE_LINE = line("h-[23.8px]");

/** 卡片分类标签行 */
const CAT_LINE = line("h-[18px]");
/** 卡片标题行 */
const TITLE_LINE = line("h-[27px]");
/** 卡片摘要行 */
const SUMMARY_LINE = line("h-[24px]");
/** 卡片作者/时间等元信息行 */
const META_LINE = line("h-[18px]");

/** 代码窗口各行的缩进与宽度序列，用交替缩进模拟真实代码块的层次感 */
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

/**
 * HomeCardSkeleton 首页文章卡片骨架
 * @returns 与首页文章卡片同构的「封面 + 分类 + 标题 + 摘要 + 作者行」占位
 */
function HomeCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex h-full flex-col gap-4">
        {/* 封面占位：保持 16:10，与真实封面比例一致 */}
        <div className={`${BAR} aspect-16/10 w-full shrink-0 rounded-md`} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* 分类标签行 */}
          <div className="row-sm">
            <span className={CAT_LINE}>
              <span className={`${BAR} block h-3 w-16 rounded-xs`} />
            </span>
          </div>

          {/* 标题占位，沿用真实标题的行数限制样式 */}
          <h2 className="line-clamp-2 section-title tracking-[-0.01em]">
            <span className={TITLE_LINE}>
              <span className={`${BAR} block h-4 w-4/5 rounded-xs`} />
            </span>
          </h2>

          {/* 摘要占位 */}
          <p className="line-clamp-2 text-(length:--type-sm) leading-normal text-body">
            <span className={SUMMARY_LINE}>
              <span className={`${BAR} block h-3.5 w-full rounded-xs`} />
            </span>
          </p>

          {/* 底部作者行：小头像 + 昵称，mt-auto 使其贴底，与真实卡片一致 */}
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
 * HomeSkeleton 首页骨架
 * @returns Hero 区与文章卡片网格的整体占位
 */
export function HomeSkeleton() {
  return (
    // 整体对辅助技术隐藏
    <div aria-hidden="true">
      {/* Hero 区：左侧文案、右侧代码窗口，栅格比例与真实 Hero 对齐 */}
      <section className="hero-section">
        <Container>
          <div className="grid grid-cols-1 items-center gap-(--space-10) max-lg:gap-10 lg:grid-cols-[1fr_480px]">
            <div className="max-w-152 max-lg:max-w-none">
              {/* eyebrow：圆点 + 小标题 */}
              <div className="m-0 mb-8 row-sm flex">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full hero-dot" />
                <span className={HERO_KICKER_LINE}>
                  <span className={`${BAR} block h-3 w-36 rounded-xs`} />
                </span>
              </div>

              {/* 主标题：上行 kicker、下行大标题 */}
              <h1 className="m-0 mb-8">
                <span className="hero-kicker">
                  <span className={line("h-[12px]")}>
                    <span className={`${BAR} block h-3 w-24 rounded-xs`} />
                  </span>
                </span>

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

              {/* 双主按钮占位 */}
              <div className="flex flex-wrap items-center gap-5">
                <span className={`${BAR} h-10 w-28 rounded-md`} />
                <span className={`${BAR} h-10 w-28 rounded-md`} />
              </div>
            </div>

            {/* 代码窗口：标题栏（三色圆点 + 文件名）+ 若干代码行 */}
            <div className="hero-code-window overflow-hidden">
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

              {/* 代码行：按 CODE_LINES 的宽度/缩进逐行铺开 */}
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

      {/* 文章列表区：区块标题 + 操作按钮 + 三列卡片网格 */}
      <section className="page-section">
        <Container>
          <div className="page-header flex items-end justify-between gap-4">
            <div>
              {/* 区块标题与副标题 */}
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

            {/* 右侧「查看全部」类按钮占位 */}
            <span className={`${BAR} h-8 w-20 shrink-0 rounded-md`} />
          </div>

          {/* 卡片网格：固定 6 张以撑满首屏常见密度 */}
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
