import Link from "next/link";
import { LogoFull } from "@/components/shared/Logo";
import { ROUTES } from "@/lib/constants/routes";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <LogoFull className="w-40" />
      <h1 className="mt-8 text-3xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-2 text-gray-600">The page you are looking for does not exist in eBudget.</p>
      <Link
        href={ROUTES.dashboard}
        className="mt-6 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
