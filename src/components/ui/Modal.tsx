/**
 * @file Modal.tsx
 * @description 通用模态框组件，通过 createPortal 挂载到 document.body；支持进出场动画、焦点陷阱、
 * Esc/遮罩关闭（useDismissable）、滚动锁定与关闭后焦点归还；用于删除确认、编辑弹窗等场景
 */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { messages } from "@/texts";
import type { ModalProps } from "@shared";
import { useDismissable } from "@/hooks/useDismissable";

/** 退场动画时长，单位ms，需与 CSS pop-out 动画时长保持一致 */
const EXIT_MS = 200;

/** 焦点陷阱内可聚焦元素的选择器（排除 disabled 与 tabindex=-1 元素） */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 模态框组件
 * @param props.open 是否打开，false 时触发退场动画后卸载
 * @param props.onClose 关闭回调（Esc、遮罩点击、右上角按钮均触发）
 * @param props.title 标题文本，存在时渲染标题栏并通过 aria-labelledby 关联
 * @param props.children 模态框内容区
 * @param props.maxWidth 内容面板最大宽度类名，默认 max-w-sm
 * @warning open 与 mounted 状态解耦：关闭后 DOM 还会保留 EXIT_MS 毫秒用于退场动画，勿在其间依赖卸载时机做副作用
 */
export function Modal({ open, onClose, title, children, maxWidth = "max-w-sm" }: ModalProps) {
  /* 内容面板元素引用，用于自动聚焦 */
  const dialogRef = useRef<HTMLDivElement>(null);

  /* 标题元素唯一 id，供 aria-labelledby 关联 */
  const titleId = useId();

  /* DOM 是否已挂载，退场动画结束后才置 false */
  const [mounted, setMounted] = useState(false);

  /* 是否处于退场动画阶段，控制淡出/弹出反向动画类名 */
  const [exiting, setExiting] = useState(false);

  /* 打开模态框前的焦点元素，关闭后归还焦点 */
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  /* 统一处理 Esc 键与遮罩点击关闭，并锁定页面滚动 */
  useDismissable(open, onClose, [dialogRef], { lockScroll: true });

  /**
   * 同步 open 与挂载状态：打开立即挂载并清除退场标记；
   * 关闭先播放退场动画，EXIT_MS 后卸载
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
   * 打开期间的焦点管理：记录打开前焦点元素，
   * 监听 Tab 键实现焦点陷阱，清理时归还焦点
   */
  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    /**
     * Tab 键焦点循环处理：首元素向前 Shift+Tab 跳至末元素，反之亦然
     * @param e 原生键盘事件
     */
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

      /* 关闭后把焦点还给打开前的元素（若仍在文档中） */
      const el = restoreFocusRef.current;
      if (el && document.contains(el)) el.focus();
    };
  }, [open]);

  /* 挂载完成后自动聚焦内容面板，保证键盘用户可立即操作 */
  useEffect(() => {
    if (open && mounted) dialogRef.current?.focus();
  }, [open, mounted]);

  if (!mounted) return null;

  return createPortal(
    /* 全屏遮罩层：role=dialog + aria-modal 标记模态语义，退场时淡出并禁用指针事件 */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      className={`fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 modal-overlay transition-opacity duration-[var(--duration-fast)] ease-smooth ${
        exiting ? "pointer-events-none opacity-0" : "animate-fade-in opacity-100"
      }`}
    >
      {/* 内容面板：宽度受 maxWidth 控制，进出场播放 pop 动画 */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`w-full ${maxWidth} rounded-2xl border border-card-border bg-card-bg p-8 shadow-(--shadow-panel) focus:outline-none ${
          exiting ? "animate-pop-out" : "animate-pop-in"
        }`}
      >
        {/* 标题栏：标题文本 + 右上角关闭按钮，仅传入 title 时渲染 */}
        {title && (
          <div className="mb-7 row-md justify-between">
            <h3
              id={titleId}
              className="text-(length:--type-md) leading-normal font-semibold text-heading"
            >
              {title}
            </h3>
            <button onClick={onClose} className="icon-btn-ghost" aria-label={messages.common.close}>
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* 模态框主体内容插槽 */}
        {children}
      </div>
    </div>,
    document.body,
  );
}
