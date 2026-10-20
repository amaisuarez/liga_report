"""End-to-end build: inventory -> team registry -> unified dataset -> quality report ->
models -> chronological backtest -> app data.

    python3 -m pipeline.build --source <dir-or-zip> [--retune] [--fast]

Steps follow the mandatory order; each writes an artefact in output/ so it can be
inspected before the next step is trusted.
"""
import argparse
import json
import os
import time
from datetime import datetime

import numpy as np
import pandas as pd

from . import backtest, form, ingest, notes, quality, ratings, sources, teams
from .ingest import STAT_LABELS, STAT_PAIRS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "output")
APP = os.path.join(ROOT, "app")

MIN_COVERAGE = 0.9           # a season counts for a target if >=90% of its matches have the statistic
MIN_SEASONS_FOR_TARGET = 3   # need warm-up + validation + at least one test season
VALIDATION_SEASONS = 1


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def is_results_file(f):
    head = sources.decode(f.data)[0].splitlines()[0]
    return any(c in head.split(",") for c in ("FTHG", "HG"))


def load_fixtures(files, registry, played, competitions):
    """Read schedule CSVs (no result columns). Rows for other competitions, rows that cannot be
    parsed, duplicates and pairings already played this season are dropped and counted."""
    rows, dropped, seen = [], {"other_competition": 0, "bad_date": 0, "already_played": 0, "duplicate": 0}, set()
    done = set(zip(played.competition, played.season, played.home_id, played.away_id))
    for f in files:
        df = pd.read_csv(sources.as_buffer(sources.decode(f.data)[0]), dtype=str)
        for r in df.itertuples(index=False):
            comp = getattr(r, "Div", None)
            if comp not in competitions:
                dropped["other_competition"] += 1
                continue
            d = pd.to_datetime(r.Date, dayfirst=True, errors="coerce")
            if pd.isna(d):
                dropped["bad_date"] += 1
                continue
            season = ingest.season_label(d.year if d.month >= 7 else d.year - 1)
            h, a = registry.resolve(r.HomeTeam), registry.resolve(r.AwayTeam)
            if (comp, season, h, a) in done:
                dropped["already_played"] += 1
                continue
            if (comp, season, h, a) in seen:
                dropped["duplicate"] += 1
                continue
            seen.add((comp, season, h, a))
            rows.append({"file": os.path.basename(f.name), "competition": comp, "season": season, "date": str(d.date()),
                         "kickoff": getattr(r, "Time", None), "home_id": h, "away_id": a,
                         "home_raw": r.HomeTeam, "away_raw": r.AwayTeam})
    return sorted(rows, key=lambda x: (x["date"], x["kickoff"] or "", x["home_id"])), dropped


def prematch_export(bt_frames):
    """Walk-forward pre-match predictions (made with matches before each weekly batch only),
    keyed by match_id, for the match detail view."""
    if not bt_frames:
        return None
    bt = pd.concat(bt_frames, ignore_index=True)
    stems = list(dict.fromkeys(bt.target))
    r3 = lambda v: None if v is None or (isinstance(v, float) and np.isnan(v)) else round(float(v), 3)
    p3 = lambda v: [r3(x) for x in v] if isinstance(v, (list, tuple, np.ndarray)) else None
    cols = ["split", "p_ratings", "p_form", "p_market"] + [f"{s}_{k}" for s in stems for k in ("rh", "ra", "fh", "fa")]
    rows = {}
    g = bt[bt.target == "goals"].set_index("match_id")
    for mid, r in g.iterrows():
        rows[mid] = [r.split, p3(r.get("p_ratings")), p3(r.get("p_form")), p3(r.get("p_market"))]
    for s in stems:
        for r in bt[bt.target == s].itertuples(index=False):
            rows.setdefault(r.match_id, [r.split, None, None, None])
            rows[r.match_id].extend([r3(r.ratings_h), r3(r.ratings_a), r3(getattr(r, "form_h", None)), r3(getattr(r, "form_a", None))])
    width = len(cols)
    return {"columns": cols, "rows": {k: v + [None] * (width - len(v)) for k, v in rows.items()}}


