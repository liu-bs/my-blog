/**
 * @file RegisterSkeleton.tsx
 * @description 注册页 AuthCard 的骨架：对应「标题/副标题 + 用户名与邮箱并排 + 密码/确认密码字段 + 提交按钮 + 限流提示 + 切换登录」
 */
import { BAR, line } from "@/components/skeletons/primitives";

/** 字段 label 行 */
const LABEL_LINE = line("h-[21px]");

/** 字段下方的辅助提示行（如密码要求） */
const HINT_LINE = line("h-[18px]");

/**
 * Field 单个表单字段骨架
 * @param props.width label 占位宽度类，用于区分不同长度的标签
 * @param props.hint 是否渲染字段下方的辅助提示行，对应密码要求等文案
 * @returns label 行 + 输入框占位（可选带提示行）
 */
function Field({ width = "w-12", hint = false }: { width?: string; hint?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="block text-(length:--type-xs) leading-normal font-medium tracking-[-0.005em] text-heading">
        <span className={LABEL_LINE}>
          <span className={`${BAR} block h-3.5 ${width} rounded-xs`} />
        </span>
      </span>

      <span className={`${BAR} block h-9 w-full rounded-md`} />

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
 * RegisterSkeleton 注册页骨架
 * @returns 与真实注册卡片同布局的占位
 */
export function RegisterSkeleton() {
  return (
    // 整体对辅助技术隐藏
    <div className="auth-card" aria-hidden="true">
      {/* 卡片头部：主标题 + 副标题 */}
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

      {/* 表单区：用户名/邮箱并排两列 + 三个单列字段 + 提交按钮 */}
      <div className="auth-form-stack">
        <div className="grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
          <Field width="w-10" />
          <Field width="w-10" />
        </div>

        {/* 密码字段带强度提示行 */}
        <Field width="w-14" hint />

        <Field width="w-12" />

        <Field width="w-14" />

        <span className={`${BAR} mt-2 inline-flex h-9 w-full rounded-md align-bottom`} />
      </div>

      {/* 限流/错误提示条占位 */}
      <div className="auth-rate-hint">
        <span className={`${BAR} size-3 shrink-0 rounded-xs`} />
        <span className={line("h-[18px]")}>
          <span className={`${BAR} block h-3 w-44 rounded-xs`} />
        </span>
      </div>

      {/* 底部「已有账号？去登录」切换区 */}
      <div className="auth-switch">
        <span className={line("h-[24px] justify-center")}>
          <span className={`${BAR} block h-3.5 w-44 rounded-xs`} />
        </span>
      </div>
    </div>
  );
}
