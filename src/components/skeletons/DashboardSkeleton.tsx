/**
 * @file DashboardSkeleton.tsx
 * @description 后台通用页加载骨架屏：还原「页面标题/副标题 + 表单字段组」布局
 * @usage 仅静态占位，无交互；表单区以三条输入占位代表典型后台编辑页
 */
import { Container } from "@/components/ui/Container";
import { BAR, PAGE_SUBTITLE_LINE, PAGE_TITLE_LINE } from "@/components/skeletons/primitives";

/**
 * 后台通用页骨架屏
 * @returns 含页头与表单占位的容器树
 */
export function DashboardSkeleton() {
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
                <span className={`${BAR} block h-3.5 w-64 rounded-xs`} />
              </span>
            </span>
          </div>
        </header>

        {/* 表单字段组：两个单行输入 + 一个多行文本域 */}
        <div className="form-stack">
          <span className={`${BAR} block h-9 w-full rounded-md`} />
          <span className={`${BAR} block h-9 w-full rounded-md`} />
          <span className={`${BAR} block h-24 w-full rounded-md`} />
        </div>
      </div>
    </Container>
  );
}
