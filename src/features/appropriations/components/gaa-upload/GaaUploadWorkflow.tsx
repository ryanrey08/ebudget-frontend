"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { BackendRequired } from "@/components/backend/DataSourceNotice";
import { useAppSelector } from "@/store/hooks";
import { selectGaaWizard } from "../../state/gaaWizardSlice";
import { GaaConfigureStep } from "./GaaConfigureStep";
import { GaaImportStep } from "./GaaImportStep";
import { GAA_STEP_TITLES, GaaStepper } from "./GaaStepper";
import { GaaUploadStep } from "./GaaUploadStep";
import { GaaValidateStep } from "./GaaValidateStep";

/**
 * GAA Upload against the backend:
 * Upload File (POST /appropriations/import/validate, nothing saved) →
 * Validate Data (correct the cells) → Configure Import (level, legal
 * reference…) → Import to System (POST /appropriations/imports, queued, polled).
 */
export function GaaUploadWorkflow() {
  const { step, fileName, report, importId } = useAppSelector(selectGaaWizard);
  const effective = step !== "upload" && !report ? "upload" : step === "import" && !importId ? "map" : step;
  const { title, description } = GAA_STEP_TITLES[effective];

  return (
    <>
      <PageHeader title={title} description={description} extraCrumbs={effective === "upload" ? [] : [title]} />
      <BackendRequired>
        <GaaStepper current={effective} fileName={fileName ?? undefined} />
        {effective === "upload" ? <GaaUploadStep /> : effective === "validate" ? <GaaValidateStep /> : effective === "map" ? <GaaConfigureStep /> : <GaaImportStep />}
      </BackendRequired>
    </>
  );
}
