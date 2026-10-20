"""Human-readable Markdown reports written next to the machine-readable outputs."""
import os
from collections import Counter


def _t(rows, cols):
    out = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    for r in rows:
        out.append("| " + " | ".join("" if v is None else str(v) for v in r) + " |")
    return "\n".join(out)


def inventory(d):
    L = ["# Data inventory", "", f"Source: `{d['source']}`  ", f"Generated: {d['generated_at']}", ""]
    L += ["## Files", "", _t([[f["file"], ", ".join(f["competitions"]), ", ".join(f["seasons"]), f["rows"], f["columns"], f["encoding"],
                               repr(f["delimiter"]), f"{f['first_date']} → {f['last_date']}", f["date_format"]] for f in d["files"]],
                             ["file", "competition", "season", "rows", "columns", "encoding", "delimiter", "date range", "date format"])]
    if d["other_files"]:
        L += ["", "Other files found (not CSV results): " + ", ".join(d["other_files"])]
    L += ["", "Fixture schedule files: " + (", ".join(d["fixture_files"]) or "none supplied. Future fixtures must be created manually; none are invented.")]
    L += ["", "## Seasons", "", _t([[s["competition"], s["season"], s["matches"], s["teams"], s["state"], f"{s['completeness']:.0%}",
                                     f"{s['first_date']} → {s['last_date']}"] for s in d["seasons"]],
                                   ["competition", "season", "matches", "teams", "state", "completeness", "dates"])]
    L += ["", "## Statistical coverage (share of matches with the statistic)", ""]
    stems = list(d["seasons"][0]["coverage"].keys())
    L += [_t([[s["season"]] + [f"{s['coverage'][k]:.0%}" for k in stems] for s in d["seasons"]], ["season"] + stems)]
    L += ["", "## Column documentation", ""]
    kinds = Counter(v["documentation"] for v in d["schema"].values())
    L += [f"- {k}: {n} columns" for k, n in sorted(kinds.items())]
    L += ["", "### Columns not literally documented in notes.txt", ""]
    L += [_t([[c, v["documentation"], v["description"] or "**unknown — flagged**", ", ".join(v["files"])]
              for c, v in d["schema"].items() if v["documentation"] in ("undocumented", "inferred_pattern")],
             ["column", "status", "interpretation", "files"])]
    L += ["", "Notes on undocumented columns:",
          "- `HxG` / `AxG` appear only in the current-season file. The name suggests home/away expected goals and the values are consistent with that, "
          "but notes.txt does not define them (provider, model, penalties included?). They are preserved and displayed, not used for training.",
          "- `SKBH/SKBD/SKBA` (and closing `SKBC*`) look like 1X2 bookmaker odds; notes.txt lists Skybet as `SKH/SKD/SKA`, so `SKB` may be Skybet "
          "under a new code. Ambiguous — preserved, not used.", ""]
    L += ["## Schema differences between files", ""]
    files = [f["file"] for f in d["files"]]
    varying = {c: v for c, v in d["schema"].items() if len(v["files"]) != len(files)}
    L += [f"{len(d['schema'])} distinct columns; {len(d['schema']) - len(varying)} present in every file; {len(varying)} vary by file "
          "(almost all bookmaker odds — bookmakers change between seasons).", ""]
    L += [_t([[c, ", ".join(v["files"])] for c, v in varying.items() if v["normalized"] or v["documentation"] == "undocumented"],
             ["modelling-relevant column with partial presence", "present in"])]
    L += ["", "Full original → normalized mapping: `output/column_mapping.csv`. All original columns are preserved in `output/raw_combined_all_columns.csv`."]
    L += ["", "## Team identities", ""]
    L += [_t([[tid, t["display"], ", ".join(t["raw_names"]), "yes" if t["confirmed"] else "**NO — needs confirmation**"] for tid, t in d["teams"].items()],
             ["team id", "display", "raw names in data", "confirmed in config"])]
    if d["unknown_team_names"] or d["team_similarity_pending"]:
        L += ["", "### Needs manual confirmation", ""]
        for p in d["unknown_team_names"]:
            L.append(f"- Unknown name `{p['raw_name']}` kept separate as `{p['provisional_id']}`; similar: {p['similar_known']}")
        for p in d["team_similarity_pending"]:
            L.append(f"- `{p['a']}` vs `{p['b']}` (similarity {p['score']}) are mapped to different teams but not confirmed distinct.")
    else:
        L += ["", "All raw team names resolved to confirmed identities; all look-alike pairs are recorded as confirmed distinct in `config/teams.json`."]
    L += ["", "## Season participation", ""]
    seasons = [s["season"] for s in d["seasons"]]
    part = {(p["season"], p["team_id"]): p for p in d["participation"]}
    tids = sorted({p["team_id"] for p in d["participation"]})
    sym = {"continuing": "●", "entered": "▲", "first_in_dataset": "○"}
    rows = []
    for t in tids:
        row = [d["teams"][t]["display"]]
        for s in seasons:
            p = part.get((s, t))
            row.append("" if not p else sym[p["status"]] + ("▼" if p["left_after"] else ""))
        rows.append(row)
    L += [_t(rows, ["team"] + seasons), "", "○ first season in dataset (prior status unknown) · ● continuing · ▲ entered (promoted / returning; source division not in data) · ▼ not in the next season (relegated)"]
    return "\n".join(L) + "\n"


