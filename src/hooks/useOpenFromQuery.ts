"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Modal open state that can be triggered by a `?new=1` link (used by the
 * dashboard quick actions). The query flag is removed once consumed.
 */
export function useOpenFromQuery(param = "new") {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get(param)) {
      setOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, param, router, pathname]);

  return [open, setOpen] as const;
}
