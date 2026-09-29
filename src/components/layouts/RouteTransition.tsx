/**
 * @file RouteTransition.tsx
 * @description 路由切换动画触发器：以当前路径作为 React key，路径变化时强制重挂载子树，
 *              从而让子元素上绑定的入场动画（CSS animation）重新播放一次
 */
"use client";

import { usePathname } from "@/i18n/navigation";

/**
 * RouteTransition 页面切换动画包装层
 * @description 仅靠换 key 实现：同路径下重新渲染不会重播动画，只有路径真正变化才会。
 *              pathname 取自 i18n 导航封装，已去除语言前缀，所以纯语言切换不会额外触发一次动画
 * @param props 组件入参
 * @param props.children 需要参与入场动画的页面内容
 * @returns 以路径为 key 的容器 div
 * @warning 重挂载会丢失子树内的组件本地状态，因此只能包裹「页面级」内容，不可用于包裹需要跨路由保活的常驻区域
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return <div key={pathname}>{children}</div>;
}
