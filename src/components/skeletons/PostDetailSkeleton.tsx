/**
 * @file PostDetailSkeleton.tsx
 * @description 文章详情页骨架：对应「正文列（返回/分类/标题/作者/封面/正文/标签/互动/评论） + 右侧目录」两栏结构
 */
import { Container } from "@/components/ui/Container";
import { BAR } from "@/components/skeletons/primitives";

/** 正文段落的行宽序列，每组代表一个自然段的多行文本，用不等宽模拟真实换行 */
const PARAGRAPHS = [
  ["w-full", "w-full", "w-11/12", "w-full", "w-3/5"],
  ["w-full", "w-5/6", "w-full", "w-2/3"],
];

/**
 * PostDetailSkeleton 文章详情页骨架
 * @returns 正文与目录两栏的占位；窄屏下目录列隐藏，与真实页面对齐
 */
export function PostDetailSkeleton() {
  return (
    <Container className="page-section">
      {/* 两栏栅格，整体对辅助技术隐藏 */}
      <div
        className="grid grid-cols-1 gap-10 pb-12 max-lg:gap-0 max-lg:pb-8 lg:grid-cols-[1fr_220px]"
        aria-hidden="true"
      >
        <article>
          {/* 顶部「返回列表」入口 */}
          <span className={`${BAR} mb-6 block h-4 w-20 rounded-xs`} />

          {/* 文章头部：分类徽章、标题两行、摘要、作者信息、标签/操作条 */}
          <header className="mb-10">
            <div className="mb-5 row-sm">
              <span className={`${BAR} h-6 w-20 rounded-full`} />
            </div>

            <span className={`${BAR} block h-9 w-full rounded-md`} />
            <span className={`${BAR} mt-3 block h-9 w-3/4 rounded-md`} />

            <div className="mt-5 space-y-2.5">
              <span className={`${BAR} block h-4 w-full rounded-xs`} />
              <span className={`${BAR} block h-4 w-2/5 rounded-xs`} />
            </div>

            <div className="mt-8 row-lg flex-wrap border-t border-stroke pt-6">
              {/* 作者头像 + 昵称/时间 */}
              <div className="flex items-center gap-3 max-md:gap-2.5">
                <span className={`${BAR} h-10 w-10 shrink-0 rounded-full`} />
                <div className="flex flex-col gap-1.5">
                  <span className={`${BAR} h-4 w-24 rounded-xs`} />
                  <span className={`${BAR} h-3 w-36 rounded-xs`} />
                </div>
              </div>
              {/* 阅读量/点赞/评论等元信息 */}
              <div className="row-md">
                <span className={`${BAR} h-4 w-12 rounded-xs`} />
                <span className={`${BAR} h-4 w-12 rounded-xs`} />
                <span className={`${BAR} h-4 w-12 rounded-xs`} />
              </div>
            </div>

            <span className={`${BAR} mt-6 block h-9 w-44 rounded-md`} />
          </header>

          {/* 封面图占位：桌面端 21:9、移动端 16:9 */}
          <div className={`${BAR} mb-10 aspect-21/9 w-full rounded-2xl max-md:aspect-16/9`} />

          <div className="space-y-8">
            {/* 正文段落 */}
            {PARAGRAPHS.map((lines, i) => (
              <div key={i} className="space-y-3">
                {lines.map((width, j) => (
                  <span key={j} className={`${BAR} block h-4 rounded-xs ${width}`} />
                ))}
              </div>
            ))}

            {/* 标签行 */}
            <div className="flex flex-wrap gap-2 border-t border-stroke pt-8">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`${BAR} h-6 w-16 rounded-full`} />
              ))}
            </div>

            {/* 点赞/收藏等互动按钮条 */}
            <div className="row-lg flex-wrap border-t border-b border-stroke py-8">
              <span className={`${BAR} h-11 w-28 rounded-full`} />
              <span className={`${BAR} h-11 w-28 rounded-full`} />
              <span className={`${BAR} h-4 w-20 rounded-xs`} />
            </div>

            {/* 评论区列表占位 */}
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

        {/* 右侧目录：窄屏隐藏，与真实页面一致 */}
        <aside className="max-lg:hidden">
          <div className="sticky-below-nav space-y-3">
            {/* 目录标题 + 各级条目，条目宽度按层级错落 */}
            <span className={`${BAR} block h-3 w-16 rounded-xs`} />
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
