import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/utils/format";
import type { ReportCellType, ReportCellValue } from "./types";

export function formatCell(value: ReportCellValue | undefined, type: ReportCellType): string {
  if (value === undefined || value === "") return "";
  if (typeof value === "string") return type === "date" ? formatDate(value) : value;
  switch (type) {
    case "currency":
      return formatCurrency(value).replace("₱", "");
    case "percent":
      return formatPercent(value);
    case "number":
      return formatNumber(value);
    default:
      return String(value);
  }
}
