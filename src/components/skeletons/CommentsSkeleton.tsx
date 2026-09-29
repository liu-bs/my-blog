/**
 * @file CommentsSkeleton.tsx
 * @description 文章详情页评论区的首屏骨架：对应「评论区标题 + 发表框 + 评论卡片列表」三段结构
 */
import { BAR, line } from "@/components/skeletons/primitives";

/** 区块标题行，对应真实评论区的 section-title 行高 */
const TITLE_LINE = line("h-[27px]");
/** 评论作者名行，对应卡片头部昵称行 */
const NAME_LINE = line("h-[24px]");
/** 评论时间行，与昵称同在首行右侧 */
const TIME_LINE = line("h-[18px]");
/** 评论正文行，正文可能折行，故按行复用同一高度 */
const BODY_LINE = line("h-[24px]");

/**
 * CommentCardSkeleton 单条评论骨架
 * @returns 与真实评论卡片同构的「头像 + 昵称/时间 + 多行正文」占位
 */
export function CommentCardSkeleton() {
  return (
    <div className="row-md card p-4">
      {/* 头像占位，圆形与真实头像尺寸一致以免首屏落位偏移 */}
      <span className={`${BAR} h-9 w-9 shrink-0 rounded-full`} />

      <div className="min-w-0 flex-1">
        {/* 卡片头部：左侧昵称、右侧时间 */}
        <div className="mb-1.5 row-md">
          <span className={NAME_LINE}>
            <span className={`${BAR} block h-3.5 w-24 rounded-xs`} />
          </span>

          <span className={TIME_LINE}>
            <span className={`${BAR} block h-3 w-16 rounded-xs`} />
          </span>
        </div>

        {/* 正文占位：用两段不同宽度模拟真实文本折行，避免整块死板 */}
        <p className="text-(length:--type-sm) leading-normal text-body">
          <span className={BODY_LINE}>
            <span className={`${BAR} block h-3.5 w-full rounded-xs`} />
          </span>
          <span className={BODY_LINE}>
            <span className={`${BAR} block h-3.5 w-2/3 rounded-xs`} />
          </span>
        </p>
      </div>
    </div>
  );
}

/**
 * CommentsSkeleton 评论区骨架
 * @returns 评论区整体占位；仅渲染单张评论卡，因首屏通常只有少量评论
 */
export function CommentsSkeleton() {
  return (
    // aria-hidden 整体隐藏，避免读屏逐个读出无意义的占位元素
    <section className="mt-10 mb-12" aria-hidden="true">
      {/* 评论区标题占位 */}
      <h2 className="mb-6 section-title">
        <span className={TITLE_LINE}>
          <span className={`${BAR} block h-4 w-28 rounded-xs`} />
        </span>
      </h2>

      {/* 发表评论框占位：文本域 + 右下角提交按钮 */}
      <div className="mb-8">
        <span className={`${BAR} block h-[122px] w-full rounded-md`} />

        <div className="mt-4 flex justify-end">
          <span className={`${BAR} h-9 w-24 rounded-md`} />
        </div>
      </div>

      {/* 评论列表占位 */}
      <div className="card-list">
        <CommentCardSkeleton />
      </div>
    </section>
  );
}
