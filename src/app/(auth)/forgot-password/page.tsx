import type { Metadata } from "next";
import { Suspense } from "react";
import { env } from "@/config/env";
import { AuthFeatureUnavailable } from "@/features/auth/components/AuthFeatureUnavailable";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  // The backend has no endpoint for this flow; it only works with the mock API.
  if (!env.useMockAuth) return <AuthFeatureUnavailable title="Forgot your password?" />;
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
