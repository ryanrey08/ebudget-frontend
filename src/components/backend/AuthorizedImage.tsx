"use client";

import { useEffect, useState } from "react";
import type { DownloadedFile } from "@/lib/api/api-types";

/**
 * Shows an image the backend serves behind the bearer token (agency logo,
 * e-signatures). A plain <img src> can't send the token, so the file is
 * fetched through the API client and shown from a blob URL.
 */
export function AuthorizedImage({
  load,
  cacheKey,
  alt,
  className,
  fallback = null,
}: {
  load: () => Promise<DownloadedFile>;
  /** Changes when the image changes (e.g. updated_at), to fetch it again. */
  cacheKey: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setFailed(false);
    load()
      .then((file) => {
        if (cancelled) return;
        url = URL.createObjectURL(file.blob);
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  if (failed) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} className={className} /> : <div className={className} aria-busy />;
}
