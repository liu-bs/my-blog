/**
 * @file buildPostsUrl.ts
 * @description 构建文章列表 URL：在当前查询参数上应用变更（值为 null/undefined/空串表示删除该参数），除显式修改 page 外一律重置页码
 */

/**
 * 基于当前查询参数构建新的 /posts 列表地址
 * @param searchParams 当前查询参数（URLSearchParams 或普通对象，空值忽略）
 * @param changes 要应用的变更，值为 null/undefined/空串时删除对应参数
 * @returns 如 /posts?category=技术&page=2
 */
export function buildPostsUrl(
  searchParams: URLSearchParams | Record<string, string | undefined>,
  changes: Record<string, string | null | undefined>,
): string {
  const params =
    searchParams instanceof URLSearchParams
      ? new URLSearchParams(searchParams)
      : new URLSearchParams(
          Object.entries(searchParams).reduce<Record<string, string>>((acc, [k, v]) => {
            // 过滤空值参数
            if (v) acc[k] = v;
            return acc;
          }, {}),
        );

  // 应用变更
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === "") params.delete(key);
    else params.set(key, value);
  }

  // 未显式指定 page 时重置回第一页
  if (!Object.keys(changes).some((k) => k === "page")) params.delete("page");

  const qs = params.toString();
  return qs ? `/posts?${qs}` : "/posts";
}
