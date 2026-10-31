"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/forms/FormField";
import { FormAlert } from "@/components/forms/FormAlert";
import { PasswordInput } from "@/components/forms/PasswordInput";
import { getErrorMessage } from "@/lib/api/error-handler";
import { ROUTES } from "@/lib/constants/routes";
import { useResetPasswordMutation } from "../services/authApi";
import { resetPasswordSchema, type ResetPasswordValues } from "../schemas";
import { AuthHeading } from "./AuthHeading";

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [resetPassword, { isLoading, error }] = useResetPasswordMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  if (!token) {
    return (
      <>
        <AuthHeading title="Reset password" description="This page needs a valid reset link." />
        <FormAlert>The reset link is missing or incomplete. Request a new one.</FormAlert>
        <Link href={ROUTES.forgotPassword} className="mt-6 block text-center text-sm font-medium text-brand-600">
          Request a new link
        </Link>
      </>
    );
  }

  const onSubmit = async ({ password }: ResetPasswordValues) => {
    try {
      await resetPassword({ token, password }).unwrap();
      router.replace(`${ROUTES.login}?reset=1`);
    } catch {
      // shown below
    }
  };

  return (
    <>
      <AuthHeading title="Set a new password" description="Choose a strong password you haven't used before." />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error && <FormAlert>{getErrorMessage(error)}</FormAlert>}
        <FormField
          label="New password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 8 characters with upper and lowercase letters and a number."
          required
        >
          <PasswordInput id="password" autoComplete="new-password" invalid={!!errors.password} {...register("password")} />
        </FormField>
        <FormField label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
        </FormField>
        <Button type="submit" size="lg" className="w-full" loading={isLoading}>
          Reset password
        </Button>
      </form>
    </>
  );
}
