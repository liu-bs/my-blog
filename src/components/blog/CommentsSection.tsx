/**
 * @file CommentsSection.tsx
 * @description 文章评论区完整交互组件：发表评论（乐观渲染 + Cmd/Ctrl+Enter 快捷键）、
 * 就地编辑、删除确认弹窗（评论作者或文章作者可删）、分页加载更多；
 * 未登录展示登录引导链接。数据与增删改经 useComments 系列 hooks 走 REST，登录态由 usePostPageAuth 提供，
 * 评论数变化会同步回写 PostStateProvider 中的文章数据。仅在 LazyIslands 判定进入视口后挂载。
 */
"use client";

import { useOptimistic, useTransition, useState } from "react";
import Link from "next/link";
import { AlertCircle, MessageCircle, Send, Check, Trash2 } from "lucide-react";
import { formatTemplate, messages } from "@/texts";
import { Modal } from "@/components/ui/Modal";
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
import { joinName } from "@shared/format";
import { entityName } from "@/lib/message";
import { notify } from "@/lib/toast";
import { COMMENT_MAX_LENGTH, createCommentSchema } from "@/shared/validation/comment";
import { postPath } from "@shared";
import type { CommentField, CommentsSectionProps, Comment } from "@shared";
import { CommentCardView } from "@/components/blog/CommentCardView";
import { CommentCardSkeleton } from "@/components/skeletons/CommentsSkeleton";
import { buildLoginRedirect } from "@/lib/url";

/** 评论列表空数据常量，避免每次渲染新建数组导致 hooks 依赖抖动 */
const EMPTY_COMMENTS: Comment[] = [];

/**
 * useOptimistic 的动作类型：pending 表示插入临时评论，confirm 表示移除所有 optimistic- 前缀的临时项
 */
type OptimisticCommentAction = { type: "pending"; comment: Comment } | { type: "confirm" };

/**
 * 评论区（发布/编辑/删除/加载更多）
 * @param props {@link CommentsSectionProps} postId 文章ID、user 为 SSR 透传用户、
 * postAuthorId 文章作者ID（决定能否删他人评论）、initialData 服务端预取首页数据
 */
