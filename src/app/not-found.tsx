/**
 * @file not-found.tsx
 * @description 应用级 404 页面，处理路由树内 notFound() 调用及未匹配路径；
 * 运行在根布局之中（自动携带导航/页脚），与 global-not-found.tsx（布局层损坏时的兜底）互补。
 * 渲染模式：Server Component。
 */
import { messages } from "@/texts";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

/**
 * 应用级 404 页面组件
 */
export default function NotFound() {
  return (
    <Container className="page-section">
      {/* 404 提示主体：标题 + 描述文案 */}
      <div className="flex min-h-[50vh] animate-fade-in flex-col items-center justify-center text-center">
        <h1 className="mb-5 display-serif text-(length:--type-3xl) leading-tight font-bold text-heading">
          404
        </h1>
        <p className="mb-10 max-w-90 text-(length:--type-base) leading-relaxed text-muted">
          {messages.errors.notFoundDesc}
        </p>

        {/* 操作按钮组：返回首页 / 浏览文章列表 */}
        <div className="flex items-center gap-3">
          <Button href="/">{messages.errors.goHome}</Button>
          <Button variant="outline" href="/posts">
            {messages.errors.browsePosts}
          </Button>
        </div>
      </div>
    </Container>
  );
}
