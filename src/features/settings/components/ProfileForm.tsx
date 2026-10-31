"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/forms/FormField";
import { FormAlert } from "@/components/forms/FormAlert";
import { applyServerErrors } from "@/components/forms/applyServerErrors";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import type { User } from "@/features/auth/types";
import { useUpdateProfileMutation } from "../services/profileApi";
import { profileSchema, type ProfileValues } from "../schemas";

const pick = (u: User): ProfileValues => ({
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  phone: u.phone,
  position: u.position,
  office: u.office,
});

export function ProfileForm({ user }: { user: User }) {
  const notify = useNotify();
  const [update, { isLoading, error }] = useUpdateProfileMutation();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: pick(user) });

  useEffect(() => reset(pick(user)), [user, reset]);

  const onSubmit = async (values: ProfileValues) => {
    try {
      const updated = await update(values).unwrap();
      reset(pick(updated));
      notify("success", "Profile updated", "Your changes have been saved.");
    } catch (err) {
      applyServerErrors(err, setError);
    }
  };

  const fields: { name: keyof ProfileValues; label: string; type?: string; autoComplete?: string }[] = [
    { name: "firstName", label: "First name", autoComplete: "given-name" },
    { name: "lastName", label: "Last name", autoComplete: "family-name" },
    { name: "email", label: "Email address", type: "email", autoComplete: "email" },
    { name: "phone", label: "Mobile number", type: "tel", autoComplete: "tel" },
    { name: "position", label: "Position" },
    { name: "office", label: "Office" },
  ];

  return (
    <Card>
      <CardHeader title="Profile Details" description="Update your personal and contact information." />
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {error && <FormAlert>{getErrorMessage(error)}</FormAlert>}
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <FormField
                key={f.name}
                label={f.label}
                htmlFor={f.name}
                error={errors[f.name]?.message}
                required={f.name !== "phone"}
              >
                <Input id={f.name} type={f.type} autoComplete={f.autoComplete} invalid={!!errors[f.name]} {...register(f.name)} />
              </FormField>
            ))}
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button variant="outline" onClick={() => reset(pick(user))} disabled={!isDirty || isLoading}>
              Cancel
            </Button>
            <Button type="submit" loading={isLoading} disabled={!isDirty}>
              Save changes
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
