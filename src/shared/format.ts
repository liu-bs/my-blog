/**
 * @file format.ts
 * @description 通用展示格式化工具：姓名拆分/拼接、头像首字母、数字千分位、中文日期与相对时间。
 * 客户端组件（UserMenu、ArticleCard、CommentCardView、ProfilePageContent 等）与
 * 服务端服务（blog/comment/auth service 拼接作者名）共用，保证前后端展示一致。
 */

/** 中文相对时间格式化器，auto 表示"昨天/今天"等自动措辞 */
const RELATIVE_FORMAT = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

/**
 * 取用户显示名的首字母（用于无头像时的 Avatar 占位）
 * @param firstName 名
 * @param lastName 姓
 * @returns 大写首字母；名字为空时返回 "U"
 */
export function getInitials(firstName: string, lastName: string): string {
  const name = (firstName || lastName || "").trim();
  return (name.charAt(0) || "U").toUpperCase();
}

/**
 * 将完整显示名按第一个空格拆分为名/姓（用于编辑资料时回填表单）
 * @param fullName 完整显示名，如 "张三" 或 "John Doe"
 * @returns firstName 为首段，lastName 为其余段拼接
 */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.split(" ");
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

/** 匹配整串均为 CJK 统一表意文字（含扩展 A 区、兼容区）的正则 */
const CJK_NAME = /^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+$/;

/**
 * 拼接名/姓为完整显示名（服务端返回 authorName、客户端展示共用）
 * @param firstName 名
 * @param lastName 姓
 * @returns 双方均为中文时直接相连（如 "张三"），否则以空格分隔（如 "John Doe"）
 */
export function joinName(firstName: string, lastName: string): string {
  const first = firstName.trim();
  const last = lastName.trim();
  if (!first) return last;
  if (!last) return first;
  return CJK_NAME.test(first) && CJK_NAME.test(last) ? `${first}${last}` : `${first} ${last}`;
}

/**
 * 格式化统计数字为千分位展示（浏览/点赞/收藏数）
 * @param n 原始数字
 * @returns 按 en-US 千分位分隔的字符串，如 "1,234"
 */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * 格式化日期为中文长日期（如 "2026年1月5日"）
 * @param dateStr 可被 Date 解析的日期字符串（通常为 ISO 时间）
 * @returns 中文日期字符串；无法解析时原样返回入参
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/**
 * 格式化为相对时间（1 分钟内、x 分钟前、x 小时前、x 天前、x 周前）
 * @param dateStr 可被 Date 解析的日期字符串
 * @returns 相对时间文案；距今超过 30 天时回退为 formatDate 的绝对日期；无法解析时原样返回入参
 */
export function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const diff = Date.now() - d.getTime();

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);

  if (minutes < 1) return RELATIVE_FORMAT.format(0, "second");
  if (minutes < 60) return RELATIVE_FORMAT.format(-minutes, "minute");
  if (hours < 24) return RELATIVE_FORMAT.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return RELATIVE_FORMAT.format(-days, "day");
  if (days < 30) return RELATIVE_FORMAT.format(-Math.floor(days / 7), "week");
  return formatDate(dateStr);
}
