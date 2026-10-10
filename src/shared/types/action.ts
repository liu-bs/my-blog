import type { ValidationErrorDetail } from "./validation";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; details?: ValidationErrorDetail[] };
