"use client";

import { BadgeCheck, CalendarDays, KeyRound, Layers, Mail, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/shared/Avatar";
import { ErrorState } from "@/components/shared/ErrorState";
import { FormAlert } from "@/components/forms/FormAlert";
import { env } from "@/config/env";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/store/slices/authSlice";
import { roleLabel } from "@/features/auth/utils";
import { useGetProfileQuery } from "../services/profileApi";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { ProfileForm } from "./ProfileForm";

/** Profile editing exists only in the mock API (the backend has no profile endpoints). */
function MockProfileEditor() {
  const { data: profile, isLoading, error, refetch } = useGetProfileQuery();
  if (error) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }
  if (isLoading || !profile) return <Skeleton className="h-96 rounded-xl" />;
  return (
    <>
      <ProfileForm user={profile} />
      <ChangePasswordForm />
    </>
  );
}

export function ProfileView() {
  // Loaded by AppShell from GET /auth/me before any protected page renders.
  const user = useAppSelector(selectCurrentUser);

  return (
    <>
      <PageHeader title="Profile" description="Your eBudget account information." />
      {!user ? (
        <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <Card>
            <CardBody className="flex flex-col items-center text-center">
              <Avatar name={user.name} size="lg" />
              <h2 className="mt-4 text-lg font-semibold text-gray-900">{user.name}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                <BadgeCheck className="size-3.5" /> {roleLabel(user)}
              </span>
              <dl className="mt-6 w-full space-y-3 border-t border-gray-100 pt-5 text-left text-sm">
                {[
                  { icon: Mail, label: "Email", value: user.email },
                  { icon: Layers, label: "System", value: user.system.name },
                  { icon: ShieldCheck, label: "Account status", value: user.is_active ? "Active" : "Inactive" },
                  { icon: CalendarDays, label: "Member since", value: formatDate(user.created_at) },
                  ...(user.last_login_at ? [{ icon: CalendarDays, label: "Last sign-in", value: formatDateTime(user.last_login_at) }] : []),
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
            <Card>
              <CardHeader title="Access" description="Roles and permissions granted to your account." />
              <CardBody className="space-y-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Roles</p>
                  {user.roles.length ? (
                    <ul className="mt-1.5 flex flex-wrap gap-2">
                      {user.roles.map((r) => (
                        <li key={r.id} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">{r.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-gray-700">No role assigned.</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Permissions</p>
                  {user.is_super_admin ? (
                    <p className="mt-1 text-gray-700">Super admin: all permissions.</p>
                  ) : user.permissions.length ? (
                    <ul className="mt-1.5 flex flex-wrap gap-2">
                      {user.permissions.map((p) => (
                        <li key={p} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-0.5 font-mono text-xs text-gray-700">
                          <KeyRound className="size-3 text-gray-400" aria-hidden /> {p}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-gray-700">No administrative permissions.</p>
                  )}
                </div>
              </CardBody>
            </Card>
            {env.useMockAuth ? (
              <MockProfileEditor />
            ) : (
              <FormAlert tone="info">
                Profile details and passwords are managed by your eBudget administrator.
              </FormAlert>
            )}
          </div>
        </div>
      )}
    </>
  );
}
