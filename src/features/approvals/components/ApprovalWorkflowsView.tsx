"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { BackendRequired } from "@/components/backend/DataSourceNotice";
import { PromptDialog } from "@/components/backend/PromptDialog";
import { useCan } from "@/hooks/useCan";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage, isApiError } from "@/lib/api/error-handler";
import { useGetUsersQuery } from "@/features/access/services/accessApi";
import { useGetSignatoriesQuery } from "@/features/administration/services/administrationApi";
import {
  useCreateApprovalWorkflowMutation,
  useDeleteApprovalWorkflowMutation,
  useGetApprovalWorkflowQuery,
  useGetApprovalWorkflowsQuery,
  useUpdateApprovalWorkflowMutation,
} from "../services/approvalsApi";
import { APPROVAL_MODULES, type ApprovalModule, type ApprovalWorkflow } from "../types";

export function ApprovalWorkflowsView() {
  return (
    <>
      <PageHeader
        title="Approval Workflows"
        description="The ordered steps each module's records go through. Requests keep the steps they were submitted with."
      />
      <BackendRequired>
        <WorkflowsTable />
      </BackendRequired>
    </>
  );
}

function WorkflowsTable() {
  const notify = useNotify();
  const canManage = useCan("approval_workflows.manage");
  const [module, setModule] = useState<ApprovalModule | "">("");
  const list = useGetApprovalWorkflowsQuery({ per_page: 100, module: module || undefined });
  const [update] = useUpdateApprovalWorkflowMutation();
  const [remove] = useDeleteApprovalWorkflowMutation();
  const [editing, setEditing] = useState<{ workflow?: ApprovalWorkflow } | null>(null);
  const [deleting, setDeleting] = useState<ApprovalWorkflow | null>(null);

  const toggleActive = async (w: ApprovalWorkflow) => {
    try {
      await update({ id: w.id, input: { is_active: !w.is_active } }).unwrap();
      notify("success", w.is_active ? "Workflow deactivated" : "Workflow activated", w.name);
    } catch (err) {
      notify("error", "Unable to change the workflow", getErrorMessage(err));
    }
  };

  const columns: Column<ApprovalWorkflow>[] = [
    { key: "module", header: "Module", cell: (w) => w.module_label },
    { key: "name", header: "Name", cell: (w) => <span className="font-medium">{w.name}</span> },
    {
      key: "steps",
      header: "Steps",
      className: "min-w-72",
      cell: (w) => (
        <ol className="space-y-0.5 text-xs">
          {w.steps.map((s) => (
            <li key={s.id}>
              <span className="font-medium text-gray-700">
                {s.sequence}. {s.name}
              </span>{" "}
              — {s.user.name}
              {s.signatory && <span className="text-gray-500"> (signs as {s.signatory.position})</span>}
            </li>
          ))}
        </ol>
      ),
    },
    { key: "active", header: "Status", align: "center", cell: (w) => (w.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>) },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            align: "center" as const,
            cell: (w: ApprovalWorkflow) => (
              <DropdownMenu
                label={`Actions for ${w.name}`}
                triggerClassName="rounded-md border border-gray-200 px-2 py-0.5 text-gray-600 hover:bg-gray-100"
                trigger={<MoreHorizontal className="size-4" />}
                items={[
                  { label: "Edit", icon: Pencil, onSelect: () => setEditing({ workflow: w }) },
                  { label: w.is_active ? "Deactivate" : "Activate", onSelect: () => toggleActive(w) },
                  { label: "Delete", icon: Trash2, danger: true, onSelect: () => setDeleting(w) },
                ]}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <label htmlFor="wf-module" className="mb-1.5 block text-sm font-medium text-gray-700">
              Module
            </label>
            <Select id="wf-module" value={module} onChange={(e) => setModule(e.target.value as ApprovalModule | "")} placeholder="All" options={APPROVAL_MODULES} />
          </div>
          <p className="flex-1 text-sm text-gray-500">Each module can have one active workflow. To switch, deactivate the current one first.</p>
          {canManage && (
            <Button onClick={() => setEditing({})}>
              <Plus className="size-4" /> Add workflow
            </Button>
          )}
        </div>
      </Card>
      <Card className="overflow-hidden">
        <DataTable dense columns={columns} rows={list.data?.items} rowKey={(w) => w.id} loading={list.isFetching && !list.currentData} error={list.error} onRetry={list.refetch} emptyTitle="No approval workflows" emptyDescription="Allotment tranches can't be submitted until the allotment module has an active workflow." caption="Approval workflows" />
      </Card>
      {editing && (editing.workflow ? <FreshWorkflowModal id={editing.workflow.id} onClose={() => setEditing(null)} /> : <WorkflowModal onClose={() => setEditing(null)} />)}
      <PromptDialog
        open={!!deleting}
        title={`Delete ${deleting?.name}?`}
        description="A workflow that any approval request has used can't be deleted; deactivate it instead."
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await remove(deleting.id).unwrap();
          notify("success", "Workflow deleted", deleting.name);
        }}
      />
    </>
  );
}

interface StepDraft {
  key: number;
  name: string;
  user_id: string;
  signatory_id: string;
}

let stepKey = 0;

/** GET /approval-workflows/{id} first, so the steps are the latest. */
function FreshWorkflowModal({ id, onClose }: { id: string; onClose: () => void }) {
  const workflow = useGetApprovalWorkflowQuery(id);
  if (!workflow.data) {
    return (
      <Modal open onClose={onClose} title="Approval workflow" footer={<Button onClick={onClose}>Close</Button>}>
        {workflow.error ? <FormAlert>{getErrorMessage(workflow.error)}</FormAlert> : <p className="py-6 text-center text-sm text-gray-500">Loading…</p>}
      </Modal>
    );
  }
  return <WorkflowModal workflow={workflow.data} onClose={onClose} />;
}