def quality(d):
    q = d["quality"]
    L = ["# Data quality report", ""]
    c = Counter((i["check"], i["severity"], i["decision"]) for i in q["issues"])
    L += ["## Checks", "", _t([[k[0], k[1], n, k[2]] for k, n in sorted(c.items())] or [["no issues", "", 0, ""]], ["check", "severity", "rows", "decision"])]
    L += ["", "Checks run: unparseable dates, home = away, duplicate matches, repeated pairings within a season, FTR vs goals, "
          "half-time > full-time, shots on target > shots, goals > shots on target, negative values, implausible values.", ""]
    L += ["### Rows flagged", "", _t([[i["file"], i["line"], i["date"], i["match"], i["check"], i["values"]] for i in q["issues"]],
                                     ["file", "line", "date", "match", "check", "values"])]
    L += ["", "## Matches per team per season", "", _t([[r["season"], r["min_matches"], r["max_matches"]] for r in q["team_counts"]], ["season", "min", "max"])]
    L += ["", "## Cross-season consistency of statistics", "",
          "Per-team-per-match means. z compares a season with the pooled other seasons; |z| > 4 is flagged. "
          "notes.txt documents no definition change for these variables in Spain (fouls are recorded directly, not free kicks conceded; "
          "yellow-card counting follows the European convention throughout), so drift is treated as a real trend and absorbed by "
          "time-decay weighting and league-relative features.", ""]
    for stem, v in q["drift"].items():
        L += [f"**{v['label']}**: " + " · ".join(f"{p['season']} {p['mean']} (z={p['z']}{' ⚠' if p.get('flag') else ''})" for p in v["seasons"]), ""]
    L += ["## Prediction targets", "", _t([[p["label"], "yes" if p["eligible"] else "no", ", ".join(p["usable_seasons"]) or "–", p["reason"] or ""]
                                           for p in d["targets"].values()], ["statistic", "modelled", "seasons with data", "reason if not"])]
    return "\n".join(L) + "\n"


def backtest(d):
    L = ["# Chronological backtest", "",
         "Walk-forward: matches are predicted in weekly batches; every model is refitted on matches strictly before the batch. "
         "Hyper-parameters were chosen on the validation season only; test seasons were scored once.", ""]
    for stem, b in d["backtest"].items():
        L += [f"## {b['label']}", "", f"Validation: {', '.join(b['validation_seasons'])} · Test: {', '.join(b['test_seasons'])}",
              f"- Ratings training: {b['train_policy']['ratings']}", f"- Form training: {b['train_policy']['form']}",
              f"- Chosen: {b['config']}", f"- Negative-binomial size (k, validation): {b['nb_size_validation'] and round(b['nb_size_validation'], 1) or 'Poisson adequate'}", ""]
        rows = []
        for split in ("validation", "test"):
            for mdl, v in b["metrics"][f"{split}_overall"].items():
                rows.append([split, mdl, v["n_matches"], f"{v['poisson_deviance']:.4f}", f"{v['mae_side']:.3f}", f"{v['mae_total']:.3f}",
                             f"{v['bias_total']:+.3f}", f"{v['interval80_coverage']:.1%}"])
        L += [_t(rows, ["split", "model", "matches", "Poisson deviance", "MAE per side", "MAE total", "bias total", "80% interval coverage"]), ""]
        if "test_outcome" in b["metrics"]:
            rows = []
            for split in ("validation", "test"):
                for mdl, v in b["metrics"][f"{split}_outcome"].items():
                    if v:
                        o = b["metrics"][f"{split}_over25"].get(mdl)
                        rows.append([split, mdl, v["n_matches"], f"{v['log_loss']:.4f}", f"{v['brier']:.4f}", f"{v['rps']:.4f}", f"{v['accuracy']:.1%}",
                                     f"{o['log_loss']:.4f}" if o else "–"])
            L += ["Match outcome (1X2) and over/under 2.5 goals. *market* = normalized pre-closing market-average odds, a benchmark only (never a model input).", "",
                  _t(rows, ["split", "model", "matches", "1X2 log loss", "Brier", "RPS", "accuracy", "O/U2.5 log loss"]), ""]
            le = b["metrics"].get("low_evidence")
            if le and le["ratings"]:
                L += [f"Low-evidence matches (a team with < 8 effective matches): {le['n_matches']} · ratings log loss {le['ratings']['log_loss']:.4f}"
                      + (f" vs market {le['market']['log_loss']:.4f}" if le["market"] else ""), ""]
        rows = []
        for season, v in b["metrics"]["by_season"].items():
            rows.append([season] + [f"{v[mdl]['poisson_deviance']:.4f}" for mdl in ("baseline", "ratings", "form")]
                        + ([f"{v['outcome'][mdl]['log_loss']:.4f}" if v["outcome"][mdl] else "–" for mdl in ("ratings", "market")] if "outcome" in v else []))
        hdr = ["season", "dev baseline", "dev ratings", "dev form"] + (["1X2 LL ratings", "1X2 LL market"] if stem == "goals" else [])
        L += [_t(rows, hdr), ""]
    return "\n".join(L) + "\n"


def write_all(d, out):
    for name, fn in (("data_inventory.md", inventory), ("data_quality.md", quality), ("backtest.md", backtest)):
        if name == "backtest.md" and not d["backtest"]:
            continue
        with open(os.path.join(out, name), "w", encoding="utf-8") as fh:
            fh.write(fn(d))
