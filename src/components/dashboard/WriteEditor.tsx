/**
 * @file WriteEditor.tsx
 * @description 文章写作/编辑页核心组件，同时承担「新建文章」与「编辑已有文章」两条路径；
 * 统一维护标题、正文、分类、标签、封面、摘要等表单状态，负责草稿本地持久化、未保存离开拦截、字段校验与提交。
 * 新建模式提交后先落为草稿再跳转到编辑态；编辑模式依据文章当前 isDraft 决定「更新草稿 / 更新文章」的文案与提交语义。
 * @warning 组件内所有提交都通过 useCreatePost / useUpdatePost 对应的 Server Action 完成，本文件不做任何数据持久化的直连调用
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

/** 草稿写入 localStorage 的防抖间隔，单位毫秒；避免每次按键都同步写盘 */
const DRAFT_DEBOUNCE_MS = 800;

/**
 * WriteEditor 写作编辑器
 * @description 新建与编辑共用同一套表单；两者的差异集中在初始值来源、提交动作与提交成功后的跳转目标
 * @param props {@link WriteEditorProps} 以行内对象类型声明
 * @returns 编辑态渲染表单主体；编辑模式下 initialPost 缺失时降级渲染加载失败空态
 * @example
 * <WriteEditor editId={null} initialPost={null} />
 */
