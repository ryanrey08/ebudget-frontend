import type { ReactNode } from "react";
import { DemoDataNotice } from "@/components/backend/DataSourceNotice";

/** The backend has no RAO registry (obligations by allotment class) endpoints yet: these pages show demo data in real mode. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoDataNotice module="RAO registry (obligations by allotment class)" />
      {children}
    </>
  );
}
