import type { Metadata } from "next";
import { UsersView } from "@/features/access/components/UsersView";

export const metadata: Metadata = { title: "Users" };

export default function Page() {
  return <UsersView />;
}
