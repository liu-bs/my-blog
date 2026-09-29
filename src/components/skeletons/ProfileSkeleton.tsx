/**
 * @file ProfileSkeleton.tsx
 * @description 个人主页骨架：对应「左栏资料卡（封面带/头像/昵称/简介/元信息/统计/操作按钮） + 右栏分段标签与文章列表」
 */
import { Container } from "@/components/ui/Container";
import { BAR, line } from "@/components/skeletons/primitives";

/** 用户名行 */
const NAME_LINE = line("h-[25px]");
/** 元信息行（如加入时间） */
const META_LINE = line("h-[18px]");
/** 简介行 */
const BIO_LINE = line("h-[22.4px]");
/** 统计数值行 */
const STAT_VALUE_LINE = line("h-[38.4px]");
/** 统计标签行 */
const STAT_LABEL_LINE = line("h-[19.2px]");

/** 右栏卡片分类标签行 */
const CAT_LINE = line("h-[18px]");
/** 右栏卡片标题行 */
const TITLE_LINE = line("h-[27px]");
/** 右栏卡片摘要行 */
const SUMMARY_LINE = line("h-[24px]");
/** 「阅读更多」行 */
const MORE_LINE = line("h-[19.2px]");

/**
 * MetaRow 资料卡中的图标 + 文字元信息行骨架
 * @param props.w 文字占位宽度类，用于区分不同长度的元信息（如链接、位置）
 * @returns 小图标方块 + 文本条的横排占位
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
 * CardSkeleton 右栏文章卡片骨架
 * @returns 与个人主页文章卡片同构的横向「封面 + 分类/标题/摘要/元信息/更多」占位
 */
function CardSkeleton() {
  return (
    <div className="card p-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* 封面：移动端 16:10、桌面端固宽 */}
        <div className={`${BAR} aspect-16/10 w-full shrink-0 rounded-md sm:aspect-auto sm:w-50`} />
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
          {/* 作者头像与时间/阅读/点赞元信息 */}
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
 * ProfileSkeleton 个人主页骨架
 * @returns 左栏粘性资料卡 + 右栏分段筛选与卡片列表
 */
export function ProfileSkeleton() {
  return (
    <Container className="page-section">
      {/* 两栏栅格：桌面端固定 300px 资料栏 + 自适应内容栏 */}
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[300px_1fr]" aria-hidden="true">
        <aside>
          <div className="sticky-below-nav">
            <section className="overflow-hidden card shadow-(--shadow-sm)">
              {/* 资料卡顶部封面带 */}
              <div className="h-24 w-full profile-cover-band" />

              <div className="px-6 pb-7">
                {/* 头像：负上移与真实卡片一样压在封面带上 */}
                <div className="-mt-5">
                  <span className={`${BAR} block h-14 w-14 rounded-full border-4 border-card-bg`} />
                </div>

                {/* 昵称 + 元信息 */}
                <div className="mt-5">
                  <span className={NAME_LINE}>
                    <span className={`${BAR} block h-5 w-32 rounded-xs`} />
                  </span>
                  <span className={`${META_LINE} mt-1`}>
                    <span className={`${BAR} block h-3 w-20 rounded-xs`} />
                  </span>
                </div>

                {/* 简介两行 */}
                <div className="mt-4">
                  <span className={BIO_LINE}>
                    <span className={`${BAR} block h-3.5 w-full rounded-xs`} />
                  </span>
                  <span className={BIO_LINE}>
                    <span className={`${BAR} block h-3.5 w-4/5 rounded-xs`} />
                  </span>
                </div>

                {/* 元信息列表：位置/链接等，宽度错落 */}
                <div className="mt-5 space-y-2">
                  <MetaRow w="w-28" />
                  <MetaRow w="w-36" />
                  <MetaRow w="w-28" />
                  <MetaRow w="w-24" />
                </div>

                {/* 统计区：文章/点赞/收藏三项 */}
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

                {/* 资料卡底部两个操作按钮 */}
                <div className="mt-6 row-md">
                  <span className={`${BAR} h-9 flex-1 rounded-md`} />
                  <span className={`${BAR} h-9 flex-1 rounded-md`} />
                </div>
              </div>
            </section>
          </div>
        </aside>

        <div className="min-w-0">
          {/* 分段选项卡：文章/收藏等，首项为选中态 */}
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

          {/* 文章卡片列表 */}
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
