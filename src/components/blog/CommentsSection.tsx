/**
 * @file CommentsSection.tsx
 * @description 文章详情页评论区：评论列表的分页加载、发表 / 编辑 / 删除（发表含乐观更新）、未登录引导登录、表单校验与错误提示
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

/** 空评论列表的稳定引用，避免每次渲染产生新数组导致多余的依赖变更 */
const EMPTY_COMMENTS: Comment[] = [];

/** 乐观列表动作：pending 插入临时评论，confirm 在真实数据进入列表后清除全部临时条目 */
type OptimisticCommentAction = { type: "pending"; comment: Comment } | { type: "confirm" };

/**
 * CommentsSection 评论区
 * @description 列表数据由 useComments（基于 offset 的分页）提供，评论的新增 / 修改 / 删除分别走三个 mutation：
 *              发表时先用 useOptimistic 插入临时评论占位，成功后用真实数据替换并同步文章评论数；
 *              编辑成功后替换本地条目；删除需二次确认，成功后移除条目并同步评论数。
 *              未登录时不渲染发表框，改为引导登录并带回跳地址；删除权限为评论作者本人或文章作者。
 * @param props {@link CommentsSectionProps}，postAuthorId 用于判定当前用户是否为文章作者（作者可删任意评论）
 * @returns 评论区整体，包含发表区、列表、加载更多与删除确认弹窗
 */
