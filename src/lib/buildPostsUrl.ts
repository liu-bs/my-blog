/**
 * @file buildPostsUrl.ts
 * @description 帖子列表页 URL 构建工具：基于现有查询参数做增量修改，自动剔除空值并在筛选条件变化时重置页码
 */

/**
 * 生成 /posts 列表页新 URL
 * @param searchParams 当前查询参数，支持 URLSearchParams 或普通对象（对象形式会剔除空值）
 * @param changes 增量变更：值为字符串则 set，值为 null/undefined/空串则 delete
 * @returns 形如 /posts?category=技术&page=2 的路径；无参数时为 /posts
 * @warning 若 changes 中未显式指定 page，会删除 page 参数（筛选变化视为回到第一页）
 * @example buildPostsUrl(new URLSearchParams("page=3"), { category: "技术" }) // "/posts?category=%E6%8A%80%E6%9C%AF"
 */
export function buildPostsUrl(
  searchParams: URLSearchParams | Record<string, string | undefined>,
  changes: Record<string, string | null | undefined>,
): string {
  // 统一转为可写的 URLSearchParams 副本，不污染入参
  const params =
    searchParams instanceof URLSearchParams
      ? new URLSearchParams(searchParams)
      : new URLSearchParams(
          Object.entries(searchParams).reduce<Record<string, string>>((acc, [k, v]) => {
            if (v) acc[k] = v;
            return acc;
          }, {}),
        );

  // 应用增量变更：空值删除，非空覆盖
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === "") params.delete(key);
    else params.set(key, value);
  }

  // 未显式操作 page 时重置页码，避免筛选变更后停留在越界页
  if (!Object.keys(changes).some((k) => k === "page")) params.delete("page");

  const qs = params.toString();
  return qs ? `/posts?${qs}` : "/posts";
}