def target_plan(season_inv, drift, notes_entries):
    """Decide, per statistic, whether it can be a prediction target and on which seasons."""
    plan = {}
    seasons = [s["season"] for s in season_inv]
    for stem, (h, a) in STAT_PAIRS.items():
        cov = {s["season"]: s["coverage"].get(stem, 0.0) for s in season_inv}
        usable = [s for s in seasons if cov[s] >= MIN_COVERAGE]
        codes = [k for k, v in ingest.CORE_MAP.items() if v in (h, a)]
        documented = any(c in notes_entries for c in codes)
        reason = None
        if not usable:
            reason = "Documented in notes.txt but not present in any CSV." if documented else "Not present in any CSV."
        elif not documented:
            reason = "Column is not documented in notes.txt; meaning cannot be validated, so it is shown but not modelled."
        elif len(usable) < MIN_SEASONS_FOR_TARGET:
            reason = f"Only {len(usable)} season(s) with data; need {MIN_SEASONS_FOR_TARGET} for chronological validation."
        elif stem == "ht_goals":
            reason = None
        plan[stem] = {"label": STAT_LABELS[stem], "original_columns": codes, "documented": documented,
                      "coverage": cov, "usable_seasons": usable, "eligible": reason is None, "reason": reason,
                      "drift_flags": [p["season"] for p in drift.get(stem, {}).get("seasons", []) if p.get("flag")]}
    for k, why in ingest.EXPECTED_BUT_UNDEFINED.items():
        plan[k] = {"label": k.title(), "original_columns": [], "documented": False, "coverage": {s: 0.0 for s in seasons},
                   "usable_seasons": [], "eligible": False, "reason": why, "drift_flags": []}
    return plan


def round_list(a, nd=5):
    return [float(f"{x:.{nd}g}") for x in np.asarray(a, float).ravel()]


def summarize_state(ts):
    """Compact team state consumed by app.js formFeatures()."""
    v = {}
    for venue in (1, 0):
        hv = [x for x in ts.hist if x[0] == venue]
        v[venue] = [len(hv), round(sum(x[1] for x in hv), 5), round(sum(x[2] for x in hv), 5)]
    return {"prev_for": round(ts.prev_for, 5), "prev_ag": round(ts.prev_ag, 5), "entered": ts.entered,
            "n": len(ts.hist), "sf": round(sum(x[1] for x in ts.hist), 5), "sa": round(sum(x[2] for x in ts.hist), 5),
            "v1": v[1], "v0": v[0], "last": [[round(x[1], 5), round(x[2], 5)] for x in ts.hist[-15:]]}


def ratings_snapshot(rf, entrant_prior):
    T = len(rf.teams)
    tri = rf.cov[np.tril_indices(len(rf.theta))]
    return {"as_of": str(rf.as_of.date()), "teams": rf.teams, "theta": round_list(rf.theta, 6), "cov_lower": round_list(tri, 5),
            "eff": {t: round(v, 2) for t, v in rf.eff_matches.items()},
            "eff_by_season": {t: {s: round(w, 2) for s, w in d.items()} for t, d in rf.eff_by_season.items()},
            "n_by_season": rf.n_by_season, "prior_used": rf.prior_used,
            "att": {t: round(float(rf.theta[2 + i]), 4) for i, t in enumerate(rf.teams)},
            "dfn": {t: round(float(rf.theta[2 + T + i]), 4) for i, t in enumerate(rf.teams)},
            "att_se": {t: round(float(np.sqrt(rf.cov[2 + i, 2 + i])), 4) for i, t in enumerate(rf.teams)},
            "dfn_se": {t: round(float(np.sqrt(rf.cov[2 + T + i, 2 + T + i])), 4) for i, t in enumerate(rf.teams)},
            "entrant_prior": {k: v for k, v in entrant_prior.items() if k != "members"} if entrant_prior else None}


