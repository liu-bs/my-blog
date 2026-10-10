export type FieldId = "firstName" | "username" | "email" | "password";

export interface FieldState {
  value: string;

  isTouched: boolean;

  isValid: boolean | null;

  error: string | null;
}
