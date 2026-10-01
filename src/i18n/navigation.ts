/**
 * @file navigation.ts
 * @description 基于 next-intl 的导航 API 封装：自动为跳转链接附加 locale 前缀，
 *              组件内跳转一律从这里导入，禁止直接使用 next/link 与 next/navigation
 */
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** 导出带 locale 感知能力的路由 API，与 next/link、next/navigation 用法对齐 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