export function WriteEditor({
  editId,
  initialPost,
}: {
  /** 编辑模式的目标文章 ID；为 null 表示新建 */
  editId: string | null;
  /** 服务端预取的文章详情；编辑模式返回 null 表示文章不存在或无权编辑 */
  initialPost: PostData | null;
}) {
  const router = useRouter();

  /** 是否处于编辑已有文章的模式，由是否传入 editId 决定 */
  const isEditMode = !!editId;

  /** 草稿在 localStorage 中的键；新建与各篇文章各自独立，互不覆盖 */
  const draftKey = draftKeyOf(editId);

  /** 编辑模式下服务端未取到文章（不存在 / 无权限），用于提前降级为空态 */
  const isPostError = isEditMode && !initialPost;

  /** 待编辑的文章实体；新建模式下为 undefined */
  const editingPost = initialPost?.post;

  /** 新建文章的提交动作 */
  const createPostMutation = useCreatePost();

  /** 更新已有文章的提交动作 */
  const updatePostMutation = useUpdatePost();

  /** 当前生效的提交动作，按模式二选一，供 pending 状态与提交调用复用 */
  const mutation = isEditMode ? updatePostMutation : createPostMutation;

  const t = useTranslations("write");
  const tCommon = useTranslations("common");

  /** 文章标题 */
  const [title, setTitle] = useState("");

  /** 文章分类，默认取分类枚举首项 */
  const [category, setCategory] = useState<string>(CATEGORY_VALUES[0]);

  /** 文章标签列表 */
  const [tags, setTags] = useState<string[]>([]);

  /** 正文 Markdown 原文 */
  const [content, setContent] = useState("");

  /** 封面图地址 */
  const [coverImage, setCoverImage] = useState("");

  /** 文章摘要，可为空 */
  const [summary, setSummary] = useState("");

  /** 按字段维度收集的校验/提交错误，驱动输入框的 error 态与错误文案 */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<PostFormField>>({});

  /** 是否已提示过「草稿已恢复」；用 ref 保证同一次挂载只提示一次，避免重复 effect 反复弹出 */
  const hasNotifiedRestore = useRef(false);

  /** 脏值判定基线：保存成功或初始化完成时与当前表单值对齐，用于计算 isDirty */
  const [baseline, setBaseline] = useState<FormSnapshot>(EMPTY_SNAPSHOT);

  /**
   * 表单是否相对基线有改动
   * tags 是数组，用不可见字符 \u0000 作连接符比较，避免标签内容里出现逗号等常见分隔符导致误判为「未改动」
   */
  const isDirty =
    title !== baseline.title ||
    category !== baseline.category ||
    content !== baseline.content ||
    coverImage !== baseline.coverImage ||
    summary !== baseline.summary ||
    tags.join("\u0000") !== baseline.tags.join("\u0000");

  /** 编辑/预览/分栏视图模式 */
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  /** 首屏按视口宽度决定初始视图：窄屏（<1024px）无法分栏，默认切到纯编辑 */
  useEffect(() => {
    setViewMode((prev) => (prev === "split" && window.innerWidth < 1024 ? "edit" : prev));
  }, []);

  /** 是否已用某一来源的数据填充过表单；防止后续 effect 覆盖用户正在编辑的内容 */
  const hasPrefilled = useRef(false);

  /** 上次完成预填充时的 editId；用于识别「切换了编辑对象」并触发表单重置 */
  const prefilledForId = useRef<string | null>(null);

  /** 挂载/草稿键变化时尝试恢复本地草稿：有则覆盖表单并提示用户，恢复后置位 hasPrefilled 阻止文章数据再次覆盖 */
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

  /** 表单有改动时防抖持久化草稿；isDirty 回落后由 clearDraft 负责清理，这里只在脏值时写入 */
  useEffect(() => {
    if (!isDirty) return;

    const timer = setTimeout(() => {
      persistDraft(draftKey, { title, category, tags, content, coverImage, summary });
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [isDirty, draftKey, title, category, tags, content, coverImage, summary]);

  /** 切换编辑对象（新建 <-> 编辑，或编辑另一篇）时清空表单与错误、重置基线，避免串稿 */
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

  /** 编辑模式下用文章数据初始化表单：仅在尚未被草稿预填充且文章 ID 与当前编辑目标一致时执行，同时把初始值记为基线 */
  useEffect(() => {
    if (isEditMode && editingPost && !hasPrefilled.current && editingPost.id === editId) {
      prefilledForId.current = editId;
      setTitle(editingPost.title);
      setCategory(editingPost.category);
      setTags(editingPost.tags || []);

      // 优先取原文（contentRaw），避免用已渲染的 HTML 覆盖用户可编辑的 Markdown
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

  /** 未保存离开拦截：isDirty 为真时先弹确认框，用户确认放弃后再执行真正的离开动作 */
  const { confirmOpen, setConfirmOpen, guard } = useUnsavedGuard(isDirty);

  // 编辑模式下文章加载失败，整页降级为空态而非渲染空表单，防止用户误以为内容被清空
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

  /** 提交失败时的错误归类规则：可映射到字段的走字段错误，401 单独提示未登录 */
  const saveErrorRules: ErrorFeedbackOptions<PostFormField> = {
    fields: ["title", "content", "category", "summary", "coverImage"],
    fallback: msg("update", "failed", { entity: entityName("post") }),
    byStatus: {
      401: { toast: msg("common", "notLoggedIn") },
    },
  };

  /**
   * 表单 submit 事件处理：发布按钮为 type=submit，此路径固定走「非草稿」提交
   * @param e 表单提交事件，阻止默认刷新后转交 savePost
   */
  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    savePost(false);
  };

  /**
   * 统一的保存/发布提交逻辑，草稿与发布共用
   * @param asDraft 为 true 表示仅保存草稿；为 false 表示发布（或对已发布文章执行更新）
   * @description 先做本地 zod 校验与封面地址白名单校验，通过后构造 DTO 调用对应 mutation；
   * 成功时清理本地草稿、更新基线并按模式跳转，失败时把错误落到字段并聚焦首个非法项
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

    // 封面在图床白名单之外时强制追加错误，避免提交后服务端拒绝或渲染出不可控的外链
    const errors: FieldErrors<PostFormField> = isCoverUrlAllowed(coverImage)
      ? invalid.fields
      : { ...invalid.fields, coverImage: t("coverInvalid") };

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focusFirstInvalid();
      return;
    }
    setFieldErrors({});

    /** 提交给 Server Action 的文章数据；摘要与封面空串归一为 undefined，交由服务端按「未提交」处理 */
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
     * 提交成功回调
     * @param data 服务端返回的文章数据
     * @description 草稿保存成功后：新建模式改址到该文章的编辑页，使后续保存走更新而非重复新建；
     * 发布成功后：编辑模式提示「已更新」，其余跳转到文章详情，无 ID 时兜底回列表
     */
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

    /**
     * 提交失败回调：按规则把错误映射到字段并聚焦
     * @param err 抛出的错误对象
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

  /** 真正执行离开：站内有历史则回退上一页，否则兜底跳到个人主页 */
  const navigateBack = () => {
    if (hasInAppHistory()) {
      router.back();
    } else {
      router.push("/profile");
    }
  };

  /** 返回按钮处理：经 guard 包装，有未保存改动时先弹确认框 */
  const handleBack = () => guard(navigateBack);

  /**
   * 用户重新输入时清除该字段的历史错误，让错误提示随修改即时消失
   * @param field 目标字段名
   */
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
          // 窄屏下的编辑/预览切换分组，宽屏由 MarkdownPane 内部分栏承担，无需此控件
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

      {/* 表单主体：noValidate 关闭浏览器原生校验，统一走 zod 校验与自定义错误提示 */}
      <form id="write-form" onSubmit={handleSave} noValidate>
        <div className="animate-fade-in form-stack">
          {/* 标题输入区 */}
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
              maxLength={200}
              error={!!fieldErrors.title}
              className="py-3 text-(length:--type-lg) leading-tight font-bold text-heading max-md:py-2 max-md:text-(length:--type-md)"
            />
            {/* 标题字段错误提示，与输入框通过 aria-describedby 关联 */}
            {fieldErrors.title && (
              <p
                id="title-error"
                className="mt-2 text-(length:--type-xs) font-medium text-state-error"
              >
                {fieldErrors.title}
              </p>
            )}
          </div>

          {/* Markdown 编辑/预览面板，受 viewMode 控制 */}
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

          {/* 分类、标签、摘要等元信息 */}
          <PostMetaFields
            category={category}
            onCategoryChange={setCategory}
            tags={tags}
            onTagsChange={setTags}
            summary={summary}
            onSummaryChange={setSummary}
          />

          {/* 封面图选择/填写 */}
          <CoverField
            value={coverImage}
            onChange={(value) => {
              setCoverImage(value);
              clearFieldError("coverImage");
            }}
            error={fieldErrors.coverImage}
          />

          {/* 底部操作栏：左侧字数与预估阅读时长，右侧返回/存草稿/发布 */}
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

              {/* 存草稿：新建时可存，编辑时仅当文章仍是草稿才出现，已发布文章不允许再退回草稿态 */}
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
              {/* 主提交按钮：编辑已发布文章显示「更新」与对勾，草稿/新建显示「发布」与纸飞机 */}
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

      {/* 未保存离开确认弹窗，确认放弃后走 navigateBack 真正离开 */}
      <UnsavedChangesDialog
        open={confirmOpen}
        onOpenChange={(v) => !v && setConfirmOpen(false)}
        onDiscard={navigateBack}
      />
    </Container>
  );
}
