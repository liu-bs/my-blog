/**
 * @file PostSidebarSkeleton.tsx
 * @description 文章列表页侧栏加载骨架屏：还原「分类筛选列表 + 标签云」两组筛选块，仅大屏可见
 * @usage 仅静态占位，无交互；由 PostsBodySkeleton 组合嵌入主内容左侧
 */
import { BAR, line } from "@/components/skeletons/primitives";

/** 分类筛选条目文本占位行 */
const FILTER_LINE = line("h-[22.4px]");

/**
 * 文章列表侧栏骨架屏
 * @returns 含分类列表与标签云的占位树（lg 断点以上显示）
 */
export function PostSidebarSkeleton() {
  return (
    <aside className="hidden w-65 shrink-0 lg:block">
      <div className="sticky-below-nav content-stack-lg">
        {/* 分类筛选块：标题 + 四条分类项 */}
        <div>
          <h3 className="mb-3 filter-heading">
            <span className={line("h-[19.2px]")}>
              <span className={`${BAR} block h-3 w-10 rounded-xs`} />
            </span>
          </h3>

          <ul className="space-y-1">
            {[0, 1, 2, 3].map((i) => (
              <li key={i}>
                <span className="flex w-full items-center rounded-md px-3 py-2 text-(length:--type-xs) font-medium">
                  <span className={FILTER_LINE}>
                    <span className={`${BAR} block h-3.5 w-16 rounded-xs`} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* 标签云块：标题 + 三枚标签徽章 */}
        <div className="mt-8">
          <h3 className="mb-3 filter-heading">
            <span className={line("h-[19.2px]")}>
              <span className={`${BAR} block h-3 w-8 rounded-xs`} />
            </span>
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="badge-lg">
                <span className={`${BAR} block h-4 ${["w-12", "w-16", "w-10"][i]} rounded-full`} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
