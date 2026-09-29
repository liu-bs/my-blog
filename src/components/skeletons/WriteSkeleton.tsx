/**
 * @file WriteSkeleton.tsx
 * @description 写作页骨架：对应「页头（标题 + 移动端编辑/预览切换） + 标题输入 + 编辑器/预览双栏 + 分类与封面 + 摘要 + 标签 + 底部操作条」
 */
import { Container } from "@/components/ui/Container";
import { BAR, line, PAGE_TITLE_LINE } from "@/components/skeletons/primitives";

/** 字段 label 行 */
const LABEL_LINE = line("h-[21px]");

/** 字段提示行 */
const HINT_LINE = line("h-[18px]");

/** 编辑器与预览共用的行宽序列，用不等宽模拟正文排版 */
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
 * Toolbar 编辑器工具栏骨架
 * @returns 一排等大的工具按钮方块，对应加粗/斜体/插入图片等操作
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
 * EditorPane Markdown 编辑器面板骨架
 * @returns 工具栏 + 编辑区行占位，外层样式与真实编辑器一致
 */
function EditorPane() {
  return (
    <div className="input-focus-within flex flex-col rounded-xl border border-stroke-strong bg-card-bg">
      <div className="border-b border-stroke px-3 py-2">
        <Toolbar />
      </div>
      {/* min-h 与真实编辑器保持一致，避免切换时高度跳动 */}
      <div className="min-h-[60vh] flex-1 space-y-3 px-4 py-3">
        {PREVIEW_LINES.map((width, i) => (
          <span key={i} className={`${BAR} block h-3.5 rounded-xs ${width}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * PreviewPane 预览面板骨架
 * @returns 复用同一行宽序列的预览区占位，行高略高于编辑区以体现正文排版
 */
function PreviewPane() {
  return (
    <div className="min-h-[60vh] overflow-y-auto rounded-xl border border-stroke-strong bg-card-bg p-6">
      <div className="article-content space-y-3">
        {PREVIEW_LINES.map((width, i) => (
          <span key={i} className={`${BAR} block h-4 rounded-xs ${width}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * Field 表单字段骨架
 * @param props.labelW label 占位宽度类
 * @param props.hintW 传入时渲染提示行，并作为其占位宽度类
 * @param props.children 字段控件的骨架内容，由调用方按字段类型决定形状
 * @returns 标签 + 控件 + 可选提示的纵向字段
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
      <span className="block text-(length:--type-xs) leading-normal font-medium tracking-[-0.005em] text-heading">
        <span className={LABEL_LINE}>
          <span className={`${BAR} block h-3.5 ${labelW} rounded-xs`} />
        </span>
      </span>

      {children}

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
 * WriteSkeleton 写作页骨架
 * @returns 页头、编辑器双栏与各元数据字段的占位；窄屏下改为单栏并隐藏预览
 */
export function WriteSkeleton() {
  return (
    <Container className="page-section">
      {/* 整体对辅助技术隐藏 */}
      <div aria-hidden="true">
        {/* 页头：标题 + 窄屏下的编辑/预览切换 */}
        <header className="page-header page-actions">
          <span className="block page-title max-md:page-title-mobile">
            <span className={PAGE_TITLE_LINE}>
              <span className={`${BAR} block h-6 w-32 rounded-xs`} />
            </span>
          </span>

          <div className="segmented lg:hidden">
            <span className="segmented-item segmented-item-on">
              <span className={`${BAR} block size-[21px] rounded-md`} />
            </span>
            <span className="segmented-item">
              <span className={`${BAR} block size-[21px] rounded-md`} />
            </span>
          </div>
        </header>

        <div className="form-stack">
          {/* 文章标题输入 */}
          <div>
            <span className={`${BAR} block h-9 w-full rounded-md`} />
          </div>

          <div>
            {/* 桌面端：编辑与预览双栏并排 */}
            <div className="hidden grid-cols-2 gap-4 lg:grid">
              <EditorPane />
              <PreviewPane />
            </div>

            {/* 窄屏：仅工具栏 + 单块编辑区 */}
            <div className="lg:hidden">
              <Toolbar />

              <span className={`${BAR} mt-2 inline-block h-[570px] w-full rounded-md`} />
            </div>
          </div>

          {/* 分类与封面：左窄右宽的栅格 */}
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

          {/* 摘要多行文本 */}
          <div>
            <Field labelW="w-10" hintW="w-40">
              <span className={`${BAR} block h-24 w-full rounded-md`} />
            </Field>
          </div>

          {/* 标签输入 */}
          <Field labelW="w-16" hintW="w-36">
            <div className="row-sm">
              <span className={`${BAR} h-9 flex-1 rounded-md`} />
            </div>
          </Field>

          {/* 底部状态文字与三个操作按钮（保存草稿/预览/发布） */}
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
