/**
 * @file PostSidebarSkeleton.tsx
 * @description 文章列表页左侧筛选栏骨架：对应「分类列表 + 标签云」两组筛选区，窄屏隐藏与真实侧栏一致
 */
import { BAR, line } from "@/components/skeletons/primitives";

/** 分类条目行，对应侧栏筛选链接的行高 */
const FILTER_LINE = line("h-[22.4px]");

/**
 * PostSidebarSkeleton 文章筛选侧栏骨架
 * @returns 分类与标签两段占位；lg 以下隐藏，与真实侧栏的响应式行为保持一致
 */
export function PostSidebarSkeleton() {
  return (
    <aside className="hidden w-65 shrink-0 lg:block">
      <div className="sticky-below-nav content-stack-lg">
        {/* 分类分组：标题 + 4 条分类项 */}
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

        {/* 标签分组：标题 + 3 个不同宽度的标签胶囊 */}
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
