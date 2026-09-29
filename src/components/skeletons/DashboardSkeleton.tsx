/**
 * @file DashboardSkeleton.tsx
 * @description 用户中心（profile / settings / write）的鉴权等待骨架：AuthGate 在客户端校验登录态期间展示，
 * 用「页头 + 表单堆叠」的通用结构兜住这些受保护页面的首屏
 */
import { Container } from "@/components/ui/Container";
import { BAR, PAGE_SUBTITLE_LINE, PAGE_TITLE_LINE } from "@/components/skeletons/primitives";

/**
 * DashboardSkeleton 用户中心通用骨架
 * @returns 页面标题 + 副标题 + 三段表单行占位
 */
export function DashboardSkeleton() {
  return (
    <Container className="page-section">
      {/* 整块对辅助技术隐藏，等待态语义由外层路由/鉴权逻辑表达 */}
      <div aria-hidden="true">
        {/* 页头：主标题与副标题，与真实页面的 page-header 结构一致 */}
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

        {/* 表单区占位：两个单行输入 + 一个多行文本域 */}
        <div className="form-stack">
          <span className={`${BAR} block h-9 w-full rounded-md`} />
          <span className={`${BAR} block h-9 w-full rounded-md`} />
          <span className={`${BAR} block h-24 w-full rounded-md`} />
        </div>
      </div>
    </Container>
  );
}
