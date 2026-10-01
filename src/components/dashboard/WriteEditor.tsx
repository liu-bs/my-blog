/**
 * @file WriteEditor.tsx
 * @description 文章写作/编辑器（新建与编辑共用）：表单校验（postCreateSchema + 封面 URL 白名单）、
 *              localStorage 草稿（dirty 后 800ms 防抖持久化，恢复时 toast 提示，保存成功清理）、
 *              isDirty 基线对比驱动未保存守卫（beforeunload 拦截 + useUnsavedGuard 拦截站内离开，可放弃草稿退出）；
 *              保存/发布共用提交流程以 asDraft 区分：草稿→发布设 publishedAt 并增作者文章数，发布→转草稿反向操作（服务端处理）
 */
"use client";

import { Container } from "@/components/ui/Container";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { Eye, Pencil, Check, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { entityName, msg } from "@/lib/message";
import { notify } from "@/lib/toast";
import {
  focusFirstInvalid,
  resolveSubmitError,
  validateForm,
  type ErrorFeedbackOptions,
  type FieldErrors,
} from "@/lib/formFeedback";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/layouts/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCreatePost, useUpdatePost } from "@/hooks/usePosts";
import { estimateReadingTime } from "@/lib/markdown";
import { CATEGORY_VALUES } from "@/lib/category";
import { hasInAppHistory } from "@/lib/url";
import { postCreateSchema } from "@/shared/validation/blog";
import { postEditPath, postPath } from "@shared";
import type { PostData, PostFormField } from "@shared";
import {
  EMPTY_SNAPSHOT,
  clearDraft,
  draftKeyOf,
  persistDraft,
  readDraft,
  type FormSnapshot,
} from "@/lib/writeDraft";
import { MarkdownPane, type ViewMode } from "@/components/dashboard/write/MarkdownPane";
import { PostMetaFields } from "@/components/dashboard/write/PostMetaFields";
import { CoverField, isCoverUrlAllowed } from "@/components/dashboard/write/CoverField";
import { UnsavedChangesDialog } from "@/components/dashboard/write/UnsavedChangesDialog";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";

/** 草稿持久化防抖时长，单位ms */
const DRAFT_DEBOUNCE_MS = 800;

/**
 * WriteEditor 写作/编辑器
 * @param editId 编辑模式的文章ID，null 表示新建
 * @param initialPost 编辑模式服务端注入的文章数据（含 post 正文原始 Markdown）
 */
