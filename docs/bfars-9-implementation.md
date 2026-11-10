# BFARS 9 (Monthly Report of Disbursement): implementation notes

## What was built
- **`/bfars-reporting/bfars-9`**: the dashboard from "BFARS 9 Monthly Disbursement Dashboard". Fiscal Year, Month, Department/Office, Allotment Class and UACS (Major) filters with Generate Report; Total Disbursements and No. of Transactions (change vs. the previous month), PS / MOOE / CO / Others-FE cards (amount, share, bar); "Monthly Disbursements Trend" stacked bars (months after the reporting month faded) and the "Disbursements by Object of Expenditure" donut; the Disbursements Details table (search, pagination, TOTAL row) with Export to Excel, Export to PDF and Print. A "Report Generator" button opens the generator.
- **`/bfars-reporting/bfars-9/generate`**: Report Parameters, Display Options (Include Summary Page, Include Detailed Transactions, Group by UACS (Major), Show Previous Month Comparison, Include Fund Source, Include Signatories Page), Output Format (PDF / XLSX / XLS) and a live A4-landscape preview with page navigation, zoom, download, print and full screen, same as BFARS 4–8.
- The printed report follows "eBudget BFARS 9 Disbursement Report": "BFARS Form 9 / Annex I" header, parameter block, the Current Month / Year-to-Date matrix by object of expenditure (PS, MOOE, CO, FE, Others, Total) with TOTAL, both charts (inline SVG so they print), then the transaction listing of the sample workbook's page 2 on its own page, and Prepared by / Reviewed by / Certified Correct. Tables continue on further pages with their header repeated.

## Files
New:
- `src/features/bfars-reporting/mrd/{types.ts, document.ts, MrdParamFields.tsx, MrdCharts.tsx, MrdView.tsx, MrdGenerator.tsx}`
- `src/mocks/data/mrd.ts`
- `src/app/(dashboard)/bfars-reporting/bfars-9/page.tsx` and `.../bfars-9/generate/page.tsx`

Additions to shared files:
- `lib/api/endpoints.ts`: `bfars.mrd`.
- `services/bfarsApi.ts`: `useGetMrdReportQuery`.
- `mocks/handlers/reporting.ts`: the MRD handler.
- `[reportId]/page.tsx`: bfars-9 is excluded from the generic viewer.
- `docs/API.md`: the endpoint.

## Assumptions
1. **Amounts follow MPC_BFARS9_MRD_Sample_March_2026.** March is ₱150M (PS 50, MOOE 60, CO 30, FE 5, Others 5) from the workbook's 11 vouchers; January–February are PS only (₱90M), so the year to date is ₱240M. The dashboard mockup shows the ₱240M year-to-date figures as "March", and the report mockup's own donut uses ₱150M for March, so the dashboard shows the month (₱150M) and the report shows both.
2. **Transaction count.** The dashboard mockup says 1,250 transactions; the sample has 11 vouchers in March, so the count is computed from the records. The mockup's 10 detail rows don't match the workbook; the workbook's vouchers are used, with UACS codes, objects of expenditure and fund source (GAA) in the dashboard's style.
3. **Previous-month change** compares with the previous month of the same fiscal year (none for January). With the sample, March vs. February is +233.3%, not the mockup's 12.5%.
4. **Months after March** have no sample data, so they show no disbursements; the trend draws them faded as in the mockup. FY 2025/2024 reuse the sample scaled like the other BFARS reports.
5. **"Others/FE Disbursements"** card combines FE and Others, as its label says.
6. **Display options**: Group by UACS (Major) groups the transaction listing under PS/MOOE/CO/FE/Others with subtotals; Show Previous Month Comparison adds a previous vs. current month table to the summary page; Include Fund Source adds the fund source to the parameters and the listing. At least the summary page or the transactions must be selected.
7. **Department/Office** isn't a column in the mockups, so each voucher has an office used only by the filter. Signatory names come from the app's user records, as in BFARS 2–8. PDF output opens the print dialog (Save as PDF).
