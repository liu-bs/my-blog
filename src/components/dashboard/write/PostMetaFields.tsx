/**
 * @file PostMetaFields.tsx
 * @description 文章元信息表单区：分类下拉（受控）、标签输入（回车/逗号/失焦确认，去重、上限 5 个、可移除）、摘要输入（500 字上限）
 */
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X, ChevronDown } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { Tag, tagVariantFor } from "@/components/ui/Tag";
import { CATEGORY_LABEL_KEYS, CATEGORY_VALUES } from "@/lib/category";

/** 标签数量上限 */
const MAX_TAGS = 5;

/**
 * PostMetaFields 元信息表单区
 * @param category 当前分类
 * @param onCategoryChange 分类变更回调
 * @param tags 标签列表
 * @param onTagsChange 标签列表变更回调
 * @param summary 摘要
 * @param onSummaryChange 摘要变更回调
 */
export function PostMetaFields({
  category,
  onCategoryChange,
  tags,
  onTagsChange,
  summary,
  onSummaryChange,
}: {
  /** 当前分类 */
  category: string;

  /** 分类变更回调 */
  onCategoryChange: (value: string) => void;

  /** 标签列表 */
  tags: string[];

  /** 标签列表变更回调 */
  onTagsChange: (tags: string[]) => void;

  /** 摘要 */
  summary: string;

  /** 摘要变更回调 */
  onSummaryChange: (value: string) => void;
}) {
  const t = useTranslations("write");
  const tCommon = useTranslations("common");

  /** 标签输入框草稿 */
  const [tagInput, setTagInput] = useState("");

  /** 添加标签：去空格、去重、不超过上限，成功后清空输入 */
  const addTag = () => {
    const value = tagInput.trim();
    if (value && !tags.includes(value) && tags.length < MAX_TAGS) {
      onTagsChange([...tags, value]);
      setTagInput("");
    }
  };

  /** 移除指定标签 */
  const removeTag = (value: string) => {
    onTagsChange(tags.filter((item) => item !== value));
  };

  /** 回车或逗号键确认添加标签 */
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };

  /** 失焦时若输入未提交则自动添加 */
  const handleTagBlur = () => {
    if (tagInput.trim()) addTag();
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
        <FormField label={t("categoryLabel")}>
          <div className="relative">
            <select
              id="category"
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="input-focus input-field appearance-none pr-8"
            >
              {CATEGORY_VALUES.map((c) => (
                <option key={c} value={c}>
                  {tCommon(CATEGORY_LABEL_KEYS[c])}
                </option>
              ))}
            </select>

            <ChevronDown
              size={16}
              strokeWidth={2.5}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-faint"
            />
          </div>
        </FormField>

        <FormField label={t("tagLabel")} hint={t("tagHint")}>
          <div className="flex flex-wrap gap-2">
            {tags.map((item) => (
              <Tag
                key={item}
                variant={tagVariantFor(item)}
                size="md"
                className="inline-flex items-center gap-1"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeTag(item)}
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-current/70 transition-colors duration-[var(--duration-fast)] ease-smooth hover:text-current"
                  aria-label={`${t("removeTag")}：${item}`}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </Tag>
            ))}

            {tags.length < MAX_TAGS && (
              <input
                id="tag-input"
                name="tags"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={handleTagBlur}
                placeholder={t("tagPlaceholder")}
                className="input-focus h-9 w-32 rounded-md border border-stroke-strong bg-card-bg px-3 text-(length:--type-2xs) leading-normal text-body placeholder:text-muted"
              />
            )}
          </div>
        </FormField>
      </div>

      <div>
        <FormField label={t("summaryLabel")} hint={t("summaryHint")}>
          <textarea
            id="summary"
            name="summary"
            placeholder={t("summaryPlaceholder")}
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
