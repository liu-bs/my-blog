import { BAR, line } from "@/components/skeletons/primitives";

const LABEL_LINE = line("h-[21px]");

const HINT_LINE = line("h-[18px]");

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

function AuthHeader({ titleWidth, subtitleWidth }: { titleWidth: string; subtitleWidth: string }) {
  return (
    <div className="mb-10">
      <span className="auth-title block">
        <span className={line("h-[30px]")}>
          <span className={`${BAR} block h-4.5 ${titleWidth} rounded-xs`} />
        </span>
      </span>

      <span className="auth-subtitle block">
        <span className={line("h-[27px]")}>
          <span className={`${BAR} block h-3.5 ${subtitleWidth} rounded-xs`} />
        </span>
      </span>
    </div>
  );
}

function AuthFooter({ switchWidth }: { switchWidth: string }) {
  return (
    <>
      <div className="auth-rate-hint">
        <span className={`${BAR} size-3 shrink-0 rounded-xs`} />
        <span className={HINT_LINE}>
          <span className={`${BAR} block h-3 w-44 rounded-xs`} />
        </span>
      </div>

      <div className="auth-switch">
        <span className={line("h-[24px] justify-center")}>
          <span className={`${BAR} block h-3.5 ${switchWidth} rounded-xs`} />
        </span>
      </div>
    </>
  );
}

export function LoginSkeleton() {
  return (
    <div className="auth-card" aria-hidden="true">
      <AuthHeader titleWidth="w-32" subtitleWidth="w-56" />

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

      <AuthFooter switchWidth="w-48" />
    </div>
  );
}

export function RegisterSkeleton() {
  return (
    <div className="auth-card" aria-hidden="true">
      <AuthHeader titleWidth="w-36" subtitleWidth="w-60" />

      <div className="auth-form-stack">
        <div className="grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
          <Field width="w-10" />
          <Field width="w-10" />
        </div>

        <Field width="w-14" hint />

        <Field width="w-12" />

        <Field width="w-14" />

        <span className={`${BAR} mt-2 inline-flex h-9 w-full rounded-md align-bottom`} />
      </div>

      <AuthFooter switchWidth="w-44" />
    </div>
  );
}
