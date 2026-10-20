"""Season-aware form features and a Poisson GLM on them ("form model").

Every feature for a match is computed from a team state that contains only matches
played *before* that match.  Rolling windows never cross a season boundary: at the start
of each season a team's windows are empty and are filled with its previous-season level
(league-relative), so last season's final five games are never treated as this season's
first five.  Teams that were not in the competition the previous season get a neutral
level (1.0) plus an 'entered' indicator whose effect the GLM learns from earlier
entrants.  The first season of each competition in the dataset is warm-up only
(no previous-season level exists), and is not used for training or evaluation.

Statistics are league-relative: a team's value divided by the running league mean, so
seasons with different overall levels (e.g. the fall in yellow cards) stay comparable.
"""
import math
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.linear_model import PoissonRegressor

K_SHRINK = 6          # pseudo-matches of previous-season level blended into season-to-date
L_PRIOR_OBS = 40      # pseudo team-matches of last season's league mean in the running league mean
FORM_WINDOWS = (5, 10, 15)
FEATURES = ["is_home", "log_s2d_for", "log_venue_for", "log_form5_for", "log_form10_for", "log_form15_for",
            "log_s2d_ag", "log_opp_s2d_ag", "log_opp_venue_ag", "log_opp_form5_ag", "log_opp_s2d_for",
            "entered_w", "opp_entered_w", "rest", "opener"]


@dataclass
class TeamSeason:
    prev_for: float = 1.0
    prev_ag: float = 1.0
    entered: int = 0
    hist: list = field(default_factory=list)   # (is_home, rel_for, rel_ag)

    def to_json(self):
        return {"prev_for": round(self.prev_for, 5), "prev_ag": round(self.prev_ag, 5), "entered": self.entered,
                "hist": [[h, round(f, 5), round(a, 5)] for h, f, a in self.hist]}


def _lg(x):
    return math.log(max(x, 0.05))


def features_from_state(ts, os, is_home, rest_days):
    """ts/os: TeamSeason (or equivalent dict) of team and opponent. Mirrors app.js formFeatures()."""
    def blend(vals, prior, k=K_SHRINK):
        return (sum(vals) + k * prior) / (len(vals) + k)

    def form(vals, prior, n):
        last = vals[-n:]
        return (sum(last) + (n - len(last)) * prior) / n

    f_for = [h[1] for h in ts.hist]; f_ag = [h[2] for h in ts.hist]
    v_for = [h[1] for h in ts.hist if h[0] == is_home]
    o_ag = [h[2] for h in os.hist]; o_for = [h[1] for h in os.hist]
    ov_ag = [h[2] for h in os.hist if h[0] == (1 - is_home)]
    n, on = len(ts.hist), len(os.hist)
    return {
        "is_home": float(is_home),
        "log_s2d_for": _lg(blend(f_for, ts.prev_for)),
        "log_venue_for": _lg(blend(v_for, ts.prev_for)),
        "log_form5_for": _lg(form(f_for, ts.prev_for, 5)),
        "log_form10_for": _lg(form(f_for, ts.prev_for, 10)),
        "log_form15_for": _lg(form(f_for, ts.prev_for, 15)),
        "log_s2d_ag": _lg(blend(f_ag, ts.prev_ag)),
        "log_opp_s2d_ag": _lg(blend(o_ag, os.prev_ag)),
        "log_opp_venue_ag": _lg(blend(ov_ag, os.prev_ag)),
        "log_opp_form5_ag": _lg(form(o_ag, os.prev_ag, 5)),
        "log_opp_s2d_for": _lg(blend(o_for, os.prev_for)),
        "entered_w": ts.entered * K_SHRINK / (n + K_SHRINK),
        "opp_entered_w": os.entered * K_SHRINK / (on + K_SHRINK),
        "rest": min(max(rest_days, 2), 21) / 7.0,
        "opener": float(n == 0),
    }


