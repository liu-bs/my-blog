/**
 * @file WriteSkeleton.tsx
 * @description 写作页加载骨架屏：还原「页头(含视图切换) + 标题输入 + 双栏 Markdown 编辑器/预览 + 元信息字段(分类/标签/摘要) + 封面字段 + 底部操作栏」布局
 * @usage 仅静态占位，无交互；桌面为编辑器+预览双栏，移动端退化为工具栏+编辑区单栏
 */
import { Container } from "@/components/ui/Container";
import { BAR, line, PAGE_TITLE_LINE } from "@/components/skeletons/primitives";

/** 字段标签占位行 */
const LABEL_LINE = line("h-[21px]");

/** 字段提示占位行 */
const HINT_LINE = line("h-[18px]");

/** 编辑器/预览区内每行文本的宽度类，模拟真实内容长短参差 */
const PREVIEW_LINES = [
  "w-1/2",
  "w-full",
  "w-11/12",
  "w-full",
  "w-3/5",
  "w-full",
  "w-2/3",
  "w-4/5",
  "w-1/3",
];

/**
 * Markdown 工具栏占位（一排等宽按钮）
 * @returns 工具栏占位节点
 */
function Toolbar() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <span key={i} className={`${BAR} size-9 shrink-0 rounded-md`} />
      ))}
    </div>
  );
}

/**
 * 编辑栏骨架（工具栏 + 正文行占位）
 * @returns 编辑栏占位节点
 */
function EditorPane() {
  return (
    <div className="input-focus-within flex flex-col rounded-xl border border-stroke-strong bg-card-bg">
      {/* 顶部工具栏 */}
      <div className="border-b border-stroke px-3 py-2">
        <Toolbar />
      </div>

      {/* 编辑正文：按 PREVIEW_LINES 宽度逐行渲染 */}
      <div className="min-h-[60vh] flex-1 space-y-3 px-4 py-3">
        {PREVIEW_LINES.map((width, i) => (
          <span key={i} className={`${BAR} block h-3.5 rounded-xs ${width}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * 预览栏骨架（渲染后的正文行占位）
 * @returns 预览栏占位节点
 */
function PreviewPane() {
  return (
    <div className="min-h-[60vh] overflow-y-auto rounded-xl border border-stroke-strong bg-card-bg p-6">
      {/* 预览正文：按 PREVIEW_LINES 宽度逐行渲染 */}
      <div className="article-content space-y-3">
        {PREVIEW_LINES.map((width, i) => (
          <span key={i} className={`${BAR} block h-4 rounded-xs ${width}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * 通用表单字段骨架（标签 + 自定义控件子节点 + 可选提示）
 * @param props.labelW 标签占位宽度类
 * @param props.hintW 提示占位宽度类；传入时渲染提示行
 * @param props.children 字段控件本体占位
 * @returns 字段占位节点
 */
function Field({
  labelW = "w-10",
  hintW,
  children,
}: {
  labelW?: string;
  hintW?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* 字段标签 */}
      <span className="block text-(length:--type-xs) leading-normal font-medium tracking-[-0.005em] text-heading">
        <span className={LABEL_LINE}>
          <span className={`${BAR} block h-3.5 ${labelW} rounded-xs`} />
        </span>
      </span>

      {/* 字段控件本体 */}
      {children}

      {/* 可选帮助提示 */}
      {hintW && (
        <span className="block meta-text">
          <span className={HINT_LINE}>
            <span className={`${BAR} block h-3 ${hintW} rounded-xs`} />
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * 写作页整体骨架屏
 * @returns 含页头、编辑器双栏与元信息字段的占位树
 */
export function WriteSkeleton() {
  return (
    <Container className="page-section">
      <div aria-hidden="true">
        {/* 页头：标题 + 移动端视图切换标签 */}
        <header className="page-header page-actions">
          <span className="block page-title max-md:page-title-mobile">
            <span className={PAGE_TITLE_LINE}>
              <span className={`${BAR} block h-6 w-32 rounded-xs`} />
            </span>
          </span>

          {/* 编辑/预览切换（仅移动端显示） */}
          <div className="segmented lg:hidden">
            <span className="segmented-item segmented-item-on">
              <span className={`${BAR} block size-[21px] rounded-md`} />
            </span>
            <span className="segmented-item">
              <span className={`${BAR} block size-[21px] rounded-md`} />
            </span>
          </div>
        </header>

        {/* 表单主体 */}
        <div className="form-stack">
          {/* 文章标题输入 */}
          <div>
            <span className={`${BAR} block h-9 w-full rounded-md`} />
          </div>

          {/* 编辑器区 */}
          <div>
            {/* 桌面双栏：编辑 + 预览 */}
            <div className="hidden grid-cols-2 gap-4 lg:grid">
              <EditorPane />
              <PreviewPane />
            </div>

            {/* 移动端单栏：工具栏 + 编辑区 */}
            <div className="lg:hidden">
              <Toolbar />

              <span className={`${BAR} mt-2 inline-block h-[570px] w-full rounded-md`} />
            </div>
          </div>

          {/* 分类 + 标签两列字段 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
            <Field labelW="w-10">
              <span className={`${BAR} block h-9 w-full rounded-md`} />
            </Field>

            <Field labelW="w-10" hintW="w-32">
              <div className="flex flex-wrap gap-2">
                <span className={`${BAR} h-9 w-32 rounded-md`} />
              </div>
            </Field>
          </div>

          {/* 摘要多行文本域 */}
          <div>
            <Field labelW="w-10" hintW="w-40">
              <span className={`${BAR} block h-24 w-full rounded-md`} />
            </Field>
          </div>

          {/* 封面 URL 字段 */}
          <Field labelW="w-16" hintW="w-36">
            <div className="row-sm">
              <span className={`${BAR} h-9 flex-1 rounded-md`} />
            </div>
          </Field>

          {/* 底部操作栏：左侧字数统计 + 右侧返回/存草稿/发布按钮 */}
          <div className="mt-8 row-md flex-wrap justify-between border-t border-stroke pt-6">
            <span className={`${BAR} h-3 w-24 rounded-xs`} />

            <div className="row-sm max-md:ml-auto">
              <span className={`${BAR} h-9 w-16 rounded-md`} />
              <span className={`${BAR} h-9 w-24 rounded-md`} />
              <span className={`${BAR} h-9 w-20 rounded-md`} />
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
