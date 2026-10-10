"use client";

import { Container } from "@/components/ui/Container";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Check, Send } from "lucide-react";
import common from "@/texts/common";
import feedback from "@/texts/feedback";
import write from "@/texts/write";
import { formatTemplate } from "@/texts/format";
import { entityLabel } from "@/lib/error-message";
import { notify } from "@/lib/toast";
import {
  focusFirstInvalid,
  resolveSubmitError,
  validateForm,
  type ErrorFeedbackOptions,
  type FieldErrors,
} from "@/lib/form-feedback";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCreatePost, useUpdatePost } from "@/hooks/usePosts";
import { estimateReadingTime } from "@shared/markdown";
import { CATEGORY_VALUES } from "@/lib/category";
import { hasInAppHistory } from "@/lib/url";
import { loadPostValidation } from "@/lib/validation-loader";
import { postEditPath, postPath } from "@shared";
import type { PostData, PostFormField } from "@shared";
import {
  EMPTY_SNAPSHOT,
  clearDraft,
  draftKeyOf,
  persistDraft,
  readDraft,
  type FormSnapshot,
} from "@/lib/write-draft";
import { MarkdownPane, type ViewMode } from "@/components/dashboard/write/MarkdownPane";
import { PostMetaFields } from "@/components/dashboard/write/PostMetaFields";
import { CoverField, isCoverUrlAllowed } from "@/components/dashboard/write/CoverField";
import { UnsavedChangesDialog } from "@/components/dashboard/write/UnsavedChangesDialog";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";

const DRAFT_DEBOUNCE_MS = 800;

export function WriteEditor({
  editId,
  initialPost,
}: {
  editId: string | null;

  initialPost: PostData | null;
}) {
  const router = useRouter();

  const isEditMode = !!editId;

  const draftKey = draftKeyOf(editId);

  const isPostError = isEditMode && !initialPost;

  const editingPost = initialPost?.post;

  const createPostMutation = useCreatePost();

  const updatePostMutation = useUpdatePost();

  const mutation = isEditMode ? updatePostMutation : createPostMutation;

  const [title, setTitle] = useState("");

  const [category, setCategory] = useState<string>(CATEGORY_VALUES[0]);

  const [tags, setTags] = useState<string[]>([]);

  const [content, setContent] = useState("");

  const [coverImage, setCoverImage] = useState("");

  const [summary, setSummary] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors<PostFormField>>({});

  const hasNotifiedRestore = useRef(false);

  const [baseline, setBaseline] = useState<FormSnapshot>(EMPTY_SNAPSHOT);

  const isDirty =
    title !== baseline.title ||
    category !== baseline.category ||
    content !== baseline.content ||
    coverImage !== baseline.coverImage ||
    summary !== baseline.summary ||
    tags.join("\u0000") !== baseline.tags.join("\u0000");

  const [viewMode, setViewMode] = useState<ViewMode>("split");

  useEffect(() => {
    setViewMode((prev) => (prev === "split" && window.innerWidth < 1024 ? "edit" : prev));
  }, []);

  const hasPrefilled = useRef(false);

  const prefilledForId = useRef<string | null>(null);

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
      notify.info(feedback.post.draftRestored);
    }
  }, [draftKey, editId]);

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

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

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

  const { confirmOpen, setConfirmOpen, guard } = useUnsavedGuard(isDirty);

  if (isPostError) {
    return (
      <Container className="page-section">
        <EmptyState
          icon={<Pencil size={20} strokeWidth={2.5} />}
          title={write.loadErrorTitle}
          description={write.loadErrorDesc}
          action={
            <Button href="/profile" variant="ghost">
              {write.backToMyPosts}
            </Button>
          }
        />
      </Container>
    );
  }

  const saveErrorRules: ErrorFeedbackOptions<PostFormField> = {
    fields: ["title", "content", "category", "summary", "coverImage"],
    fallback: formatTemplate(feedback.update.failed, { entity: entityLabel("post") }),
    byStatus: {
      401: { toast: feedback.common.notLoggedIn },
    },
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void savePost(false);
  };

  const savePost = async (asDraft: boolean) => {
    const { postCreateSchema } = await loadPostValidation();

    const invalid = validateForm(
      postCreateSchema,
      { title, content, category, summary, coverImage, isDraft: asDraft },
      {
        fieldTexts: {
          title: write.titleRequired,
          content: write.contentRequired,
          coverImage: write.coverInvalid,
        },
        knownFields: ["title", "content", "category", "summary", "coverImage"],
      },
    );

    const errors: FieldErrors<PostFormField> = isCoverUrlAllowed(coverImage)
      ? invalid.fields
      : { ...invalid.fields, coverImage: write.coverInvalid };

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

    const onSuccess = (data: PostData) => {
      clearDraft(draftKey);

      setBaseline({ title, category, tags, content, coverImage, summary });

      if (asDraft) {
        notify.success(feedback.post[isEditMode ? "draftUpdated" : "draftSaved"]);

        if (!isEditMode && data?.post?.id) {
          router.replace(postEditPath(data.post.id));
        }
      } else {
        if (isEditMode) notify.updated("post");
        else notify.success(feedback.post.published);

        const target = data?.post?.id ? postPath(data.post.id) : "/posts";

        router.replace(target);
      }
    };

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

  const navigateBack = () => {
    if (hasInAppHistory()) {
      router.back();
    } else {
      router.push("/profile");
    }
  };

  const handleBack = () => guard(navigateBack);

  const clearFieldError = (field: PostFormField) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <Container className="page-section">
      <PageHeader
        title={
          <h1 className="page-title max-md:page-title-mobile">
            {isEditMode ? write.editTitle : write.createTitle}
          </h1>
        }
        actions={
          <div className="segmented lg:hidden">
            <button
              type="button"
              onClick={() => setViewMode("edit")}
              className={`segmented-item ${viewMode !== "preview" ? "segmented-item-on" : ""}`}
              aria-label={write.viewEdit}
            >
              <Pencil size={12} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`segmented-item ${viewMode === "preview" ? "segmented-item-on" : ""}`}
              aria-label={write.viewPreview}
            >
              <Eye size={12} strokeWidth={2.5} />
            </button>
          </div>
        }
      />

      <form
        id="write-form"
        onSubmit={handleSave}
        noValidate
        onFocus={() => void loadPostValidation()}
      >
        <div className="animate-fade-in form-stack">
          <div>
            <Input
              id="title"
              name="title"
              type="text"
              aria-label={write.titlePlaceholder}
              placeholder={write.titlePlaceholder}
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
                ? formatTemplate(write.charCount, {
                    count: content.length,
                    minutes: estimateReadingTime(content),
                  })
                : ""}
            </span>
            <div className="row-sm max-md:ml-auto">
              <Button variant="ghost" type="button" onClick={handleBack}>
                {common.back}
              </Button>

              {(!isEditMode || editingPost?.isDraft) && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => void savePost(true)}
                >
                  {mutation.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Check data-icon="inline-start" size={16} strokeWidth={2.5} />
                  )}
                  {isEditMode ? write.updateDraft : write.saveDraft}
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
                    ? write.publishPost
                    : write.updatePost
                  : write.publishPost}
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
