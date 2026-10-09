/**
 * @file SettingsSkeleton.tsx
 * @description 设置页加载骨架屏：还原「页头 + 分段标签 + 资料表单（头像/昵称/简介/位置/网站/保存按钮）」布局
 * @usage 仅静态占位，无交互；整棵子树以 aria-hidden 屏蔽辅助技术读取
 */
import { Container } from "@/components/ui/Container";
import { BAR, PAGE_SUBTITLE_LINE, PAGE_TITLE_LINE } from "@/components/skeletons/primitives";

/** 字段标签行容器（固定高度 flex 居中） */
const LABEL_BOX = "flex h-[21px] items-center";

/** 字段提示行容器（固定高度 flex 居中） */
const HINT_BOX = "flex h-[18px] items-center";

/**
 * 字段标签占位
 * @param props.w 标签文本占位宽度类
 * @returns 标签占位节点
 */
function Label({ w = "w-14" }: { w?: string }) {
  return (
    <span className={LABEL_BOX}>
      <span className={`${BAR} block h-3.5 ${w} rounded-xs`} />
    </span>
  );
}

/**
 * 字段帮助提示占位
 * @param props.w 提示文本占位宽度类
 * @param props.className 附加定位/对齐类
 * @returns 提示占位节点
 */
function Hint({ w = "w-24", className = "" }: { w?: string; className?: string }) {
  return (
    <span className={`${HINT_BOX} ${className}`}>
      <span className={`${BAR} block h-3 ${w} rounded-xs`} />
    </span>
  );
}

/**
 * 单个表单字段骨架（标签 + 输入框，可选提示）
 * @param props.labelW 标签占位宽度类
 * @param props.hintW 提示占位宽度类；传入时渲染提示行
 * @returns 字段占位节点
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
 * 设置页整体骨架屏
 * @returns 含页头、标签页与表单占位的容器树
 */
export function SettingsSkeleton() {
  return (
    <Container className="page-section">
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

        {/* 分段标签页（两项，首项选中） */}
        <div className="mb-8 segmented">
          <span className="segmented-item segmented-item-on">
            <span className={`${BAR} block h-[21px] w-14 rounded-xs`} />
          </span>
          <span className="segmented-item">
            <span className={`${BAR} block h-[21px] w-14 rounded-xs`} />
          </span>
        </div>

        {/* 表单区 */}
        <div className="form-stack">
          {/* 头像行（圆形头像 + 头像 URL 字段） */}
          <div className="flex items-center gap-8">
            <span className={`${BAR} h-10 w-10 shrink-0 rounded-full`} />
            <div className="min-w-0 flex-1">
              <Field labelW="w-14" hintW="w-26" />
            </div>
          </div>

          {/* 名/姓两列并排 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field labelW="w-6" />
            <Field labelW="w-6" />
          </div>

          {/* 简介多行文本域（含右对齐计数与提示） */}
          <div className="flex flex-col gap-2">
            <Label w="w-14" />

            <span className={`${BAR} block h-[122px] w-full rounded-md`} />

            <Hint w="w-12" className="mt-1 justify-end" />
            <Hint w="w-19" />
          </div>

          {/* 位置/网站两列并排 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field labelW="w-11" hintW="w-6" />
            <Field labelW="w-14" hintW="w-6" />
          </div>

          {/* 保存按钮（右对齐） */}
          <div className="flex justify-end pt-4">
            <span className={`${BAR} h-9 w-[108px] rounded-md`} />
          </div>
        </div>
      </div>
    </Container>
  );
}