function WorkflowModal({ workflow, onClose }: { workflow?: ApprovalWorkflow; onClose: () => void }) {
  const notify = useNotify();
  const users = useGetUsersQuery({ per_page: 100 });
  const signatories = useGetSignatoriesQuery({ per_page: 100, is_active: 1 });
  const [create, createState] = useCreateApprovalWorkflowMutation();
  const [update, updateState] = useUpdateApprovalWorkflowMutation();
  const busy = createState.isLoading || updateState.isLoading;
  const [module, setModule] = useState<ApprovalModule>(workflow?.module ?? "allotment");
  const [name, setName] = useState(workflow?.name ?? "");
  const [active, setActive] = useState(workflow?.is_active ?? false);
  const [steps, setSteps] = useState<StepDraft[]>(
    workflow?.steps.map((s) => ({ key: ++stepKey, name: s.name, user_id: s.user.id, signatory_id: s.signatory?.id ?? "" })) ?? [{ key: ++stepKey, name: "", user_id: "", signatory_id: "" }],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState("");

  const userOptions = (users.data?.items ?? []).filter((u) => u.is_active).map((u) => ({ value: u.id, label: u.name }));
  const signatoriesOf = (userId: string) => (signatories.data?.items ?? []).filter((s) => s.user.id === userId).map((s) => ({ value: s.id, label: s.position }));

  const patchStep = (i: number, patch: Partial<StepDraft>) => setSteps((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) =>
    setSteps((all) => {
      const next = [...all];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  const save = async () => {
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = "Enter a name.";
    if (!steps.length) local.steps = "Add at least one step.";
    steps.forEach((s, i) => {
      if (!s.name.trim()) local[`steps.${i}.name`] = "Name the step.";
      if (!s.user_id) local[`steps.${i}.user_id`] = "Choose who acts on it.";
    });
    if (Object.keys(local).length) return setErrors(local);
    setErrors({});
    setGeneral("");
    const payload = {
      name: name.trim(),
      is_active: active,
      steps: steps.map((s) => ({ name: s.name.trim(), user_id: s.user_id, signatory_id: s.signatory_id || null })),
    };
    try {
      if (workflow) await update({ id: workflow.id, input: payload }).unwrap();
      else await create({ ...payload, module }).unwrap();
      notify("success", workflow ? "Workflow updated" : "Workflow created", payload.name);
      onClose();
    } catch (err) {
      if (isApiError(err) && err.fieldErrors) setErrors(err.fieldErrors);
      setGeneral(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      size="xl"
      onClose={busy ? () => undefined : onClose}
      title={workflow ? `Edit ${workflow.name}` : "Add approval workflow"}
      description={workflow ? "Saving the steps replaces all of them. Requests already submitted keep their own copy." : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save workflow
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {general && <FormAlert>{general}</FormAlert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Module" htmlFor="wf-edit-module" error={errors.module} required>
            <Select id="wf-edit-module" disabled={!!workflow} value={module} onChange={(e) => setModule(e.target.value as ApprovalModule)} options={APPROVAL_MODULES} />
          </FormField>
          <FormField label="Name" htmlFor="wf-name" error={errors.name} required>
            <Input id="wf-name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} />
          </FormField>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
            <input type="checkbox" className="size-4 accent-brand-600" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
            {errors.is_active && <span className="text-xs text-red-600">{errors.is_active}</span>}
          </label>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Steps, in order</p>
          {errors.steps && <p className="mb-2 text-xs text-red-600">{errors.steps}</p>}
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.key} className="grid items-start gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-[2rem_1fr_1fr_1fr_auto]">
                <span className="pt-2 text-sm font-semibold text-gray-500">{i + 1}.</span>
                <FormField label="" htmlFor={`step-${s.key}-name`} error={errors[`steps.${i}.name`]}>
                  <Input id={`step-${s.key}-name`} placeholder="e.g. Reviewed by" value={s.name} onChange={(e) => patchStep(i, { name: e.target.value })} aria-label={`Step ${i + 1} name`} />
                </FormField>
                <FormField label="" htmlFor={`step-${s.key}-user`} error={errors[`steps.${i}.user_id`]}>
                  <Select id={`step-${s.key}-user`} aria-label={`Step ${i + 1} user`} value={s.user_id} placeholder="Approver…" options={userOptions} onChange={(e) => patchStep(i, { user_id: e.target.value, signatory_id: "" })} />
                </FormField>
                <FormField label="" htmlFor={`step-${s.key}-sig`} error={errors[`steps.${i}.signatory_id`]}>
                  <Select id={`step-${s.key}-sig`} aria-label={`Step ${i + 1} signatory`} value={s.signatory_id} placeholder="No e-signature" options={signatoriesOf(s.user_id)} onChange={(e) => patchStep(i, { signatory_id: e.target.value })} disabled={!s.user_id} />
                </FormField>
                <div className="flex gap-1 pt-1">
                  <Button size="icon" variant="ghost" className="size-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" disabled={steps.length === 1} onClick={() => setSteps((all) => all.filter((_, j) => j !== i))} aria-label="Remove step">
                    <X className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <Button variant="outline" size="sm" className="mt-2" disabled={steps.length >= 20} onClick={() => setSteps((all) => [...all, { key: ++stepKey, name: "", user_id: "", signatory_id: "" }])}>
            <Plus className="size-3.5" /> Add step
          </Button>
          <p className="mt-2 text-xs text-gray-500">A step with a signatory needs the approver&apos;s e-signature; the signatory must belong to that step&apos;s user.</p>
        </div>
      </div>
    </Modal>
  );
}
