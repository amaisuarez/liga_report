"""Load every CSV, build the per-file inventory and the unified match table.

The original columns are preserved in a wide 'raw' table; modelling uses a normalized
core schema whose mapping back to the original column names is recorded.
"""
import csv
import os

import numpy as np
import pandas as pd

from . import notes as notes_mod
from .sources import as_buffer, decode

# original code -> normalized name.  Several originals can map to one normalized name
# when notes.txt says they are the same variable ("FTHG and HG = ...").
CORE_MAP = {
    "Div": "competition", "Date": "date", "Time": "kickoff",
    "HomeTeam": "home_team_raw", "AwayTeam": "away_team_raw",
    "Home": "home_team_raw", "Away": "away_team_raw",
    "FTHG": "home_goals", "HG": "home_goals", "FTAG": "away_goals", "AG": "away_goals",
    "FTR": "result", "Res": "result",
    "HTHG": "ht_home_goals", "HTAG": "ht_away_goals", "HTR": "ht_result",
    "Attendance": "attendance", "Referee": "referee",
    "HS": "home_shots", "AS": "away_shots", "HST": "home_sot", "AST": "away_sot",
    "HHW": "home_woodwork", "AHW": "away_woodwork",
    "HC": "home_corners", "AC": "away_corners",
    "HF": "home_fouls", "AF": "away_fouls",
    "HFKC": "home_fk_conceded", "AFKC": "away_fk_conceded",
    "HO": "home_offsides", "AO": "away_offsides",
    "HY": "home_yellows", "AY": "away_yellows", "HR": "home_reds", "AR": "away_reds",
    "HBP": "home_booking_pts", "ABP": "away_booking_pts",
    # undocumented in notes.txt; name suggests expected goals. Kept, flagged, not modelled.
    "HxG": "home_xg_undocumented", "AxG": "away_xg_undocumented",
    # market benchmark (pre-closing market average, documented)
    "AvgH": "mkt_avg_odds_home", "AvgD": "mkt_avg_odds_draw", "AvgA": "mkt_avg_odds_away",
    "Avg>2.5": "mkt_avg_odds_over25", "Avg<2.5": "mkt_avg_odds_under25",
}

# Statistics that can become prediction targets: normalized stem -> (home col, away col)
STAT_PAIRS = {
    "goals": ("home_goals", "away_goals"),
    "shots": ("home_shots", "away_shots"),
    "sot": ("home_sot", "away_sot"),
    "corners": ("home_corners", "away_corners"),
    "fouls": ("home_fouls", "away_fouls"),
    "yellows": ("home_yellows", "away_yellows"),
    "reds": ("home_reds", "away_reds"),
    "ht_goals": ("ht_home_goals", "ht_away_goals"),
    "woodwork": ("home_woodwork", "away_woodwork"),
    "offsides": ("home_offsides", "away_offsides"),
    "fk_conceded": ("home_fk_conceded", "away_fk_conceded"),
    "booking_pts": ("home_booking_pts", "away_booking_pts"),
    "xg_undocumented": ("home_xg_undocumented", "away_xg_undocumented"),
}
STAT_LABELS = {
    "goals": "Goals", "shots": "Shots", "sot": "Shots on target", "corners": "Corners",
    "fouls": "Fouls committed", "yellows": "Yellow cards", "reds": "Red cards",
    "ht_goals": "Half-time goals", "woodwork": "Hit woodwork", "offsides": "Offsides",
    "fk_conceded": "Free kicks conceded", "booking_pts": "Booking points",
    "xg_undocumented": "xG (undocumented column)",
}
# Variables a user might expect but which notes.txt does not define at all.
EXPECTED_BUT_UNDEFINED = {"possession": "Ball possession is not defined in notes.txt and no column contains it."}


def season_label(start_year):
    return f"{start_year}/{str(start_year + 1)[-2:]}"


def _parse_dates(s):
    out = pd.to_datetime(s, format="%d/%m/%Y", errors="coerce")
    short = out.isna() & s.notna()
    if short.any():
        out[short] = pd.to_datetime(s[short], format="%d/%m/%y", errors="coerce")
    return out, ("dd/mm/yyyy" if not short.any() else "dd/mm/yy (some rows)")


