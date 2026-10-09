/**
 * @file PostsBodySkeleton.tsx
 * @description 文章列表主体加载骨架屏：还原「侧栏 + 工具栏（排序/搜索）+ 横向文章卡片列表」布局
 * @usage 仅静态占位，无交互；被 PostsListSkeleton 等页面骨架复用；内嵌 PostSidebarSkeleton
 */
import { BAR, line } from "@/components/skeletons/primitives";
import { PostSidebarSkeleton } from "@/components/skeletons/PostSidebarSkeleton";

/** 卡片分类标签占位行 */
const CAT_LINE = line("h-[18px]");

/** 卡片标题占位行 */
const TITLE_LINE = line("h-[27px]");

/** 卡片摘要占位行 */
const SUMMARY_LINE = line("h-[24px]");

/** 卡片「继续阅读」链接占位行 */
const MORE_LINE = line("h-[19.2px]");

/**
 * 单张横向文章卡片骨架（左侧封面 + 右侧分类/标题/摘要/标签/元信息）
 * @returns 卡片占位节点
 */
function CardSkeleton() {
  return (
    <div className="card p-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* 封面图占位 */}
        <div className={`${BAR} aspect-16/10 w-full shrink-0 rounded-md sm:aspect-auto sm:w-50`} />

        {/* 卡片文本信息列 */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* 分类标签行 */}
          <div className="row-sm">
            <span className={CAT_LINE}>
              <span className={`${BAR} block h-3 w-12 rounded-xs`} />
            </span>
          </div>

          {/* 文章标题行 */}
          <h2 className="line-clamp-2 section-title tracking-[-0.01em]">
            <span className={TITLE_LINE}>
              <span className={`${BAR} block h-4 w-3/5 rounded-xs`} />
            </span>
          </h2>

          {/* 文章摘要两行 */}
          <p className="line-clamp-2 text-(length:--type-sm) leading-normal text-body sm:line-clamp-3">
            <span className={SUMMARY_LINE}>
              <span className={`${BAR} block h-3.5 w-full rounded-xs`} />
            </span>
            <span className={SUMMARY_LINE}>
              <span className={`${BAR} block h-3.5 w-4/5 rounded-xs`} />
            </span>
          </p>

          {/* 标签徽章组 */}
          <div className="flex flex-wrap gap-2">
            <span className={`${BAR} h-[22px] w-14 rounded-full`} />
            <span className={`${BAR} h-[22px] w-12 rounded-full`} />
          </div>

          {/* 底部元信息行（头像 + 作者/时间/阅读等，用圆点分隔） */}
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

          {/* 继续阅读链接 */}
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
 * 文章列表主体骨架屏（侧栏 + 工具栏 + 三张卡片）
 * @returns 含筛选侧栏与卡片列表的占位树
 */
export function PostsBodySkeleton() {
  return (
    <div aria-hidden="true">
      {/* 移动端筛选按钮（大屏隐藏） */}
      <div className="mb-5 flex lg:hidden">
        <span className={`${BAR} h-8 w-24 rounded-md`} />
      </div>

      {/* 双列：侧栏 + 主内容 */}
      <div className="flex gap-12 max-lg:flex-col">
        <PostSidebarSkeleton />

        {/* 主内容列 */}
        <div className="min-w-0 flex-1">
          {/* 工具栏：结果计数 + 搜索框 */}
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

          {/* 文章卡片列表：渲染三张占位卡 */}
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
