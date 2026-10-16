# LaLiga Match Lab

Multi-season football prediction built from football-data.co.uk CSVs and their `notes.txt`.

## Rebuild
```
python3 -m pipeline.build --source <folder-or-zip>   # default: this folder
python3 -m pipeline.build --retune                   # redo the hyper-parameter search (~5 min)
python3 -m pytest -q tests
```
Then open `app/index.html` in a browser (works from file://; no server needed).

## Pipeline order
1. `sources.py`: find CSVs and notes.txt in a folder or ZIP (ZIP is read in memory)
2. `notes.py`: parse notes.txt and classify every column (documented, notes rule, inferred, undocumented)
3. `ingest.py`: per-file inventory, seasons from dates, original → normalized column mapping
4. `teams.py` + `config/teams.json`: canonical team ids; unknown names are never merged and are listed for confirmation
5. `teams.participation`: who played each season; entered (promoted) / left (relegated)
6. `quality.py`: checks, explicit keep/exclude decisions, cross-season drift
7. `ratings.py`: time-decayed, season-discounted Poisson ratings with an empirical promoted-team prior
8. `form.py`: season-scoped rolling features (5/10/15, season-to-date, home/away, opponent, rest) + Poisson GLM
9. `backtest.py`: weekly walk-forward; tuning on validation season, scored on held-out seasons

Outputs land in `output/`: `data_inventory.md`, `data_quality.md` and `backtest.md` are the human-readable reports.
`app/data.js` is generated; do not edit it.

## Adding data
- New season: drop the CSV in the folder and rebuild. The latest season becomes "current".
- Fixture list: a CSV with `Div,Date,HomeTeam,AwayTeam` (no result columns) is read as a schedule.
- New or renamed club: add it to `config/teams.json`, or add the spelling as an alias of an existing club.
