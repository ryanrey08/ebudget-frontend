"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "@/store";

export default function StoreProvider({ children }: { children: ReactNode }) {
  // Lazily create one store per client; never a module-level singleton.
  const [store] = useState<AppStore>(makeStore);
  return <Provider store={store}>{children}</Provider>;
}
