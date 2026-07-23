#!/usr/bin/env python3
"""
Fetches challenge data from Google Sheets (gviz API, no auth required)
and writes weekly JSON files under data/weeks/{club}/{team}/.

Usage: python3 scripts/sync_sheets.py
"""

import json
import os
import re
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
DAY_FI = {
    'monday': 'Maanantai', 'tuesday': 'Tiistai', 'wednesday': 'Keskiviikko',
    'thursday': 'Torstai', 'friday': 'Perjantai', 'saturday': 'Lauantai', 'sunday': 'Sunnuntai',
}


# ── ISO week helpers ──────────────────────────────────────────────────

def iso_week_key(d: date) -> str:
    year, week, _ = d.isocalendar()
    return f'{year}-W{week:02d}'

def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


# ── Fetch from gviz API ───────────────────────────────────────────────

def fetch_sheet_rows(sheet_id: str, sheet_name: str) -> list:
    url = (
        f'https://docs.google.com/spreadsheets/d/{sheet_id}'
        f'/gviz/tq?tqx=out:json&sheet={urllib.parse.quote(sheet_name)}'
    )
    with urllib.request.urlopen(url, timeout=30) as resp:
        text = resp.read().decode('utf-8')

    start = text.index('{')
    end = text.rindex('}')
    data = json.loads(text[start:end + 1])

    if data.get('status') != 'ok':
        raise ValueError(f'gviz status: {data.get("status")}')

    return data['table'].get('rows') or []


# ── Parse gviz rows ───────────────────────────────────────────────────

def parse_rows(rows: list) -> dict[str, dict]:
    """Returns {date_iso_str: {date, tasks}} for rows that have tasks."""
    by_date = {}
    gviz_date_re = re.compile(r'Date\((\d+),(\d+),(\d+)\)')

    for row in rows:
        cells = row.get('c') or []
        if not cells or not cells[0] or not cells[0].get('v'):
            continue

        m = gviz_date_re.match(str(cells[0]['v']))
        if not m:
            continue

        year, month0, day = int(m[1]), int(m[2]), int(m[3])
        d = date(year, month0 + 1, day)   # month is 0-indexed in gviz

        tasks = []
        for cell in cells[1:]:
            val = (cell or {}).get('v')
            if val and isinstance(val, str) and val.strip():
                tasks.append(val.strip())

        if tasks:
            by_date[d.isoformat()] = {'date': d, 'tasks': tasks}

    return by_date


# ── Group into ISO weeks ──────────────────────────────────────────────

def group_by_week(by_date: dict) -> dict[str, dict]:
    weeks = {}

    for entry in by_date.values():
        d, tasks = entry['date'], entry['tasks']
        wk = iso_week_key(d)
        if wk not in weeks:
            weeks[wk] = {'days': {}}

        # isoweekday: 1=Mon … 7=Sun; %7 maps Sun→0 matching DAYS index
        day_key = DAYS[d.isoweekday() % 7]
        weeks[wk]['days'][day_key] = {'title': DAY_FI[day_key], 'tasks': tasks}

    return weeks


# ── Write JSON files ──────────────────────────────────────────────────

def write_week_files(club_id: str, team_id: str, weeks: dict) -> int:
    import shutil
    out_dir = ROOT / 'data' / 'weeks' / club_id / team_id

    # Wipe and recreate so removed sheet rows don't leave stale files
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    for wk, data in weeks.items():
        path = out_dir / f'{wk}.json'
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    return len(weeks)


# ── Main ─────────────────────────────────────────────────────────────

def main():
    import urllib.parse  # noqa: F401 — needed by fetch_sheet_rows

    clubs = json.loads((ROOT / 'data' / 'clubs.json').read_text())
    total_written = 0

    for club in clubs:
        sheet_id = club.get('sheetId')
        if not sheet_id:
            continue

        teams = json.loads((ROOT / 'data' / club['id'] / 'teams.json').read_text())

        for team in teams:
            sheet_name = team.get('sheetName') or team['id']
            label = f"{club['id']}/{team['id']} (sheet: \"{sheet_name}\")"
            print(f'  {label} … ', end='', flush=True)

            try:
                rows = fetch_sheet_rows(sheet_id, sheet_name)
                by_date = parse_rows(rows)
                weeks = group_by_week(by_date)
                written = write_week_files(club['id'], team['id'], weeks)
                print(f'{len(weeks)} weeks, {written} updated')
                total_written += written
            except Exception as e:
                print(f'ERROR: {e}', file=sys.stderr)

    print(f'\nDone. {total_written} file(s) written.')


if __name__ == '__main__':
    main()
