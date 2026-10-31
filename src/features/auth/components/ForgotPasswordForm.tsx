"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/forms/FormField";
import { FormAlert } from "@/components/forms/FormAlert";
import { getErrorMessage } from "@/lib/api/error-handler";
import { ROUTES } from "@/lib/constants/routes";
import { useForgotPasswordMutation } from "../services/authApi";
import { forgotPasswordSchema, type ForgotPasswordValues } from "../schemas";
import { AuthHeading } from "./AuthHeading";

export function ForgotPasswordForm() {
  const [requestReset, { data, isLoading, error, isSuccess }] = useForgotPasswordMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  return (
    <>
      <AuthHeading
        title="Forgot your password?"
        description="Enter the email linked to your account and we'll send you a reset link."
      />
      {isSuccess && data ? (
        <div className="space-y-4">
          <FormAlert tone="success">{data.message}</FormAlert>
          {data.devResetToken && (
            <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600">
              Demo mode: no email is sent.{" "}
              <Link
                href={`${ROUTES.resetPassword}?token=${data.devResetToken}`}
                className="font-medium text-brand-600 hover:underline"
              >
                Open the reset link
              </Link>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit((v) => requestReset(v))} noValidate className="space-y-4">
          {error && <FormAlert>{getErrorMessage(error)}</FormAlert>}
          <FormField label="Email address" htmlFor="email" error={errors.email?.message} required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              leftIcon={<Mail className="size-4" />}
              invalid={!!errors.email}
              {...register("email")}
            />
          </FormField>
          <Button type="submit" size="lg" className="w-full" loading={isLoading}>
            Send reset link
          </Button>
        </form>
      )}
      <Link
        href={ROUTES.login}
        className="mt-6 flex items-center justify-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </>
  );
}
