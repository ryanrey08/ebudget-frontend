"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useGetGaaUploadQuery } from "../../services/gaaApi";
import { batchSelected, selectGaaWizard, wizardReset } from "../../state/gaaWizardSlice";
import { GAA_STEP_TITLES, GaaStepper } from "./GaaStepper";
import { ImportResultStep } from "./ImportResultStep";
import { MapConfigureStep } from "./MapConfigureStep";
import { UploadStep } from "./UploadStep";
import { ValidateStep } from "./ValidateStep";

/**
 * GAA Upload workflow: Upload File → Validate Data → Map & Configure → Import to System.
 * A `?batch=<id>` link (e.g. from a notification) resumes an existing upload.
 */
export function GaaUploadWorkflow() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { step, batchId } = useAppSelector(selectGaaWizard);
  const batchQuery = useGetGaaUploadQuery(batchId ?? "", { skip: !batchId });
  const batch = batchId ? batchQuery.data : undefined;

  useEffect(() => {
    const requested = searchParams.get("batch");
    if (requested) {
      dispatch(batchSelected({ batchId: requested, step: "validate" }));
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, dispatch, router, pathname]);

  // The batch was deleted or the link was stale: start over.
  useEffect(() => {
    if (batchId && batchQuery.isError) dispatch(wizardReset());
  }, [batchId, batchQuery.isError, dispatch]);

  // An imported batch always opens on its results.
  const effectiveStep = batch?.status === "Imported" && step !== "upload" ? "import" : step;
  const { title, description } = GAA_STEP_TITLES[effectiveStep];
  const needsBatch = effectiveStep !== "upload";

  return (
    <>
      <PageHeader title={title} description={description} extraCrumbs={effectiveStep === "upload" ? [] : [title]} />
      <GaaStepper current={effectiveStep} fileName={batch?.fileName} completed={batch?.status === "Imported" && effectiveStep === "import"} />
      {needsBatch && !batch ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : effectiveStep === "upload" ? (
        <UploadStep batch={batch} />
      ) : effectiveStep === "validate" ? (
        <ValidateStep batch={batch!} />
      ) : effectiveStep === "map" ? (
        <MapConfigureStep batch={batch!} />
      ) : (
        <ImportResultStep batch={batch!} />
      )}
    </>
  );
}
