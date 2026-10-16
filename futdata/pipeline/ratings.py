"""Time-decayed, season-aware Poisson team-ratings model for any count statistic.

For a statistic X (goals, shots, corners, ...):
    log E[X_home] = mu + home + att[home_team] + dfn[away_team]
    log E[X_away] = mu +        att[away_team] + dfn[home_team]
'att' is a team's tendency to produce X, 'dfn' its tendency to allow the opponent X.

Match weights:  0.5 ** (days_before_asof / half_life) * season_discount ** seasons_back
so information from earlier seasons is discounted across every season boundary (squad
turnover) on top of the smooth time decay.

Team parameters have Gaussian priors (penalized likelihood = MAP).  Established teams are
shrunk toward the league average (0).  Teams that *entered* the competition in the target
season use an empirical prior estimated from how earlier entrants performed in their first
season (hierarchical: entrants are treated as a group).  The posterior covariance (inverse
Hessian) gives parameter uncertainty, which widens predictions for sparsely observed teams.
"""
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

WEAK_SD = 10.0


@dataclass
class RatingsConfig:
    half_life_days: float = 240.0
    season_discount: float = 0.7
    prior_sd: float = 0.3


@dataclass
class RatingsFit:
    teams: list
    theta: np.ndarray
    cov: np.ndarray
    as_of: pd.Timestamp
    config: RatingsConfig
    eff_matches: dict = field(default_factory=dict)
    prior_used: dict = field(default_factory=dict)
    eff_by_season: dict = field(default_factory=dict)
    n_by_season: dict = field(default_factory=dict)

    def idx(self, team):
        return self.teams.index(team)

    def eta(self, home, away):
        """Mean and covariance of (log lambda_home, log lambda_away)."""
        T = len(self.teams)
        xh = np.zeros(len(self.theta)); xa = np.zeros(len(self.theta))
        xh[0] = 1; xh[1] = 1; xh[2 + self.idx(home)] = 1; xh[2 + T + self.idx(away)] = 1
        xa[0] = 1; xa[2 + self.idx(away)] = 1; xa[2 + T + self.idx(home)] = 1
        X = np.vstack([xh, xa])
        return X @ self.theta, X @ self.cov @ X.T

    def expected(self, home, away):
        m, S = self.eta(home, away)
        return np.exp(m + 0.5 * np.diag(S))


def season_index(season):
    return int(season[:4])


def weights(dates, seasons, as_of, target_season, cfg):
    days = (as_of - dates).dt.days.clip(lower=0).to_numpy(float)
    back = (season_index(target_season) - seasons.map(season_index)).clip(lower=0).to_numpy(float)
    return 0.5 ** (days / cfg.half_life_days) * cfg.season_discount ** back


