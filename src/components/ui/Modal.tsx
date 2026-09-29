/**
 * @file Modal.tsx
 * @description 通用模态对话框：经 portal 挂载到 body，负责 ESC/点击遮罩关闭、滚动锁定、Tab 焦点陷阱与焦点还原
 */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ModalProps } from "@shared";
import { useDismissable } from "@/hooks/useDismissable";

/** 退场动画时长（ms），需与 CSS 中 animate-pop-out 的过渡时长保持一致 */
const EXIT_MS = 200;

/** 焦点陷阱的可聚焦元素选择器：排除禁用与 tabindex="-1" 的元素 */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal 模态对话框
 * @param props {@link ModalProps}
 * @returns open 为 true 时通过 portal 渲染到 document.body，关闭时返回 null；关闭过程会先播完退场动画再卸载
 * @warning 依赖 document.body，只能在客户端组件中使用；滚动锁定由 useDismissable 负责，卸载时会恢复原 overflow
 */
export function Modal({ open, onClose, title, children, maxWidth = "max-w-sm" }: ModalProps) {
  /** 对话框面板引用，焦点陷阱与初始聚焦都以此节点为边界 */
  const dialogRef = useRef<HTMLDivElement>(null);

  /** 标题元素的唯一 id，供 aria-labelledby 关联，避免多实例冲突 */
  const titleId = useId();
  const t = useTranslations("common");

  /** 是否已挂载进 DOM，用于支撑进入/退出两段动画的过渡期 */
  const [mounted, setMounted] = useState(false);

  /** 是否处于退场动画中，决定 class 走 pop-out 还是 pop-in */
  const [exiting, setExiting] = useState(false);

  /** 打开前持有焦点的元素，关闭后归还焦点，保证键盘用户不会丢失位置 */
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // 统一处理 ESC 关闭、点击遮罩关闭与 body 滚动锁定
  useDismissable(open, onClose, [dialogRef], { lockScroll: true });

  // 管理挂载与退场时序：打开即挂载；关闭时先播放退场动画，动画结束后再卸载
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

  // 焦点管理：打开时记录来源焦点并劫持 Tab 循环，关闭时把焦点还给来源元素
  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    /** Tab / Shift+Tab 在首尾可聚焦元素间循环，把焦点锁在对话框内 */
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

      // 关闭后恢复焦点；元素可能已从 DOM 移除，故先校验 contains
      const el = restoreFocusRef.current;
      if (el && document.contains(el)) el.focus();
    };
  }, [open]);

  // 挂载完成后把初始焦点移入对话框，避免焦点停留在背后的页面
  useEffect(() => {
    if (open && mounted) dialogRef.current?.focus();
  }, [open, mounted]);

  if (!mounted) return null;

  // portal 挂载到 body，规避父级 overflow / transform 对 fixed 定位的干扰
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      className={`fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 modal-overlay transition-opacity duration-[var(--duration-fast)] ease-smooth ${
        exiting ? "pointer-events-none opacity-0" : "animate-fade-in opacity-100"
      }`}
    >
      {/* 对话框面板：tabIndex=-1 使其可编程聚焦，退场时禁用指针事件防止误点 */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`w-full ${maxWidth} rounded-2xl border border-card-border bg-card-bg p-8 shadow-(--shadow-panel) focus:outline-none ${
          exiting ? "animate-pop-out" : "animate-pop-in"
        }`}
      >
        {/* 标题栏：仅在传入 title 时渲染，关闭按钮带 i18n 的 aria-label */}
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
