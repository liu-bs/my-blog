/**
 * @file Modal.tsx
 * @description 模态对话框组件，基于 Portal 渲染到 body：Tab 焦点循环、Escape/遮罩点击关闭（useDismissable）、关闭后恢复打开前焦点、开关带淡入淡出动画
 */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ModalProps } from "@shared";
import { useDismissable } from "@/hooks/useDismissable";

/** 关闭动画持续时间（ms），动画播完才真正卸载 DOM */
const EXIT_MS = 200;

/** 可聚焦元素选择器，供 Tab 焦点循环收集对话框内可聚焦节点 */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal 模态对话框
 * @description 未打开时不渲染；打开后 Portal 到 body，aria-modal 标记模态语义，退出动画期间遮罩禁用交互
 * @param props {@link ModalProps} open 开关、onClose 回调、标题与内容，maxWidth 控制宽度
 */
export function Modal({ open, onClose, title, children, maxWidth = "max-w-sm" }: ModalProps) {
  /** 对话框容器 Ref：初始聚焦与焦点循环都基于此元素 */
  const dialogRef = useRef<HTMLDivElement>(null);

  /** 标题元素 id，供 aria-labelledby 关联 */
  const titleId = useId();
  const t = useTranslations("common");

  /** 对话框是否已挂载：打开期间与退出动画期间为 true */
  const [mounted, setMounted] = useState(false);

  /** 是否处于关闭退出动画阶段，用于切换淡出样式 */
  const [exiting, setExiting] = useState(false);

  /** 记录打开前的焦点元素，关闭后恢复焦点 */
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  /** 遮罩点击/Escape 触发 onClose，并锁定 body 滚动 */
  useDismissable(open, onClose, [dialogRef], { lockScroll: true });

  /**
   * 开关状态驱动挂载与退出动画
   * 打开：立即挂载并复位退出标记；关闭：先播放退出动画，EXIT_MS 后卸载 DOM
   */
  useEffect(() => {
    if (open) {
      setMounted(true);
      setExiting(false);
      return;
    }
    if (mounted) {
      setExiting(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setExiting(false);
      }, EXIT_MS);
      return () => clearTimeout(timer);
    }
  }, [open, mounted]);

  /**
   * 焦点管理：打开时记录触发前焦点，监听 Tab 在对话框内做焦点循环
   * 清理时移除监听并恢复打开前的焦点
   */
  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    /** Tab 键处理：焦点在首个与末个可聚焦元素间循环（Shift+Tab 反向） */
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);

      // 恢复打开前的焦点；触发元素可能已随外部状态卸载，需确认仍在文档中
      const el = restoreFocusRef.current;
      if (el && document.contains(el)) el.focus();
    };
  }, [open]);

  /** 对话框挂载后主动聚焦容器，使 Tab 焦点循环从对话框内部开始 */
  useEffect(() => {
    if (open && mounted) dialogRef.current?.focus();
  }, [open, mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      className={`fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 modal-overlay transition-opacity duration-[var(--duration-fast)] ease-smooth ${
        exiting ? "pointer-events-none opacity-0" : "animate-fade-in opacity-100"
      }`}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`w-full ${maxWidth} rounded-2xl border border-card-border bg-card-bg p-8 shadow-(--shadow-panel) focus:outline-none ${
          exiting ? "animate-pop-out" : "animate-pop-in"
        }`}
      >
        {title && (
          <div className="mb-7 row-md justify-between">
            <h3
              id={titleId}
              className="text-(length:--type-md) leading-normal font-semibold text-heading"
            >
              {title}
            </h3>
            <button onClick={onClose} className="icon-btn-ghost" aria-label={t("close")}>
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
