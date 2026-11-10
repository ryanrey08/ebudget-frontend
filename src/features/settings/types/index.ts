import type { User } from "@/features/auth/types";

export type UpdateProfileRequest = Pick<User, "firstName" | "lastName" | "email" | "phone" | "position" | "office">;

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
