/**
 * @file PostsListSkeleton.tsx
 * @description 文章列表页整页加载骨架屏：在页面容器内组合「页头标题 + 列表主体」
 * @usage 仅静态占位，无交互；列表主体复用 PostsBodySkeleton，本页只负责外层页头
 */
import { Container } from "@/components/ui/Container";
import { BAR, PAGE_SUBTITLE_LINE, PAGE_TITLE_LINE } from "@/components/skeletons/primitives";
import { PostsBodySkeleton } from "@/components/skeletons/PostsBodySkeleton";

/**
 * 文章列表页整页骨架屏
 * @returns 含页头与列表主体的占位树
 */
export function PostsListSkeleton() {
  return (
    <Container className="page-section">
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

        {/* 列表主体（侧栏 + 卡片列表） */}
        <PostsBodySkeleton />
      </div>
    </Container>
  );
}
