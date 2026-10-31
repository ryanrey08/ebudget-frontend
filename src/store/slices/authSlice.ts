import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { authApi } from "@/features/auth/services/authApi";
import { profileApi } from "@/features/settings/services/profileApi";
import type { User } from "@/features/auth/types";

/**
 * Client-side view of the session. This is display state only: the backend
 * (or middleware, via the session cookie) is the source of truth for access.
 * Passwords and tokens are never stored here.
 */
export type AuthStatus = "checking" | "authenticated" | "unauthenticated";

export interface AuthState {
  status: AuthStatus;
  user: User | null;
}

const initialState: AuthState = { status: "checking", user: null };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loggedOut: () => ({ status: "unauthenticated" as const, user: null }),
    userUpdated: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
        state.status = "authenticated";
        state.user = payload.user;
      })
      .addMatcher(authApi.endpoints.getCurrentUser.matchFulfilled, (state, { payload }) => {
        state.status = "authenticated";
        state.user = payload;
      })
      .addMatcher(authApi.endpoints.getCurrentUser.matchRejected, (state, action) => {
        if (action.meta.condition) return; // skipped because a request is already in flight
        state.status = "unauthenticated";
        state.user = null;
      })
      .addMatcher(profileApi.endpoints.updateProfile.matchFulfilled, (state, { payload }) => {
        state.user = payload;
      });
  },
  selectors: {
    selectAuthStatus: (state) => state.status,
    selectCurrentUser: (state) => state.user,
    selectIsAuthenticated: (state) => state.status === "authenticated",
  },
});

export const { loggedOut, userUpdated } = authSlice.actions;
export const { selectAuthStatus, selectCurrentUser, selectIsAuthenticated } = authSlice.selectors;
export default authSlice;
