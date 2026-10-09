/**
 * @file WriteEditor.tsx
 * @description 文章写作/编辑页主体：标题输入、Markdown 编辑预览、分类/标签/摘要/封面元信息，支持新建与编辑、存草稿与发布，并含本地草稿持久化、脏值守护与离开确认
 * @usage 客户端组件；editId 非空为编辑模式；离开前若有未保存更改触发 UnsavedChangesDialog；草稿按 draftKey 去抖写入 localStorage
 */
"use client";

import { Container } from "@/components/ui/Container";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Check, Send } from "lucide-react";
import { formatTemplate, messages } from "@/texts";
import { entityName } from "@/lib/message";
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
import { estimateReadingTime } from "@shared/markdown";
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

/** 草稿持久化的去抖间隔（毫秒） */
const DRAFT_DEBOUNCE_MS = 800;

/**
 * 写作/编辑页主体
 * @param props.editId 编辑目标文章 ID；为 null 表示新建模式
 * @param props.initialPost 编辑模式下预取的文章数据；缺失且处于编辑模式视为加载失败
 * @returns 含标题、编辑器、元信息、封面与操作栏的写作表单
 */
export function WriteEditor({
  editId,
  initialPost,
}: {
  /** 编辑目标文章 ID，null 为新建 */
  editId: string | null;

  /** 编辑模式的初始文章数据 */
  initialPost: PostData | null;
}) {
  /** Next 路由实例，用于保存后跳转与返回 */
  const router = useRouter();

  /** 是否处于编辑模式 */
  const isEditMode = !!editId;

  /** 当前草稿在 localStorage 中的存储键 */
  const draftKey = draftKeyOf(editId);

  /** 编辑模式下未取到文章数据（视为加载失败） */
  const isPostError = isEditMode && !initialPost;

  /** 编辑模式下要回填的文章实体 */
  const editingPost = initialPost?.post;

  /** 新建文章 mutation */
  const createPostMutation = useCreatePost();

  /** 更新文章 mutation */
  const updatePostMutation = useUpdatePost();

  /** 按模式选用创建或更新 mutation，共享其 isPending 状态 */
  const mutation = isEditMode ? updatePostMutation : createPostMutation;

  /** 表单：文章标题 */
  const [title, setTitle] = useState("");

  /** 表单：分类，默认取候选首项 */
  const [category, setCategory] = useState<string>(CATEGORY_VALUES[0]);

  /** 表单：标签数组 */
  const [tags, setTags] = useState<string[]>([]);

  /** 表单：Markdown 正文 */
  const [content, setContent] = useState("");

  /** 表单：封面图 URL */
  const [coverImage, setCoverImage] = useState("");

  /** 表单：摘要 */
  const [summary, setSummary] = useState("");

  /** 各字段的校验/后端错误信息 */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<PostFormField>>({});

  /** 是否已提示过草稿恢复，避免重复 toast */
  const hasNotifiedRestore = useRef(false);

  /** 已保存的基准快照，用于判断表单是否相对上次保存发生变化 */
  const [baseline, setBaseline] = useState<FormSnapshot>(EMPTY_SNAPSHOT);

  /** 当前表单相对 baseline 是否存在未保存改动 */
  const isDirty =
    title !== baseline.title ||
    category !== baseline.category ||
    content !== baseline.content ||
    coverImage !== baseline.coverImage ||
    summary !== baseline.summary ||
    tags.join("\u0000") !== baseline.tags.join("\u0000");

  /** 编辑器视图模式（双栏/编辑/预览） */
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  /**
   * 挂载时若视口窄于断点，将桌面默认的 split 模式降级为纯编辑，避免窄屏双栏挤压
   */
  useEffect(() => {
    setViewMode((prev) => (prev === "split" && window.innerWidth < 1024 ? "edit" : prev));
  }, []);

  /** 是否已用草稿或文章数据预填过表单，防止后续 effect 覆盖用户输入 */
  const hasPrefilled = useRef(false);

  /** 记录预填对应的 editId，用于检测编辑目标切换 */
  const prefilledForId = useRef<string | null>(null);

  /**
   * 读取本地草稿并回填各字段；首次恢复时弹出提示 toast
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
      notify.info(messages.feedback.post.draftRestored);
    }
  }, [draftKey, editId]);

  /** 上一次渲染时的脏标记，用于从脏变为干净时清理草稿 */
  const wasDirty = useRef(false);
  /**
   * 脏值持久化：变干净时清除草稿并复位标记；仍脏则去抖写入最新表单快照
   */
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

  /**
   * 存在未保存更改时注册 beforeunload，阻止浏览器直接关闭/刷新导致草稿丢失
   */
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  /**
   * 编辑目标（editId）切换时重置全部表单、错误与基准快照，避免上一篇文章残留
   */
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

  /**
   * 编辑模式下用文章原始数据回填表单与基准快照（仅当未被草稿预填且 ID 匹配时执行一次）
   */
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

  /** 未保存离开守护：提供确认弹窗开关与包裹导航的 guard */
  const { confirmOpen, setConfirmOpen, guard } = useUnsavedGuard(isDirty);

  // 编辑模式加载失败时展示错误空态，提供返回「我的文章」入口
  if (isPostError) {
    return (
      <Container className="page-section">
        <EmptyState
          icon={<Pencil size={20} strokeWidth={2.5} />}
          title={messages.write.loadErrorTitle}
          description={messages.write.loadErrorDesc}
          action={
            <Button href="/profile" variant="ghost">
              {messages.write.backToMyPosts}
            </Button>
          }
        />
      </Container>
    );
  }

  /** 保存错误映射规则：可回填字段、兜底文案，401 时提示未登录 */
  const saveErrorRules: ErrorFeedbackOptions<PostFormField> = {
    fields: ["title", "content", "category", "summary", "coverImage"],
    fallback: formatTemplate(messages.feedback.update.failed, { entity: entityName("post") }),
    byStatus: {
      401: { toast: messages.feedback.common.notLoggedIn },
    },
  };

  /**
   * 表单提交事件处理：阻止默认提交，统一走发布流程
   * @param e 表单提交事件
   */
  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    savePost(false);
  };

  /**
   * 保存文章核心流程：校验字段（含封面 URL 白名单）→ 组装 DTO → 按模式调用创建/更新 mutation
   * @param asDraft 是否作为草稿保存（true 存草稿，false 发布）
   */
  const savePost = (asDraft: boolean) => {
    const invalid = validateForm(
      postCreateSchema,
      { title, content, category, summary, coverImage, isDraft: asDraft },
      {
        messages: {
          title: messages.write.titleRequired,
          content: messages.write.contentRequired,
          coverImage: messages.write.coverInvalid,
        },
        knownFields: ["title", "content", "category", "summary", "coverImage"],
      },
    );

    const errors: FieldErrors<PostFormField> = isCoverUrlAllowed(coverImage)
      ? invalid.fields
      : { ...invalid.fields, coverImage: messages.write.coverInvalid };

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

    /**
     * 保存成功回调：清理草稿、以当前表单刷新基准快照，并按草稿/发布分支提示与跳转
     * @param data 后端返回的文章数据
     */
    const onSuccess = (data: PostData) => {
      clearDraft(draftKey);

      setBaseline({ title, category, tags, content, coverImage, summary });

      if (asDraft) {
        notify.success(messages.feedback.post[isEditMode ? "draftUpdated" : "draftSaved"]);

        if (!isEditMode && data?.post?.id) {
          router.replace(postEditPath(data.post.id));
        }
      } else {
        if (isEditMode) notify.updated("post");
        else notify.success(messages.feedback.post.published);

        const target = data?.post?.id ? postPath(data.post.id) : "/posts";

        router.replace(target);
      }
    };

    /**
     * 保存失败回调：解析错误并回填字段，定位首个无效项
     * @param err 抛出的错误
     */
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

  /**
   * 返回上一页：有站内历史则 router.back，否则跳转个人主页
   */
  const navigateBack = () => {
    if (hasInAppHistory()) {
      router.back();
    } else {
      router.push("/profile");
    }
  };

  /** 返回按钮：经脏值守护包裹，存在未保存更改时先弹确认框 */
  const handleBack = () => guard(navigateBack);

  /**
   * 清除指定字段的错误标记（用户开始编辑该字段时调用）
   * @param field 目标字段名
   */
  const clearFieldError = (field: PostFormField) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <Container className="page-section">
      {/* 页头：新建/编辑标题 + 移动端视图切换 */}
      <PageHeader
        title={
          <h1 className="page-title max-md:page-title-mobile">
            {isEditMode ? messages.write.editTitle : messages.write.createTitle}
          </h1>
        }
        actions={
          <div className="segmented lg:hidden">
            <button
              type="button"
              onClick={() => setViewMode("edit")}
              className={`segmented-item ${viewMode !== "preview" ? "segmented-item-on" : ""}`}
              aria-label={messages.write.viewEdit}
            >
              <Pencil size={12} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`segmented-item ${viewMode === "preview" ? "segmented-item-on" : ""}`}
              aria-label={messages.write.viewPreview}
            >
              <Eye size={12} strokeWidth={2.5} />
            </button>
          </div>
        }
      />

      <form id="write-form" onSubmit={handleSave} noValidate>
        <div className="animate-fade-in form-stack">
          {/* 文章标题输入 + 错误提示（回车不提交） */}
          <div>
            <Input
              id="title"
              name="title"
              type="text"
              aria-label={messages.write.titlePlaceholder}
              placeholder={messages.write.titlePlaceholder}
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

          {/* Markdown 正文编辑/预览面板 */}
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

          {/* 分类 / 标签 / 摘要元信息区 */}
          <PostMetaFields
            category={category}
            onCategoryChange={setCategory}
            tags={tags}
            onTagsChange={setTags}
            summary={summary}
            onSummaryChange={setSummary}
          />

          {/* 封面图 URL 字段 */}
          <CoverField
            value={coverImage}
            onChange={(value) => {
              setCoverImage(value);
              clearFieldError("coverImage");
            }}
            error={fieldErrors.coverImage}
          />

          {/* 底部操作栏：字数/阅读时长 + 返回/存草稿/发布按钮 */}
          <div className="mt-8 row-md flex-wrap justify-between border-t border-stroke pt-6">
            <span className="text-(length:--type-xs) leading-normal text-muted">
              {content.length > 0
                ? formatTemplate(messages.write.charCount, {
                    count: content.length,
                    minutes: estimateReadingTime(content),
                  })
                : ""}
            </span>
            <div className="row-sm max-md:ml-auto">
              <Button variant="ghost" type="button" onClick={handleBack}>
                {messages.common.back}
              </Button>

              {/* 存草稿按钮：新建或编辑草稿时可见 */}
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
                  {isEditMode ? messages.write.updateDraft : messages.write.saveDraft}
                </Button>
              )}

              {/* 发布/更新按钮：新建发布、草稿转发布或更新已发布文章，文案随模式变化 */}
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
                    ? messages.write.publishPost
                    : messages.write.updatePost
                  : messages.write.publishPost}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* 未保存离开确认弹窗：放弃时清草稿并返回 */}
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
