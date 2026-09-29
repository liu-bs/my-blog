/**
 * @file postId.ts
 * @description 文章 ID 的格式约定与 URL 辅助函数。文章 ID 允许字母、数字、下划线、连字符（形如
 *              `{毫秒时间戳}-{随机串}`），合法 ID 无需再做百分号转义即可安全拼接进 URL。
 *              本文件被服务端生成 / 校验 ID 与前端构造链接、路由解析共同复用。
 */
/** 文章 ID 允许的字符集与长度：仅字母、数字、_、-，长度 1–128，用于阻断路径穿越等非法字符 */
const POST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** 是否包含百分号转义序列（如 %2F）；作为「是否需要尝试解码」的快速判断，避免对普通 ID 做无效解码 */
const PERCENT_ESCAPE = /%[0-9A-Fa-f]{2}/;

/** 解码的最大轮数：兼容历史链接的多层编码，同时限制轮数以防恶意嵌套编码导致死循环 */
const MAX_DECODE_DEPTH = 3;

/**
 * 校验文章 ID 是否符合格式约定
 * @description 只做字符串格式校验、不做解码，用于路由参数与外部入参的快速合法性判断；
 *              若入参是旧格式 ID 会返回 false，调用方应据此走 ID 映射兼容逻辑
 * @param id 待校验的文章 ID
 * @returns 合法返回 true
 */
export function isValidPostId(id: string): boolean {
  return POST_ID_PATTERN.test(id);
}

/**
 * 断言文章 ID 合法，否则抛错
 * @description 用于「生成了 ID」这类应当恒为合法的内部场景，一旦不合法说明是代码缺陷，
 *              应在写入数据库 / 拼进 URL 前立即失败，而不是把非法 ID 传播出去
 * @param id 待校验的文章 ID
 * @throws ID 不合法时抛出 Error
 */
export function assertValidPostId(id: string): void {
  if (!isValidPostId(id)) {
    throw new Error(`Invalid post id: ${JSON.stringify(id)}`);
  }
}

/**
 * 编码文章 ID 以便安全拼接进 URL
 * @param id 文章 ID
 * @returns 百分号编码后的字符串；普通合法 ID 编码后与原值相同
 */
export function encodePostId(id: string): string {
  return encodeURIComponent(id);
}

/**
 * 解码 URL 片段中的文章 ID
 * @description 对含百分号转义的历史链接做最多 {@link MAX_DECODE_DEPTH} 轮解码，直到结果稳定；
 *              不含转义片段时原样返回，解码异常（非法转义）时提前结束并返回当前结果
 * @param segment 从 URL 路径中取出的片段
 * @returns 解码后的文章 ID
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
 * 构造文章详情页路径
 * @param id 文章 ID
 * @returns 形如 `/posts/{id}` 的路径（不含语言前缀，由 i18n 导航再补 locale）
 */
export function postPath(id: string): string {
  return `/posts/${encodePostId(id)}`;
}

/**
 * 构造文章编辑页路径
 * @param id 文章 ID
 * @returns 形如 `/write?id={id}` 的编辑入口路径
 */
export function postEditPath(id: string): string {
  return `/write?id=${encodePostId(id)}`;
}
