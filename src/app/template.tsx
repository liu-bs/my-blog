/**
 * @file template.tsx
 * @description 全站模板文件，包裹在 layout 与页面之间；每次子路由导航时都会重新挂载，
 * 可用于触发自定义的入场动画或重置子树状态。当前仅提供一个最外层 div 容器。
 */

/**
 * 全站 Template 组件
 * @param props children - 由 layout 传入的页面子树，导航时会整体重建
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
