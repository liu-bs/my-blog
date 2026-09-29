/**
 * @file PostsBodySkeleton.tsx
 * @description 文章列表页正文区骨架：对应「移动端筛选按钮 + 左侧筛选栏 + 右侧结果条与文章卡片列表」结构
 */
import { BAR, line } from "@/components/skeletons/primitives";
import { PostSidebarSkeleton } from "@/components/skeletons/PostSidebarSkeleton";

/** 卡片分类标签行 */
const CAT_LINE = line("h-[18px]");
/** 卡片标题行 */
const TITLE_LINE = line("h-[27px]");
/** 卡片摘要行 */
const SUMMARY_LINE = line("h-[24px]");
/** 「阅读更多」行 */
const MORE_LINE = line("h-[19.2px]");

/**
 * CardSkeleton 列表文章卡片骨架
 * @returns 与真实列表卡片同构的「横向封面 + 分类 + 标题 + 摘要 + 标签 + 元信息 + 更多」占位
 */
function CardSkeleton() {
  return (
    <div className="card p-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* 封面占位：移动端 16:10、桌面端固定宽度侧栏样式 */}
        <div className={`${BAR} aspect-16/10 w-full shrink-0 rounded-md sm:aspect-auto sm:w-50`} />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* 分类 */}
          <div className="row-sm">
            <span className={CAT_LINE}>
              <span className={`${BAR} block h-3 w-12 rounded-xs`} />
            </span>
          </div>

          {/* 标题：沿用真实标题的 line-clamp 样式 */}
          <h2 className="line-clamp-2 section-title tracking-[-0.01em]">
            <span className={TITLE_LINE}>
              <span className={`${BAR} block h-4 w-3/5 rounded-xs`} />
            </span>
          </h2>

          {/* 摘要：两行 */}
          <p className="line-clamp-2 text-(length:--type-sm) leading-normal text-body sm:line-clamp-3">
            <span className={SUMMARY_LINE}>
              <span className={`${BAR} block h-3.5 w-full rounded-xs`} />
            </span>
            <span className={SUMMARY_LINE}>
              <span className={`${BAR} block h-3.5 w-4/5 rounded-xs`} />
            </span>
          </p>

          {/* 标签胶囊 */}
          <div className="flex flex-wrap gap-2">
            <span className={`${BAR} h-[22px] w-14 rounded-full`} />
            <span className={`${BAR} h-[22px] w-12 rounded-full`} />
          </div>

          {/* 底部元信息：作者头像 + 时间/阅读/点赞，用 1px 圆点作分隔 */}
          <div className="mt-auto row-sm flex-wrap meta-text">
            <span className={`${BAR} h-5 w-5 shrink-0 rounded-full`} />
            <span className={line("h-[18px]")}>
              <span className={`${BAR} block h-3 w-20 rounded-xs`} />
            </span>
            <span className={`${BAR} size-1 shrink-0 rounded-full`} />
            <span className={line("h-[18px]")}>
              <span className={`${BAR} block h-3 w-16 rounded-xs`} />
            </span>
            <span className={`${BAR} size-1 shrink-0 rounded-full`} />
            <span className={line("h-[18px]")}>
              <span className={`${BAR} block h-3 w-10 rounded-xs`} />
            </span>
          </div>

          {/* 阅读更多 */}
          <span className="mt-2 inline-flex items-center gap-1 text-(length:--type-2xs) text-muted">
            <span className={MORE_LINE}>
              <span className={`${BAR} block h-3 w-14 rounded-xs`} />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * PostsBodySkeleton 文章列表正文区骨架
 * @returns 移动端筛选按钮、侧栏、结果条与三张卡片占位
 */
export function PostsBodySkeleton() {
  return (
    // 整体对辅助技术隐藏
    <div aria-hidden="true">
      {/* 窄屏下的筛选入口按钮 */}
      <div className="mb-5 flex lg:hidden">
        <span className={`${BAR} h-8 w-24 rounded-md`} />
      </div>

      <div className="flex gap-12 max-lg:flex-col">
        {/* 左侧筛选栏，复用文章筛选侧栏骨架 */}
        <PostSidebarSkeleton />

        <div className="min-w-0 flex-1">
          {/* 结果条：命中数量文案 + 排序/搜索控件 */}
          <div className="mb-6 page-actions">
            <p className="text-(length:--type-xs) leading-normal font-medium text-body">
              <span className={line("h-[21px]")}>
                <span className={`${BAR} block h-3.5 w-14 rounded-xs`} />
              </span>
            </p>

            <div className="row-md flex-wrap">
              <span className={`${BAR} h-10 w-50 shrink-0 rounded-md`} />
            </div>
          </div>

          {/* 文章卡片列表 */}
          <div className="card-list">
            {[0, 1, 2].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
