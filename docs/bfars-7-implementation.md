# BFARS 7 (SABUDBOE): implementation notes

## What was built
- **`/bfars-reporting/bfars-7`**: the dashboard from "eBudget BFARS 7 Dashboard". Fiscal Year, Quarter, Department/Office, Allotment Class and UACS (Major) filters with Generate Report; five KPI cards (Approved Budget, Utilizations (Obligations), Disbursements, Allotments, Available Balance) with % of approved budget; "Budget Utilization by Object of Expenditure" bars and "Allocation by Object of Expenditure" donut; the BFARS 7 Details table (UACS 5-01…5-05, % utilization bars, TOTAL row, search, pagination) with Export to Excel, Export to PDF and Print. A "Report Generator" button opens the generator.
- **`/bfars-reporting/bfars-7/generate`**: the generator from "eBudget BFARS 7 Report Dashboard".
  - Left: Report Parameters (Fiscal Year, Quarter, Department/Office, Allotment Class), the UACS (Major) view choice (Summary (Object of Expenditure) / Detailed (MFO/PAP and Sub-Object)), Report Options (cover page, signature page, previous year comparison, allotment class breakdown, group by department/office, show % utilization) and Output Format (PDF / XLSX / XLS).
  - Right: a live A4-landscape preview with page navigation, zoom, download, print and full screen.
  - The report has the "BFARS Form 7 (SABUDBOE) Annex G" header, the Approved Budget split into GAA/Original, Supplemental and Total, class headers I–V with subtotal rows, GRAND TOTAL, the workbook's footnote and the Prepared by / Reviewed by / Certified Correct signatures. Long statements (Detailed view, grouping by office) continue over several pages with the table head repeated, and the signatures stay with the last rows.

## Files
New:
- `src/features/bfars-reporting/sabudboe/{types.ts, document.ts, SabudboeView.tsx, SabudboeGenerator.tsx}`
- `src/mocks/data/sabudboe.ts`
- `src/app/(dashboard)/bfars-reporting/bfars-7/page.tsx` and `.../bfars-7/generate/page.tsx`

Additions to shared files:
- `lib/api/endpoints.ts`: `bfars.sabudboe`.
- `services/bfarsApi.ts`: `useGetSabudboeReportQuery`.
- `mocks/handlers/reporting.ts`: the SABUDBOE handler.
- `[reportId]/page.tsx`: bfars-7 is excluded from the generic viewer.
- `docs/API.md`: the endpoint.

## Assumptions
1. **Formulas** from the BFARS 7 sample workbook: available balance = approved budget − utilizations, utilization % = utilizations ÷ approved budget; utilizations are obligations (the mockups label the column "Obligations / Utilizations").
2. **Figures follow the workbook.** The dashboard mockup's class rows don't add up to its own totals (e.g. utilizations 160+100+50+8+12 = ₱330M against a ₱310M total), and the report mockup's line amounts and duplicated disbursement column don't agree either. Class totals are the workbook's (PS 200/180/160/120M, MOOE 150/130/90/70M, CO 100/90/45/35M, FE 25/20/5/5M, Others 25/15/10/10M), giving the same grand totals as both mockups: ₱500M / 435M / 310M / 240M / 190M (62.00%). The 12 UACS lines keep the report mockup's codes and names and are sized to those totals.
3. The report mockup has two "% Utilization" columns and a repeated disbursement column; the report has one of each.
4. **Summary (Object of Expenditure)** is the layout in the mockup preview. **Detailed (MFO/PAP and Sub-Object)** splits each object line by MFO/PAP. Offices map to the BFARS 1 (QPRO) PAPs: Administrative Services and Finance Office → PAP-001 GASS, Academic Affairs → PAP-002 Instructional Services, Research Office → PAP-003 R&D, Extension Office → PAP-004 Extension Services.
5. Office and allotment class splits reuse BFARS 3's (`SAAODBOE_SPLITS`).
6. **Group by Department/Office** groups the statement by office, with an office total for each. **Include Allotment Class Breakdown** adds a RAOPS/RAOMO/RAOCO/RAOFE table. **Include Previous Year Comparison** compares approved budget, utilizations, disbursements and % utilization with the same quarter of FY−1 (on by default, as in the mockup). **Show % Utilization** toggles that column everywhere.
7. The generator has no UACS (Major) dropdown, as in the mockup, so its report covers all majors ("UACS (Major): All").
8. Supplemental is ₱0 in the sample and shows as "-". PDF output opens the print dialog (Save as PDF), like BFARS 1–6.
9. Signatory names come from the app's user records, as in BFARS 2–6, so they differ from the mockup's sample names.

## Verification
- `tsc`, `eslint .` and `next build` pass (build run in a copy so the running dev server wasn't touched).
- Checked in the browser: KPI cards and table match the workbook totals; default preview is 3 pages (cover, statement with signatures, previous-year comparison); Detailed + group by office + class breakdown gives 7 pages with nothing clipped; Research Office + 502 gives ₱22.5M approved / 19.5M allotments / 13.5M utilizations / 10.5M disbursements; clearing Fiscal Year blocks generation with an error; no horizontal scroll at phone width.
- Not tested: actually saving the XLSX/XLS files and the print dialog; both use the same helpers as BFARS 1–6.
