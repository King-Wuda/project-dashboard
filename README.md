# Project Dashboard

A web dashboard for the HRS project portfolio, built from the monthly "Project Dashboard MASTER" Excel workbook.
It replaces the workbook as the place to see, and update, project progress end to end.

- **Overview** – open projects, contract value, weighted RBP and progress, work done but not yet invoiced, health, lifecycle stage, value by PM, and "needs attention" lists.
- **Projects** – every column from the workbook's first sheet, with filters, sorting and CSV export. Click a row to edit it. Closed and eliminated projects are archived (hidden by default, one click to show).
- **Issues** – the issue log (add, edit, delete) with an optional due date. An open issue with a due date shows as Overdue automatically once that date has passed; issues are sorted most-late first. Issues without a due date (such as those imported from the workbook) keep the status set by hand.
- **Resources** – the resource planner by PM, with planned handover by quarter (read-only for now).

Every change is stored with a timestamp and the editor's name, and shown in each project's History. The dashboard is single-user for now, so changes are recorded as Gerhardus Uys (`EDITOR` in `web/src/api.ts`); this becomes the signed-in user when logins are added.

## Run it

```bash
npm install
npm run build
npm start            # http://127.0.0.1:8787
```

For development: `npm run dev` (API on :8787, Vite on :5173). Tests: `npm test`.

With no real data present the app starts on a **synthetic demo dataset** (`demo/seed.demo.json`).

## Share as a single HTML file (pilot / feedback)

To let people try the dashboard before it is hosted, build one self-contained `.html` file. It needs no server and no install:
the recipient double-clicks it and it opens in their browser.

```bash
npm run build:html                           # demo data    -> dist-html/dashboard-demo.html
npm run build:html -- --data data/seed.json  # real data    -> dist-html/dashboard-private.html
```

- The data is embedded in the file. Each person's edits are saved **in their own browser only**, so two people never see each other's changes.
- **Data ▾** in the top bar has *Export backup*, *Restore from backup* and *Reset to original data*. Export a backup to keep your edits or to send them back.
- A page banner says it is a pilot. The same validation and change history as the hosted version run inside the file.
- Rebuilding with the same data keeps edits already saved in a browser; rebuilding with different data starts that browser fresh.
- `dashboard-private.html` contains real project data (customer names, contract values, margins). It is git-ignored; share it only with people allowed to see that data, and note some email systems block `.html` attachments (zip it or use Teams/SharePoint).
- If a browser blocks local storage (some private-browsing modes), the banner says so and edits last only until the page is closed.

## Load the real workbook

The workbook contains customer names, contract values and margins, so **it and the data derived from it are git-ignored and must stay out of the repository.**

```bash
pip install openpyxl
npm run import -- /path/to/Project_Dashboard_MASTER.xlsx   # writes data/seed.json
rm -f data/store.json                                      # only if re-seeding from scratch
npm start
```

On first start the server copies `data/seed.json` into `data/store.json`. From then on `data/store.json` is the
live record and all edits go there, so **back it up** (it is one file). Re-importing does not overwrite it unless you delete it.

Environment: `PORT` (8787), `HOST` (127.0.0.1), `DATA_DIR` (`./data`).

## How health is calculated

One calculated health per open project (see `web/src/lib/health.ts`, thresholds at the top of the file). A PM can override it with a required reason; the override and the calculated value are both shown.

| Signal | Amber | Red |
|---|---|---|
| RBP (margin) | below 12% | below 10% |
| Invoicing behind progress (POC minus invoiced) | 15+ pts | 30+ pts |
| A lifecycle gate marked off track / deviation | off track | deviation |
| Comment contains risk words (delay, pending, waiting, funds, issue, …) | yes | – |

Archived projects have no health.

## Assumptions to confirm

- In the workbook the lifecycle gates (PGR1–7) exist only as cell colours. Imported as: green = done, light green = in progress, grey = not applicable, blank = not started, amber = off track, red = deviation.
- "RBP %" is treated as planned margin.
- Open = SAP status Created or Posted. Archived = Administrative closed or Eliminated.

## Not included yet

- **No login.** Anyone who can reach the server can edit. Run it on an internal network, or put it behind SSO/a reverse proxy, before sharing it.
- Resource planner and attendance/agenda editing; the Attendance and Agenda sheets were not migrated.
- Automatic refresh from SAP (`OH26`/`PSales26` exports). Data is entered here, or re-imported from a workbook.
