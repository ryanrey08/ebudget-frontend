"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Starts the bar from code, e.g. before `router.push()`. */
export function startNavigationProgress() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("ebudget:navigation-start"));
}

function isInternalNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor || !anchor.href || anchor.hasAttribute("download")) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Same page (or only the #hash differs): nothing will load.
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

/**
 * Thin progress bar at the top of the window that appears the moment an
 * internal link is clicked and finishes when the new route has rendered.
 * App Router gives no feedback until the next page's server response
 * arrives, which in `next dev` includes compiling the page (seconds), so
 * without this a click looks like it did nothing.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState<number | null>(null);
  const timers = useRef<{ trickle?: ReturnType<typeof setInterval>; hide?: ReturnType<typeof setTimeout>; safety?: ReturnType<typeof setTimeout> }>({});
  const active = useRef(false);

  useEffect(() => {
    const t = timers.current;
    const start = () => {
      if (active.current) return;
      active.current = true;
      clearTimeout(t.hide);
      setProgress(8);
      clearInterval(t.trickle);
      // Approaches 90% and waits there until the route changes.
      t.trickle = setInterval(() => setProgress((p) => (p === null ? p : p + (90 - p) * 0.08)), 200);
      clearTimeout(t.safety);
      t.safety = setTimeout(() => finish(), 60_000);
    };
    const finish = () => {
      if (!active.current) return;
      active.current = false;
      clearInterval(t.trickle);
      clearTimeout(t.safety);
      setProgress(100);
      t.hide = setTimeout(() => setProgress(null), 250);
    };
    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("ebudget:navigation-start", start);
    window.addEventListener("popstate", start);
    (t as { finish?: () => void }).finish = finish;
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("ebudget:navigation-start", start);
      window.removeEventListener("popstate", start);
      clearInterval(t.trickle);
      clearTimeout(t.hide);
      clearTimeout(t.safety);
    };
  }, []);

  // The new route has committed: complete the bar.
  useEffect(() => {
    (timers.current as { finish?: () => void }).finish?.();
  }, [pathname, searchParams]);

  if (progress === null) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
    >
      <div
        className="h-full bg-brand-600 shadow-[0_0_8px_rgba(215,31,38,0.6)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
      />
    </div>
  );
}
