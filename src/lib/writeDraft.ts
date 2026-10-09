/**
 * @file writeDraft.ts
 * @description 写作页草稿本地持久化工具：以 localStorage 按帖子维度（新建/编辑各一 key）缓存表单快照，
 * 支持读取（过滤无意义草稿）、保存（空表单自动清除）与清除；全部方法服务端环境安全短路
 */
import { CATEGORY_VALUES } from "@/lib/category";

/**
 * 写作表单快照
 */
export type FormSnapshot = {
  /** 标题 */
  title: string;

  /** 分类，取值见 CATEGORY_VALUES */
  category: string;

  /** 标签列表 */
  tags: string[];

  /** Markdown 正文 */
  content: string;

  /** 封面图地址 */
  coverImage: string;

  /** 摘要 */
  summary: string;
};

/** 空表单快照；category 默认取分类枚举第一项（技术），用于与本地草稿合并时的基线 */
export const EMPTY_SNAPSHOT: FormSnapshot = {
  title: "",
  category: CATEGORY_VALUES[0],
  tags: [],
  content: "",
  coverImage: "",
  summary: "",
};

/**
 * 生成草稿 localStorage key
 * @param postId 编辑目标帖子 ID；null 表示新建帖子
 * @returns 形如 my-app:write-draft:new 或 my-app:write-draft:<id>
 */
export function draftKeyOf(postId: string | null): string {
  return `my-app:write-draft:${postId ?? "new"}`;
}

/**
 * 判断草稿是否含实质内容
 * @param draft 解析出的部分快照
 * @returns 标题/正文/摘要/封面/标签任一非空则为 true，避免恢复全空草稿
 */
function isMeaningful(draft: Partial<FormSnapshot> | null): draft is Partial<FormSnapshot> {
  if (!draft) return false;
  return Boolean(
    draft.title || draft.content || draft.summary || draft.coverImage || draft.tags?.length,
  );
}

/**
 * 读取本地草稿
 * @param key {@link draftKeyOf} 生成的 key
 * @returns 有意义的草稿快照（部分字段可能缺失）；无草稿、全空或 JSON 损坏时返回 null
 * @warning 仅浏览器环境生效，SSR 返回 null；解析异常静默吞掉并返回 null
 */
export function readDraft(key: string): Partial<FormSnapshot> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FormSnapshot>;
    return isMeaningful(parsed) ? parsed : null;
  } catch {
    // 存储内容损坏时视为无草稿
    return null;
  }
}

/**
 * 持久化表单快照为草稿
 * @param key {@link draftKeyOf} 生成的 key
 * @param snapshot 当前完整表单快照
 * @warning 表单全空时执行删除而非写入；localStorage 配额溢出等异常静默忽略
 */
export function persistDraft(key: string, snapshot: FormSnapshot): void {
  if (typeof window === "undefined") return;
  const empty =
    !snapshot.title &&
    !snapshot.content &&
    !snapshot.summary &&
    !snapshot.coverImage &&
    snapshot.tags.length === 0;
  try {
    if (empty) {
      // 空表单等价于清空草稿
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {}
}

/**
 * 清除指定 key 的本地草稿（发布/保存成功后调用）
 * @param key {@link draftKeyOf} 生成的 key
 */
export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}
