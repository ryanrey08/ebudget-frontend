"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, ImageUp, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { ErrorState } from "@/components/shared/ErrorState";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { AuthorizedImage } from "@/components/backend/AuthorizedImage";
import { BackendRequired } from "@/components/backend/DataSourceNotice";
import { useCan } from "@/hooks/useCan";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage, isApiError } from "@/lib/api/error-handler";
import { formatDateTime } from "@/lib/utils/format";
import { agencyProfileService } from "@/services/backend";
import { useGetAgencyProfileQuery, useRemoveAgencyLogoMutation, useUpdateAgencyProfileMutation, useUploadAgencyLogoMutation } from "../services/administrationApi";
import { AGENCY_PROFILE_LIMITS, type AgencyProfile, type AgencyProfileInput } from "../types";

const FIELDS: { name: keyof AgencyProfileInput; label: string; textarea?: boolean }[] = [
  { name: "agency_name", label: "Agency name" },
  { name: "acronym", label: "Acronym" },
  { name: "department_code", label: "Department code" },
  { name: "agency_code", label: "Agency code" },
  { name: "head_of_agency", label: "Head of agency" },
  { name: "address", label: "Address", textarea: true },
];

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function AgencyProfileView() {
  return (
    <>
      <PageHeader title="Agency Profile" description="The agency's codes, name, address, head and logo, printed in report and form headers." />
      <BackendRequired>
        <AgencyProfileForm />
      </BackendRequired>
    </>
  );
}

function AgencyProfileForm() {
  const notify = useNotify();
  const canManage = useCan("agency_profile.manage");
  const profile = useGetAgencyProfileQuery();
  const [update, { isLoading: saving }] = useUpdateAgencyProfileMutation();
  const [uploadLogo, { isLoading: uploading }] = useUploadAgencyLogoMutation();
  const [removeLogo, { isLoading: removing }] = useRemoveAgencyLogoMutation();
  const [values, setValues] = useState<AgencyProfileInput>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const current = profile.data;
    if (current) setValues(Object.fromEntries(FIELDS.map((f) => [f.name, current[f.name]])) as AgencyProfileInput);
  }, [profile.data]);

  if (profile.error) return <ErrorState error={profile.error} onRetry={profile.refetch} />;
  const data = profile.data;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    const changed: AgencyProfileInput = {};
    const local: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = (values[f.name] ?? "").trim();
      if (!v) local[f.name] = `${f.label} can't be blank.`;
      else if (v.length > AGENCY_PROFILE_LIMITS[f.name]) local[f.name] = `At most ${AGENCY_PROFILE_LIMITS[f.name]} characters.`;
      if (v !== data[f.name]) changed[f.name] = v;
    }
    if (Object.keys(local).length) return setErrors(local);
    if (!Object.keys(changed).length) return notify("info", "Nothing to save");
    setGeneral("");
    try {
      await update(changed).unwrap();
      notify("success", "Agency profile saved");
    } catch (err) {
      if (isApiError(err) && err.fieldErrors) setErrors(err.fieldErrors);
      else setGeneral(getErrorMessage(err));
    }
  };

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return notify("error", "Unsupported logo", "Use a PNG, JPEG or WebP image.");
    if (file.size > 2 * 1024 * 1024) return notify("error", "Logo too large", "The logo can be at most 2 MB.");
    try {
      await uploadLogo(file).unwrap();
      notify("success", "Logo updated");
    } catch (err) {
      notify("error", "Unable to upload the logo", getErrorMessage(err));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader title="Details" description={data ? `Last updated ${formatDateTime(data.updated_at)}` : undefined} />
        <CardBody>
          {!data ? (
            <div className="space-y-3">
              {FIELDS.map((f) => (
                <Skeleton key={f.name} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
              {general && (
                <div className="sm:col-span-2">
                  <FormAlert>{general}</FormAlert>
                </div>
              )}
              {FIELDS.map((f) => (
                <FormField key={f.name} label={f.label} htmlFor={`agency-${f.name}`} error={errors[f.name]} className={f.textarea || f.name === "agency_name" ? "sm:col-span-2" : undefined}>
                  {f.textarea ? (
                    <Textarea id={`agency-${f.name}`} rows={2} disabled={!canManage} maxLength={AGENCY_PROFILE_LIMITS[f.name]} value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                  ) : (
                    <Input id={`agency-${f.name}`} disabled={!canManage} maxLength={AGENCY_PROFILE_LIMITS[f.name]} value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} invalid={!!errors[f.name]} />
                  )}
                </FormField>
              ))}
              {canManage && (
                <div className="flex justify-end sm:col-span-2">
                  <Button type="submit" loading={saving}>
                    Save changes
                  </Button>
                </div>
              )}
            </form>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Logo" description="PNG, JPEG or WebP, up to 2 MB and 4000 × 4000 px." />
        <CardBody className="space-y-4">
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
            {data?.logo_url ? (
              <AuthorizedImage
                load={() => agencyProfileService.logo((data as AgencyProfile).logo_url as string)}
                cacheKey={data.updated_at}
                alt={`${data.agency_name} logo`}
                className="max-h-36 max-w-full object-contain"
                fallback={<Building2 className="size-10 text-gray-300" />}
              />
            ) : (
              <Building2 className="size-10 text-gray-300" aria-label="No logo" />
            )}
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept={LOGO_TYPES.join(",")} className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} loading={uploading}>
                <ImageUp className="size-4" /> {data?.logo_url ? "Replace" : "Upload"}
              </Button>
              {data?.logo_url && (
                <Button
                  variant="danger"
                  loading={removing}
                  onClick={async () => {
                    try {
                      await removeLogo().unwrap();
                      notify("success", "Logo removed");
                    } catch (err) {
                      notify("error", "Unable to remove the logo", getErrorMessage(err));
                    }
                  }}
                >
                  <Trash2 className="size-4" /> Remove
                </Button>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
