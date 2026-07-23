#!/usr/bin/env python3
"""
Fetches challenge data from Google Sheets (gviz API, no auth required)
and writes weekly JSON files under data/weeks/{club}/{team}/.

Sheet structure per team tab:
  - "Viikko X" rows (text in col A) are week headers — ignored for challenge data
  - Writing "Toista: 23" in Haaste 1 of a week header generates a repeat JSON
  - All other rows with a date in col A and any challenge text are normal challenge rows

Usage: python3 scripts/sync_sheets.py
"""

import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
DAY_FI = {
    'monday': 'Maanantai', 'tuesday': 'Tiistai', 'wednesday': 'Keskiviikko',
    'thursday': 'Torstai', 'friday': 'Perjantai', 'saturday': 'Lauantai', 'sunday': 'Sunnuntai',
}

GVIZ_DATE_RE  = re.compile(r'Date\((\d+),(\d+),(\d+)\)')
DAY_MONTH_RE  = re.compile(r'(\d{1,2})\.(\d{1,2})\.(\d{4})?')
VIIKKO_RE     = re.compile(r'Viikko\s+(\d+)', re.IGNORECASE)
TOISTA_RE     = re.compile(r'Toista\s*:\s*(\d+)', re.IGNORECASE)
YOUTUBE_RE    = re.compile(r'(https?://(?:www\.)?(?:youtube\.com|youtu\.be)\S+)')


# ── Task parsing ─────────────────────────────────────────────────────

def parse_task(raw: str) -> 'str | dict':
    """If cell contains a YouTube URL, return {text, video} object."""
    m = YOUTUBE_RE.search(raw)
    if not m:
        return raw
    url  = m.group(1).rstrip('.,;)')
    text = raw[:m.start()].strip(' |–-')
    return {'text': text, 'video': url} if text else {'text': '▶ Katso video', 'video': url}


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
    end   = text.rindex('}')
    data  = json.loads(text[start:end + 1])

    if data.get('status') != 'ok':
        raise ValueError(f'gviz status: {data.get("status")}')

    return data['table'].get('rows') or []


# ── Parse gviz rows ───────────────────────────────────────────────────

def parse_rows(rows: list) -> tuple[dict, dict]:
    """
    Returns:
      by_date      — {iso_date: {date, tasks}}  for rows with challenge data
      week_repeats — {week_key: repeat_week_key} for "Toista: X" week headers

    Sheet structure (6 columns):
      A: Päivämäärä "20.7."  |  B: Viikonpäivä "ma"  |  C-F: Haaste 1-4
    Week header rows:
      A: "Viikko 30"  |  B: ""  |  C: "Toista: 23" (optional)
    """
    by_date      = {}
    week_repeats = {}
    today        = date.today()

    for row in rows:
        cells = row.get('c') or []
        if not cells or not cells[0]:
            continue

        v = (cells[0] or {}).get('v')
        if v is None:
            continue

        v_str = str(v).strip()

        # ── Week header row: "Viikko 30" ─────────────────────────────
        hm = VIIKKO_RE.match(v_str)
        if hm:
            week_num = int(hm.group(1))
            # Repeat number lives in col F (index 5); fall back to older positions
            toista_val = None
            for idx in (5, 2, 1):
                if len(cells) > idx and cells[idx]:
                    toista_val = (cells[idx] or {}).get('v')
                    if toista_val:
                        break
            if toista_val is not None:
                toista_str = str(toista_val).strip()
                tm = TOISTA_RE.search(toista_str)
                if tm:
                    week_repeats[week_num] = int(tm.group(1))
                elif isinstance(toista_val, (int, float)):
                    week_repeats[week_num] = int(toista_val)
                elif toista_str.isdigit():
                    week_repeats[week_num] = int(toista_str)
            continue

        # ── Regular date row – new text format "20.7." in col A ──────
        dm = DAY_MONTH_RE.search(v_str)
        if dm:
            day_num   = int(dm.group(1))
            month_num = int(dm.group(2))
            year      = int(dm.group(3)) if dm.group(3) else today.year
            try:
                d = date(year, month_num, day_num)
            except ValueError:
                continue

            # Col B is weekday abbreviation (ignored); tasks are in cols C-F (index 2+)
            tasks = []
            for cell in cells[2:]:
                val = (cell or {}).get('v')
                if val and isinstance(val, str) and val.strip():
                    tasks.append(parse_task(val.strip()))
            if tasks:
                by_date[d.isoformat()] = {'date': d, 'tasks': tasks}
            continue

        # ── Fallback: old gviz Date(year,month,day) format ───────────
        dm2 = GVIZ_DATE_RE.match(v_str)
        if dm2:
            year, month0, day = int(dm2[1]), int(dm2[2]), int(dm2[3])
            d = date(year, month0 + 1, day)
            tasks = []
            for cell in cells[1:]:
                val = (cell or {}).get('v')
                if val and isinstance(val, str) and val.strip():
                    tasks.append(parse_task(val.strip()))
            if tasks:
                by_date[d.isoformat()] = {'date': d, 'tasks': tasks}

    # Resolve week_repeats int pairs → ISO week keys
    resolved_repeats = {}
    ref_year = today.year
    for wk_num, rep_num in week_repeats.items():
        resolved_repeats[f'{ref_year}-W{wk_num:02d}'] = f'{ref_year}-W{rep_num:02d}'

    return by_date, resolved_repeats


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

def write_week_files(club_id: str, team_id: str, weeks: dict, week_repeats: dict) -> int:
    import shutil
    out_dir = ROOT / 'data' / 'weeks' / club_id / team_id

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    written = 0

    for wk, data in weeks.items():
        (out_dir / f'{wk}.json').write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
        )
        written += 1

    for wk_key, rep_key in week_repeats.items():
        if wk_key in weeks:
            continue  # week has its own data — skip repeat
        (out_dir / f'{wk_key}.json').write_text(
            json.dumps({'repeat': rep_key}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
        )
        written += 1

    return written


# ── Main ─────────────────────────────────────────────────────────────

def main():
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
                rows                    = fetch_sheet_rows(sheet_id, sheet_name)
                by_date, week_repeats   = parse_rows(rows)
                weeks                   = group_by_week(by_date)
                written                 = write_week_files(club['id'], team['id'], weeks, week_repeats)
                repeats                 = len(week_repeats)
                print(f'{len(weeks)} weeks, {repeats} repeats, {written} files')
                total_written += written
            except Exception as e:
                print(f'ERROR: {e}', file=sys.stderr)

    print(f'\nDone. {total_written} file(s) written.')


if __name__ == '__main__':
    main()
