import type { ObligationLookups } from "@/features/obligation-management/types";

/** Choice lists and sample procurement records for the obligation form (dummy data). */
export const OBLIGATION_LOOKUPS: Omit<ObligationLookups, "payees"> = {
  units: ["piece", "ream", "box", "pack", "set", "unit", "lot", "month", "day"],
  modesOfProcurement: [
    "Section 53.9 - Small Value Procurement (SVP)",
    "Competitive Bidding",
    "Direct Contracting",
    "Not Applicable",
  ],
  applicableDocuments: [
    "APP",
    "Approved Allotment",
    "Purchase Request (PR)",
    "Purchase Order (PO)",
    "CANvASS/Abstract of Quotations",
    "Other Documents",
  ],
  sources: [
    {
      type: "PR/PO",
      referenceNo: "PR-2026-0456",
      prNo: "PR-2026-0456",
      poNo: "PO-2026-0789",
      appNo: "APP-2026-0123",
      title: "Procurement of Office Supplies",
      payee: "ABC Office Supplies Inc.",
      modeOfProcurement: "Section 53.9 - Small Value Procurement (SVP)",
      items: [
        { uacsCode: "5020302000", description: "Bond Paper A4 80gsm", quantity: 100, unit: "ream", unitCost: 220 },
        { uacsCode: "5020302000", description: "Ink Cartridge (Black)", quantity: 50, unit: "piece", unitCost: 1200 },
        { uacsCode: "5020302000", description: "Ballpen (Blue)", quantity: 1000, unit: "piece", unitCost: 12 },
        { uacsCode: "5020304000", description: "Folder (Long)", quantity: 500, unit: "piece", unitCost: 18 },
      ],
    },
    {
      type: "PR/PO",
      referenceNo: "PR-2026-0471",
      prNo: "PR-2026-0471",
      poNo: "PO-2026-0802",
      appNo: "APP-2026-0130",
      title: "ICT Equipment Repair and Maintenance",
      payee: "Marikina IT Solutions",
      modeOfProcurement: "Section 53.9 - Small Value Procurement (SVP)",
      items: [
        { uacsCode: "5021305003", description: "Preventive maintenance – desktop units", quantity: 40, unit: "unit", unitCost: 1500 },
        { uacsCode: "5021305003", description: "Printer servicing", quantity: 12, unit: "unit", unitCost: 2500 },
      ],
    },
    {
      type: "APP",
      referenceNo: "APP-2026-0141",
      appNo: "APP-2026-0141",
      title: "Training and Capacity Building – Q4",
      items: [
        { uacsCode: "5020201000", description: "Training venue and meals", quantity: 3, unit: "day", unitCost: 85000 },
        { uacsCode: "5020201000", description: "Training kits", quantity: 60, unit: "set", unitCost: 650 },
      ],
    },
  ],
};

export const SAMPLE_PAYEES = [
  { name: "ABC Office Supplies Inc.", tin: "123-456-789-000", address: "123 Main St., Quezon City, Metro Manila" },
  { name: "Marikina IT Solutions", tin: "234-567-890-000", address: "45 Shoe Ave., Marikina City" },
];
