export type ValidationRule = "imageUrl" | "nonBlank" | "passwordMismatch";

export interface ValidationErrorDetail {
  path: string;

  message: string;

  code?: string;

  rule?: ValidationRule;

  params?: { min?: number; max?: number };
}