def season_tables(m):
    out = {}
    for season, g in m.groupby("season"):
        rows = {}
        for r in g.itertuples(index=False):
            for t, gf, ga, home in ((r.home_id, r.home_goals, r.away_goals, 1), (r.away_id, r.away_goals, r.home_goals, 0)):
                x = rows.setdefault(t, {"team": t, "p": 0, "w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "pts": 0})
                x["p"] += 1; x["gf"] += int(gf); x["ga"] += int(ga)
                if gf > ga: x["w"] += 1; x["pts"] += 3
                elif gf == ga: x["d"] += 1; x["pts"] += 1
                else: x["l"] += 1
        tab = sorted(rows.values(), key=lambda x: (-x["pts"], -(x["gf"] - x["ga"]), -x["gf"], x["team"]))
        for i, x in enumerate(tab):
            x["pos"] = i + 1
        out[season] = tab
    return out


def team_season_stats(m, stems):
    out = {}
    for season, g in m.groupby("season"):
        for t in sorted(set(g.home_id) | set(g.away_id)):
            hm, am = g[g.home_id == t], g[g.away_id == t]
            d = {}
            for stem in stems:
                h, a = STAT_PAIRS[stem]
                if h not in g:
                    continue
                f = pd.concat([hm[h], am[a]]).dropna(); ag = pd.concat([hm[a], am[h]]).dropna()
                if len(f):
                    d[stem] = [round(float(f.mean()), 3), round(float(ag.mean()), 3), int(len(f))]
            out.setdefault(t, {})[season] = d
    return out


def matches_compact(m):
    cols = ["date", "kickoff", "season", "competition", "home_id", "away_id", "home_goals", "away_goals", "ht_home_goals", "ht_away_goals",
            "home_shots", "away_shots", "home_sot", "away_sot", "home_corners", "away_corners", "home_fouls", "away_fouls",
            "home_yellows", "away_yellows", "home_reds", "away_reds", "home_xg_undocumented", "away_xg_undocumented", "source_file"]
    cols = [c for c in cols if c in m.columns]
    rows = []
    for r in m[cols].itertuples(index=False):
        row = []
        for c, v in zip(cols, r):
            if c == "date":
                row.append(str(v.date()))
            elif isinstance(v, (float, np.floating)):
                row.append(None if np.isnan(v) else (int(v) if float(v).is_integer() else round(float(v), 2)))
            else:
                row.append(v)
        rows.append(row)
    return {"columns": cols, "rows": rows}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=ROOT, help="directory or ZIP containing the CSVs and notes.txt")
    ap.add_argument("--retune", action="store_true", help="re-run hyper-parameter search")
    ap.add_argument("--fast", action="store_true", help="skip tuning and backtest (defaults only)")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    # 1-2. inspect files, read notes
    log(f"Discovering files in {args.source}")
    csvs, notes_file, other = sources.discover(args.source)
    if notes_file is None:
        raise SystemExit("notes.txt not found: it is required to interpret the statistical columns.")
    notes_text, _ = sources.decode(notes_file.data)
    notes_entries, notes_rules = notes.parse_notes(notes_text)
    result_files = [f for f in csvs if is_results_file(f)]
    fixture_files = [f for f in csvs if not is_results_file(f)]
    registry = teams.TeamRegistry(os.path.join(ROOT, "config", "teams.json"))

    # 3. inventory + unified dataset
    m_raw, raw, file_inv, col_table = ingest.load(result_files, notes_entries, notes_rules, registry)
    raw.drop(columns=["_date"]).to_csv(os.path.join(OUT, "raw_combined_all_columns.csv"), index=False)
    col_table.to_csv(os.path.join(OUT, "column_mapping.csv"), index=False)
    season_inv = ingest.season_inventory(m_raw)

    # 4. team identities
    similar = registry.similarity_audit(set(m_raw.home_team_raw) | set(m_raw.away_team_raw))
    raw_names = {}
    for side in ("home", "away"):
        for tid, raw_name in zip(m_raw[f"{side}_id"], m_raw[f"{side}_team_raw"]):
            raw_names.setdefault(tid, set()).add(raw_name)

    # 7-8. quality
    issues = quality.run_checks(m_raw)
    m = quality.apply_decisions(m_raw)
    m = m[~m.excluded].reset_index(drop=True)
    m.to_csv(os.path.join(OUT, "matches_unified.csv"), index=False)
    fixtures, fixtures_dropped = load_fixtures(fixture_files, registry, m, set(m.competition))

    # 5. participation
    seasons_by_comp = {c: sorted(g.season.unique()) for c, g in m.groupby("competition")}
    part = pd.DataFrame(teams.participation(m, seasons_by_comp))
    part.to_csv(os.path.join(OUT, "team_seasons.csv"), index=False)

    # 6. coverage + drift -> target plan
    stems_present = [s for s, (h, a) in STAT_PAIRS.items() if h in m.columns and m[h].notna().any()]
    drift = quality.stat_drift(m, stems_present)
    plan = target_plan(season_inv, drift, notes_entries)
    targets = [s for s, p in plan.items() if p["eligible"]]
    log(f"Eligible targets: {targets}")

    comp = sorted(seasons_by_comp)[0] if len(seasons_by_comp) == 1 else None
    all_seasons = sorted(m.season.unique())
    current = all_seasons[-1]
    current_state = next(s for s in season_inv if s["season"] == current)["state"]
    val_seasons = all_seasons[2:2 + VALIDATION_SEASONS]           # first = warm-up, second = first with history
    test_seasons = all_seasons[2 + VALIDATION_SEASONS:]

    tuning_path = os.path.join(OUT, "tuning.json")
    tuning = json.load(open(tuning_path)) if os.path.exists(tuning_path) and not args.retune else {}

    models_out, backtest_out, bt_frames = {}, {}, []
    for stem in targets:
        h, a = STAT_PAIRS[stem]
        usable = plan[stem]["usable_seasons"]
        mt = m[m.season.isin(usable)]
        rows, form_snaps = form.build(mt, h, a)
        t0 = time.time()
        if args.fast:
            rcfg, fwin, grid_r, grid_f = ratings.RatingsConfig(), "all", None, None
        elif stem in tuning:
            rcfg = ratings.RatingsConfig(**tuning[stem]["ratings"]); fwin = tuning[stem]["form_window"]
            grid_r, grid_f = tuning[stem].get("grid_ratings"), tuning[stem].get("grid_form")
        else:
            log(f"[{stem}] tuning on validation {val_seasons}")
            rcfg, gr = backtest.tune_ratings(mt, part, stem, h, a, val_seasons)
            fwin, gf = backtest.tune_form(rows, mt, part, stem, h, a, val_seasons, rcfg)
            grid_r, grid_f = gr.round(5).to_dict("records"), gf.round(5).to_dict("records")
            tuning[stem] = {"ratings": rcfg.__dict__, "form_window": fwin, "grid_ratings": grid_r, "grid_form": grid_f}
            json.dump(tuning, open(tuning_path, "w"), indent=1)

        bt = None
        if not args.fast:
            log(f"[{stem}] walk-forward backtest {val_seasons + test_seasons}")
            bt = backtest.run_target(mt, part, stem, h, a, val_seasons + test_seasons, rcfg, rows, fwin, with_probs=(stem == "goals"))
            bt["target"] = stem
            bt["split"] = np.where(bt.season.isin(val_seasons), "validation", "test")
            k = backtest.nb_dispersion(bt[bt.split == "validation"])
            k_all = backtest.nb_dispersion(bt)
            summary = {"by_season": {}, "test_overall": {}, "validation_overall": {}}
            for split in ("validation", "test"):
                d = bt[bt.split == split]
                summary[f"{split}_overall"] = {mdl: backtest.count_metrics(d, mdl) for mdl in ("baseline", "ratings", "form")}
                for mdl in ("baseline", "ratings", "form"):
                    summary[f"{split}_overall"][mdl]["interval80_coverage"] = backtest.interval_coverage(d, mdl, k)
            for season, d in bt.groupby("season"):
                summary["by_season"][season] = {mdl: backtest.count_metrics(d, mdl) for mdl in ("baseline", "ratings", "form")}
            if stem == "goals":
                for split in ("validation", "test"):
                    d = bt[bt.split == split]
                    summary[f"{split}_outcome"] = {mdl: backtest.outcome_metrics(d, f"p_{mdl}") for mdl in ("baseline", "ratings", "form", "market")}
                    summary[f"{split}_over25"] = {mdl: backtest.binary_metrics(d, c) for mdl, c in
                                                  (("baseline", "grid_baseline_over25"), ("ratings", "grid_ratings_over25"),
                                                   ("form", "grid_form_over25"), ("market", "market_over25"))}
                for season, d in bt.groupby("season"):
                    summary["by_season"][season]["outcome"] = {mdl: backtest.outcome_metrics(d, f"p_{mdl}") for mdl in ("baseline", "ratings", "form", "market")}
                # low-evidence analysis: entrants in first 10 matches vs others
                low = bt[(bt.eff_h < 8) | (bt.eff_a < 8)]
                summary["low_evidence"] = {"n_matches": int(len(low)),
                                           "ratings": backtest.outcome_metrics(low, "p_ratings"),
                                           "market": backtest.outcome_metrics(low, "p_market")}
            bt_frames.append(bt)
            backtest_out[stem] = {"label": STAT_LABELS[stem], "validation_seasons": val_seasons, "test_seasons": test_seasons,
                                  "train_policy": {"ratings": f"all matches before each weekly batch from seasons {usable[0]}..; "
                                                              f"weights 0.5^(days/{rcfg.half_life_days:g}) x {rcfg.season_discount:g}^(seasons back)",
                                                   "form": ("all seasons before the batch" if fwin == "all" else f"last {fwin} seasons before the batch")
                                                           + f" (warm-up season {usable[0]} excluded)"},
                                  "config": {"ratings": rcfg.__dict__, "form_window": fwin},
                                  "grid_ratings": (grid_r or [])[:8], "grid_form": grid_f,
                                  "nb_size_validation": k, "nb_size_all": k_all, "metrics": summary}
        else:
            k_all = None
        log(f"[{stem}] done in {time.time() - t0:.0f}s")

        # final models: one snapshot per season (as at the end of that season / now)
        snaps = {}
        for season in usable:
            sm = mt[mt.season == season]
            as_of = sm.date.max() + pd.Timedelta(days=1)
            priors, pri = backtest.entrant_priors_for(mt, part, h, a, season, rcfg)
            participants = part[part.season == season].team_id.tolist()
            rf = ratings.fit(mt[mt.date < as_of], h, a, as_of, season, rcfg, participants, priors)
            ff = form.fit(rows, as_of, fwin)
            fs = form_snaps[(sm.competition.iloc[0], season)]
            base = ratings.baseline_rates(mt[mt.date < as_of], h, a, as_of, season, rcfg)
            snaps[season] = {
                "ratings": ratings_snapshot(rf, pri),
                "form": None if ff is None or season == usable[0] else {
                    "features": form.FEATURES, "coef": round_list(ff.coef, 6), "mean": round_list(ff.mean, 6), "scale": round_list(ff.scale, 6),
                    "intercept": round(ff.intercept, 6), "n_train": ff.n_train, "train_seasons": ff.seasons,
                    "league_mean": round(fs["league_mean"], 5), "as_of": str(fs["as_of"].date()),
                    "last_date": {t: str(d.date()) for t, d in fs["last_date"].items()},
                    "teams": {t: summarize_state(s) for t, s in fs["teams"].items()},
                    "constants": {"K": form.K_SHRINK}},
                "baseline": [round(base[0], 4), round(base[1], 4)],
            }
        models_out[stem] = {"label": STAT_LABELS[stem], "nb_size": k_all, "config": {"ratings": rcfg.__dict__, "form_window": fwin}, "snapshots": snaps}

    if bt_frames:
        allbt = pd.concat(bt_frames, ignore_index=True)
        allbt.drop(columns=[c for c in allbt.columns if c.startswith("p_")]).to_csv(os.path.join(OUT, "backtest_predictions.csv"), index=False)

    # export
    teams_out = {}
    for tid in sorted(set(m.home_id) | set(m.away_id)):
        teams_out[tid] = {"display": registry.display(tid), "raw_names": sorted(raw_names.get(tid, [])),
                          "aliases": registry.teams.get(tid, {}).get("aliases", []), "confirmed": tid in registry.teams}
    schema = {}
    for c in col_table.column.unique():
        sub = col_table[col_table.column == c]
        schema[c] = {"files": sub.file.tolist(), "documentation": sub.documentation.iloc[0], "description": sub.description.iloc[0],
                     "normalized": sub.normalized.iloc[0] if isinstance(sub.normalized.iloc[0], str) else None,
                     "missing": dict(zip(sub.file, sub.missing.astype(int)))}
    file_season = {f["file"]: f["seasons"] for f in file_inv}
    data = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source": os.path.abspath(args.source),
        "competitions": {c: registry.competitions.get(c, {"name": c}) for c in seasons_by_comp},
        "current": {"competition": comp, "season": current, "state": current_state, "as_of": str(m[m.season == current].date.max().date())},
        "files": file_inv, "file_season": file_season, "notes": {"entries": list(notes_entries.values()), "rules": notes_rules},
        "other_files": [f.name for f in other], "fixture_files": [f.name for f in fixture_files], "fixtures": fixtures,
        "fixtures_dropped": fixtures_dropped, "fixtures_status": _read_json(os.path.join(OUT, "fixtures_status.json")),
        "prematch": prematch_export(bt_frames),
        "schema": schema, "seasons": season_inv, "participation": part.where(part.notna(), None).to_dict("records"),
        "teams": teams_out, "team_similarity_pending": similar, "unknown_team_names": registry.pending,
        "quality": {"issues": issues, "drift": drift, "team_counts": quality.team_counts(m)},
        "targets": plan, "models": models_out, "backtest": backtest_out,
        "tables": season_tables(m), "team_stats": team_season_stats(m, stems_present),
        "matches": matches_compact(m),
    }
    with open(os.path.join(OUT, "app_data.json"), "w") as fh:
        json.dump(data, fh, separators=(",", ":"), default=_json_default)
    with open(os.path.join(APP, "data.js"), "w") as fh:
        fh.write("window.FUTDATA=")
        json.dump(data, fh, separators=(",", ":"), default=_json_default)
        fh.write(";\n")
    from . import reports
    reports.write_all(data, OUT)
    write_pages_site()
    log(f"Wrote {os.path.join(APP, 'data.js')} ({os.path.getsize(os.path.join(APP, 'data.js')) / 1e6:.2f} MB) and reports in {OUT}")


PAGES_HEAD = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
"""


def write_pages_site():
    """docs/ = standalone copy of app/ for GitHub Pages (Settings > Pages > branch main, folder /docs).
    app/index.html omits the document head because the artifact host adds one; Pages needs it."""
    import shutil
    docs = os.path.join(ROOT, "docs")
    os.makedirs(docs, exist_ok=True)
    with open(os.path.join(APP, "index.html"), encoding="utf-8") as fh:
        body = fh.read().replace('<meta charset="utf-8">\n', "", 1)   # PAGES_HEAD already declares it
    head, rest = body.split("</style>", 1)
    with open(os.path.join(docs, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(PAGES_HEAD + head + "</style>\n</head>\n<body>" + rest + "</body>\n</html>\n")
    for f in ("app.js", "ui.js", "data.js"):
        shutil.copyfile(os.path.join(APP, f), os.path.join(docs, f))
    open(os.path.join(docs, ".nojekyll"), "w").close()


def _read_json(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, (pd.Timestamp,)):
        return str(o.date())
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(type(o))


if __name__ == "__main__":
    main()
