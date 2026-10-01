/**
 * @file postId.ts
 * @description 文章 ID 的合法性校验与 URL 编解码工具：文章 ID 直接进入路由路径，
 *              生成链接前必须编码，读取路由参数后必须先校验再使用，防止恶意路径注入
 */

/** 合法文章 ID 规则：仅限字母、数字、下划线、连字符，长度 1-128 */
const POST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** 判断字符串是否含有百分号编码（形如 %XX 的转义序列） */
const PERCENT_ESCAPE = /%[0-9A-Fa-f]{2}/;

/**
 * 重复解码的最大深度上限，防止 %2525 这类多重编码被无限展开
 * ponytail: 固定 3 层深度，覆盖常规浏览器/客户端重复编码场景；如出现更深层编码来源再提高上限
 */
const MAX_DECODE_DEPTH = 3;

/**
 * 校验字符串是否为合法文章 ID
 * @param id 待校验的 ID（通常来自路由参数或服务端数据）
 * @returns 合法返回 true
 */
export function isValidPostId(id: string): boolean {
  return POST_ID_PATTERN.test(id);
}

/**
 * 断言文章 ID 合法，不合法直接抛错
 * @param id 待校验的 ID
 * @throws ID 不符合 POST_ID_PATTERN 时抛出 Error
 */
export function assertValidPostId(id: string): void {
  if (!isValidPostId(id)) {
    throw new Error(`Invalid post id: ${JSON.stringify(id)}`);
  }
}

/**
 * 将文章 ID 编码为可安全出现在 URL 路径/查询串中的片段
 * @param id 原始文章 ID
 * @returns encodeURIComponent 编码后的字符串
 */
export function encodePostId(id: string): string {
  return encodeURIComponent(id);
}

/**
 * 将路由段中的文章 ID 解码回原始值
 * 无百分号编码时原样返回；有编码时最多迭代解码 MAX_DECODE_DEPTH 层，
 * 解码失败或结果稳定即停止，保证异常输入不会抛错
 * @param segment 路由段中的 ID 字符串
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
 * 拼接文章详情页路径，ID 经过 URL 编码
 * @param id 文章 ID
 * @returns 如 /posts/abc123
 */
export function postPath(id: string): string {
  return `/posts/${encodePostId(id)}`;
}

/**
 * 拼接文章编辑页路径，ID 作为查询参数并经过 URL 编码
 * @param id 文章 ID
 * @returns 如 /write?id=abc123
 */
export function postEditPath(id: string): string {
  return `/write?id=${encodePostId(id)}`;
}
