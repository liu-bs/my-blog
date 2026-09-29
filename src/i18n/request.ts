/**
 * @file request.ts
 * @description next-intl 的请求级配置入口，由 next-intl/plugin 在 next.config 中挂载。
 * 职责：为每次服务端请求决定当前语言，并加载该语言对应的语言包交给 next-intl 使用
 */
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

/**
 * 请求配置：解析当前语言并动态加载对应语言包
 * @description 语言解析的回退顺序：
 * 1. rootLocale()：从动态段 [locale] 读取，是最权威的来源；
 * 2. requestLocale：next-intl 依据中间件与 Accept-Language 推断的语言，作为兜底；
 * 3. routing.defaultLocale：以上都取不到或语言非法时回退默认语言。
 * 最终语言必然落在 zh / en 内，因此动态 import 不会命中不存在的语言包
 * @warning 未配置 onError / getMessageFallback，缺 key 时走 next-intl 默认降级：
 * 页面直接渲染 key 路径（如 "post.title"）并在开发环境打印告警，不会抛错中断渲染
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // 优先取动态段语言；无 [locale] 段时 rootLocale() 会 reject，用 catch 吞掉后回退到 requestLocale
  const requested = (await rootLocale().catch(() => undefined)) ?? (await requestLocale);

  // 白名单校验，非法值统一降级为默认语言，避免 import 到不存在的语言包目录
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  // 动态导入该语言的聚合语言包（messages/zh.ts 或 messages/en.ts），产物按语言分包
  const messages = (await import(`./messages/${locale}`)).default;
  return { locale, messages };
});
