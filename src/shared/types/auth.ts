export interface AuthPayload {
  id: string;

  tokenVersion: number;

  iat?: number;

  exp?: number;
}

export interface RegisterDto {
  email: string;

  password: string;

  firstName: string;

  lastName: string;

  username: string;
}

export interface LoginDto {
  email: string;

  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;

  newPassword: string;
}

export interface UpdateProfileDto {
  firstName?: string;

  lastName?: string;

  avatar?: string;

  bio?: string;

  location?: string;

  website?: string;
}
