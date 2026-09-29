/**
 * @file PostMetaFields.tsx
 * @description 文章元信息表单块：分类下拉、标签录入、摘要文本域。
 *              分类取值受限于 lib/category 的固定配额，标签通过「输入 + 回车 / 逗号 / 离焦」提交为数组，
 *              所有字段均为受控且最终值由父级表单持有
 */
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X, ChevronDown } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { Tag, tagVariantFor } from "@/components/ui/Tag";
import { CATEGORY_LABEL_KEYS, CATEGORY_VALUES } from "@/lib/category";

/** 单篇文章标签数上限，超出后隐藏输入框；与后端 schema 的上限保持一致 */
const MAX_TAGS = 5;

/**
 * PostMetaFields 文章元信息字段组
 * @description 自身只额外维护「标签草稿输入」这一项瞬时状态，分类 / 标签数组 / 摘要均直接读写父级受控值。
 *              标签去重由前端做第一道拦截，最终唯一性与长度约束仍由服务端 schema 裁决
 * @param props 组件入参，字段含义见下方内联类型注释
 * @param props.category 当前分类值，取值应在 CATEGORY_VALUES 之内
 * @param props.onCategoryChange 分类变更回调
 * @param props.tags 已选标签列表，去重且不超过 MAX_TAGS
 * @param props.onTagsChange 标签列表变更回调（新增或删除均通过它回写完整数组）
 * @param props.summary 摘要文本，最长 500 字
 * @param props.onSummaryChange 摘要变更回调
 * @returns 分类 + 标签的一行栅格，以及下方的摘要区域
 */
export function PostMetaFields({
  category,
  onCategoryChange,
  tags,
  onTagsChange,
  summary,
  onSummaryChange,
}: {
  /** 当前分类值 */
  category: string;
  /** 分类变更回调 */
  onCategoryChange: (value: string) => void;
  /** 已选标签列表 */
  tags: string[];
  /** 标签列表变更回调 */
  onTagsChange: (tags: string[]) => void;
  /** 摘要文本 */
  summary: string;
  /** 摘要变更回调 */
  onSummaryChange: (value: string) => void;
}) {
  const t = useTranslations("write");
  const tCommon = useTranslations("common");

  /** 标签输入框的草稿值，未按回车确认前不进入 tags 列表 */
  const [tagInput, setTagInput] = useState("");

  /**
   * 将输入框草稿追加为标签
   * @description 三重前置条件：非空白、不与已有标签重复、未达数量上限；
   *              任一不满足就静默忽略（不报错也不清空），避免打断连续录入
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
   * 标签输入框按键处理：回车或英文逗号即确认当前草稿
   * @description 拦截默认行为是为了阻止回车冒泡触发外层表单提交、以及逗号被真的写入输入框
   * @param e 输入框键盘事件
   */
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };

  /** 输入框失焦时兜底提交草稿，避免用户输入后直接点击提交导致标签丢失 */
  const handleTagBlur = () => {
    if (tagInput.trim()) addTag();
  };

  return (
    <>
      {/* 分类与标签：宽屏按 180px + 自适应 两列排布，窄屏堆叠 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
        {/* 分类下拉：选项来自固定配额，文案经 common 命名空间本地化 */}
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
            {/* 自定义下拉箭头：原生箭头被 appearance-none 隐藏后补一个不拦截点击的图标 */}
            <ChevronDown
              size={16}
              strokeWidth={2.5}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-faint"
            />
          </div>
        </FormField>

        {/* 标签区：已选标签以 Tag 形式内联展示，未达上限时追加输入框 */}
        <FormField label={t("tagLabel")} hint={t("tagHint")}>
          <div className="flex flex-wrap gap-2">
            {/* 已选标签：每个标签自带删除按钮 */}
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
            {/* 达到上限后隐藏输入框，用「不在场」直接表达不可再加 */}
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
        {/* 摘要：限长 500 由 maxLength 在输入层挡住，服务端 schema 仍会二次校验 */}
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
