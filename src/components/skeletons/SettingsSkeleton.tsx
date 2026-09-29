/**
 * @file SettingsSkeleton.tsx
 * @description 设置页骨架：对应「页头 + 分段选项卡 + 头像上传/资料字段/简介/密码字段/保存按钮」的表单结构
 */
import { Container } from "@/components/ui/Container";
import { BAR, PAGE_SUBTITLE_LINE, PAGE_TITLE_LINE } from "@/components/skeletons/primitives";

/** label 占位行容器样式 */
const LABEL_BOX = "flex h-[21px] items-center";

/** 字段提示行容器样式 */
const HINT_BOX = "flex h-[18px] items-center";

/**
 * Label 字段标签骨架
 * @param props.w 标签占位宽度类
 * @returns 固定行高的标签占位
 */
function Label({ w = "w-14" }: { w?: string }) {
  return (
    <span className={LABEL_BOX}>
      <span className={`${BAR} block h-3.5 ${w} rounded-xs`} />
    </span>
  );
}

/**
 * Hint 字段提示骨架
 * @param props.w 提示文本占位宽度类
 * @param props.className 追加的样式类，用于（如靠右）对齐调整
 * @returns 固定行高的提示占位
 */
function Hint({ w = "w-24", className = "" }: { w?: string; className?: string }) {
  return (
    <span className={`${HINT_BOX} ${className}`}>
      <span className={`${BAR} block h-3 ${w} rounded-xs`} />
    </span>
  );
}

/**
 * Field 字段骨架
 * @param props.labelW 标签占位宽度类
 * @param props.hintW 传入时渲染提示行，并作为其占位宽度类
 * @returns 标签 + 输入框占位（可选带提示行）
 */
function Field({ labelW = "w-14", hintW }: { labelW?: string; hintW?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label w={labelW} />
      <span className={`${BAR} block h-9 w-full rounded-md`} />
      {hintW && <Hint w={hintW} />}
    </div>
  );
}

/**
 * SettingsSkeleton 设置页骨架
 * @returns 页头、选项卡与各表单字段的占位
 */
export function SettingsSkeleton() {
  return (
    <Container className="page-section">
      {/* 整体对辅助技术隐藏 */}
      <div aria-hidden="true">
        {/* 页头：主标题 + 副标题 */}
        <header className="page-header">
          <div>
            <span className="block page-title max-md:page-title-mobile">
              <span className={PAGE_TITLE_LINE}>
                <span className={`${BAR} block h-6 w-32 rounded-xs`} />
              </span>
            </span>

            <span className="page-subtitle block">
              <span className={PAGE_SUBTITLE_LINE}>
                <span className={`${BAR} block h-3.5 w-56 rounded-xs`} />
              </span>
            </span>
          </div>
        </header>

        {/* 分段选项卡：资料 / 密码，首项选中态 */}
        <div className="mb-8 segmented">
          <span className="segmented-item segmented-item-on">
            <span className={`${BAR} block h-[21px] w-14 rounded-xs`} />
          </span>
          <span className="segmented-item">
            <span className={`${BAR} block h-[21px] w-14 rounded-xs`} />
          </span>
        </div>

        <div className="form-stack">
          {/* 头像上传行：左侧头像 + 右侧上传字段 */}
          <div className="flex items-center gap-8">
            <span className={`${BAR} h-10 w-10 shrink-0 rounded-full`} />
            <div className="min-w-0 flex-1">
              <Field labelW="w-14" hintW="w-26" />
            </div>
          </div>

          {/* 并排的两个短字段 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field labelW="w-6" />
            <Field labelW="w-6" />
          </div>

          {/* 多行简介字段：label + 文本域 + 两行提示（其中一行靠右） */}
          <div className="flex flex-col gap-2">
            <Label w="w-14" />

            <span className={`${BAR} block h-[122px] w-full rounded-md`} />

            <Hint w="w-12" className="mt-1 justify-end" />
            <Hint w="w-19" />
          </div>

          {/* 并排的两个带提示的字段 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field labelW="w-11" hintW="w-6" />
            <Field labelW="w-14" hintW="w-6" />
          </div>

          {/* 右下角保存按钮 */}
          <div className="flex justify-end pt-4">
            <span className={`${BAR} h-9 w-[108px] rounded-md`} />
          </div>
        </div>
      </div>
    </Container>
  );
}
