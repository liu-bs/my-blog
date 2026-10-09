/**
 * @file CommentsSkeleton.tsx
 * @description 文章评论区加载骨架屏：还原「评论输入框 + 评论列表」布局，用于评论数据未就绪时的占位
 * @usage 仅静态占位，无交互；整棵子树以 aria-hidden 屏蔽辅助技术读取
 */
import { BAR, line } from "@/components/skeletons/primitives";

/** 评论区标题占位行 */
const TITLE_LINE = line("h-[27px]");

/** 单条评论昵称占位行 */
const NAME_LINE = line("h-[24px]");

/** 单条评论时间占位行 */
const TIME_LINE = line("h-[18px]");

/** 单条评论正文占位行 */
const BODY_LINE = line("h-[24px]");

/**
 * 单条评论卡片骨架（头像 + 昵称/时间 + 两行正文）
 * @returns 评论条目占位节点
 */
export function CommentCardSkeleton() {
  return (
    <div className="row-md card p-4">
      {/* 评论者圆形头像 */}
      <span className={`${BAR} h-9 w-9 shrink-0 rounded-full`} />

      {/* 昵称时间与正文列 */}
      <div className="min-w-0 flex-1">
        {/* 昵称 + 时间头部行 */}
        <div className="mb-1.5 row-md">
          <span className={NAME_LINE}>
            <span className={`${BAR} block h-3.5 w-24 rounded-xs`} />
          </span>

          <span className={TIME_LINE}>
            <span className={`${BAR} block h-3 w-16 rounded-xs`} />
          </span>
        </div>

        {/* 评论正文两行（次行较短模拟自然断行） */}
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
 * 评论区整体骨架屏（标题 + 输入框 + 单条示例评论）
 * @returns 评论区占位树
 */
export function CommentsSkeleton() {
  return (
    <section className="mt-10 mb-12" aria-hidden="true">
      {/* 区块标题 */}
      <h2 className="mb-6 section-title">
        <span className={TITLE_LINE}>
          <span className={`${BAR} block h-4 w-28 rounded-xs`} />
        </span>
      </h2>

      {/* 评论输入区（多行文本框 + 右侧提交按钮） */}
      <div className="mb-8">
        <span className={`${BAR} block h-[122px] w-full rounded-md`} />

        <div className="mt-4 flex justify-end">
          <span className={`${BAR} h-9 w-24 rounded-md`} />
        </div>
      </div>

      {/* 评论列表（示例渲染一条占位） */}
      <div className="card-list">
        <CommentCardSkeleton />
      </div>
    </section>
  );
}
