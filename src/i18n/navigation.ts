/**
 * @file navigation.ts
 * @description 语言感知的导航 API 统一封装。业务代码必须从这里导入 Link / useRouter / usePathname 等，
 * 用来替代 next/link、next/navigation 的同名 API，否则跳转不会带上当前语言前缀
 */
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * 带语言前缀的导航工具集合
 * @description createNavigation 依据 routing 生成包装版 API，行为如下：
 * - Link / redirect / useRouter 接收的是不含语言前缀的内部路径（如 "/posts"），会自动补成 "/zh/posts" 或 "/en/posts"
 * - useRouter().push / replace 还支持传 { locale } 参数，可在跳转的同一次操作里切换语言
 * - usePathname() 返回的是剥掉语言前缀后的路径（如 "/posts"），便于做导航高亮、菜单选中这类比较
 * - getPathname() 在同一路径上计算不同语言对应的 URL，用于生成 hreflang / 语言切换链接
 * @warning 禁止直接使用 next/link 与 next/navigation 的 Link / useRouter / usePathname，
 * 否则跳转会丢失语言前缀并命中 404（basePath 语义由本封装统一负责）
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
