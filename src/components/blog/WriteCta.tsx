/**
 * @file WriteCta.tsx
 * @description 首页"开始写作"号召按钮：纯链接样式按钮，跳转 /write 写作页。服务端组件，无交互逻辑。
 */
import { messages } from "@/texts";
import { Button } from "@/components/ui/Button";

/**
 * 开始写作 CTA 按钮
 */
export function WriteCta() {
  return (
    // 跳转到写作页的 outline 大按钮
    <Button href="/write" variant="outline" size="lg">
      {messages.home.startWriting}
    </Button>
  );
}
