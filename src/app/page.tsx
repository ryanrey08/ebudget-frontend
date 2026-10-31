import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";

// Middleware normally handles "/", this is a fallback.
export default function Home() {
  redirect(ROUTES.dashboard);
}
