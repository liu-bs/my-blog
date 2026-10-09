/**
 * @file RegisterSkeleton.tsx
 * @description 注册页加载骨架屏：还原「标题/副标题 + 多字段表单（含帮助提示）+ 速率提示 + 切换登录链接」布局
 * @usage 仅静态占位，无交互；整棵子树以 aria-hidden 屏蔽辅助技术读取
 */
import { BAR, line } from "@/components/skeletons/primitives";

/** 表单字段标签占位行 */
const LABEL_LINE = line("h-[21px]");

/** 字段帮助提示占位行 */
const HINT_LINE = line("h-[18px]");

/**
 * 单个注册表单字段骨架（标签 + 输入框，可选帮助提示）
 * @param props.width 标签文本占位宽度类
 * @param props.hint 是否渲染底部帮助提示行
 * @returns 字段占位节点
 */
function Field({ width = "w-12", hint = false }: { width?: string; hint?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {/* 字段标签 */}
      <span className="block text-(length:--type-xs) leading-normal font-medium tracking-[-0.005em] text-heading">
        <span className={LABEL_LINE}>
          <span className={`${BAR} block h-3.5 ${width} rounded-xs`} />
        </span>
      </span>

      {/* 输入框 */}
      <span className={`${BAR} block h-9 w-full rounded-md`} />

      {/* 可选帮助提示（如密码规则说明） */}
      {hint && (
        <span className="block text-(length:--type-2xs) leading-normal text-faint">
          <span className={HINT_LINE}>
            <span className={`${BAR} block h-3 w-40 rounded-xs`} />
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * 注册页整体骨架屏
 * @returns 认证卡片布局的占位树
 */
export function RegisterSkeleton() {
  return (
    <div className="auth-card" aria-hidden="true">
      {/* 标题 + 副标题 */}
      <div className="mb-10">
        <span className="auth-title block">
          <span className={line("h-[30px]")}>
            <span className={`${BAR} block h-4.5 w-36 rounded-xs`} />
          </span>
        </span>

        <span className="auth-subtitle block">
          <span className={line("h-[27px]")}>
            <span className={`${BAR} block h-3.5 w-60 rounded-xs`} />
          </span>
        </span>
      </div>

      {/* 表单区：姓名双列 + 邮箱(带提示) + 用户名 + 密码 + 提交按钮 */}
      <div className="auth-form-stack">
        {/* 名/姓两列并排 */}
        <div className="grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
          <Field width="w-10" />
          <Field width="w-10" />
        </div>

        {/* 邮箱字段（带帮助提示） */}
        <Field width="w-14" hint />

        <Field width="w-12" />

        <Field width="w-14" />

        {/* 注册按钮 */}
        <span className={`${BAR} mt-2 inline-flex h-9 w-full rounded-md align-bottom`} />
      </div>

      {/* 速率限制提示（小图标 + 文本） */}
      <div className="auth-rate-hint">
        <span className={`${BAR} size-3 shrink-0 rounded-xs`} />
        <span className={line("h-[18px]")}>
          <span className={`${BAR} block h-3 w-44 rounded-xs`} />
        </span>
      </div>

      {/* 切换至登录的链接（居中） */}
      <div className="auth-switch">
        <span className={line("h-[24px] justify-center")}>
          <span className={`${BAR} block h-3.5 w-44 rounded-xs`} />
        </span>
      </div>
    </div>
  );
}
