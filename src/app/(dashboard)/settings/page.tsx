/**
 * @file page.tsx
 * @description 设置页（路由 /settings），Server Component：仅做服务端鉴权，
 * 表单数据由客户端组件 SettingsForm 自行处理。需登录——未登录时
 * requireUserOrRedirect 跳转到 /login?redirect=/settings&stale=1。
 */
import { Container } from "@/components/ui/Container";
import { messages } from "@/texts";
import { PageHeader } from "@/components/layouts/PageHeader";
import { requireUserOrRedirect } from "@server/auth/auth.service";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

/**
 * 设置页：鉴权通过后渲染页头与客户端设置表单
 */
export default async function SettingsPage() {
  // 服务端鉴权：未登录则重定向到登录页；此处不需要用户数据，返回值忽略
  await requireUserOrRedirect("/settings");

  return (
    <Container className="page-section">
      {/* 页头：标题与副标题取自全局文案 messages.settings */}
      <PageHeader title={messages.settings.title} subtitle={messages.settings.subtitle} />
      {/* 设置表单（客户端组件） */}
      <SettingsForm />
    </Container>
  );
}
