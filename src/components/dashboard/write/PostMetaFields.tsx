/**
 * @file PostMetaFields.tsx
 * @description 文章元信息表单区：分类下拉选择、标签增量输入（去重/上限/回车或失焦添加）与摘要文本域
 * @usage 客户端组件，用于写作页；受控字段，变更均通过回调上报父级 WriteEditor
 */
"use client";

import { useState } from "react";
import { messages } from "@/texts";
import { X, ChevronDown } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { Tag, tagVariantFor } from "@/components/ui/Tag";
import { CATEGORY_VALUES } from "@/lib/category";

/** 单篇文章允许的最大标签数量 */
const MAX_TAGS = 5;

/**
 * 文章元信息表单区（分类 / 标签 / 摘要）
 * @param props.category 当前选中分类
 * @param props.onCategoryChange 分类变更回调
 * @param props.tags 当前标签数组
 * @param props.onTagsChange 标签数组变更回调
 * @param props.summary 当前摘要文本
 * @param props.onSummaryChange 摘要变更回调
 * @returns 分类下拉、标签输入组与摘要文本域的组合表单块
 */
export function PostMetaFields({
  category,
  onCategoryChange,
  tags,
  onTagsChange,
  summary,
  onSummaryChange,
}: {
  /** 当前选中分类 */
  category: string;

  /** 分类变更回调 */
  onCategoryChange: (value: string) => void;

  /** 当前标签数组 */
  tags: string[];

  /** 标签数组变更回调 */
  onTagsChange: (tags: string[]) => void;

  /** 当前摘要文本 */
  summary: string;

  /** 摘要变更回调 */
  onSummaryChange: (value: string) => void;
}) {
  /** 标签输入框的临时文本 */
  const [tagInput, setTagInput] = useState("");

  /**
   * 提交当前标签输入：非空、未重复且未达上限时追加到标签数组并清空输入框
   */
  const addTag = () => {
    const value = tagInput.trim();
    if (value && !tags.includes(value) && tags.length < MAX_TAGS) {
      onTagsChange([...tags, value]);
      setTagInput("");
    }
  };

  /**
   * 移除指定标签
   * @param value 待移除的标签文本
   */
  const removeTag = (value: string) => {
    onTagsChange(tags.filter((item) => item !== value));
  };

  /**
   * 标签输入框键盘事件：回车或逗号触发添加标签
   * @param e 键盘事件
   */
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };

  /**
   * 标签输入框失焦：存在待提交文本时自动添加
   */
  const handleTagBlur = () => {
    if (tagInput.trim()) addTag();
  };

  return (
    <>
      {/* 分类 + 标签两列布局 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
        {/* 分类下拉选择 */}
        <FormField label={messages.write.categoryLabel}>
          <div className="relative">
            <select
              id="category"
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="input-focus input-field appearance-none pr-8"
            >
              {CATEGORY_VALUES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* 自定义下拉箭头（原生箭头已被 appearance-none 隐藏） */}
            <ChevronDown
              size={16}
              strokeWidth={2.5}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-faint"
            />
          </div>
        </FormField>

        {/* 标签输入组：已选标签徽章 + 达上限后隐藏的输入框 */}
        <FormField label={messages.write.tagLabel} hint={messages.write.tagHint}>
          <div className="flex flex-wrap gap-2">
            {tags.map((item) => (
              <Tag
                key={item}
                variant={tagVariantFor(item)}
                size="md"
                className="inline-flex items-center gap-1"
              >
                {item}
                {/* 标签移除按钮 */}
                <button
                  type="button"
                  onClick={() => removeTag(item)}
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-current/70 transition-colors duration-[var(--duration-fast)] ease-smooth hover:text-current"
                  aria-label={`${messages.write.removeTag}：${item}`}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </Tag>
            ))}

            {/* 未达上限时才渲染新标签输入框 */}
            {tags.length < MAX_TAGS && (
              <input
                id="tag-input"
                name="tags"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={handleTagBlur}
                placeholder={messages.write.tagPlaceholder}
                className="input-focus h-9 w-32 rounded-md border border-stroke-strong bg-card-bg px-3 text-(length:--type-2xs) leading-normal text-body placeholder:text-muted"
              />
            )}
          </div>
        </FormField>
      </div>

      {/* 摘要文本域 */}
      <div>
        <FormField label={messages.write.summaryLabel} hint={messages.write.summaryHint}>
          <textarea
            id="summary"
            name="summary"
            placeholder={messages.write.summaryPlaceholder}
            value={summary}
            onChange={(e) => onSummaryChange(e.target.value)}
            maxLength={500}
            rows={2}
            className="input-focus textarea-field text-(length:--type-xs)"
          />
        </FormField>
      </div>
    </>
  );
}
