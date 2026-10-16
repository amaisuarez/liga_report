"""Data-quality checks. Nothing is dropped silently: every issue is recorded with
its source file and line, and an explicit decision (keep / exclude-from-target)."""
import numpy as np
import pandas as pd

from .ingest import STAT_PAIRS, STAT_LABELS


def run_checks(m):
    issues = []

    def add(mask, check, severity, decision, cols):
        for _, r in m[mask].iterrows():
            issues.append({
                "check": check, "severity": severity, "decision": decision,
                "file": r.source_file, "line": int(r.source_row), "date": str(r.date.date()) if pd.notna(r.date) else None,
                "match": f"{r.home_team_raw} v {r.away_team_raw}",
                "values": {c: (None if pd.isna(r[c]) else (int(r[c]) if isinstance(r[c], (float, np.floating)) and float(r[c]).is_integer() else r[c])) for c in cols if c in m.columns},
            })

    add(m.date.isna(), "unparseable date", "error", "excluded from modelling", ["date"])
    add(m.home_id == m.away_id, "home team equals away team", "error", "excluded from modelling", [])
    dup = m.duplicated(["competition", "date", "home_id", "away_id"], keep="first")
    add(dup, "duplicate match (same date and teams)", "error", "later copy excluded", [])
    pair_dup = m.duplicated(["competition", "season", "home_id", "away_id"], keep=False) & ~dup
    add(pair_dup, "same home/away pairing twice in one season", "warning", "kept; verify", [])
    calc = np.select([m.home_goals > m.away_goals, m.home_goals < m.away_goals], ["H", "A"], "D")
    add(m.result.notna() & m.home_goals.notna() & (m.result != calc), "FTR inconsistent with goals", "error",
        "goals trusted, FTR recomputed", ["home_goals", "away_goals", "result"])
    add((m.ht_home_goals > m.home_goals) | (m.ht_away_goals > m.away_goals), "half-time goals exceed full-time",
        "error", "half-time values excluded", ["ht_home_goals", "home_goals", "ht_away_goals", "away_goals"])
    add((m.home_sot > m.home_shots) | (m.away_sot > m.away_shots), "shots on target exceed shots", "error",
        "shot values excluded for this match", ["home_shots", "home_sot", "away_shots", "away_sot"])
    add((m.home_goals > m.home_sot) | (m.away_goals > m.away_sot), "goals exceed shots on target", "info",
        "kept: consistent with own goals, which are not shots by the scoring side",
        ["home_goals", "home_sot", "away_goals", "away_sot"])
    stat_cols = [c for pair in STAT_PAIRS.values() for c in pair if c in m.columns]
    neg = (m[stat_cols] < 0).any(axis=1)
    add(neg, "negative statistic", "error", "value excluded", stat_cols)
    big = (m.get("home_reds", 0) > 4) | (m.get("away_reds", 0) > 4) | (m.home_goals > 12) | (m.away_goals > 12)
    add(big, "implausibly large value", "warning", "kept; verify", ["home_goals", "away_goals", "home_reds", "away_reds"])
    return issues


def apply_decisions(m):
    """Return a modelling copy with values blanked/rows excluded according to the checks."""
    m = m.copy()
    m["excluded"] = m.date.isna() | (m.home_id == m.away_id) | m.duplicated(["competition", "date", "home_id", "away_id"])
    bad_ht = (m.ht_home_goals > m.home_goals) | (m.ht_away_goals > m.away_goals)
    m.loc[bad_ht, ["ht_home_goals", "ht_away_goals"]] = np.nan
    bad_shots = (m.home_sot > m.home_shots) | (m.away_sot > m.away_shots)
    m.loc[bad_shots, ["home_shots", "away_shots", "home_sot", "away_sot"]] = np.nan
    m["result"] = np.select([m.home_goals > m.away_goals, m.home_goals < m.away_goals], ["H", "A"], "D")
    return m


def team_counts(m):
    rows = []
    for (comp, season), g in m.groupby(["competition", "season"]):
        cnt = pd.concat([g.home_id, g.away_id]).value_counts()
        rows.append({"competition": comp, "season": season, "min_matches": int(cnt.min()), "max_matches": int(cnt.max())})
    return rows


def stat_drift(m, available):
    """Per-season mean of each statistic (per team per match) and a drift flag.

    A season is flagged when its mean differs from the pooled mean of the other seasons by
    more than 4 standard errors. Drift is *not* evidence of a definition change by itself;
    notes.txt documents no change for these variables, so flagged drift is treated as a
    real trend and handled with time-decay weighting.
    """
    out = {}
    for stem in available:
        h, a = STAT_PAIRS[stem]
        per = []
        for season, g in m.groupby("season"):
            v = pd.concat([g[h], g[a]]).dropna()
            if len(v) == 0:
                continue
            per.append({"season": season, "n": int(len(v)), "mean": float(v.mean()), "sd": float(v.std(ddof=1)) if len(v) > 1 else 0.0,
                        "home_mean": float(g[h].mean()), "away_mean": float(g[a].mean())})
        for p in per:
            others = [q for q in per if q["season"] != p["season"]]
            if not others:
                p["z"] = None
                p["flag"] = False
                continue
            n_o = sum(q["n"] for q in others)
            mu_o = sum(q["mean"] * q["n"] for q in others) / n_o
            se = np.sqrt(p["sd"] ** 2 / p["n"] + p["sd"] ** 2 / n_o) or 1e-9
            p["z"] = round(float((p["mean"] - mu_o) / se), 2)
            p["flag"] = abs(p["z"]) > 4
            p["mean"], p["sd"] = round(p["mean"], 3), round(p["sd"], 3)
            p["home_mean"], p["away_mean"] = round(p["home_mean"], 3), round(p["away_mean"], 3)
        out[stem] = {"label": STAT_LABELS[stem], "seasons": per}
    return out
