import Link from "next/link";
import { CloudUpload, FileChartColumn, FilePlus2, FileText, Layers, ScrollText, type LucideIcon } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

const actions: { label: string; href: string; icon: LucideIcon; tone: string }[] = [
  { label: "Upload GAA", href: ROUTES.gaaUpload, icon: CloudUpload, tone: "bg-red-50 text-brand-600 hover:bg-red-100" },
  { label: "New Appropriation", href: ROUTES.newAppropriation, icon: FileText, tone: "bg-blue-50 text-blue-600 hover:bg-blue-100" },
  { label: "New Allotment", href: ROUTES.newAllotment, icon: FilePlus2, tone: "bg-green-50 text-green-600 hover:bg-green-100" },
  { label: "New Obligation", href: `${ROUTES.obligationManagement}?new=1`, icon: ScrollText, tone: "bg-orange-50 text-orange-600 hover:bg-orange-100" },
  { label: "Manage Allotment Classes", href: ROUTES.allotmentClass("raop"), icon: Layers, tone: "bg-purple-50 text-purple-700 hover:bg-purple-100" },
  { label: "Generate BFARS Report", href: `${ROUTES.reports}?category=BFARS`, icon: FileChartColumn, tone: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader title="Quick Actions" />
      <CardBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {actions.map(({ label, href, icon: Icon, tone }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex min-h-28 flex-col items-center justify-center gap-2.5 rounded-xl p-3 text-center text-sm font-medium transition-colors",
                tone,
              )}
            >
              <Icon className="size-8" aria-hidden />
              <span className="leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
