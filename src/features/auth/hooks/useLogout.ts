"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store/hooks";
import { api } from "@/store/services/api";
import { loggedOut } from "@/store/slices/authSlice";
import { alertAdded } from "@/store/slices/alertsSlice";
import { ROUTES } from "@/lib/constants/routes";
import { useLogoutMutation } from "../services/authApi";

/** Ends the session (server + client state) and returns to the login page. */
export function useLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [logoutRequest, { isLoading }] = useLogoutMutation();

  const logout = useCallback(async () => {
    try {
      await logoutRequest().unwrap();
    } catch {
      // Even if the request fails the local session is cleared.
    }
    dispatch(loggedOut());
    dispatch(api.util.resetApiState());
    dispatch(alertAdded({ variant: "info", title: "Signed out", description: "You have been signed out of eBudget." }));
    router.replace(ROUTES.login);
    router.refresh();
  }, [dispatch, logoutRequest, router]);

  return { logout, isLoggingOut: isLoading };
}
