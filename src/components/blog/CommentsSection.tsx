/**
 * @file CommentsSection.tsx
 * @description 文章评论区组件：评论列表分页懒加载、发表/编辑/删除评论；
 *              发表采用 useOptimistic 两段式乐观更新——先插入 optimistic- 前缀临时评论（pending），
 *              接口成功后拉取真实数据并过滤临时条目（confirm），失败不派发 confirm，
 *              transition 结束后乐观值自动回落并回填输入框；未登录经 requireAuth 引导登录
 */
"use client";

import { useOptimistic, useTransition, useState } from "react";
import { Link } from "@/i18n/navigation";
import { AlertCircle, MessageCircle, Send, Check, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from "@/hooks/useComments";
import { usePostPageAuth } from "@/hooks/usePostPageAuth";
import {
  resolveSubmitError,
  validateFieldValue,
  type ErrorFeedbackOptions,
} from "@/lib/formFeedback";
import { getInitials, splitName, formatRelativeTime } from "@/lib/format";
import { entityName, msg } from "@/lib/message";
import { notify } from "@/lib/toast";
import type { Locale } from "@/i18n/config";
import { COMMENT_MAX_LENGTH, createCommentSchema } from "@/shared/validation/comment";
import { postPath } from "@shared";
import type { CommentField, CommentsSectionProps, Comment } from "@shared";
import { CommentCardSkeleton } from "@/components/skeletons/CommentsSkeleton";
import { buildLoginRedirect } from "@/lib/url";

/** 评论列表的稳定空数组兜底，避免每次渲染创建新引用破坏 memo/依赖比较 */
const EMPTY_COMMENTS: Comment[] = [];

/**
 * 乐观评论更新动作
 * pending-插入临时评论到列表头部；confirm-过滤掉全部 optimistic- 前缀临时条目
 */
type OptimisticCommentAction = { type: "pending"; comment: Comment } | { type: "confirm" };

/**
 * CommentsSection 评论区
 * @param postId 文章ID，评论查询与提交的目标
 * @param ssrUser 服务端注入的当前登录用户，避免首屏闪烁
 * @param postAuthorId 文章作者ID，用于判定"作者可删除任意评论"的权限
 */
export function CommentsSection({ postId, user: ssrUser, postAuthorId }: CommentsSectionProps) {
  const t = useTranslations("post");

  const tCommon = useTranslations("common");

  const locale = useLocale() as Locale;

  /** 评论分页数据与增删改操作集合（经 useComments 封装的懒加载查询） */
  const {
    data: commentsData,
    isLoading: isLoadingComments,
    isLoadingMore,
    isError,
    refetch: refetchComments,
    loadMore,
    appendComment,
    replaceComment,
    removeComment,
  } = useComments(postId);

  /** 当前已加载的评论列表 */
  const comments = commentsData?.comments ?? EMPTY_COMMENTS;

  /** 评论总数（分页元信息），用于"加载更多"剩余数量提示 */
  const totalComments = commentsData?.total ?? comments.length;

  /** 发表评论 mutation */
  const createCommentMutation = useCreateComment(postId);

  /** 编辑评论 mutation */
  const updateCommentMutation = useUpdateComment();

  /** 删除评论 mutation */
  const deleteCommentMutation = useDeleteComment();

  /** 当前登录用户、文章状态更新方法与登录守卫（未登录时跳转登录页并在登录后回跳） */
  const { user, updatePost, requireAuth } = usePostPageAuth(postId, ssrUser);

  /**
   * 乐观评论列表：基于真实评论派生
   * pending 时在头部插入 optimistic- 前缀临时评论，confirm 时过滤全部临时条目；
   * 接口失败不派发 confirm，transition 结束后乐观值自动回落为真实列表
   */
  const [optimisticComments, addOptimisticComment] = useOptimistic<
    Comment[],
    OptimisticCommentAction
  >(comments, (current, action) =>
    action.type === "pending"
      ? [action.comment, ...current]
      : current.filter((c) => !c.id.startsWith("optimistic-")),
  );

  /** 发表评论的 transition 进行中标记，用于提交按钮 loading 与禁用 */
  const [isPending, startTransition] = useTransition();

  /** 新评论输入内容 */
  const [commentText, setCommentText] = useState("");

  /** 正在编辑的评论ID，null 表示无编辑中的评论 */
  const [editingId, setEditingId] = useState<string | null>(null);

  /** 编辑中的评论内容 */
  const [editText, setEditText] = useState("");

  /** 待删除的评论ID，非 null 时展示删除确认弹窗 */
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  /** 发表评论的校验/接口错误文案 */
  const [createError, setCreateError] = useState<string | null>(null);

  /** 编辑评论的校验/接口错误文案 */
  const [editError, setEditError] = useState<string | null>(null);

  /**
   * 校验评论内容（复用评论创建 schema 的 content 字段规则）
   * @param value 待校验文本
   * @returns 错误文案，合法返回 null
   */
  const validateComment = (value: string): string | null =>
    validateFieldValue(createCommentSchema.shape.content, value, t("commentEmpty"));

  /** 评论实体名，用于拼接错误兜底文案 */
  const commentLabel = entityName("comment");

  const createErrorRules: ErrorFeedbackOptions<CommentField> = {
    fields: ["content"],
    fallback: msg("create", "failed", { entity: commentLabel }),
  };

  const updateErrorRules: ErrorFeedbackOptions<CommentField> = {
    fields: ["content"],
    fallback: msg("update", "failed", { entity: commentLabel }),
  };

  const deleteErrorRules: ErrorFeedbackOptions<never> = {
    fields: [],
    fallback: msg("delete", "failed", { entity: commentLabel }),
  };

  /**
   * 发表评论：两段式乐观更新
   * 1. 本地校验通过且登录后，构造 optimistic- 前缀临时评论插入列表头部（pending），并清空输入框；
   * 2. 接口成功：appendComment 写入真实数据、文章评论数 +1、派发 confirm 过滤临时条目；
   * 3. 接口失败：不派发 confirm，transition 结束后乐观列表回落，输入内容回填
   */
  const submitComment = () => {
    const invalid = validateComment(commentText);
    if (invalid) {
      setCreateError(invalid);
      return;
    }
    setCreateError(null);
    const text = commentText.trim();
    requireAuth(() => {
      startTransition(async () => {
        /** optimistic- 前缀的临时评论，供 confirm 阶段按前缀过滤识别 */
        const tempComment: Comment = {
          id: `optimistic-${Date.now()}`,
          postId,
          userId: user?.id ?? "",
          userName: user ? `${user.firstName} ${user.lastName}` : "",
          userAvatar: user?.avatar || undefined,
          content: text,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addOptimisticComment({ type: "pending", comment: tempComment });
        setCommentText("");
        const data = await createCommentMutation.mutate(
          { content: text },
          {
            onError: (err) => {
              const failed = resolveSubmitError(err, createErrorRules);
              setCreateError(failed.fields.content ?? failed.form);

              setCommentText((prev) => (prev.trim() ? prev : text));
            },
          },
        );

        if (data) {
          appendComment(data);
          updatePost((prev) => ({ ...prev, commentsCount: prev.commentsCount + 1 }));
          addOptimisticComment({ type: "confirm" });
        }
      });
    });
  };

  /**
   * 进入编辑态：填充编辑内容并清空上次的编辑错误
   */
  const startEdit = (cId: string, content: string) => {
    setEditingId(cId);
    setEditText(content);
    setEditError(null);
  };

  /**
   * 保存编辑：校验通过后调用更新接口，
   * 成功用服务端返回的评论整条替换本地数据；失败展示字段/兜底错误并保留编辑态
   */
  const saveEdit = () => {
    const invalid = validateComment(editText);
    if (invalid) {
      setEditError(invalid);
      return;
    }
    setEditError(null);
    if (!editingId) return;
    const text = editText.trim();
    updateCommentMutation.mutate(
      { commentId: editingId, dto: { content: text } },
      {
        onSuccess: (updated) => {
          setEditingId(null);
          setEditText("");
          replaceComment(updated);
        },
        onError: (err) => {
          const failed = resolveSubmitError(err, updateErrorRules);
          setEditError(failed.fields.content ?? failed.form);
        },
      },
    );
  };

  return (
    <section className="mt-10 mb-12">
      <h2 className="mb-6 section-title">
        {t("commentsTitle")}{" "}
        <span className="ml-1.5 text-(length:--type-xs) font-normal text-muted opacity-80">
          · {totalComments}
        </span>
      </h2>

      <div className="mb-8">
        {user ? (
          <>
            <textarea
              id="comment-content"
              name="comment"
              aria-label={t("commentPlaceholder")}
              value={commentText}
              onChange={(e) => {
                setCommentText(e.target.value);

                if (createError) setCreateError(null);
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  submitComment();
                }
              }}
              placeholder={t("commentPlaceholder")}
              aria-invalid={!!createError}
              maxLength={COMMENT_MAX_LENGTH}
              rows={4}
              className="input-focus textarea-field"
            />

            {createError && (
              <span
                role="alert"
                className="mt-2 block text-(length:--type-2xs) leading-normal text-state-error"
              >
                {createError}
              </span>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                onClick={submitComment}
                disabled={!commentText.trim() || isPending}
                loading={isPending}
              >
                <Send size={16} strokeWidth={2.5} />
                {t("submitComment")}
              </Button>
            </div>
          </>
        ) : (
          /* 未登录：展示登录引导文案，携带当前文章路径作为回跳地址 */
          <div className="card rounded-xl border border-stroke p-6 text-center text-(length:--type-xs) leading-normal text-muted">
            <Link
              href={buildLoginRedirect(postPath(postId))}
              className="text-accent hover:underline"
            >
              {t("commentLoginBefore")}
            </Link>
            {t("commentLoginAfter")}
          </div>
        )}
      </div>

      <div className="card-list">
        {isError ? (
          <EmptyState
            icon={<AlertCircle size={20} strokeWidth={2.5} />}
            title={t("commentLoadError")}
            action={
              <Button variant="ghost" onClick={() => refetchComments()}>
                {tCommon("retry")}
              </Button>
            }
          />
        ) : isLoadingComments ? (
          <div aria-busy="true" aria-label={t("commentsTitle")}>
            <CommentCardSkeleton />
          </div>
        ) : (
          optimisticComments.length === 0 && (
            <EmptyState
              icon={<MessageCircle size={20} strokeWidth={2.5} />}
              title={t("noCommentsTitle")}
              description={t("noCommentsDesc")}
            />
          )
        )}

        {optimisticComments.map((c) => {
          /** 是否为该条评论的作者（可编辑、可删除自己的评论） */
          const isCommentAuthor = !!user && c.userId === user.id;

          /** 可删除范围：评论作者本人，或文章作者（可删除任意评论） */
          const canDelete =
            isCommentAuthor || (!!user && !!postAuthorId && postAuthorId === user.id);

          const { firstName, lastName } = splitName(c.userName);
          return (
            <div key={c.id} className="row-md card card-hover p-4">
              <Avatar
                initials={getInitials(firstName, lastName)}
                src={c.userAvatar || undefined}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 row-md">
                  <span className="text-(length:--type-sm) leading-normal font-semibold text-heading">
                    {c.userName}
                  </span>
                  <span className="meta-text">{formatRelativeTime(c.createdAt, locale)}</span>
                </div>

                {editingId === c.id ? (
                  <div className="mt-2">
                    <textarea
                      id={`comment-edit-${c.id}`}
                      name="comment"
                      aria-label={`${tCommon("edit")} ${t("commentsTitle")}`}
                      value={editText}
                      onChange={(e) => {
                        setEditText(e.target.value);

                        if (editError) setEditError(null);
                      }}
                      aria-invalid={!!editError}
                      rows={3}
                      maxLength={COMMENT_MAX_LENGTH}
                      className="input-focus textarea-field resize-y"
                    />

                    {editError && (
                      <span
                        role="alert"
                        className="mt-2 block text-(length:--type-2xs) leading-normal text-state-error"
                      >
                        {editError}
                      </span>
                    )}
                    <div className="mt-4 row-sm">
                      <Button
                        size="sm"
                        onClick={saveEdit}
                        loading={updateCommentMutation.isPending}
                      >
                        <Check size={14} strokeWidth={2.5} />
                        {tCommon("save")}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(null);
                          setEditText("");
                        }}
                      >
                        {tCommon("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-(length:--type-sm) leading-normal break-words text-body">
                      {c.content}
                    </p>
                    {(isCommentAuthor || canDelete) && (
                      <div className="mt-3 row-sm">
                        {isCommentAuthor && (
                          <button
                            onClick={() => startEdit(c.id, c.content)}
                            className="text-(length:--type-2xs) leading-normal text-muted transition-colors duration-[var(--duration-fast)] ease-smooth hover:text-heading"
                          >
                            {tCommon("edit")}
                          </button>
                        )}

                        {canDelete && (
                          <button
                            onClick={() => setDeleteTargetId(c.id)}
                            className="text-(length:--type-2xs) leading-normal text-muted transition-colors duration-[var(--duration-fast)] ease-smooth hover:text-heading"
                          >
                            {tCommon("delete")}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* 分页懒加载：仍有更多评论时展示"加载更多"按钮，按剩余数量提示 */}
        {commentsData?.hasMore && (
          <div className="mt-6 text-center">
            <Button variant="ghost" size="sm" onClick={loadMore} loading={isLoadingMore}>
              {t("loadMoreComments", {
                count: Math.max(0, totalComments - optimisticComments.length),
              })}
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        title={t("deleteCommentTitle")}
      >
        <p className="text-(length:--type-sm) leading-normal text-body">{t("deleteCommentDesc")}</p>
        <div className="mt-8 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTargetId(null)}>
            {tCommon("cancel")}
          </Button>

          <Button
            variant="danger"
            loading={deleteCommentMutation.isPending}
            onClick={() => {
              if (deleteTargetId) {
                const targetId = deleteTargetId;
                /* 删除成功后同步本地：移除该条评论并令文章评论数 -1（下限 0），无论成败关闭弹窗 */
                deleteCommentMutation.mutate(targetId, {
                  onSuccess: () => {
                    removeComment(targetId);
                    updatePost((prev) => ({
                      ...prev,
                      commentsCount: Math.max(0, prev.commentsCount - 1),
                    }));
                  },
                  onError: (err) => {
                    const failed = resolveSubmitError(err, deleteErrorRules);
                    notify.fail(failed.form ?? deleteErrorRules.fallback);
                  },
                  onSettled: () => setDeleteTargetId(null),
                });
              }
            }}
          >
            <Trash2 size={16} strokeWidth={2.5} />
            {t("confirmDeleteBtn")}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
