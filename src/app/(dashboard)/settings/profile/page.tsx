import type { Metadata } from "next";
import { ProfileView } from "@/features/settings/components/ProfileView";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return <ProfileView />;
}
