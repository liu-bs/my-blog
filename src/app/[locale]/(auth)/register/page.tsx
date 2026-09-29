/**
 * @file (auth)/register/page.tsx
 * @description 注册页（Server Component 外壳）。服务端只生成 SEO 元信息，表单交互交给客户端组件 RegisterForm；
 * 页面本身不读取数据、不做登录态判定（守卫由 (auth)/layout.tsx 的 AuthGuard 承担）。
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { assertLocale } from "@/i18n/locale";
import { RegisterForm } from "@/components/auth/RegisterForm";

/**
 * 生成注册页 SEO 元信息
 * @description 标题由 i18n 的 auth.registerTitle 与站点名拼接，描述取注册页副标题
 * @param params 动态路由参数，含 locale
 * @returns Next.js Metadata
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);

  // auth / meta 两个命名空间并行取翻译
  const [t, tMeta] = await Promise.all([getTranslations("auth"), getTranslations("meta")]);
  return {
    title: `${t("registerTitle")} · ${tMeta("siteTitle")}`,
    description: t("registerSubtitle"),
  };
}

/**
 * 注册页
 * @description 无服务端数据依赖，直接委托客户端 RegisterForm 处理表单状态与提交
 * @returns 注册表单组件
 */
export default function RegisterPage() {
  return <RegisterForm />;
}
