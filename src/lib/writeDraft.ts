/**
 * @file writeDraft.ts
 * @description 写作页草稿的本地暂存：以 localStorage 为存储介质，按文章维度的 key 序列化表单快照，支持读取、覆盖与清除
 */
import { CATEGORY_VALUES } from "@/lib/category";

/**
 * 写作表单的完整快照，也是草稿的序列化结构
 */
export type FormSnapshot = {
  /** 标题 */
  title: string;

  /** 分类，取值属于 {@link CATEGORY_VALUES} */
  category: string;

  /** 标签列表 */
  tags: string[];

  /** 正文（Markdown 源文本） */
  content: string;

  /** 封面图地址 */
  coverImage: string;

  /** 摘要 */
  summary: string;
};

/** 空白表单初始值；分类默认取第一个可选值，避免新建时为空导致提交校验失败 */
export const EMPTY_SNAPSHOT: FormSnapshot = {
  title: "",
  category: CATEGORY_VALUES[0],
  tags: [],
  content: "",
  coverImage: "",
  summary: "",
};

/**
 * 计算草稿的存储 key
 * @description 以文章 id 区分草稿，保证不同文章互不覆盖；新建文章（postId 为 null）统一使用 "new"。
 * key 带应用前缀以免与其他同域页面冲突
 * @param postId 文章 id；新建时为 null
 * @returns localStorage 的存储 key
 */
export function draftKeyOf(postId: string | null): string {
  return `my-app:write-draft:${postId ?? "new"}`;
}

/**
 * 判断草稿是否含有实质内容
 * @description 只填了分类（默认值）不算有效草稿，避免用户打开写作页又立刻离开后，下次进来被弹「恢复草稿」
 * @param draft 解析出的草稿对象
 * @returns 标题/正文/摘要/封面/标签任一非空时返回 true
 */
function isMeaningful(draft: Partial<FormSnapshot> | null): draft is Partial<FormSnapshot> {
  if (!draft) return false;
  return Boolean(
    draft.title || draft.content || draft.summary || draft.coverImage || draft.tags?.length,
  );
}

/**
 * 读取草稿
 * @description 解析失败（脏数据、JSON 损坏）与无内容草稿都返回 null，让调用方按「无草稿」处理
 * @param key 草稿 key，由 {@link draftKeyOf} 生成
 * @returns 草稿的局部快照；无有效草稿时为 null
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
 * 写入草稿
 * @description 表单被清空时改为删除对应 key 而非写入空对象，避免残留无意义记录；写入失败（如超配额）静默忽略，
 * 保证暂存能力不会反过来阻断编辑流程
 * @param key 草稿 key
 * @param snapshot 当前表单快照
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
 * 清除草稿
 * @description 发布成功或用户主动放弃修改后调用；失败静默忽略
 * @param key 草稿 key
 */
export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}
