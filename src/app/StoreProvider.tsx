"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { onAuthEvent } from "@/lib/api/auth-token";
import { makeStore, type AppStore } from "@/store";
import { loggedOut } from "@/store/slices/authSlice";

export default function StoreProvider({ children }: { children: ReactNode }) {
  // Lazily create one store per client; never a module-level singleton.
  const [store] = useState<AppStore>(makeStore);

  // A 401 from any request (including direct service calls such as file
  // downloads) ends the client session; AppShell then returns to the login page.
  useEffect(() => onAuthEvent((event) => {
    if (event === "unauthorized" && store.getState().auth.status === "authenticated") store.dispatch(loggedOut());
  }), [store]);

  return <Provider store={store}>{children}</Provider>;
}
