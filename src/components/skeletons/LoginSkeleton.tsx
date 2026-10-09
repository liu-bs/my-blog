/**
 * @file LoginSkeleton.tsx
 * @description 登录页加载骨架屏：还原「标题/副标题 + 表单字段 + 速率提示 + 切换注册链接」布局
 * @usage 仅静态占位，无交互；整棵子树以 aria-hidden 屏蔽辅助技术读取
 */
import { BAR, line } from "@/components/skeletons/primitives";

/** 表单字段标签占位行 */
const LABEL_LINE = line("h-[21px]");

/**
 * 单个登录表单字段骨架（标签 + 输入框）
 * @param props.width 标签文本占位宽度类
 * @returns 字段占位节点
 */
function Field({ width = "w-12" }: { width?: string }) {
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
    </div>
  );
}

/**
 * 登录页整体骨架屏
 * @returns 认证卡片布局的占位树
 */
export function LoginSkeleton() {
  return (
    <div className="auth-card" aria-hidden="true">
      {/* 标题 + 副标题 */}
      <div className="mb-10">
        <span className="auth-title block">
          <span className={line("h-[30px]")}>
            <span className={`${BAR} block h-4.5 w-32 rounded-xs`} />
          </span>
        </span>

        <span className="auth-subtitle block">
          <span className={line("h-[27px]")}>
            <span className={`${BAR} block h-3.5 w-56 rounded-xs`} />
          </span>
        </span>
      </div>

      {/* 表单区：用户名/密码字段 + 忘记密码链接 + 提交按钮 */}
      <div className="auth-form-stack">
        <Field width="w-12" />
        <Field width="w-14" />

        {/* 忘记密码（右对齐链接） */}
        <div className="text-right">
          <span className={line("h-[25.6px] justify-end")}>
            <span className={`${BAR} block h-3 w-16 rounded-xs`} />
          </span>
        </div>

        {/* 登录按钮 */}
        <span className={`${BAR} mt-1 inline-flex h-9 w-full rounded-md align-bottom`} />
      </div>

      {/* 速率限制提示（小图标 + 文本） */}
      <div className="auth-rate-hint">
        <span className={`${BAR} size-3 shrink-0 rounded-xs`} />
        <span className={line("h-[18px]")}>
          <span className={`${BAR} block h-3 w-44 rounded-xs`} />
        </span>
      </div>

      {/* 切换至注册的链接（居中） */}
      <div className="auth-switch">
        <span className={line("h-[24px] justify-center")}>
          <span className={`${BAR} block h-3.5 w-48 rounded-xs`} />
        </span>
      </div>
    </div>
  );
}
