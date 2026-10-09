/**
 * @file posts.ts
 * @description 文章列表页（src/app/posts/page.tsx，usePosts/PostsSearchInput 等组件）文案：
 * 标题、分类/标签筛选、搜索、统计、空状态与分页，经 messages.posts 消费。
 */

/** 文章列表页文案集合 */
const posts = {
  /** 列表页主标题 */
  title: "全部文章",
  /** 列表页副标题说明 */
  subtitle: "浏览全部文章，按分类或标签筛选。",

  /** 筛选区的分组标签 */
  filter: "筛选",

  /** 筛选项：分类 */
  categories: "分类",

  /** 筛选项：标签 */
  tags: "标签",

  /** 分类筛选的默认项（不限分类） */
  allCategories: "全部",
  /** 搜索输入框占位符 */
  searchPlaceholder: "搜索文章…",

  /** 清空搜索按钮的无障碍标签 */
  clearSearch: "清除搜索",

  /** 带分页信息的统计文案，{count}/{current}/{total} 插值 */
  totalWithPage: "共 {count} 篇 · 第 {current}/{total} 页",

  /** 仅单页时显示的统计文案，{count} 为文章总数 */
  totalOnly: "共 {count} 篇",

  /** 筛选无结果时的空状态标题 */
  noResultsTitle: "没有符合条件的文章",
  /** 筛选无结果时的空状态描述 */
  noResultsDesc: "试试其他筛选条件或关键词",

  /** 空状态下去掉全部筛选的按钮 */
  clearFilters: "清除筛选",

  /** 已选筛选条件 chip 的移除按钮无障碍标签，{name} 为条件名 */
  removeFilterAria: "移除筛选：{name}",

  /** 列表加载失败的提示标题 */
  loadErrorTitle: "文章加载失败",
  /** 列表加载失败的提示描述 */
  loadErrorDesc: "网络异常，请稍后重试。",

  /** 分页导航容器的无障碍标签 */
  pagination: "分页导航",

  /** 上一页按钮 */
  prevPage: "上一页",

  /** 下一页按钮 */
  nextPage: "下一页",

  /** 页码按钮的可访问名称，{n} 为页码 */
  pageN: "第 {n} 页",
};

/** 文章列表页文案默认导出 */
export default posts;
