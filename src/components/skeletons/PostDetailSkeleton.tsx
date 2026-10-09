/**
 * @file PostDetailSkeleton.tsx
 * @description 文章详情页加载骨架屏：还原「正文 + 侧栏目录」双列布局，含页头元信息、封面、正文段落、标签、互动栏与评论列表
 * @usage 仅静态占位，无交互；整棵子树以 aria-hidden 屏蔽辅助技术读取
 */
import { Container } from "@/components/ui/Container";
import { BAR } from "@/components/skeletons/primitives";

/** 正文段落占位：每个子数组是一段，内含若干行宽度类 */
const PARAGRAPHS = [
  ["w-full", "w-full", "w-11/12", "w-full", "w-3/5"],
  ["w-full", "w-5/6", "w-full", "w-2/3"],
];

/**
 * 文章详情页整体骨架屏
 * @returns 双列布局（正文 article + 侧栏 aside）的占位树
 */
export function PostDetailSkeleton() {
  return (
    <Container className="page-section">
      <div
        className="grid grid-cols-1 gap-10 pb-12 max-lg:gap-0 max-lg:pb-8 lg:grid-cols-[1fr_220px]"
        aria-hidden="true"
      >
        {/* 正文列 */}
        <article>
          {/* 面包屑/返回链接占位 */}
          <span className={`${BAR} mb-6 block h-4 w-20 rounded-xs`} />

          {/* 文章页头区 */}
          <header className="mb-10">
            {/* 分类徽章 */}
            <div className="mb-5 row-sm">
              <span className={`${BAR} h-6 w-20 rounded-full`} />
            </div>

            {/* 标题两行 */}
            <span className={`${BAR} block h-9 w-full rounded-md`} />
            <span className={`${BAR} mt-3 block h-9 w-3/4 rounded-md`} />

            {/* 发布时间等副信息 */}
            <div className="mt-5 space-y-2.5">
              <span className={`${BAR} block h-4 w-full rounded-xs`} />
              <span className={`${BAR} block h-4 w-2/5 rounded-xs`} />
            </div>

            {/* 作者信息行（头像+昵称）与右侧统计元信息 */}
            <div className="mt-8 row-lg flex-wrap border-t border-stroke pt-6">
              <div className="flex items-center gap-3 max-md:gap-2.5">
                <span className={`${BAR} h-10 w-10 shrink-0 rounded-full`} />
                <div className="flex flex-col gap-1.5">
                  <span className={`${BAR} h-4 w-24 rounded-xs`} />
                  <span className={`${BAR} h-3 w-36 rounded-xs`} />
                </div>
              </div>

              <div className="row-md">
                <span className={`${BAR} h-4 w-12 rounded-xs`} />
                <span className={`${BAR} h-4 w-12 rounded-xs`} />
                <span className={`${BAR} h-4 w-12 rounded-xs`} />
              </div>
            </div>

            {/* 页尾按钮（如关注/分享） */}
            <span className={`${BAR} mt-6 block h-9 w-44 rounded-md`} />
          </header>

          {/* 文章封面大图 */}
          <div className={`${BAR} mb-10 aspect-21/9 w-full rounded-2xl max-md:aspect-16/9`} />

          {/* 正文与互动区 */}
          <div className="space-y-8">
            {/* 正文段落：按 PARAGRAPHS 逐段逐行渲染 */}
            {PARAGRAPHS.map((lines, i) => (
              <div key={i} className="space-y-3">
                {lines.map((width, j) => (
                  <span key={j} className={`${BAR} block h-4 rounded-xs ${width}`} />
                ))}
              </div>
            ))}

            {/* 标签组 */}
            <div className="flex flex-wrap gap-2 border-t border-stroke pt-8">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`${BAR} h-6 w-16 rounded-full`} />
              ))}
            </div>

            {/* 互动按钮栏（点赞/收藏等） */}
            <div className="row-lg flex-wrap border-t border-b border-stroke py-8">
              <span className={`${BAR} h-11 w-28 rounded-full`} />
              <span className={`${BAR} h-11 w-28 rounded-full`} />
              <span className={`${BAR} h-4 w-20 rounded-xs`} />
            </div>

            {/* 评论列表（示例渲染三条） */}
            <div className="space-y-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <span className={`${BAR} h-9 w-9 shrink-0 rounded-full`} />
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <span className={`${BAR} block h-3.5 w-32 rounded-xs`} />
                    <span className={`${BAR} block h-3.5 w-full rounded-xs`} />
                    <span className={`${BAR} block h-3.5 w-1/2 rounded-xs`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* 侧栏目录（大屏可见，粘性定位） */}
        <aside className="max-lg:hidden">
          <div className="sticky-below-nav space-y-3">
            {/* 目录标题 */}
            <span className={`${BAR} block h-3 w-16 rounded-xs`} />
            {/* 目录条目列表：每第三行缩短模拟长短参差 */}
            <div className="space-y-2.5 border-l border-stroke pl-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={`${BAR} block h-3 rounded-xs ${i % 3 === 1 ? "w-4/5" : "w-full"}`}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Container>
  );
}
