#!/usr/bin/env python3
"""Convert the HRS Project Dashboard Excel workbook into data/seed.json.

Usage: python3 scripts/import_workbook.py <workbook.xlsx> [--out data/seed.json] [--gate-report]

Run it locally; the output contains customer and contract data and is git-ignored.
Gate (PGR1-7) progress lives only in cell fill colours in the workbook, so the
fills are read straight from the styles part of the file.
"""
import argparse, collections, datetime as dt, json, os, re, sys, zipfile
import xml.etree.ElementTree as ET

import openpyxl

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
FIRST_ROW = 9
GATE_COLS = ["W", "X", "Y", "Z", "AA", "AB", "AC"]
GATE_NAMES = [
    "Opportunity qualified",
    "Binding quotation",
    "Project initiation",
    "Kick-off / orders / manufacturing",
    "Project planning / installation",
    "Commissioning",
    "Snags / handover",
]
# Fill colour -> gate state. Workbook legend: green on track/WIP, amber off track/risk,
# red deviation, grey not applicable. Light green (92D050) is not in the legend; in the data it
# marks the gate currently under way, so it is read as "wip" and plain green as "done".
FILL_STATE = {
    "FF00B050": "done",
    "FF92D050": "wip",
    "FFFFC000": "risk",
    "FFFF0000": "deviation",
    "FFA6A6A6": "na",
    "FFBFBFBF": "na",
}


def clean(v):
    if v is None:
        return ""
    return re.sub(r"\s+", " ", str(v)).strip()


def person(v):
    s = clean(v)
    if not s:
        return ""
    if "," in s:
        last, first = [p.strip() for p in s.split(",", 1)]
        s = f"{first} {last}"
    return " ".join(w[:1].upper() + w[1:].lower() for w in s.split())


def num(v):
    return float(v) if isinstance(v, (int, float)) else None


def start_date(v):
    if isinstance(v, (dt.datetime, dt.date)):
        return v.date().isoformat() if isinstance(v, dt.datetime) else v.isoformat()
    s = clean(v)
    m = re.match(r"^([A-Za-z]{3})\w*\s*'?(\d{2,4})$", s)
    if m:
        try:
            d = dt.datetime.strptime(m.group(1)[:3].title(), "%b")
            y = int(m.group(2)); y = y + 2000 if y < 100 else y
            return f"{y}-{d.month:02d}-01"
        except ValueError:
            pass
    return None


