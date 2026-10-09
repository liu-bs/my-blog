/**
 * @file ProfileSkeleton.tsx
 * @description 个人主页加载骨架屏：还原「左侧用户资料卡（头像/简介/联系/统计/操作）+ 右侧标签页与文章卡列表」双列布局
 * @usage 仅静态占位，无交互；整棵子树以 aria-hidden 屏蔽辅助技术读取
 */
import { Container } from "@/components/ui/Container";
import { BAR, line } from "@/components/skeletons/primitives";

/** 用户昵称占位行 */
const NAME_LINE = line("h-[25px]");

/** 元信息条目占位行（图标+文本） */
const META_LINE = line("h-[18px]");

/** 个人简介段落占位行 */
const BIO_LINE = line("h-[22.4px]");

/** 统计项数值占位行 */
const STAT_VALUE_LINE = line("h-[38.4px]");

/** 统计项标签占位行 */
const STAT_LABEL_LINE = line("h-[19.2px]");

/** 文章卡分类标签占位行 */
const CAT_LINE = line("h-[18px]");

/** 文章卡标题占位行 */
const TITLE_LINE = line("h-[27px]");

/** 文章卡摘要占位行 */
const SUMMARY_LINE = line("h-[24px]");

/** 文章卡「继续阅读」占位行 */
const MORE_LINE = line("h-[19.2px]");

/**
 * 资料卡内单行元信息骨架（小图标 + 文本）
 * @param props.w 文本占位宽度类
 * @returns 元信息行占位节点
 */
function MetaRow({ w }: { w: string }) {
  return (
    <span className={`${META_LINE} gap-2`}>
      <span className={`${BAR} size-3.5 shrink-0 rounded-xs`} />
      <span className={`${BAR} block h-3 ${w} rounded-xs`} />
    </span>
  );
}

/**
 * 文章列表内单张横向卡片骨架
 * @returns 卡片占位节点
 */
function CardSkeleton() {
  return (
    <div className="card p-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* 封面图占位 */}
        <div className={`${BAR} aspect-16/10 w-full shrink-0 rounded-md sm:aspect-auto sm:w-50`} />
        {/* 文本信息列：分类/标题/摘要/元信息/继续阅读 */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <span className={CAT_LINE}>
            <span className={`${BAR} block h-3 w-10 rounded-xs`} />
          </span>
          <span className={TITLE_LINE}>
            <span className={`${BAR} block h-4 w-4/5 rounded-xs`} />
          </span>
          <span className={SUMMARY_LINE}>
            <span className={`${BAR} block h-3.5 w-full rounded-xs`} />
          </span>

          {/* 底部元信息行（头像圆点 + 文本） */}
          <div className="mt-auto row-sm h-5 flex-wrap meta-text">
            <span className={`${BAR} h-5 w-5 shrink-0 rounded-full`} />
            <span className={`${BAR} h-3 w-20 rounded-xs`} />
            <span className={`${BAR} h-3 w-16 rounded-xs`} />
            <span className={`${BAR} h-3 w-10 rounded-xs`} />
          </div>
          <span className={`${MORE_LINE} mt-2`}>
            <span className={`${BAR} block h-3 w-14 rounded-xs`} />
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * 个人主页整页骨架屏
 * @returns 双列（左侧资料卡 + 右侧标签页与文章列表）占位树
 */
export function ProfileSkeleton() {
  return (
    <Container className="page-section">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[300px_1fr]" aria-hidden="true">
        {/* 左侧用户资料卡 */}
        <aside>
          <div className="sticky-below-nav">
            <section className="overflow-hidden card shadow-(--shadow-sm)">
              {/* 封面色带 */}
              <div className="h-24 w-full profile-cover-band" />

              <div className="px-6 pb-7">
                {/* 头像（重叠于色带下方） */}
                <div className="-mt-5">
                  <span className={`${BAR} block h-14 w-14 rounded-full border-4 border-card-bg`} />
                </div>

                {/* 昵称 + 用户名 */}
                <div className="mt-5">
                  <span className={NAME_LINE}>
                    <span className={`${BAR} block h-5 w-32 rounded-xs`} />
                  </span>
                  <span className={`${META_LINE} mt-1`}>
                    <span className={`${BAR} block h-3 w-20 rounded-xs`} />
                  </span>
                </div>

                {/* 个人简介两行 */}
                <div className="mt-4">
                  <span className={BIO_LINE}>
                    <span className={`${BAR} block h-3.5 w-full rounded-xs`} />
                  </span>
                  <span className={BIO_LINE}>
                    <span className={`${BAR} block h-3.5 w-4/5 rounded-xs`} />
                  </span>
                </div>

                {/* 联系/位置等元信息行组 */}
                <div className="mt-5 space-y-2">
                  <MetaRow w="w-28" />
                  <MetaRow w="w-36" />
                  <MetaRow w="w-28" />
                  <MetaRow w="w-24" />
                </div>

                {/* 统计网格（数值 + 标签三列） */}
                <div className="mt-6 border-t border-stroke pt-6">
                  <div className="stats-grid">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="stat-item">
                        <span className={STAT_VALUE_LINE}>
                          <span className={`${BAR} block h-6 w-10 rounded-xs`} />
                        </span>
                        <span className={STAT_LABEL_LINE}>
                          <span className={`${BAR} block h-3 w-12 rounded-xs`} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 操作按钮组（撰写/编辑） */}
                <div className="mt-6 row-md">
                  <span className={`${BAR} h-9 flex-1 rounded-md`} />
                  <span className={`${BAR} h-9 flex-1 rounded-md`} />
                </div>
              </div>
            </section>
          </div>
        </aside>

        {/* 右侧内容区 */}
        <div className="min-w-0">
          {/* 分段切换标签页（三项，首项选中） */}
          <div className="segmented">
            <span className="segmented-item segmented-item-on">
              <span className={`${BAR} block h-[21px] w-13 rounded-xs`} />
            </span>
            <span className="segmented-item">
              <span className={`${BAR} block h-[21px] w-12 rounded-xs`} />
            </span>
            <span className="segmented-item">
              <span className={`${BAR} block h-[21px] w-12 rounded-xs`} />
            </span>
          </div>

          {/* 文章卡列表：渲染三张占位卡 */}
          <div className="mt-10 card-list">
            {[0, 1, 2].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}