def load(csv_files, notes_entries, notes_rules, registry):
    inventory, raw_frames, core_frames, column_rows = [], [], [], []
    for f in csv_files:
        text, enc = decode(f.data)
        try:
            dialect = csv.Sniffer().sniff(text.splitlines()[0])
            delim = dialect.delimiter
        except csv.Error:
            delim = ","
        df = pd.read_csv(as_buffer(text), sep=delim, dtype=str, keep_default_na=False, na_values=[""])
        df = df.dropna(how="all")
        df.columns = [c.strip() for c in df.columns]
        dates, date_fmt = _parse_dates(df["Date"])
        start_year = np.where(dates.dt.month >= 7, dates.dt.year, dates.dt.year - 1)
        df["_source_file"] = os.path.basename(f.name)
        df["_row"] = np.arange(len(df)) + 2           # 1-based line number incl. header
        df["_date"] = dates
        df["_season"] = [season_label(int(y)) if not np.isnan(y) else None for y in start_year.astype(float)]

        for col in df.columns:
            if col.startswith("_"):
                continue
            kind, desc = notes_mod.classify_column(col, notes_entries, notes_rules)
            vals = pd.to_numeric(df[col], errors="coerce")
            column_rows.append({
                "file": os.path.basename(f.name), "column": col, "normalized": CORE_MAP.get(col),
                "documentation": kind, "description": desc,
                "non_null": int(df[col].notna().sum()), "missing": int(df[col].isna().sum()),
                "numeric": bool(vals.notna().sum() == df[col].notna().sum() and df[col].notna().any()),
            })

        seasons = sorted(s for s in df["_season"].dropna().unique())
        comps = sorted(df["Div"].dropna().unique()) if "Div" in df else []
        inventory.append({
            "file": os.path.basename(f.name), "encoding": enc, "delimiter": delim,
            "rows": int(len(df)), "columns": int(len([c for c in df.columns if not c.startswith('_')])),
            "competitions": comps, "seasons": seasons,
            "date_format": date_fmt, "first_date": str(dates.min().date()), "last_date": str(dates.max().date()),
            "unparseable_dates": int(dates.isna().sum()),
            "column_names": [c for c in df.columns if not c.startswith("_")],
        })
        raw_frames.append(df)

        core = pd.DataFrame({"source_file": df["_source_file"], "source_row": df["_row"],
                             "date": df["_date"], "season": df["_season"]})
        for orig, normed in CORE_MAP.items():
            if orig in df.columns and normed not in core.columns:
                core[normed] = df[orig]
        core_frames.append(core)

    raw = pd.concat(raw_frames, ignore_index=True, sort=False)
    m = pd.concat(core_frames, ignore_index=True, sort=False)
    numeric = [c for c in m.columns if c not in {"source_file", "date", "season", "competition", "kickoff",
                                                 "home_team_raw", "away_team_raw", "result", "ht_result", "referee"}]
    for c in numeric:
        m[c] = pd.to_numeric(m[c], errors="coerce")
    m["home_id"] = m["home_team_raw"].map(registry.resolve)
    m["away_id"] = m["away_team_raw"].map(registry.resolve)
    m = m.sort_values(["date", "kickoff", "home_id"], kind="mergesort").reset_index(drop=True)
    m["match_id"] = (m["competition"] + "_" + m["date"].dt.strftime("%Y%m%d") + "_" + m["home_id"] + "_" + m["away_id"])
    return m, raw, inventory, pd.DataFrame(column_rows)


def season_inventory(m):
    """One row per competition x season, with completeness and statistical coverage."""
    rows = []
    for (comp, season), g in m.groupby(["competition", "season"]):
        teams = sorted(set(g.home_id) | set(g.away_id))
        n = len(teams)
        expected = n * (n - 1)
        cov = {}
        for stem, (h, a) in STAT_PAIRS.items():
            if h in g.columns and a in g.columns:
                valid = g[h].notna() & g[a].notna()
                cov[stem] = round(float(valid.mean()), 4)
            else:
                cov[stem] = 0.0
        rows.append({
            "competition": comp, "season": season, "files": sorted(g.source_file.unique()),
            "matches": int(len(g)), "teams": n, "expected_matches_double_round_robin": expected,
            "completeness": round(len(g) / expected, 4) if expected else None,
            "state": "complete" if len(g) == expected else ("partial (in progress)" if len(g) < expected else "over-complete?"),
            "first_date": str(g.date.min().date()), "last_date": str(g.date.max().date()),
            "coverage": cov,
        })
    return rows
