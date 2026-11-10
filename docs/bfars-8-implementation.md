# BFARS 8 (Aging of Unpaid Obligations): implementation notes

## What was built
- **`/bfars-reporting/bfars-8`**: the dashboard from "eBudget BFARS 8 Aging Dashboard". Fiscal Year, As of Date, Department/Office, Allotment Class and UACS (Major) filters with Generate Report; Total Unpaid Obligations plus one card per aging bracket (amount, % of total, bar); "Unpaid Obligations by Aging Bucket" bars and "Unpaid Obligations by Object of Expenditure" donut; the Unpaid Obligations Details table (aging days, colored bucket pill, TOTAL row, search, pagination) with Export to Excel, Export to PDF and Print. A "Report Generator" button opens the generator.
- **`/bfars-reporting/bfars-8/generate`**: parameters, report options (Summary by Aging Bracket, Charts, Signatures), output format (PDF / XLSX / XLS) and a live A4-landscape preview with page navigation, zoom, download, print and full screen, same as BFARS 4–7.
- The printed report follows "BFARS 8 Aging of Unpaid Obligations": "BFARS Form 8 / Annex H" header, parameter block, detail table with the five aging columns and TOTAL, the Summary by Aging Bracket table, both charts (inline SVG so they print), and Prepared by / Reviewed by / Certified Correct. The default report fits on one page; longer lists continue on further pages.

## Files
New:
- `src/features/bfars-reporting/auo/{types.ts, document.ts, AuoParamFields.tsx, AuoCharts.tsx, AuoView.tsx, AuoGenerator.tsx}`
- `src/mocks/data/auo.ts`
- `src/app/(dashboard)/bfars-reporting/bfars-8/page.tsx` and `.../bfars-8/generate/page.tsx`

Additions to shared files:
- `lib/api/endpoints.ts`: `bfars.auo`.
- `services/bfarsApi.ts`: `useGetAuoReportQuery`.
- `mocks/handlers/reporting.ts`: the AUO handler.
- `[reportId]/page.tsx`: bfars-8 is excluded from the generic viewer.
- `docs/API.md`: the endpoint.

## Assumptions
1. **Aging rule.** Days past due = as-of date − due date. Not yet due → Current; then 1–30, 31–60, 61–90 and Over 90 days. The sample workbook says aging must be validated against actual due dates, so each record carries a due date (illustrative).
2. **Amounts.** The report mockup's 15 lines add up to ₱80.5M, not its ₱70M total, and its bracket columns don't match its own totals. The bracket totals in the mockup, the dashboard and the workbook agree (₱15M / 20M / 18M / 10M / 7M = ₱70M), so the 15 lines keep the mockup's references, payees, classes, UACS codes, descriptions and brackets, and amounts are resized to hit those totals. Rows 4–8 keep the mockup's amounts.
3. **OBL-2026-0014** (BuildRight Corp., Over 90 Days) is dated Dec 18, 2025: the mockup's Jan 18, 2026 can't be over 90 days old on March 31.
4. **Aging (Days)** on the dashboard is days past due, so Current rows show 0 (the mockup shows 5 and 10 for Current rows, and 25 days for an obligation dated 11 days earlier).
5. **Donut** is computed from the lines: PS ₱12M, MOOE ₱33.5M, CO ₱24.5M, Others ₱0. The mockup's 28/25/13/4M split can't come from its own lines (only one PS line, ₱12M). Object of Expenditure is shown as PS / MOOE / CO (the mockup mixes "Capital Outlay" and "CO").
6. **As of Date** offers the month-ends of the fiscal year. Obligations dated after it are left out; no payments are recorded in the sample, so later dates age the same lines. FY 2025/2024 reuse the sample scaled like the other BFARS reports.
7. **Department/Office** isn't a column in the mockups, so each record has an office (Administrative Services, Academic Affairs, Research Office) used only by the filter.
8. Signatory names come from the app's user records, as in BFARS 2–7. PDF output opens the print dialog (Save as PDF).
