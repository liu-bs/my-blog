/**
 * @file PostsListSkeleton.tsx
 * @description 文章列表页路由级骨架：页头（标题/副标题）加正文区，正文结构复用 PostsBodySkeleton
 */
import { Container } from "@/components/ui/Container";
import { BAR, PAGE_SUBTITLE_LINE, PAGE_TITLE_LINE } from "@/components/skeletons/primitives";
import { PostsBodySkeleton } from "@/components/skeletons/PostsBodySkeleton";

/**
 * PostsListSkeleton 文章列表页骨架
 * @returns 页面版心内的页头占位 + 列表正文骨架
 */
export function PostsListSkeleton() {
  return (
    <Container className="page-section">
      {/* 整体对辅助技术隐藏 */}
      <div aria-hidden="true">
        {/* 页头：主标题 + 副标题 */}
        <header className="page-header">
          <div>
            <span className="block page-title max-md:page-title-mobile">
              <span className={PAGE_TITLE_LINE}>
                <span className={`${BAR} block h-6 w-40 rounded-xs`} />
              </span>
            </span>

            <span className="page-subtitle block">
              <span className={PAGE_SUBTITLE_LINE}>
                <span className={`${BAR} block h-3.5 w-72 rounded-xs`} />
              </span>
            </span>
          </div>
        </header>

        {/* 列表正文骨架，与文章列表页共用 */}
        <PostsBodySkeleton />
      </div>
    </Container>
  );
}
