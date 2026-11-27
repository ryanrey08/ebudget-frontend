"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { FormAlert } from "@/components/forms/FormAlert";
import { getErrorMessage } from "@/lib/api/error-handler";

/**
 * Confirmation dialog, optionally asking for a reason (cancel, reject). The
 * reason's limit follows the backend (500 characters unless given).
 */
export function PromptDialog({
  open,
  title,
  description,
  confirmLabel,
  danger,
  reason,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** Ask for a text: required unless `optional`. */
  reason?: { label: string; optional?: boolean; max?: number };
  onConfirm: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (open) {
      setText("");
      setError(null);
    }
  }, [open]);

  const max = reason?.max ?? 500;
  const invalid = !!reason && !reason.optional && !text.trim();

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(text.trim());
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={submit} loading={busy} disabled={invalid}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <FormAlert>{getErrorMessage(error)}</FormAlert> : null}
        {reason && (
          <div className="space-y-1.5">
            <label htmlFor={id} className="block text-sm font-medium text-gray-700">
              {reason.label}
              {!reason.optional && <span className="ml-0.5 text-brand-600">*</span>}
            </label>
            <Textarea id={id} rows={3} maxLength={max} value={text} onChange={(e) => setText(e.target.value)} />
            <p className="text-right text-xs text-gray-400">
              {text.length}/{max}
            </p>
          </div>
        )}
        {!reason && !description && <p className="text-sm text-gray-600">Are you sure?</p>}
      </div>
    </Modal>
  );
}
