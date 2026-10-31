"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/forms/FormField";
import { FormAlert } from "@/components/forms/FormAlert";
import { PasswordInput } from "@/components/forms/PasswordInput";
import { applyServerErrors } from "@/components/forms/applyServerErrors";
import { getErrorMessage } from "@/lib/api/error-handler";
import { ROUTES } from "@/lib/constants/routes";
import { useRegisterMutation } from "../services/authApi";
import { OFFICES, registerSchema, type RegisterValues } from "../schemas";
import { AuthHeading } from "./AuthHeading";

export function RegisterForm() {
  const router = useRouter();
  const [registerUser, { isLoading, error }] = useRegisterMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      employeeId: "",
      office: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const onSubmit = async ({ confirmPassword: _c, acceptTerms: _t, ...values }: RegisterValues) => {
    try {
      await registerUser(values).unwrap();
      router.push(`${ROUTES.login}?registered=1`);
    } catch (err) {
      applyServerErrors(err, setError);
    }
  };

  return (
    <>
      <AuthHeading title="Create your account" description="Register to start using eBudget." />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error && <FormAlert>{getErrorMessage(error)}</FormAlert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="firstName" error={errors.firstName?.message} required>
            <Input id="firstName" autoComplete="given-name" invalid={!!errors.firstName} {...register("firstName")} />
          </FormField>
          <FormField label="Last name" htmlFor="lastName" error={errors.lastName?.message} required>
            <Input id="lastName" autoComplete="family-name" invalid={!!errors.lastName} {...register("lastName")} />
          </FormField>
        </div>
        <FormField label="Email address" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register("email")} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Employee ID" htmlFor="employeeId" error={errors.employeeId?.message} required>
            <Input id="employeeId" placeholder="MPC-2026-0001" invalid={!!errors.employeeId} {...register("employeeId")} />
          </FormField>
          <FormField label="Office" htmlFor="office" error={errors.office?.message} required>
            <Select
              id="office"
              placeholder="Select office"
              options={OFFICES.map((o) => ({ value: o, label: o }))}
              invalid={!!errors.office}
              {...register("office")}
            />
          </FormField>
        </div>
        <FormField
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 8 characters with upper and lowercase letters and a number."
          required
        >
          <PasswordInput id="password" autoComplete="new-password" invalid={!!errors.password} {...register("password")} />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
        </FormField>
        <div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" {...register("acceptTerms")} />
            I agree to the eBudget terms of use and data privacy policy.
          </label>
          {errors.acceptTerms && <p className="mt-1 text-xs text-red-600">{errors.acceptTerms.message}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isLoading}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href={ROUTES.login} className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </>
  );
}
