export interface AppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  href?: string;
  kind: "info" | "success" | "warning";
}
