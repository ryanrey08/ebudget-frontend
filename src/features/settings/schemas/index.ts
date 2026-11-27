import { z } from "zod";
import { isMockAuth } from "@/config/api.config";
import { passwordRules } from "@/features/auth/schemas";

/**
 * The backend's rule for a new password (UpdatePasswordRequest): at least 12
 * characters with upper and lower case, a number and a symbol. The backend
 * also refuses breached passwords, which only it can check.
 */
export const backendPasswordRules = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(255, "Use at most 255 characters")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/\d/, "Include a number")
  .regex(/[^A-Za-z0-9]/, "Include a symbol");

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s-]{6,}$/, "Enter a valid phone number")
    .or(z.literal("")),
  position: z.string().trim().min(2, "Position is required"),
  office: z.string().trim().min(2, "Office is required"),
});
export type ProfileValues = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: isMockAuth() ? passwordRules : backendPasswordRules,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "New password must be different from the current one",
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
