import { AlertTriangle, Lock, RotateCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { codeForStatus, isApiError } from "@/lib/api/api-error";
import { getErrorMessage } from "@/lib/api/error-handler";

function describe(error: unknown) {
  const code = isApiError(error) ? (error.code ?? codeForStatus(error.status)) : undefined;
  if (code === "NETWORK_ERROR" || code === "TIMEOUT") return { title: "Cannot connect to the server", Icon: WifiOff };
  if (code === "FORBIDDEN") return { title: "Access denied", Icon: Lock };
  if (code === "NOT_FOUND") return { title: "Not found", Icon: AlertTriangle };
  return { title: "Unable to load data", Icon: AlertTriangle };
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { title, Icon } = describe(error);
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-red-50 p-3 text-red-500">
        <Icon className="size-6" aria-hidden />
      </div>
      <p className="font-medium text-gray-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw className="size-4" /> Try again
        </Button>
      )}
    </div>
  );
}
