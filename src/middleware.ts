import { NextResponse, type NextRequest } from "next/server";
import { REDIRECT_PARAM, SESSION_COOKIE } from "@/lib/auth/session";
import { AUTH_ROUTES, PROTECTED_ROUTE_PREFIXES, ROUTES } from "@/lib/constants/routes";

/**
 * Route guard based on the presence of the session cookie. This is a UX
 * redirect only; the backend must still authorise every API request.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const isProtected = PROTECTED_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_ROUTES.some((p) => pathname === p);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? ROUTES.dashboard : ROUTES.login, request.url));
  }

  if (isProtected && !hasSession) {
    const url = new URL(ROUTES.login, request.url);
    url.searchParams.set(REDIRECT_PARAM, `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && hasSession && pathname !== ROUTES.resetPassword) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|brand|templates|icon.png|favicon.ico).*)"],
};