export function WriteEditor({
  editId,
  initialPost,
}: {
  /** 编辑模式的文章ID，null 表示新建 */
  editId: string | null;

  /** 编辑模式服务端注入的文章数据 */
  initialPost: PostData | null;
}) {
  const router = useRouter();

  /** 是否编辑模式 */
  const isEditMode = !!editId;

  /** 当前文章对应的 localStorage 草稿键（新建/编辑分别隔离） */
  const draftKey = draftKeyOf(editId);

  /** 编辑模式下未取到文章数据的错误态 */
  const isPostError = isEditMode && !initialPost;

  /** 编辑目标文章实体 */
  const editingPost = initialPost?.post;

  /** 新建文章 mutation */
  const createPostMutation = useCreatePost();

  /** 更新文章 mutation */
  const updatePostMutation = useUpdatePost();

  /** 按模式选用的提交 mutation */
  const mutation = isEditMode ? updatePostMutation : createPostMutation;

  const t = useTranslations("write");
  const tCommon = useTranslations("common");

  /** 文章标题 */
  const [title, setTitle] = useState("");

  /** 所属分类 */
  const [category, setCategory] = useState<string>(CATEGORY_VALUES[0]);

  /** 标签列表 */
  const [tags, setTags] = useState<string[]>([]);

  /** 正文 Markdown */
  const [content, setContent] = useState("");

  /** 封面图 URL */
  const [coverImage, setCoverImage] = useState("");

  /** 摘要 */
  const [summary, setSummary] = useState("");

  /** 表单字段级错误文案 */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<PostFormField>>({});

  /** 草稿恢复 toast 只提示一次的标记 */
  const hasNotifiedRestore = useRef(false);

  /** 已保存基线快照：与当前表单对比得出 isDirty，保存成功后重置为当前值 */
  const [baseline, setBaseline] = useState<FormSnapshot>(EMPTY_SNAPSHOT);

  /** 脏标记：任一字段与基线不一致即视为有未保存改动 */
  const isDirty =
    title !== baseline.title ||
    category !== baseline.category ||
    content !== baseline.content ||
    coverImage !== baseline.coverImage ||
    summary !== baseline.summary ||
    tags.join("\u0000") !== baseline.tags.join("\u0000");

  /** 编辑/预览视图模式（移动端切换，桌面默认分栏） */
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  /** 小屏默认单栏编辑，避免初始分栏在窄屏挤压 */
  useEffect(() => {
    setViewMode((prev) => (prev === "split" && window.innerWidth < 1024 ? "edit" : prev));
  }, []);

  /** 是否已用本地草稿/服务端文章做过首次回填 */
  const hasPrefilled = useRef(false);

  /** 已回填对应的文章ID，用于编辑目标切换时重置表单 */
  const prefilledForId = useRef<string | null>(null);

  /**
   * 草稿恢复：读取 localStorage 中本篇文章的草稿并回填表单，仅首次恢复时 toast 提示；
   * 恢复的草稿视为脏状态（基线仍为空），从而继续走防抖持久化与离开守卫
   */
  useEffect(() => {
    const saved = readDraft(draftKey);
    if (!saved) return;

    setTitle(saved.title ?? "");
    setCategory(saved.category ?? CATEGORY_VALUES[0]);
    setTags(saved.tags ?? []);
    setContent(saved.content ?? "");
    setCoverImage(saved.coverImage ?? "");
    setSummary(saved.summary ?? "");
    hasPrefilled.current = true;
    prefilledForId.current = editId;
    if (!hasNotifiedRestore.current) {
      hasNotifiedRestore.current = true;
      notify.info(msg("post", "draftRestored"));
    }
  }, [draftKey, editId]);

  /** 脏状态跟踪与草稿持久化：转脏后 800ms 防抖写入 localStorage；回到干净态（保存成功）时清理草稿 */
  const wasDirty = useRef(false);
  useEffect(() => {
    if (!isDirty) {
      if (wasDirty.current) clearDraft(draftKey);
      wasDirty.current = false;
      return;
    }
    wasDirty.current = true;

    const timer = setTimeout(() => {
      persistDraft(draftKey, { title, category, tags, content, coverImage, summary });
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [isDirty, draftKey, title, category, tags, content, coverImage, summary]);

  /** 关闭/刷新页面守卫：有未保存改动时注册 beforeunload 触发浏览器原生确认 */
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  /** 编辑目标切换（草稿箱切文章）时重置表单与基线，防止上一篇内容串场 */
  useEffect(() => {
    if (prefilledForId.current === null) return;
    if (prefilledForId.current === editId) return;
    prefilledForId.current = editId;
    hasPrefilled.current = false;
    setTitle("");
    setCategory(CATEGORY_VALUES[0]);
    setTags([]);
    setContent("");
    setCoverImage("");
    setSummary("");
    setFieldErrors({});
    setBaseline(EMPTY_SNAPSHOT);
  }, [editId]);

  /** 服务端文章数据就绪后的首次回填：正文优先取原始 Markdown（contentRaw），并同步基线快照 */
  useEffect(() => {
    if (isEditMode && editingPost && !hasPrefilled.current && editingPost.id === editId) {
      prefilledForId.current = editId;
      setTitle(editingPost.title);
      setCategory(editingPost.category);
      setTags(editingPost.tags || []);

      setContent(editingPost.contentRaw ?? editingPost.content);
      setCoverImage(editingPost.coverImage || "");
      setSummary(editingPost.summary || "");
      hasPrefilled.current = true;

      setBaseline({
        title: editingPost.title,
        category: editingPost.category,
        tags: editingPost.tags || [],
        content: editingPost.contentRaw ?? editingPost.content,
        coverImage: editingPost.coverImage || "",
        summary: editingPost.summary || "",
      });
    }
  }, [isEditMode, editingPost, editId]);

  /** 未保存离开守卫：站内导航经 guard 拦截并弹确认框，confirmOpen 控制弹窗 */
  const { confirmOpen, setConfirmOpen, guard } = useUnsavedGuard(isDirty);

  if (isPostError) {
    return (
      <Container className="page-section">
        <EmptyState
          icon={<Pencil size={20} strokeWidth={2.5} />}
          title={t("loadErrorTitle")}
          description={t("loadErrorDesc")}
          action={
            <Button href="/profile" variant="ghost">
              {t("backToMyPosts")}
            </Button>
          }
        />
      </Container>
    );
  }

  /** 提交错误解析规则：字段映射与兜底文案，401 时提示未登录 */
  const saveErrorRules: ErrorFeedbackOptions<PostFormField> = {
    fields: ["title", "content", "category", "summary", "coverImage"],
    fallback: msg("update", "failed", { entity: entityName("post") }),
    byStatus: {
      401: { toast: msg("common", "notLoggedIn") },
    },
  };

  /** 表单提交入口（回车被禁止，避免误触提交） */
  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    savePost(false);
  };

  /**
   * 保存/发布共用提交流程，以 asDraft 区分意图：
   * 1. postCreateSchema 校验 + 封面 URL 白名单校验，失败聚焦首个错误字段；
   * 2. 成功后清理 localStorage 草稿并把当前值写入基线（isDirty 归零）；
   * 3. asDraft：提示草稿已保存，新建态 replace 到编辑路径（获得 editId）；
   *   发布：提示已发布/已更新并跳转文章详情。
   *   草稿→发布由服务端设 publishedAt 并增作者文章数，反向转草稿则清空并减计数
   */
  const savePost = (asDraft: boolean) => {
    const invalid = validateForm(
      postCreateSchema,
      { title, content, category, summary, coverImage, isDraft: asDraft },
      {
        messages: {
          title: t("titleRequired"),
          content: t("contentRequired"),
          coverImage: t("coverInvalid"),
        },
        knownFields: ["title", "content", "category", "summary", "coverImage"],
      },
    );

    const errors: FieldErrors<PostFormField> = isCoverUrlAllowed(coverImage)
      ? invalid.fields
      : { ...invalid.fields, coverImage: t("coverInvalid") };

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focusFirstInvalid();
      return;
    }
    setFieldErrors({});

    const dto = {
      title: title.trim(),
      content,
      summary: summary.trim() || undefined,
      category,
      tags,
      isDraft: asDraft,
      coverImage: coverImage.trim() || undefined,
    };

    /** 提交成功：清草稿、固化基线，按 asDraft 分支提示并跳转 */
    const onSuccess = (data: PostData) => {
      clearDraft(draftKey);

      setBaseline({ title, category, tags, content, coverImage, summary });

      if (asDraft) {
        notify.success(msg("post", isEditMode ? "draftUpdated" : "draftSaved"));

        if (!isEditMode && data?.post?.id) {
          router.replace(postEditPath(data.post.id));
        }
      } else {
        if (isEditMode) notify.updated("post");
        else notify.success(msg("post", "published"));

        const target = data?.post?.id ? postPath(data.post.id) : "/posts";

        router.replace(target);
      }
    };

    /** 提交失败：解析字段/兜底错误并聚焦首个错误字段 */
    const onError = (err: Error) => {
      const failed = resolveSubmitError(err, saveErrorRules);
      setFieldErrors(failed.fields);
      focusFirstInvalid();
    };

    if (isEditMode && editId) {
      updatePostMutation.mutate({ id: editId, dto }, { onSuccess, onError });
    } else {
      createPostMutation.mutate(dto, { onSuccess, onError });
    }
  };

  /** 实际返回动作：有站内历史则回退，否则到个人中心 */
  const navigateBack = () => {
    if (hasInAppHistory()) {
      router.back();
    } else {
      router.push("/profile");
    }
  };

  /** 返回按钮：经未保存守卫拦截，确认后放行 */
  const handleBack = () => guard(navigateBack);

  /** 输入时清除对应字段的错误提示 */
  const clearFieldError = (field: PostFormField) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <Container className="page-section">
      <PageHeader
        title={
          <h1 className="page-title max-md:page-title-mobile">
            {isEditMode ? t("editTitle") : t("createTitle")}
          </h1>
        }
        actions={
          <div className="segmented lg:hidden">
            <button
              type="button"
              onClick={() => setViewMode("edit")}
              className={`segmented-item ${viewMode !== "preview" ? "segmented-item-on" : ""}`}
              aria-label={t("viewEdit")}
            >
              <Pencil size={12} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`segmented-item ${viewMode === "preview" ? "segmented-item-on" : ""}`}
              aria-label={t("viewPreview")}
            >
              <Eye size={12} strokeWidth={2.5} />
            </button>
          </div>
        }
      />

      <form id="write-form" onSubmit={handleSave} noValidate>
        <div className="animate-fade-in form-stack">
          <div>
            <Input
              id="title"
              name="title"
              type="text"
              aria-label={t("titlePlaceholder")}
              placeholder={t("titlePlaceholder")}
              aria-describedby={fieldErrors.title ? "title-error" : undefined}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clearFieldError("title");
              }}

              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              maxLength={200}
              error={!!fieldErrors.title}
              className="py-3 text-(length:--type-lg) leading-tight font-bold text-heading max-md:py-2 max-md:text-(length:--type-md)"
            />

            {fieldErrors.title && (
              <p
                id="title-error"
                className="mt-2 text-(length:--type-xs) font-medium text-state-error"
              >
                {fieldErrors.title}
              </p>
            )}
          </div>

          <div>
            <MarkdownPane
              content={content}
              onContentChange={(value) => {
                setContent(value);
                clearFieldError("content");
              }}
              error={fieldErrors.content}
              viewMode={viewMode}
            />
          </div>

          <PostMetaFields
            category={category}
            onCategoryChange={setCategory}
            tags={tags}
            onTagsChange={setTags}
            summary={summary}
            onSummaryChange={setSummary}
          />

          <CoverField
            value={coverImage}
            onChange={(value) => {
              setCoverImage(value);
              clearFieldError("coverImage");
            }}
            error={fieldErrors.coverImage}
          />

          <div className="mt-8 row-md flex-wrap justify-between border-t border-stroke pt-6">
            <span className="text-(length:--type-xs) leading-normal text-muted">
              {content.length > 0
                ? t("charCount", { count: content.length, minutes: estimateReadingTime(content) })
                : ""}
            </span>
            <div className="row-sm max-md:ml-auto">
              <Button variant="ghost" type="button" onClick={handleBack}>
                {tCommon("back")}
              </Button>

              {(!isEditMode || editingPost?.isDraft) && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => savePost(true)}
                >
                  {mutation.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Check data-icon="inline-start" size={16} strokeWidth={2.5} />
                  )}
                  {isEditMode ? t("updateDraft") : t("saveDraft")}
                </Button>
              )}

              <Button type="submit" name="intent" value="publish" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : isEditMode && !editingPost?.isDraft ? (
                  <Check data-icon="inline-start" size={16} strokeWidth={2.5} />
                ) : (
                  <Send data-icon="inline-start" size={16} strokeWidth={2.5} />
                )}
                {isEditMode
                  ? editingPost?.isDraft
                    ? t("publishPost")
                    : t("updatePost")
                  : t("publishPost")}
              </Button>
            </div>
          </div>
        </div>
      </form>

      <UnsavedChangesDialog
        open={confirmOpen}
        onOpenChange={(v) => !v && setConfirmOpen(false)}
        onDiscard={() => {
          clearDraft(draftKey);
          navigateBack();
        }}
      />
    </Container>
  );
}
