/**
 * @file writeDraft.ts
 * @description 写作页 localStorage 草稿：存储键按文章ID区分新建/编辑，提供读取、持久化（全空时移除）与清除；SSR 环境与解析异常均安全降级
 */
import { CATEGORY_VALUES } from "@/lib/category";

/**
 * 写作表单快照
 */
export type FormSnapshot = {
  /** 文章标题 */
  title: string;

  /** 分类 */
  category: string;

  /** 标签列表 */
  tags: string[];

  /** 正文内容 */
  content: string;

  /** 封面图地址 */
  coverImage: string;

  /** 摘要 */
  summary: string;
};

/** 新建草稿的空快照 */
export const EMPTY_SNAPSHOT: FormSnapshot = {
  title: "",
  category: CATEGORY_VALUES[0],
  tags: [],
  content: "",
  coverImage: "",
  summary: "",
};

/**
 * 生成草稿存储键，新建文章用固定 "new" 键
 * @param postId 文章ID，新建时为 null
 * @returns localStorage 键
 */
export function draftKeyOf(postId: string | null): string {
  return `my-app:write-draft:${postId ?? "new"}`;
}

/** 判断草稿是否有实际内容（关键字段全空视为无草稿） */
function isMeaningful(draft: Partial<FormSnapshot> | null): draft is Partial<FormSnapshot> {
  if (!draft) return false;
  return Boolean(
    draft.title || draft.content || draft.summary || draft.coverImage || draft.tags?.length,
  );
}

/**
 * 读取草稿，无有效内容或解析失败返回 null
 * @param key 草稿存储键
 * @returns 草稿快照（可能仅含部分字段）
 */
export function readDraft(key: string): Partial<FormSnapshot> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FormSnapshot>;
    return isMeaningful(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 持久化草稿；快照全空时移除存储，异常静默忽略
 * @param key 草稿存储键
 * @param snapshot 表单快照
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
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {}
}

/**
 * 清除草稿存储，异常静默忽略
 * @param key 草稿存储键
 */
export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}
