"use client";

import { BadgeCheck, Briefcase, Building2, CalendarDays, IdCard, Mail, Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/shared/Avatar";
import { ErrorState } from "@/components/shared/ErrorState";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { ROLE_LABELS } from "@/features/auth/types";
import { useGetProfileQuery } from "../services/profileApi";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { ProfileForm } from "./ProfileForm";

export function ProfileView() {
  const { data: user, isLoading, error, refetch } = useGetProfileQuery();

  return (
    <>
      <PageHeader title="Profile" description="Manage your eBudget account information." />
      {error ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : isLoading || !user ? (
        <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <Card>
            <CardBody className="flex flex-col items-center text-center">
              <Avatar name={`${user.firstName} ${user.lastName}`} size="lg" />
              <h2 className="mt-4 text-lg font-semibold text-gray-900">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-sm text-gray-500">{user.position}</p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                <BadgeCheck className="size-3.5" /> {ROLE_LABELS[user.role]}
              </span>
              <dl className="mt-6 w-full space-y-3 border-t border-gray-100 pt-5 text-left text-sm">
                {[
                  { icon: IdCard, label: "Employee ID", value: user.employeeId },
                  { icon: Mail, label: "Email", value: user.email },
                  { icon: Phone, label: "Mobile", value: user.phone || "—" },
                  { icon: Briefcase, label: "Office", value: user.office },
                  { icon: Building2, label: "Agency", value: user.agency },
                  { icon: CalendarDays, label: "Member since", value: formatDate(user.createdAt) },
                  ...(user.lastLoginAt ? [{ icon: CalendarDays, label: "Last sign-in", value: formatDateTime(user.lastLoginAt) }] : []),
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <Icon className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden />
                    <div className="min-w-0">
                      <dt className="text-xs text-gray-500">{label}</dt>
                      <dd className="break-words text-gray-900">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
          <div className="space-y-5">
            <ProfileForm user={user} />
            <ChangePasswordForm />
          </div>
        </div>
      )}
    </>
  );
}
