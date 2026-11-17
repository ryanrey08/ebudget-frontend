import { proxyToBackend } from "@/lib/server/backend-proxy";

/**
 * /api/v1/* → {BACKEND_API_URL}/{BACKEND_SYSTEM}/*
 *
 * Same-origin proxy for the eBudget data API in real data mode
 * (NEXT_PUBLIC_API_MODE=real). See src/lib/server/backend-proxy.ts.
 */
export const dynamic = "force-dynamic";

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PUT = proxyToBackend;
export const PATCH = proxyToBackend;
export const DELETE = proxyToBackend;
