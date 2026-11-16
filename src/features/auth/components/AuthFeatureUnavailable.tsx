import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormAlert } from "@/components/forms/FormAlert";
import { ROUTES } from "@/lib/constants/routes";
import { AuthHeading } from "./AuthHeading";

/**
 * Shown in real auth mode for flows the backend does not provide
 * (registration, forgot password, reset password). Nothing is simulated.
 */
export function AuthFeatureUnavailable({ title }: { title: string }) {
  return (
    <>
      <AuthHeading title={title} description="This option is not available yet." />
      <FormAlert tone="info">
        eBudget accounts and passwords are managed by your system administrator. Contact them to create an account or
        reset your password.
      </FormAlert>
      <Link
        href={ROUTES.login}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </>
  );
}
