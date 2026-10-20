"""Run with:  python3 -m pytest -q tests   (from the project root)."""
import json
import os
import subprocess
import sys

import numpy as np
import pandas as pd
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from pipeline import backtest, build, form, ingest, notes, quality, ratings, sources, teams  # noqa: E402


@pytest.fixture(scope="module")
def data():
    csvs, nf, _ = sources.discover(ROOT)
    ent, rules = notes.parse_notes(sources.decode(nf.data)[0])
    reg = teams.TeamRegistry(os.path.join(ROOT, "config", "teams.json"))
    m, _, _, _ = ingest.load([f for f in csvs if build.is_results_file(f)], ent, rules, reg)
    m = quality.apply_decisions(m)
    m = m[~m.excluded].reset_index(drop=True)
    part = pd.DataFrame(teams.participation(m, {"SP1": sorted(m.season.unique())}))
    return m, part


def run_node(js):
    return json.loads(subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout)


def test_current_participants_come_from_current_file(data):
    m, part = data
    cur = sorted(m.season.unique())[-1]
    sp = part[part.season == cur]
    assert len(sp) == 20
    assert set(sp[sp.status == "entered"].team_id) == {"la-coruna", "malaga", "santander"}
    # relegated teams of the previous season are not current participants
    prev = part[(part.season == "2025/26") & (part.left_after == True)].team_id  # noqa: E712
    assert set(prev) == {"girona", "mallorca", "oviedo"}
    assert not set(prev) & set(sp.team_id)


def test_unknown_team_name_is_not_merged():
    reg = teams.TeamRegistry(os.path.join(ROOT, "config", "teams.json"))
    assert reg.resolve("Ath Madrid") != reg.resolve("Ath Bilbao")
    pid = reg.resolve("Real Sociedad B")
    assert pid.startswith("unconfirmed:") and pid != reg.resolve("Sociedad")
    assert reg.pending and reg.pending[0]["raw_name"] == "Real Sociedad B"


def test_form_features_use_only_past_matches(data):
    m, _ = data
    rows_all, _ = form.build(m, "home_goals", "away_goals")
    cutoff = pd.Timestamp("2025-01-01")
    rows_cut, _ = form.build(m[m.date < cutoff], "home_goals", "away_goals")
    a = rows_all[rows_all.date < cutoff].reset_index(drop=True)
    pd.testing.assert_frame_equal(a[form.FEATURES + ["L"]], rows_cut[form.FEATURES + ["L"]].reset_index(drop=True))


def test_season_boundary_resets_rolling_windows(data):
    m, _ = data
    rows, _ = form.build(m, "home_goals", "away_goals")
    first = rows[(rows.season == "2024/25") & (rows.team == "barcelona")].iloc[0]
    assert first.opener == 1.0
    # empty windows are filled with last season's level, so all form windows agree
    assert first.log_form5_for == pytest.approx(first.log_form15_for) == pytest.approx(first.log_s2d_for)


def test_backtest_predictions_ignore_future_results(data):
    m, part = data
    cfg = ratings.RatingsConfig()
    tamper = m.copy()
    late = tamper.season.eq("2024/25") & (tamper.date >= pd.Timestamp("2025-03-01"))
    tamper.loc[late, "home_goals"] = 9
    a = backtest.run_target(m, part, "goals", "home_goals", "away_goals", ["2024/25"], cfg, None, None)
    b = backtest.run_target(tamper, part, "goals", "home_goals", "away_goals", ["2024/25"], cfg, None, None)
    early = a.date < pd.Timestamp("2025-03-01")
    np.testing.assert_allclose(a[early].ratings_h, b[early].ratings_h)
    assert not np.allclose(a[~early].ratings_h, b[~early].ratings_h)


def test_entrant_prior_uses_earlier_seasons_only(data):
    m, part = data
    p = ratings.entrant_prior(m, "home_goals", "away_goals", part, "2024/25")
    assert p["seasons"] == ["2022/23", "2023/24"]
    assert ratings.entrant_prior(m, "home_goals", "away_goals", part, "2022/23") is None


@pytest.fixture(scope="module")
def app_data():
    path = os.path.join(ROOT, "output", "app_data.json")
    if not os.path.exists(path):
        pytest.skip("run python3 -m pipeline.build first")
    with open(path) as fh:
        return json.load(fh)