def fit(train, h_col, a_col, as_of, target_season, cfg, extra_teams=(), team_priors=None, max_iter=30):
    """train: matches strictly before as_of with columns home_id, away_id, date, season, h_col, a_col."""
    team_priors = team_priors or {}
    d = train[train[h_col].notna() & train[a_col].notna()]
    teams = sorted(set(d.home_id) | set(d.away_id) | set(extra_teams))
    T = len(teams)
    ix = {t: i for i, t in enumerate(teams)}
    w = weights(d.date, d.season, as_of, target_season, cfg)
    n = len(d)
    hi = d.home_id.map(ix).to_numpy(); ai = d.away_id.map(ix).to_numpy()
    y = np.concatenate([d[h_col].to_numpy(float), d[a_col].to_numpy(float)])
    W = np.concatenate([w, w])
    rows = np.arange(2 * n)
    # sparse-ish design built densely (p is small)
    p = 2 + 2 * T
    X = np.zeros((2 * n, p))
    X[:, 0] = 1
    X[:n, 1] = 1
    X[rows[:n], 2 + hi] = 1; X[rows[:n], 2 + T + ai] = 1
    X[rows[n:], 2 + ai] = 1; X[rows[n:], 2 + T + hi] = 1

    prior_mean = np.zeros(p); prior_prec = np.full(p, 1 / cfg.prior_sd ** 2)
    prior_prec[:2] = 1 / WEAK_SD ** 2
    prior_used = {}
    for t in teams:
        if t in team_priors:
            pm = team_priors[t]
            prior_mean[2 + ix[t]] = pm["att"]; prior_mean[2 + T + ix[t]] = pm["dfn"]
            prior_prec[2 + ix[t]] = 1 / pm["sd_att"] ** 2; prior_prec[2 + T + ix[t]] = 1 / pm["sd_dfn"] ** 2
            prior_used[t] = pm.get("source", "custom")
        else:
            prior_used[t] = "league_average"

    ybar = (W @ y) / max(W.sum(), 1e-9) if W.sum() > 0 else 1.0
    theta = prior_mean.copy(); theta[0] = np.log(max(ybar, 1e-3))

    def objective(th):
        eta = X @ th
        return -(W @ (y * eta - np.exp(eta))) + 0.5 * np.sum(prior_prec * (th - prior_mean) ** 2)

    obj = objective(theta)
    for _ in range(max_iter):
        lam = np.exp(X @ theta)
        g = X.T @ (W * (y - lam)) - prior_prec * (theta - prior_mean)
        H = (X * (W * lam)[:, None]).T @ X + np.diag(prior_prec)
        step = np.linalg.solve(H, g)
        t = 1.0
        while True:
            cand = theta + t * step
            new = objective(cand)
            if new <= obj + 1e-10 or t < 1e-4:
                break
            t /= 2
        theta, conv = cand, abs(obj - new) < 1e-8 * (1 + abs(obj))
        obj = new
        if conv:
            break
    lam = np.exp(X @ theta)
    H = (X * (W * lam)[:, None]).T @ X + np.diag(prior_prec)
    cov = np.linalg.inv(H)
    eff = {t: float(w[(hi == ix[t]) | (ai == ix[t])].sum()) for t in teams}
    seas = d.season.to_numpy()
    eff_s, n_s = {}, {}
    for t in teams:
        mask = (hi == ix[t]) | (ai == ix[t])
        eff_s[t] = {s: float(w[mask & (seas == s)].sum()) for s in np.unique(seas[mask])}
        n_s[t] = {s: int((mask & (seas == s)).sum()) for s in np.unique(seas[mask])}
    return RatingsFit(teams, theta, cov, as_of, cfg, eff, prior_used, eff_s, n_s)


def entrant_prior(matches, h_col, a_col, part, before_season, min_teams=3):
    """Empirical prior for teams entering the competition, from earlier seasons only.

    For each earlier season, fit that season alone and collect the ratings of teams whose
    status was 'entered'.  Returns mean and spread, or None if too few entrants exist.
    """
    rows = []
    entered = part[(part.status == "entered") & (part.season.map(season_index) < season_index(before_season))]
    for season, g in entered.groupby("season"):
        d = matches[matches.season == season]
        if d[h_col].notna().sum() < 50:
            continue
        f = fit(d, h_col, a_col, d.date.max() + pd.Timedelta(days=1), season,
                RatingsConfig(half_life_days=1e9, season_discount=1.0, prior_sd=1.0))
        T = len(f.teams)
        for t in g.team_id:
            if t in f.teams:
                i = f.idx(t)
                rows.append({"season": season, "team": t, "att": f.theta[2 + i], "dfn": f.theta[2 + T + i]})
    if len(rows) < min_teams:
        return None
    r = pd.DataFrame(rows)
    return {"att": float(r.att.mean()), "dfn": float(r.dfn.mean()),
            "sd_att": float(max(r.att.std(ddof=1), 0.1)), "sd_dfn": float(max(r.dfn.std(ddof=1), 0.1)),
            "n_teams": int(len(r)), "seasons": sorted(r.season.unique().tolist()), "source": "empirical_entrant_prior",
            "members": r.round(4).to_dict("records")}


def fallback_entrant_prior(cfg):
    """No earlier entrants to learn from: centre on the league average but with doubled
    uncertainty, and say so in the UI."""
    sd = 2 * cfg.prior_sd
    return {"att": 0.0, "dfn": 0.0, "sd_att": sd, "sd_dfn": sd, "n_teams": 0, "seasons": [],
            "source": "conservative_league_average"}


def baseline_rates(train, h_col, a_col, as_of, target_season, cfg):
    """League-average home/away rates (no team information), same weighting."""
    d = train[train[h_col].notna() & train[a_col].notna()]
    w = weights(d.date, d.season, as_of, target_season, cfg)
    return float(w @ d[h_col].to_numpy(float) / w.sum()), float(w @ d[a_col].to_numpy(float) / w.sum())
