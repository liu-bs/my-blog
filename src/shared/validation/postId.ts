/**
 * @file postId.ts
 * @description 文章 ID 的合法性校验、URL 编解码与站内路径拼装工具。
 * 消费方：server/blog（blog.service/blog.cache）、REST 路由、posts 页面与 sitemap/rss 生成、
 * 组件层跳转（DeletePostButton、ProfileTabs、WriteEditor 等）。
 */

/** 合法文章 ID：字母、数字、下划线、连字符，1-128 位 */
const POST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** 匹配 %-xx 百分号转义序列，用于判断 URL 段是否需要解码 */
const PERCENT_ESCAPE = /%[0-9A-Fa-f]{2}/;

/** decodePostId 反复解码的最大层数，防止双重编码与无限循环 */
const MAX_DECODE_DEPTH = 3;

/**
 * 判断字符串是否为合法文章 ID
 * @param id 待校验的文章 ID
 * @returns 是否匹配 POST_ID_PATTERN
 */
export function isValidPostId(id: string): boolean {
  return POST_ID_PATTERN.test(id);
}

/**
 * 断言文章 ID 合法，非法立即抛错
 * @param id 待校验的文章 ID
 * @returns 无
 * @throws ID 不合法时抛出包含原值的 Error，用于在入口处快速定位非法参数
 */
export function assertValidPostId(id: string): void {
  if (!isValidPostId(id)) {
    throw new Error(`Invalid post id: ${JSON.stringify(id)}`);
  }
}

/**
 * 将文章 ID 编码为可安全拼入 URL 的形式
 * @param id 文章 ID
 * @returns encodeURIComponent 处理后的字符串
 */
export function encodePostId(id: string): string {
  return encodeURIComponent(id);
}

/**
 * 解码路由段中的文章 ID
 * @param segment URL 中的 ID 段
 * @returns 至多反复解码 MAX_DECODE_DEPTH 层后的原文；不含转义或解码失败时原样返回
 */
export function decodePostId(segment: string): string {
  if (!PERCENT_ESCAPE.test(segment)) return segment;

  let decoded = segment;
  for (let depth = 0; depth < MAX_DECODE_DEPTH; depth++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

/**
 * 拼装文章详情页路径
 * @param id 文章 ID
 * @returns 形如 /posts/{encodedId} 的路径
 */
export function postPath(id: string): string {
  return `/posts/${encodePostId(id)}`;
}

/**
 * 拼装写作页编辑链接路径
 * @param id 文章 ID
 * @returns 形如 /write?id={encodedId} 的路径
 */
export function postEditPath(id: string): string {
  return `/write?id=${encodePostId(id)}`;
}
