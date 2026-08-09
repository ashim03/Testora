export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: Pagination;
  errors?: Array<{ field?: string; message: string }>;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Array<{ field?: string; message: string }>;
}

export type Role = "SUPER_ADMIN" | "TEACHER" | "STUDENT";
export type Status = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  status: Status;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}