def test_js_ratings_eta_matches_python(app_data):
    snap = app_data["models"]["goals"]["snapshots"][app_data["current"]["season"]]["ratings"]
    p = len(snap["theta"])
    C = np.zeros((p, p)); C[np.tril_indices(p)] = snap["cov_lower"]; C = C + C.T - np.diag(np.diag(C))
    T = len(snap["teams"]); h, a = "real-madrid", "la-coruna"
    ih, ia = snap["teams"].index(h), snap["teams"].index(a)
    X = np.zeros((2, p)); X[0, [0, 1, 2 + ih, 2 + T + ia]] = 1; X[1, [0, 2 + ia, 2 + T + ih]] = 1
    py_m, py_S = X @ np.array(snap["theta"]), X @ C @ X.T
    js = run_node(f"const FM=require({json.dumps(os.path.join(ROOT, 'app', 'app.js'))});"
                  f"const s={json.dumps(snap)};console.log(JSON.stringify(FM.ratingsEta(s,'{h}','{a}')))")
    np.testing.assert_allclose(js["m"], py_m, rtol=1e-9)
    np.testing.assert_allclose(js["S"], py_S, rtol=1e-6)


def test_js_form_features_match_python(data, app_data):
    m, _ = data
    _, snaps = form.build(m, "home_goals", "away_goals")
    cur = app_data["current"]["season"]
    st = snaps[("SP1", cur)]["teams"]
    pairs = [("barcelona", "la-coruna", 1, 6), ("santander", "real-madrid", 0, 3), ("getafe", "elche", 1, 30)]
    py = [form.features_from_state(st[t], st[o], h, r) for t, o, h, r in pairs]
    summ = {t: build.summarize_state(s) for t, s in st.items()}
    js = run_node(f"const FM=require({json.dumps(os.path.join(ROOT, 'app', 'app.js'))});const S={json.dumps(summ)};"
                  f"console.log(JSON.stringify({json.dumps(pairs)}.map(([t,o,h,r])=>FM.formFeatures(S[t],S[o],!!h,r,{form.K_SHRINK}))))")
    for a, b in zip(py, js):
        for k in form.FEATURES:
            assert a[k] == pytest.approx(b[k], abs=1e-4), k


def test_targets_reflect_coverage(app_data):
    t = app_data["targets"]
    assert t["goals"]["eligible"] and t["corners"]["eligible"]
    assert not t["xg_undocumented"]["eligible"]          # undocumented and one season only
    assert not t["possession"]["eligible"]
    assert not t["offsides"]["eligible"]                # documented in notes but absent from the CSVs


def test_prematch_probabilities_are_consistent(app_data):
    pm = app_data["prematch"]
    i = {c: k for k, c in enumerate(pm["columns"])}
    played = {f"{r[3]}_{r[0].replace('-', '')}_{r[4]}_{r[5]}" for r in app_data["matches"]["rows"]}
    assert set(pm["rows"]) <= played                      # every pre-match forecast belongs to a real match
    for row in pm["rows"].values():
        for col in ("p_ratings", "p_form", "p_market"):
            if row[i[col]]:
                assert sum(row[i[col]]) == pytest.approx(1, abs=0.005)


def test_fixtures_skip_played_and_other_competitions(data):
    m, _ = data
    reg = teams.TeamRegistry(os.path.join(ROOT, "config", "teams.json"))
    last = m.iloc[-1]
    text = ("Div,Date,Time,HomeTeam,AwayTeam\n"
            f"SP1,{last.date:%d/%m/%Y},20:00,{last.home_team_raw},{last.away_team_raw}\n"      # already played
            "SP2,01/06/2027,20:00,Eibar,Burgos\n"                                               # no local results
            f"SP1,01/06/2027,20:00,{last.away_team_raw},{last.home_team_raw}\n"
            f"SP1,01/06/2027,20:00,{last.away_team_raw},{last.home_team_raw}\n")                # duplicate
    f = sources.SourceFile("fx.csv", text.encode(), "test")
    rows, dropped = build.load_fixtures([f], reg, m, {"SP1"})
    assert dropped == {"other_competition": 1, "bad_date": 0, "already_played": 1, "duplicate": 1}
    assert len(rows) == 1 and rows[0]["home_id"] == last.away_id and not reg.pending