def build(matches, h_col, a_col):
    """Return (rows, snapshots).

    rows: one row per team per match with pre-match features, league level L and target.
    snapshots: {season: {"as_of", "league_mean", "teams": {team: state}, "last_date": {...}}}
               state after the last match of each season (used for future predictions).
    """
    rows, snapshots = [], {}
    last_date = {}
    prev = None    # (season, league mean, {team: (for_rel_mean, ag_rel_mean)})
    for comp, cm in matches.groupby("competition"):
        prev = None
        for season in sorted(cm.season.unique()):
            sm = cm[(cm.season == season) & cm[h_col].notna() & cm[a_col].notna()].sort_values(["date", "kickoff"])
            consecutive = prev is not None and int(season[:4]) - int(prev[0][:4]) == 1
            warmup = not consecutive
            L_prev = prev[1] if consecutive else None
            teams = sorted(set(sm.home_id) | set(sm.away_id))
            st = {}
            for t in teams:
                if consecutive and t in prev[2]:
                    st[t] = TeamSeason(prev[2][t][0], prev[2][t][1], 0)
                elif consecutive:
                    st[t] = TeamSeason(1.0, 1.0, 1)
                else:
                    st[t] = TeamSeason()
            s_sum, s_n = 0.0, 0
            for r in sm.itertuples(index=False):
                L = (s_sum + L_PRIOR_OBS * L_prev) / (s_n + L_PRIOR_OBS) if L_prev else (s_sum / s_n if s_n else np.nan)
                yh, ya = getattr(r, h_col), getattr(r, a_col)
                for team, opp, is_home, y in ((r.home_id, r.away_id, 1, yh), (r.away_id, r.home_id, 0, ya)):
                    rest = (r.date - last_date[team]).days if team in last_date else 21
                    f = features_from_state(st[team], st[opp], is_home, rest)
                    f.update({"date": r.date, "season": season, "competition": comp, "team": team, "opp": opp,
                              "match_id": r.match_id, "L": L, "y": float(y), "warmup": warmup or not np.isfinite(L)})
                    rows.append(f)
                Lu = L if np.isfinite(L) else max((yh + ya) / 2, 0.1)
                st[r.home_id].hist.append((1, yh / Lu, ya / Lu))
                st[r.away_id].hist.append((0, ya / Lu, yh / Lu))
                last_date[r.home_id] = last_date[r.away_id] = r.date
                s_sum += yh + ya; s_n += 2
            L_end = (s_sum + L_PRIOR_OBS * L_prev) / (s_n + L_PRIOR_OBS) if L_prev else s_sum / max(s_n, 1)
            snapshots[(comp, season)] = {
                "as_of": sm.date.max(), "league_mean": L_end, "league_mean_prev": L_prev, "n_obs": s_n,
                "teams": {t: st[t] for t in teams}, "last_date": {t: last_date[t] for t in teams},
            }
            # previous-season levels for next season (season means, recentred to league = 1)
            lv = {}
            for t in teams:
                h = st[t].hist
                if h:
                    lv[t] = (float(np.mean([x[1] for x in h])), float(np.mean([x[2] for x in h])))
            prev = (season, s_sum / max(s_n, 1), lv)
    return pd.DataFrame(rows), snapshots


@dataclass
class FormFit:
    mean: np.ndarray
    scale: np.ndarray
    coef: np.ndarray
    intercept: float
    n_train: int
    seasons: list

    def predict(self, F, L):
        Z = (np.asarray(F, float) - self.mean) / self.scale
        return np.asarray(L, float) * np.exp(self.intercept + Z @ self.coef)


def fit(rows, before, window="all", alpha=1e-3):
    d = rows[(rows.date < before) & ~rows.warmup]
    if window != "all":
        seasons = sorted(d.season.unique())[-int(window):]
        d = d[d.season.isin(seasons)]
    if len(d) < 200:
        return None
    F = d[FEATURES].to_numpy(float)
    mean, scale = F.mean(0), F.std(0)
    scale[scale < 1e-9] = 1.0
    Z = (F - mean) / scale
    L = d.L.to_numpy(float)
    m = PoissonRegressor(alpha=alpha, max_iter=500).fit(Z, d.y.to_numpy(float) / L, sample_weight=L)
    return FormFit(mean, scale, m.coef_, float(m.intercept_), int(len(d)), sorted(d.season.unique()))
