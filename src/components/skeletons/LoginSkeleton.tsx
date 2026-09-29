/**
 * @file LoginSkeleton.tsx
 * @description 登录页 AuthCard 的骨架：对应「标题/副标题 + 账号密码字段 + 忘记密码 + 提交按钮 + 限流提示 + 切换注册」结构
 */
import { BAR, line } from "@/components/skeletons/primitives";

/** 字段 label 行，对应输入框上方标签的行高 */
const LABEL_LINE = line("h-[21px]");

/**
 * Field 单个表单字段骨架
 * @param props.width label 占位宽度类，用于区分「邮箱」「密码」等不同长度标签
 * @returns label 行 + 输入框占位
 */
function Field({ width = "w-12" }: { width?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="block text-(length:--type-xs) leading-normal font-medium tracking-[-0.005em] text-heading">
        <span className={LABEL_LINE}>
          <span className={`${BAR} block h-3.5 ${width} rounded-xs`} />
        </span>
      </span>

      <span className={`${BAR} block h-9 w-full rounded-md`} />
    </div>
  );
}

/**
 * LoginSkeleton 登录页骨架
 * @returns 与真实登录卡片同宽同布局的占位
 */
export function LoginSkeleton() {
  return (
    // 整体对辅助技术隐藏
    <div className="auth-card" aria-hidden="true">
      {/* 卡片头部：主标题 + 副标题 */}
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

      {/* 表单区：两个字段 + 忘记密码链接 + 提交按钮 */}
      <div className="auth-form-stack">
        <Field width="w-12" />
        <Field width="w-14" />

        <div className="text-right">
          <span className={line("h-[25.6px] justify-end")}>
            <span className={`${BAR} block h-3 w-16 rounded-xs`} />
          </span>
        </div>

        <span className={`${BAR} mt-1 inline-flex h-9 w-full rounded-md align-bottom`} />
      </div>

      {/* 限流/错误提示条占位 */}
      <div className="auth-rate-hint">
        <span className={`${BAR} size-3 shrink-0 rounded-xs`} />
        <span className={line("h-[18px]")}>
          <span className={`${BAR} block h-3 w-44 rounded-xs`} />
        </span>
      </div>

      {/* 底部「没有账号？去注册」切换区 */}
      <div className="auth-switch">
        <span className={line("h-[24px] justify-center")}>
          <span className={`${BAR} block h-3.5 w-48 rounded-xs`} />
        </span>
      </div>
    </div>
  );
}
