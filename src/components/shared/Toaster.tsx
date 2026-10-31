"use client";

import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { alertDismissed, selectAlerts, type Alert } from "@/store/slices/alertsSlice";
import { cn } from "@/lib/utils/cn";

const styles = {
  success: { icon: CheckCircle2, className: "text-green-600" },
  error: { icon: XCircle, className: "text-red-600" },
  warning: { icon: AlertTriangle, className: "text-amber-500" },
  info: { icon: Info, className: "text-blue-600" },
} as const;

export function Toaster() {
  const alerts = useAppSelector(selectAlerts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6"
    >
      {alerts.map((alert) => (
        <Toast key={alert.id} alert={alert} />
      ))}
    </div>
  );
}

function Toast({ alert }: { alert: Alert }) {
  const dispatch = useAppDispatch();
  const { icon: Icon, className } = styles[alert.variant];

  useEffect(() => {
    const id = setTimeout(() => dispatch(alertDismissed(alert.id)), 5000);
    return () => clearTimeout(id);
  }, [alert.id, dispatch]);

  return (
    <div
      role={alert.variant === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", className)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
        {alert.description && <p className="mt-0.5 text-sm text-gray-600">{alert.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => dispatch(alertDismissed(alert.id))}
        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label="Dismiss notification"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
