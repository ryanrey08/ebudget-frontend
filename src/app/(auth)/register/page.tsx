import type { Metadata } from "next";
import { Suspense } from "react";
import { env } from "@/config/env";
import { AuthFeatureUnavailable } from "@/features/auth/components/AuthFeatureUnavailable";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  // The backend has no endpoint for this flow; it only works with the mock API.
  if (!env.useMockAuth) return <AuthFeatureUnavailable title="Create an account" />;
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
