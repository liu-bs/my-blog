/**
 * @file template.tsx
 * @description 路由切换模板：Next.js 会在每次导航时重新挂载 Template（区别于常驻的 layout），
 *              子树重挂载触发全局 CSS 中的页面入场动画，实现语言/页面切换的过渡效果
 */

/**
 * 路由模板组件
 * @param children 当前路由内容，每次导航重新挂载
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
