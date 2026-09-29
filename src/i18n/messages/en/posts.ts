/**
 * @file en/posts.ts
 * @description 英文 - 文章列表页文案（标题、筛选、搜索、结果统计、分页、加载失败态），与 zh/posts.ts 逐 key 对应
 */
import type { Messages } from "../zh/posts";

const posts: Messages = {
  /** 列表页主标题 */
  title: "All posts",
  subtitle: "Browse all posts — filter by category or tag.",
  /** 筛选面板的标题 / aria-label */
  filter: "Filters",
  /** 分类筛选分组标题 */
  categories: "Categories",
  /** 标签筛选分组标题 */
  tags: "Tags",
  /** 分类筛选的「不限」选项，不是字面意义的 allCategories */
  allCategories: "All",
  searchPlaceholder: "Search posts…",
  /** 搜索框清空按钮的 aria-label */
  clearSearch: "Clear search",
  /**
   * 结果统计（带分页），用于英文的 ICU 复数规则：{count} 为命中总数并驱动 one/other 分支，
   * 分支内的 # 由 ICU 替换为 count 数值；{current} 为当前页码，{total} 为总页数。
   * 中文包因无复数形态而使用普通占位符，两包实现不同但语义一致
   */
  totalWithPage: "{count, plural, one {# post} other {# posts}} · Page {current}/{total}",
  /** 结果统计（无分页场景），同样用 ICU 复数按 {count} 选择单复数并插入数值 */
  totalOnly: "{count, plural, one {# post} other {# posts}}",
  /** 无结果空态标题 */
  noResultsTitle: "No matching posts",
  noResultsDesc: "Try different filters or keywords.",
  /** 空态里重置全部筛选条件的按钮 */
  clearFilters: "Clear filters",
  /** 列表加载失败标题 */
  loadErrorTitle: "Failed to load posts",
  loadErrorDesc: "Network error. Refresh and try again.",
  /** 分页导航容器的 aria-label */
  pagination: "Pagination",
  /** 分页上一页按钮 aria-label，首屏禁用 */
  prevPage: "Previous page",
  /** 分页下一页按钮 aria-label，末屏禁用 */
  nextPage: "Next page",
  /** 单个页码按钮的 aria-label，{n} 为页码数字 */
  pageN: "Page {n}",
};

export default posts;