export function CommentsSection({
  postId,
  user: ssrUser,
  postAuthorId,
  initialData = null,
}: CommentsSectionProps) {
  // 评论列表数据源：useComments 管理分页与本地增删改
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
  } = useComments(postId, initialData);

  const comments = commentsData?.comments ?? EMPTY_COMMENTS;

  /** 评论总数，接口未返回时回退为当前列表长度 */
  const totalComments = commentsData?.total ?? comments.length;

  /** 创建评论 mutation */
  const createCommentMutation = useCreateComment(postId);

  /** 更新评论 mutation */
  const updateCommentMutation = useUpdateComment();

  /** 删除评论 mutation */
  const deleteCommentMutation = useDeleteComment();

  // 登录态与文章上下文状态（updatePost 用于同步评论数）
  const { user, updatePost, requireAuth } = usePostPageAuth(postId, ssrUser);

  // 乐观评论列表：pending 时把临时评论置顶插入，confirm 时清除所有 optimistic- 前缀项
  const [optimisticComments, addOptimisticComment] = useOptimistic<
    Comment[],
    OptimisticCommentAction
  >(comments, (current, action) =>
    action.type === "pending"
      ? [action.comment, ...current]
      : current.filter((c) => !c.id.startsWith("optimistic-")),
  );

  const [isPending, startTransition] = useTransition();

  /** 新评论输入框内容 */
  const [commentText, setCommentText] = useState("");

  /** 正在编辑的评论ID，null 表示无编辑态 */
  const [editingId, setEditingId] = useState<string | null>(null);

  /** 编辑态输入框内容 */
  const [editText, setEditText] = useState("");

  /** 删除确认弹窗的目标评论ID，null 表示弹窗关闭 */
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  /** 发表评论的字段/表单错误信息 */
  const [createError, setCreateError] = useState<string | null>(null);

  /** 编辑评论的错误信息 */
  const [editError, setEditError] = useState<string | null>(null);

  /**
   * 用 createCommentSchema 的 content 规则校验评论内容
   * @param value 待校验内容
   * @returns 错误文案，合法时返回 null
   */
  const validateComment = (value: string): string | null =>
    validateFieldValue(createCommentSchema.shape.content, value, messages.post.commentEmpty);

  /** "评论"实体的提示文案名称 */
  const commentLabel = entityName("comment");

  /** 创建失败的错误回显规则：content 字段级 + 兜底表单级 */
  const createErrorRules: ErrorFeedbackOptions<CommentField> = {
    fields: ["content"],
    fallback: formatTemplate(messages.feedback.create.failed, { entity: commentLabel }),
  };

  /** 更新失败的错误回显规则 */
  const updateErrorRules: ErrorFeedbackOptions<CommentField> = {
    fields: ["content"],
    fallback: formatTemplate(messages.feedback.update.failed, { entity: commentLabel }),
  };

  /** 删除失败的错误回显规则（仅表单级兜底） */
  const deleteErrorRules: ErrorFeedbackOptions<never> = {
    fields: [],
    fallback: formatTemplate(messages.feedback.delete.failed, { entity: commentLabel }),
  };

  /**
   * 发表新评论：先本地校验，再在过渡中插入乐观评论并清空输入；
   * 接口失败时回显错误并尽量恢复用户输入的文本，成功后追加真实数据、
   * 评论数 +1 并清除乐观临时项
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
        const tempComment: Comment = {
          id: `optimistic-${Date.now()}`,
          postId,
          userId: user?.id ?? "",
          userName: user ? joinName(user.firstName, user.lastName) : "",
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
   * 进入某条评论的编辑态
   * @param cId 评论ID
   * @param content 评论原内容，作为编辑初始值
   */
  const startEdit = (cId: string, content: string) => {
    setEditingId(cId);
    setEditText(content);
    setEditError(null);
  };

  /**
   * 保存编辑：本地校验通过后调用更新接口，
   * 成功退出编辑态并替换列表数据，失败回显字段错误
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
      {/* 评论区标题 + 评论总数 */}
      <h2 className="mb-6 section-title">
        {messages.post.commentsTitle}{" "}
        <span className="ml-1.5 text-(length:--type-xs) font-normal text-muted opacity-80">
          · {totalComments}
        </span>
      </h2>

      {/* 发表评论区：登录展示编辑器，未登录展示登录引导链接（携带回跳地址） */}
      <div className="mb-8">
        {user ? (
          <>
            {/* 评论输入框：支持 Cmd/Ctrl+Enter 快捷提交，maxLength 与服务端校验一致 */}
            <textarea
              id="comment-content"
              name="comment"
              aria-label={messages.post.commentPlaceholder}
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
              placeholder={messages.post.commentPlaceholder}
              aria-invalid={!!createError}
              maxLength={COMMENT_MAX_LENGTH}
              rows={4}
              className="input-focus textarea-field"
            />

            {/* 发表错误提示 */}
            {createError && (
              <span
                role="alert"
                className="mt-2 block text-(length:--type-2xs) leading-normal text-state-error"
              >
                {createError}
              </span>
            )}

            {/* 提交按钮：内容为空或过渡中禁用 */}
            <div className="mt-4 flex justify-end">
              <Button
                onClick={submitComment}
                disabled={!commentText.trim() || isPending}
                loading={isPending}
              >
                <Send size={16} strokeWidth={2.5} />
                {messages.post.submitComment}
              </Button>
            </div>
          </>
        ) : (
          <div className="card rounded-xl border border-stroke p-6 text-center text-(length:--type-xs) leading-normal text-muted">
            {/* 登录引导：登录后回跳到当前文章页 */}
            <Link
              href={buildLoginRedirect(postPath(postId))}
              className="text-accent hover:underline"
            >
              {messages.post.commentLoginBefore}
            </Link>
            {messages.post.commentLoginAfter}
          </div>
        )}
      </div>

      {/* 评论列表区：错误/加载/空态互斥，其下渲染乐观评论卡片 */}
      <div className="card-list">
        {isError ? (
          <EmptyState
            icon={<AlertCircle size={20} strokeWidth={2.5} />}
            title={messages.post.commentLoadError}
            action={
              <Button variant="ghost" onClick={() => refetchComments()}>
                {messages.common.retry}
              </Button>
            }
          />
        ) : isLoadingComments ? (
          <div aria-busy="true" aria-label={messages.post.commentsTitle}>
            <CommentCardSkeleton />
          </div>
        ) : (
          optimisticComments.length === 0 && (
            <EmptyState
              icon={<MessageCircle size={20} strokeWidth={2.5} />}
              title={messages.post.noCommentsTitle}
              description={messages.post.noCommentsDesc}
            />
          )
        )}

        {/* 单条评论卡片：编辑态渲染表单，否则渲染正文 + 作者/文章主的编辑删除入口 */}
        {optimisticComments.map((c) => {
          /** 当前登录用户是否为该评论作者 */
          const isCommentAuthor = !!user && c.userId === user.id;

          /** 可删除条件：评论作者本人，或当前用户是文章作者（可删任何人评论） */
          const canDelete =
            isCommentAuthor || (!!user && !!postAuthorId && postAuthorId === user.id);

          return (
            <CommentCardView key={c.id} comment={c}>
              {editingId === c.id ? (
                <div className="mt-2">
                  {/* 编辑输入框 */}
                  <textarea
                    id={`comment-edit-${c.id}`}
                    name="comment"
                    aria-label={`${messages.common.edit} ${messages.post.commentsTitle}`}
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

                  {/* 编辑错误提示 */}
                  {editError && (
                    <span
                      role="alert"
                      className="mt-2 block text-(length:--type-2xs) leading-normal text-state-error"
                    >
                      {editError}
                    </span>
                  )}
                  {/* 保存 / 取消按钮 */}
                  <div className="mt-4 row-sm">
                    <Button size="sm" onClick={saveEdit} loading={updateCommentMutation.isPending}>
                      <Check size={14} strokeWidth={2.5} />
                      {messages.common.save}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(null);
                        setEditText("");
                      }}
                    >
                      {messages.common.cancel}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* 评论正文 */}
                  <p className="text-(length:--type-sm) leading-normal break-words text-body">
                    {c.content}
                  </p>
                  {/* 操作行：编辑仅作者可见，删除作者与文章主可见 */}
                  {(isCommentAuthor || canDelete) && (
                    <div className="mt-3 row-sm">
                      {isCommentAuthor && (
                        <button
                          onClick={() => startEdit(c.id, c.content)}
                          className="text-(length:--type-2xs) leading-normal text-muted transition-colors duration-[var(--duration-fast)] ease-smooth hover:text-heading"
                        >
                          {messages.common.edit}
                        </button>
                      )}

                      {canDelete && (
                        <button
                          onClick={() => setDeleteTargetId(c.id)}
                          className="text-(length:--type-2xs) leading-normal text-muted transition-colors duration-[var(--duration-fast)] ease-smooth hover:text-heading"
                        >
                          {messages.common.delete}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </CommentCardView>
          );
        })}

        {/* 加载更多：剩余条数取自总数减去已展示数量 */}
        {commentsData?.hasMore && (
          <div className="mt-6 text-center">
            <Button variant="ghost" size="sm" onClick={loadMore} loading={isLoadingMore}>
              {formatTemplate(messages.post.loadMoreComments, {
                count: Math.max(0, totalComments - optimisticComments.length),
              })}
            </Button>
          </div>
        )}
      </div>

      {/* 删除评论确认弹窗 */}
      <Modal
        open={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        title={messages.post.deleteCommentTitle}
      >
        <p className="text-(length:--type-sm) leading-normal text-body">
          {messages.post.deleteCommentDesc}
        </p>
        {/* 弹窗操作区：确认删除成功后移除列表项并同步评论数 -1（下限 0），失败弹 toast */}
        <div className="mt-8 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTargetId(null)}>
            {messages.common.cancel}
          </Button>

          <Button
            variant="danger"
            loading={deleteCommentMutation.isPending}
            onClick={() => {
              if (deleteTargetId) {
                const targetId = deleteTargetId;

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
            {messages.post.confirmDeleteBtn}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
