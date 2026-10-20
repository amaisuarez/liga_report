"""Download the upcoming-fixtures list published by football-data.co.uk and keep the
competitions this project tracks.

    python3 -m pipeline.fixtures [--url URL] [--out fixtures.csv]
    python3 -m pipeline.build

Only matches that are not already in the local results CSVs are written. If none remain
(the published list often still shows the round that was just played), no fixture file is
left behind, so the app never shows stale "upcoming" matches. Either way the check is
recorded in output/fixtures_status.json and shown in the app.
"""
import argparse
import json
import os
import urllib.request
from datetime import datetime

import pandas as pd

from . import build, sources, teams

DEFAULT_URL = "https://www.football-data.co.uk/fixtures.csv"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--out", default=os.path.join(build.ROOT, "fixtures.csv"))
    args = ap.parse_args()

    req = urllib.request.Request(args.url, headers={"User-Agent": "futdata-fixtures/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        text, _ = sources.decode(resp.read())
    df = pd.read_csv(sources.as_buffer(text), dtype=str)
    if not {"Div", "Date", "HomeTeam", "AwayTeam"} <= set(df.columns):
        raise SystemExit("Unexpected format: Div, Date, HomeTeam and AwayTeam columns are required.")
    if {"FTHG", "HG"} & set(df.columns):
        raise SystemExit("This file contains results, not fixtures.")

    # only competitions that have local results: a model cannot predict the others
    registry = teams.TeamRegistry(os.path.join(build.ROOT, "config", "teams.json"))
    csvs, _, _ = sources.discover(build.ROOT)
    played, comps = set(), set()
    for f in csvs:
        if not build.is_results_file(f):
            continue
        r = pd.read_csv(sources.as_buffer(sources.decode(f.data)[0]), dtype=str)
        d = pd.to_datetime(r.Date, dayfirst=True, errors="coerce").dt.strftime("%Y-%m-%d")
        comps |= set(r.Div.dropna())
        played |= set(zip(r.Div, d, r.HomeTeam.map(registry.resolve), r.AwayTeam.map(registry.resolve)))

    df = df[df.Div.isin(comps)].copy()
    df["_d"] = pd.to_datetime(df.Date, dayfirst=True, errors="coerce").dt.strftime("%Y-%m-%d")
    key = list(zip(df.Div, df._d, df.HomeTeam.map(registry.resolve), df.AwayTeam.map(registry.resolve)))
    new = df[[k not in played for k in key]].drop(columns="_d")

    keep = ["Div", "Date", "Time", "HomeTeam", "AwayTeam"]
    if len(new):
        new[[c for c in keep if c in new.columns]].to_csv(args.out, index=False)
    elif os.path.exists(args.out):
        os.remove(args.out)          # only stale rows: drop the previous list
    status = {"checked_at": datetime.now().isoformat(timespec="seconds"), "url": args.url,
              "rows_in_source": int(len(df)), "upcoming_written": int(len(new)),
              "already_played": int(len(df) - len(new)), "file": os.path.basename(args.out) if len(new) else None}
    os.makedirs(build.OUT, exist_ok=True)
    with open(os.path.join(build.OUT, "fixtures_status.json"), "w", encoding="utf-8") as fh:
        json.dump(status, fh, indent=1)
    print(json.dumps(status, indent=1))
    if registry.pending:
        print("Unknown team names (add them to config/teams.json):", [p["raw_name"] for p in registry.pending])


if __name__ == "__main__":
    main()
