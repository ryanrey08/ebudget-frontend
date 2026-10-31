"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/forms/FormField";
import { PasswordInput } from "@/components/forms/PasswordInput";
import { applyServerErrors } from "@/components/forms/applyServerErrors";
import { FormAlert } from "@/components/forms/FormAlert";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage, isApiError } from "@/lib/api/error-handler";
import { useChangePasswordMutation } from "../services/profileApi";
import { changePasswordSchema, type ChangePasswordValues } from "../schemas";

const empty: ChangePasswordValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function ChangePasswordForm() {
  const notify = useNotify();
  const [changePassword, { isLoading, error }] = useChangePasswordMutation();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: empty });

  const onSubmit = async ({ currentPassword, newPassword }: ChangePasswordValues) => {
    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      reset(empty);
      notify("success", "Password changed", "Use your new password the next time you sign in.");
    } catch (err) {
      applyServerErrors(err, setError);
    }
  };

  const showGeneralError = error && !(isApiError(error) && error.fieldErrors);

  return (
    <Card>
      <CardHeader title="Change Password" description="Use at least 8 characters with mixed case and a number." />
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {showGeneralError && <FormAlert>{getErrorMessage(error)}</FormAlert>}
          <FormField label="Current password" htmlFor="currentPassword" error={errors.currentPassword?.message} required>
            <PasswordInput id="currentPassword" autoComplete="current-password" invalid={!!errors.currentPassword} {...register("currentPassword")} />
          </FormField>
          <FormField label="New password" htmlFor="newPassword" error={errors.newPassword?.message} required>
            <PasswordInput id="newPassword" autoComplete="new-password" invalid={!!errors.newPassword} {...register("newPassword")} />
          </FormField>
          <FormField label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
            <PasswordInput id="confirmPassword" autoComplete="new-password" invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => reset(empty)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" loading={isLoading}>
              Update password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