export function CommentsSection({ postId, user: ssrUser, postAuthorId }: CommentsSectionProps) {
  /** post 命名空间文案，用于评论区标题、占位符、删除确认等文本 */
  const t = useTranslations("post");

  /** common 命名空间文案，用于保存 / 取消 / 编辑 / 删除 / 重试等通用文案 */
  const tCommon = useTranslations("common");

  /** 当前语言，用于评论时间的相对时间格式化 */
  const locale = useLocale() as Locale;

  /** 评论列表分页 hook：数据、加载态、错误态与本地增删改方法 */
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

  /** 已加载的评论列表，未拿到数据时用稳定空数组兜底 */
  const comments = commentsData?.comments ?? EMPTY_COMMENTS;

  /** 评论总数：优先取接口返回值，缺省时按已加载条数估算 */
  const totalComments = commentsData?.total ?? comments.length;

  /** 发表评论 mutation */
  const createCommentMutation = useCreateComment(postId);

  /** 编辑评论 mutation */
  const updateCommentMutation = useUpdateComment();

  /** 删除评论 mutation */
  const deleteCommentMutation = useDeleteComment();

  /** 详情页登录态：user 为当前用户，requireAuth 在未登录时跳转登录，updatePost 用于同步文章评论数 */
  const { user, updatePost, requireAuth } = usePostPageAuth(postId, ssrUser);

  /**
   * 乐观评论列表：pending 动作把临时评论插到最前；confirm 动作在真实数据已写入基础列表后
   * 过滤掉全部临时条目，保证「真实落库」与「乐观清理」交替期间任何渲染都不会出现重复两条。
   * 乐观值在 transition 结束后自动回落，因此发表失败时无需手动回滚。
   */
  const [optimisticComments, addOptimisticComment] = useOptimistic<Comment[], OptimisticCommentAction>(
    comments,
    (current, action) =>
      action.type === "pending"
        ? [action.comment, ...current]
        : current.filter((c) => !c.id.startsWith("optimistic-")),
  );

  /** 发表评论请求的过渡状态，用作提交按钮 loading 与禁用；乐观值在其 pending 期间展示 */
  const [isPending, startTransition] = useTransition();

  /** 发表框的输入内容 */
  const [commentText, setCommentText] = useState("");

  /** 正在内联编辑的评论 ID，null 表示当前没有处于编辑态的评论 */
  const [editingId, setEditingId] = useState<string | null>(null);

  /** 编辑框的输入内容 */
  const [editText, setEditText] = useState("");

  /** 待删除的评论 ID，非空时打开删除确认弹窗 */
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  /** 发表评论的校验 / 服务端错误提示文本 */
  const [createError, setCreateError] = useState<string | null>(null);

  /** 编辑评论的校验 / 服务端错误提示文本 */
  const [editError, setEditError] = useState<string | null>(null);

  /**
   * 前端即时校验评论正文（发表与编辑共用）
   * @param value 待校验文本
   * @returns 校验失败返回提示文案；通过返回 null
   */
  const validateComment = (value: string): string | null =>
    validateFieldValue(createCommentSchema.shape.content, value, t("commentEmpty"));

  /** 当前操作的实体名（评论），用于拼装失败提示文案 */
  const commentLabel = entityName("comment");

  /** 发表失败的反馈规则：把服务端的 content 字段错误落到输入框，其余走表单级兜底文案 */
  const createErrorRules: ErrorFeedbackOptions<CommentField> = {
    fields: ["content"],
    fallback: msg("create", "failed", { entity: commentLabel }),
  };

  /** 编辑失败的反馈规则：字段同为 content，兜底文案为更新失败 */
  const updateErrorRules: ErrorFeedbackOptions<CommentField> = {
    fields: ["content"],
    fallback: msg("update", "failed", { entity: commentLabel }),
  };

  /** 删除失败的反馈规则：无字段级错误，统一走表单级 / toast 提示 */
  const deleteErrorRules: ErrorFeedbackOptions<never> = {
    fields: [],
    fallback: msg("delete", "failed", { entity: commentLabel }),
  };

  /**
   * 发表评论
   * @description 流程：先做前端校验，未通过则内联提示并中断；通过后交给 requireAuth——
   *              未登录会跳转登录页带回跳地址，已登录则进入 transition：先插入乐观临时评论并清空输入，
   *              再调用 mutation。成功时把真实评论写入列表、评论数 +1 并 confirm 清除临时条目；失败时写入 createError
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
        /** 乐观占位评论：id 用 optimistic- 前缀临时生成，confirm 时统一清除 */
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
              // 仅当用户没在失败期间重新输入时才回填原文，避免顶掉新敲的内容
              setCommentText((prev) => (prev.trim() ? prev : text));
            },
          },
        );

        /** 请求成功：真实评论写入列表并同步评论数，再 confirm 清除临时条目避免两条并存 */
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
   * @param cId 目标评论 ID
   * @param content 该评论当前正文，回填到编辑框
   */
  const startEdit = (cId: string, content: string) => {
    setEditingId(cId);
    setEditText(content);
    setEditError(null);
  };

  /**
   * 保存编辑
   * @description 先做与发表相同的前端校验；通过后调用更新 mutation，成功则退出编辑态并将列表中的旧评论替换为新内容，
   *              失败则把错误落到编辑框下方的 editError。
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
      {/* 标题：评论区标题 + 评论总数 */}
      <h2 className="mb-6 section-title">
        {t("commentsTitle")}{" "}
        <span className="ml-1.5 text-(length:--type-xs) font-normal text-muted opacity-80">
          · {totalComments}
        </span>
      </h2>

      {/* 发表区：已登录渲染输入框，未登录渲染登录引导 */}
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

                /* 用户重新输入即清除上一次的错误提示，避免旧错误一直停留 */
                if (createError) setCreateError(null);
              }}
              onKeyDown={(e) => {
                /* 支持 Cmd/Ctrl + Enter 快捷提交，不影响普通回车换行 */
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
            {/* 发表校验 / 服务端错误：内联展示在输入框下方，role=alert 便于读屏播报 */}
            {createError && (
              <span
                role="alert"
                className="mt-2 block text-(length:--type-2xs) leading-normal text-state-error"
              >
                {createError}
              </span>
            )}
            {/* 提交按钮：内容为空或提交中禁用，提交中展示 loading */}
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
          /* 未登录：链接到登录页并带上当前文章作为回跳地址，登录后回到本文继续评论 */
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

      {/* 评论列表区：依次处理错误态、首屏加载态、空态，并渲染评论条目与加载更多 */}
      <div className="card-list">
        {isError ? (
          /* 列表加载失败：给出重试入口，重试会重新触发 useComments 的拉取 */
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
          /* 首屏加载：用评论卡片骨架屏占位 */
          <div aria-busy="true" aria-label={t("commentsTitle")}>
            <CommentCardSkeleton />
          </div>
        ) : (
          /* 加载完成且无评论：空态引导 */
          optimisticComments.length === 0 && (
            <EmptyState
              icon={<MessageCircle size={20} strokeWidth={2.5} />}
              title={t("noCommentsTitle")}
              description={t("noCommentsDesc")}
            />
          )
        )}
        {/* 评论条目：编辑态与展示态二选一渲染 */}
        {optimisticComments.map((c) => {
          /** 是否该评论的作者本人，决定是否展示编辑入口 */
          const isCommentAuthor = !!user && c.userId === user.id;

          /** 删除权限：评论作者本人，或文章作者（后端同样会校验） */
          const canDelete =
            isCommentAuthor || (!!user && !!postAuthorId && postAuthorId === user.id);

          /** 拆分展示名为姓 / 名，用于生成头像首字母 */
          const { firstName, lastName } = splitName(c.userName);
          return (
            <div key={c.id} className="row-md card card-hover p-4">
              <Avatar
                initials={getInitials(firstName, lastName)}
                src={c.userAvatar || undefined}
                size="md"
              />
              <div className="min-w-0 flex-1">
                {/* 评论头部：作者名与相对时间 */}
                <div className="mb-1.5 row-md">
                  <span className="text-(length:--type-sm) leading-normal font-semibold text-heading">
                    {c.userName}
                  </span>
                  <span className="meta-text">{formatRelativeTime(c.createdAt, locale)}</span>
                </div>

                {editingId === c.id ? (
                  /* 编辑态：内联编辑框 + 保存 / 取消，编辑框回填原正文 */
                  <div className="mt-2">
                    <textarea
                      id={`comment-edit-${c.id}`}
                      name="comment"
                      aria-label={`${tCommon("edit")} ${t("commentsTitle")}`}
                      value={editText}
                      onChange={(e) => {
                        setEditText(e.target.value);

                        /* 重新输入即清除编辑错误提示 */
                        if (editError) setEditError(null);
                      }}
                      aria-invalid={!!editError}
                      rows={3}
                      maxLength={COMMENT_MAX_LENGTH}
                      className="input-focus textarea-field resize-y"
                    />
                    {/* 编辑错误提示：与发表区一致，内联展示并可被读屏播报 */}
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
                      {/* 取消编辑：仅退出编辑态并清空编辑框，不发起请求 */}
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
                  /* 展示态：评论正文 + 按权限展示的编辑 / 删除入口 */
                  <>
                    <p className="text-(length:--type-sm) leading-normal break-words text-body">
                      {c.content}
                    </p>
                    {(isCommentAuthor || canDelete) && (
                      <div className="mt-3 row-sm">
                        {/* 编辑入口：仅评论作者本人可见 */}
                        {isCommentAuthor && (
                          <button
                            onClick={() => startEdit(c.id, c.content)}
                            className="text-(length:--type-2xs) leading-normal text-muted transition-colors duration-[var(--duration-fast)] ease-smooth hover:text-heading"
                          >
                            {tCommon("edit")}
                          </button>
                        )}
                        {/* 删除入口：评论作者或文章作者可见，点击先打开确认弹窗 */}
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
        {/* 加载更多：仍有更多评论时展示，剩余数量按总数减去已渲染条数计算 */}
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

      {/* 删除确认弹窗：deleteTargetId 非空即打开，关闭或操作结束都会清空该状态 */}
      <Modal
        open={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        title={t("deleteCommentTitle")}
      >
        <p className="text-(length:--type-sm) leading-normal text-body">{t("deleteCommentDesc")}</p>
        <div className="mt-8 flex justify-end gap-2">
          {/* 取消：仅关闭弹窗 */}
          <Button variant="ghost" onClick={() => setDeleteTargetId(null)}>
            {tCommon("cancel")}
          </Button>
          {/* 确认删除：成功后从列表移除并让文章评论数 -1；失败走 toast；无论成败都收起弹窗 */}
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
            {t("confirmDeleteBtn")}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
