import type { Metadata } from "next";
import { Suspense } from "react";
import { env } from "@/config/env";
import { AuthFeatureUnavailable } from "@/features/auth/components/AuthFeatureUnavailable";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  // The backend has no endpoint for this flow; it only works with the mock API.
  if (!env.useMockAuth) return <AuthFeatureUnavailable title="Reset your password" />;
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
