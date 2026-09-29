/**
 * @file buildPostsUrl.ts
 * @description 文章列表页的查询参数拼装工具：在保留现有筛选条件的基础上覆盖变更项，并自动把翻页重置回第一页
 */
/**
 * 基于当前查询参数生成新的 /posts 地址
 * @description 保留规则：除 changes 中显式变更的 key 外，其余现有参数一律原样保留，使「改分类」不会丢掉搜索词、排序等条件；
 * 变更规则：值为 null/undefined/空串表示删除该参数，否则覆盖为新值；
 * 翻页规则：只要 changes 里没有出现 page，就删除 page——因为筛选条件变了，旧的页码已无意义，应回到第一页
 * @param searchParams 当前参数，可为 URLSearchParams 或普通对象（对象中的空值会被过滤）
 * @param changes 本次要变更的参数，值为 null/undefined/空串时代表移除
 * @returns 形如 `/posts?category=技术` 的相对地址；无参数时返回 `/posts`
 * @example
 * buildPostsUrl(searchParams, { category: "技术" }) // 保留其他筛选，页码回到第一页
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
            // 普通对象里值为 undefined 的项等价于不存在
            if (v) acc[k] = v;
            return acc;
          }, {}),
        );

  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === "") params.delete(key);
    else params.set(key, value);
  }

  // 本次未显式翻页，则清空 page，保证筛选变更后从第一页开始
  if (!Object.keys(changes).some((k) => k === "page")) params.delete("page");

  const qs = params.toString();
  return qs ? `/posts?${qs}` : "/posts";
}
