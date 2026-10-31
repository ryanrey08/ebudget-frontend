"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/forms/FormField";
import { FormAlert } from "@/components/forms/FormAlert";
import { PasswordInput } from "@/components/forms/PasswordInput";
import { useNotify } from "@/hooks/useNotify";
import { env } from "@/config/env";
import { getErrorMessage } from "@/lib/api/error-handler";
import { REDIRECT_PARAM, sanitizeRedirect } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants/routes";
import { useLoginMutation } from "../services/authApi";
import { loginSchema, type LoginValues } from "../schemas";
import { AuthHeading } from "./AuthHeading";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useNotify();
  const [login, { isLoading, error, reset }] = useLoginMutation();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  const onSubmit = async (values: LoginValues) => {
    try {
      const { user } = await login(values).unwrap();
      notify("success", `Welcome back, ${user.firstName}!`);
      router.replace(sanitizeRedirect(searchParams.get(REDIRECT_PARAM), ROUTES.dashboard));
    } catch {
      // Error is rendered from the mutation state below.
    }
  };

  const fillDemo = () => {
    setValue("email", "juan.delacruz@mpc.edu.ph", { shouldValidate: true });
    setValue("password", "eBudget@2026", { shouldValidate: true });
  };

  return (
    <>
      <AuthHeading title="Sign in to eBudget" description="Enter your credentials to access your account." />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4" onChange={() => error && reset()}>
        {error && <FormAlert>{getErrorMessage(error)}</FormAlert>}
        {searchParams.get("registered") && !error && (
          <FormAlert tone="success">Your account was created. Sign in to continue.</FormAlert>
        )}
        {searchParams.get("reset") && !error && (
          <FormAlert tone="success">Your password was reset. Sign in with your new password.</FormAlert>
        )}
        <FormField label="Email address" htmlFor="email" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@agency.gov.ph"
            leftIcon={<Mail className="size-4" />}
            invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
        </FormField>
        <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
        </FormField>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="size-4 rounded border-gray-300 accent-brand-600" {...register("remember")} />
            Remember me
          </label>
          <Link href={ROUTES.forgotPassword} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isLoading}>
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {env.useMockApi && (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600">
          <p className="font-medium text-gray-800">Demo mode (mock API)</p>
          <p className="mt-1">
            juan.delacruz@mpc.edu.ph · eBudget@2026{" "}
            <button type="button" onClick={fillDemo} className="font-medium text-brand-600 hover:underline">
              Use demo account
            </button>
          </p>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link href={ROUTES.register} className="font-medium text-brand-600 hover:text-brand-700">
          Create one
        </Link>
      </p>
    </>
  );
}
