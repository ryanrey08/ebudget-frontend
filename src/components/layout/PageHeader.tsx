"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House } from "lucide-react";
import { getBreadcrumbs } from "@/config/navigation";
import { ROUTES } from "@/lib/constants/routes";

export function PageHeader({
  title,
  description,
  actions,
  extraCrumbs = [],
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Crumbs appended after the navigation trail, e.g. the current workflow step. */
  extraCrumbs?: string[];
}) {
  const pathname = usePathname();
  const crumbs = [...getBreadcrumbs(pathname), ...extraCrumbs.map((label) => ({ label }))];

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-[2rem] sm:leading-tight">{title}</h1>
        {description && <p className="mt-1 text-gray-600 sm:text-[17px]">{description}</p>}
      </div>
      <div className="flex flex-col items-start gap-3 sm:items-end">
        <nav aria-label="Breadcrumb" className="no-print">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <li>
              <Link href={ROUTES.dashboard} className="text-gray-700 hover:text-brand-600" aria-label="Dashboard">
                <House className="size-4" />
              </Link>
            </li>
            {crumbs.map((c, i) => (
              <li key={c.label} className="flex items-center gap-2">
                <span className="text-gray-400">/</span>
                <span aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
              </li>
            ))}
          </ol>
        </nav>
        {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
