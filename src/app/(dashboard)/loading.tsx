import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-7 text-brand-600" label="Loading…" />
    </div>
  );
}