def gate_fills(path):
    """{row: {col: argb}} for the gate columns, from sheet1 + styles."""
    z = zipfile.ZipFile(path)
    styles = ET.fromstring(z.read("xl/styles.xml"))
    fills = styles.find("m:fills", NS)
    xfs = styles.find("m:cellXfs", NS)

    def argb(style_id):
        f = fills[int(xfs[style_id].get("fillId"))]
        p = f.find("m:patternFill", NS)
        fg = p.find("m:fgColor", NS) if p is not None else None
        return fg.get("rgb") if fg is not None and fg.get("rgb") else None

    wb_rels = z.read("xl/_rels/workbook.xml.rels").decode()
    wb_xml = z.read("xl/workbook.xml").decode()
    rid = re.search(r'<sheet name="HRS Project Overview"[^>]*r:id="(\w+)"', wb_xml).group(1)
    target = re.search(rf'Id="{rid}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="{rid}"', wb_rels)
    target = next(t for t in target.groups() if t)
    xml = z.read("xl/" + target.lstrip("/").replace("xl/", "")).decode()
    out = collections.defaultdict(dict)
    gate = set(GATE_COLS)
    for rm in re.finditer(r'<row r="(\d+)"[^>]*>(.*?)</row>', xml, re.S):
        r = int(rm.group(1))
        if r < FIRST_ROW:
            continue
        for cm in re.finditer(r'<c r="([A-Z]+)\d+"(?: s="(\d+)")?', rm.group(2)):
            if cm.group(1) in gate and cm.group(2):
                out[r][cm.group(1)] = argb(int(cm.group(2)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("workbook")
    ap.add_argument("--out", default="data/seed.json")
    ap.add_argument("--gate-report", action="store_true")
    a = ap.parse_args()

    fills = gate_fills(a.workbook)
    wb = openpyxl.load_workbook(a.workbook, data_only=True, read_only=True)

    ws = wb["HRS Project Overview"]
    projects, errors = [], []
    for r, row in enumerate(ws.iter_rows(min_row=FIRST_ROW, max_col=35, values_only=True), FIRST_ROW):
        cell = lambda col: row[openpyxl.utils.column_index_from_string(col) - 1]
        pid = clean(cell("A"))
        if not pid:
            continue
        gates = [FILL_STATE.get(fills.get(r, {}).get(c), "") for c in GATE_COLS]
        comment = clean(cell("AE")) or clean(cell("AI"))
        inv = cell("U")
        if isinstance(inv, str):
            errors.append(f"row {r} {pid}: invoiced % is {inv!r}")
        projects.append({
            "id": pid,
            "customer": clean(cell("B")),
            "location": clean(cell("C")),
            "description": clean(cell("D")),
            "level": clean(cell("E")),
            "pm": person(cell("F")),
            "startDate": start_date(cell("G")),
            "status": clean(cell("H")),
            "value": num(cell("R")) or 0,
            "rbp": num(cell("S")),
            "poc": num(cell("T")),
            "invoiced": num(inv),
            "gates": gates,
            "handoverSigned": bool(cell("AD")),
            "comment": comment,
            "sourceRow": r,
        })

    rp = wb["Resource planner"]
    resources = []
    for row in rp.iter_rows(min_row=2, max_col=18, values_only=True):
        if not any(row):
            continue
        g = lambda i: "" if clean(row[i]).upper() == "N/A" else clean(row[i])
        resources.append({
            "projectId": clean(row[0]),
            "customer": clean(row[1]),
            "location": clean(row[2]),
            "description": clean(row[3]),
            "level": clean(row[4]),
            "pm": person(row[5]),
            "status": clean(row[6]),
            "phase": clean(row[8]),
            "pipingContractor": g(9),
            "electrician": g(10),
            "panelBuilder": g(11),
            "internal": [n for n, v in zip(["Andrew", "Stevie", "Miguel"], row[12:15]) if clean(v).upper() == "Y"],
            "claddingContractor": g(15),
            "comment": clean(row[16]),
            "handover": clean(row[17]),
        })

    il = wb["HRT Solutions ssue Log"]
    issues = []
    for row in il.iter_rows(min_row=7, max_col=10, values_only=True):
        if not clean(row[1]):
            continue
        issues.append({
            "id": f"I-{clean(row[0]) or len(issues) + 1}",
            "projectId": clean(row[1]), "customer": clean(row[2]), "location": clean(row[3]),
            "description": clean(row[4]), "pm": person(row[5]), "issue": clean(row[6]),
            "nextSteps": clean(row[7]), "responsible": clean(row[8]), "status": clean(row[9]) or "WIP",
        })

    last = None
    for row in ws.iter_rows(min_row=3, max_row=3, min_col=2, max_col=2, values_only=True):
        last = row[0]
    if isinstance(last, str):
        m = re.match(r"(\d+)/(\d+)/(\d+)", last)
        last = f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else None
    elif isinstance(last, (dt.datetime, dt.date)):
        last = last.date().isoformat() if isinstance(last, dt.datetime) else last.isoformat()

    out = {
        "meta": {"title": "NPE HRS Project Dashboard", "dataAsOf": last, "importedFrom": a.workbook.split("/")[-1],
                 "gateNames": GATE_NAMES},
        "projects": projects, "resources": resources, "issues": issues,
    }
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    json.dump(out, open(a.out, "w"), indent=1)
    print(f"projects={len(projects)} resources={len(resources)} issues={len(issues)} -> {a.out}")
    for e in errors:
        print("warning:", e, file=sys.stderr)
    if a.gate_report:
        by = collections.defaultdict(collections.Counter)
        for p in projects:
            for i, s in enumerate(p["gates"]):
                by[(p["status"], i + 1)][s or "-"] += 1
        for k in sorted(by):
            print(k, dict(by[k]))


if __name__ == "__main__":
    main()
