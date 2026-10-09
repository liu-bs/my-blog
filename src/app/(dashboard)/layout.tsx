/**
 * @file layout.tsx
 * @description 后台路由组 (dashboard) 布局，覆盖 /profile、/settings、/write。
 * 用客户端组件 AuthGate 做登录门槛：鉴权加载中先放行内容，确认未登录则渲染
 * LoginRequired 提示；对外声明 robots 禁止索引，后台页面不进搜索引擎。
 */
import { AuthGate } from "@/components/auth/AuthGate";

/** 后台页面统一禁止搜索引擎索引与跟踪 */
export const metadata = { robots: { index: false, follow: false } };

/**
 * 后台布局：以 AuthGate 包裹全部后台子页面
 * @param props.children 后台子路由页面内容
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
