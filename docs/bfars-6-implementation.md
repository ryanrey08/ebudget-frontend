# BFARS 6 (SABUDB): implementation notes

## What was built
- **`/bfars-reporting/bfars-6`**: the dashboard from "eBudget BFARS 6 Dashboard". It has the Fiscal Year, Quarter, Department/Office, Allotment Class and UACS (Major) filters with a Generate Report button. Below them are five KPI cards (Total Approved Budget, Total Utilizations, Total Disbursements, Total Obligations, Available Balance), the "Budget Utilization by Expense Class" bar chart and the "Budget Allocation by UACS (Major)" donut. The BFARS 6 Details table has a search box, pagination, a TOTAL row, and Export to Excel, Export to PDF and Print.
- **`/bfars-reporting/bfars-6/generate`**: the generator from "eBudget BFARS 6 Report Dashboard".
  - Left side: Report Parameters, View By (Summary / Detailed (by UACS)), Report Options and Output Format (PDF / XLSX / XLS).
  - Right side: a live A4-landscape preview with page navigation, zoom, download, print and full screen.
  - The report has the "BFARS Form 6 (SABUDB) Annex F" header and the Approved Budget split into GAA/Original, Supplemental and Total. Lines are grouped by class with subtotals, followed by the GRAND TOTAL and the Prepared by / Reviewed by / Certified Correct signatures.

## Files
New:
- `src/features/bfars-reporting/sabudb/{types.ts, document.ts, SabudbView.tsx, SabudbGenerator.tsx}`
- `src/mocks/data/sabudb.ts`
- `src/app/(dashboard)/bfars-reporting/bfars-6/page.tsx` and `.../bfars-6/generate/page.tsx`

Additions to shared files:
- `lib/api/endpoints.ts`: added `bfars.sabudb`.
- `services/bfarsApi.ts`: added `useGetSabudbReportQuery`.
- `mocks/handlers/reporting.ts`: added the SABUDB handler.
- `[reportId]/page.tsx`: bfars-6 is excluded from the generic viewer.

## Assumptions
1. **Formulas** come from the BFARS 6 sample workbook: utilizations = obligations, balance = approved budget − utilizations, % utilization = utilizations ÷ approved budget.
2. **Totals follow the workbook.** The dashboard mockup's PS disbursements (₱120M) don't add up to its own ₱240M total, so PS is ₱129M as in the workbook. The report mockup's line amounts and subtotal rows also don't agree, so the 12 UACS lines keep the mockup's codes and names and are sized to the class totals. Q1 totals: ₱500M / 435M / 310M / 240M / 190M (62.00%).
3. **"Group by Allotment Class"** (on by default) groups lines under 501–505 with subtotals, as the preview shows. When it's off, the lines are listed without groups.
4. **"Group by Object of Expenditure"** adds a summary table by UACS major. Both grouping options apply only to the Detailed view.
5. **"Include Previous Year Comparison"** compares approved budget, utilizations and % utilization with the same quarter of FY−1, using the same filters.
6. **"Include Notes/Remarks"** prints the formula notes and a sample-data notice.
7. **Supplemental** is ₱0 in the sample and shows as "-".
8. The sample sheet's "Unpaid Obligations" column isn't in the mockups, so it was left out.
9. **PDF output** works the same way as BFARS 1–5: the print dialog opens and you choose "Save as PDF".
10. The **Available Balance** card's progress bar is blue rather than the mockup's slate, because the shared ProgressBar has no slate color.

## Verification
- `tsc` and `eslint` are clean. `next build` passed in a copy of the project, so the running dev server wasn't touched.
- Checked in the browser on the dev server:
  - KPIs and table match the mockup values.
  - The preview is 3 pages by default (cover, statement with signatures, notes), and nothing is clipped.
  - Summary view, the extra options, and the filters (e.g. Research Office + 502 gives ₱21M) all work.
  - Clearing Fiscal Year blocks generation and shows an error.
  - No horizontal scroll at phone width.
- Not tested: actually downloading an XLSX file and the print dialog. Both use the same helpers as BFARS 1–5.
