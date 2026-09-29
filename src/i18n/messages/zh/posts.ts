/**
 * @file zh/posts.ts
 * @description 中文 - 文章列表页文案（标题、筛选、搜索、结果统计、分页、加载失败态）
 */
const posts = {
  /** 列表页主标题 */
  title: "全部文章",
  subtitle: "浏览全部文章，按分类或标签筛选。",
  /** 筛选面板的标题 / aria-label */
  filter: "筛选",
  /** 分类筛选分组标题 */
  categories: "分类",
  /** 标签筛选分组标题 */
  tags: "标签",
  /** 分类筛选的「不限」选项，不是字面意义的 allCategories */
  allCategories: "全部",
  searchPlaceholder: "搜索文章…",
  /** 搜索框清空按钮的 aria-label */
  clearSearch: "清除搜索",
  /** 结果统计（带分页），{count} 为命中总数，{current} 为当前页码，{total} 为总页数 */
  totalWithPage: "共 {count} 篇 · 第 {current}/{total} 页",
  /** 结果统计（无分页场景），{count} 为命中总数 */
  totalOnly: "共 {count} 篇",
  /** 无结果空态标题 */
  noResultsTitle: "没有符合条件的文章",
  noResultsDesc: "试试其他筛选条件或关键词",
  /** 空态里重置全部筛选条件的按钮 */
  clearFilters: "清除筛选",
  /** 列表加载失败标题 */
  loadErrorTitle: "文章加载失败",
  loadErrorDesc: "网络异常，请稍后重试。",
  /** 分页导航容器的 aria-label */
  pagination: "分页导航",
  /** 分页上一页按钮 aria-label，首屏禁用 */
  prevPage: "上一页",
  /** 分页下一页按钮 aria-label，末屏禁用 */
  nextPage: "下一页",
  /** 单个页码按钮的 aria-label，{n} 为页码数字 */
  pageN: "第 {n} 页",
};

export type Messages = typeof posts;
export default posts;
