import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { authApi } from "@/features/auth/services/authApi";
import type { Permission, User } from "@/features/auth/types";
import { hasPermission } from "@/features/auth/utils";
import { codeForStatus, isApiError } from "@/lib/api/api-error";
import type { ApiError } from "@/types/api";

const isSessionError = (error: ApiError) => {
  const code = error.code ?? codeForStatus(error.status);
  return code === "UNAUTHORIZED" || code === "FORBIDDEN" || code === "NOT_FOUND";
};

/**
 * Client-side view of the session. This is display state only: the backend
 * (and middleware, via the httpOnly session cookie) is the source of truth
 * for access. Passwords and tokens are never stored here.
 *
 * Requests run through RTK Query (`authApi`), the project's established
 * pattern; this slice follows their pending / fulfilled / rejected actions.
 */
export type AuthStatus = "checking" | "authenticated" | "unauthenticated";

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  /** True while a login, logout or session check is running. */
  isLoading: boolean;
  /** Last authentication error message (login or session check), for display. */
  error: string | null;
}

const NO_PERMISSIONS: Permission[] = [];

const initialState: AuthState = { status: "checking", user: null, isLoading: false, error: null };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** Ends the client session (logout, 401 from any request, expired session). */
    loggedOut: () => ({ ...initialState, status: "unauthenticated" as const }),
    userUpdated: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    authErrorCleared: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(authApi.endpoints.login.matchPending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
        state.status = "authenticated";
        state.user = payload.user;
        state.isLoading = false;
        state.error = null;
      })
      .addMatcher(authApi.endpoints.login.matchRejected, (state, action) => {
        state.isLoading = false;
        state.error = isApiError(action.payload) ? action.payload.message : "Sign-in failed. Please try again.";
      })
      .addMatcher(authApi.endpoints.getCurrentUser.matchPending, (state) => {
        state.isLoading = true;
      })
      .addMatcher(authApi.endpoints.getCurrentUser.matchFulfilled, (state, { payload }) => {
        state.status = "authenticated";
        state.user = payload;
        state.isLoading = false;
        state.error = null;
      })
      .addMatcher(authApi.endpoints.getCurrentUser.matchRejected, (state, action) => {
        if (action.meta.condition) return; // skipped because a request is already in flight
        state.isLoading = false;
        // Backend unreachable or failing: the session may still be valid, so keep
        // checking (AppShell shows a connection error with retry) instead of signing out.
        if (isApiError(action.payload) && !isSessionError(action.payload)) {
          state.error = action.payload.message;
          return;
        }
        state.status = "unauthenticated";
        state.user = null;
      })
      .addMatcher(authApi.endpoints.logout.matchPending, (state) => {
        state.isLoading = true;
      })
      .addMatcher(authApi.endpoints.logout.matchFulfilled, () => ({ ...initialState, status: "unauthenticated" as const }))
      .addMatcher(authApi.endpoints.logout.matchRejected, () => ({ ...initialState, status: "unauthenticated" as const }));
  },
  selectors: {
    selectAuthStatus: (state) => state.status,
    selectCurrentUser: (state) => state.user,
    selectIsAuthenticated: (state) => state.status === "authenticated",
    /** The first session check has finished (either way). */
    selectIsAuthInitialized: (state) => state.status !== "checking",
    selectAuthLoading: (state) => state.isLoading,
    selectAuthError: (state) => state.error,
    selectPermissions: (state) => state.user?.permissions ?? NO_PERMISSIONS,
    selectHasPermission: (state, permission: Permission) => hasPermission(state.user, permission),
  },
});

export const { loggedOut, userUpdated, authErrorCleared } = authSlice.actions;
export const {
  selectAuthStatus,
  selectCurrentUser,
  selectIsAuthenticated,
  selectIsAuthInitialized,
  selectAuthLoading,
  selectAuthError,
  selectPermissions,
  selectHasPermission,
} = authSlice.selectors;
export default authSlice;
