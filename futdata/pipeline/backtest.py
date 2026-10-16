"""Chronological walk-forward evaluation.

Matches are processed in weekly batches.  Every model is refitted using only matches whose
date is strictly before the first match of the batch, so no information from the batch
or later leaks in.  Hyper-parameters are chosen per target on the validation season(s);
the test seasons are scored once with the chosen settings.
"""
import itertools

import numpy as np
import pandas as pd
from scipy.stats import poisson

from . import form, ratings

MAXG = 10
RNG = np.random.default_rng(7)
RATINGS_GRID = {"half_life_days": [120, 240, 480, 960], "season_discount": [1.0, 0.7, 0.4], "prior_sd": [0.15, 0.3]}
FORM_WINDOWS = ["all", "2"]


def batches(season_matches):
    wk = season_matches.date.dt.to_period("W-SUN")
    for _, g in season_matches.groupby(wk, sort=True):
        yield g.date.min(), g


def entrant_priors_for(m, part, h, a, season, cfg):
    pri = ratings.entrant_prior(m, h, a, part, season)
    if pri is None:
        pri = ratings.fallback_entrant_prior(cfg)
    entrants = part[(part.season == season) & (part.status == "entered")].team_id.tolist()
    return {t: pri for t in entrants}, pri


def score_grid(eta_mean, eta_cov, draws=300):
    """Average independent-Poisson score grid over parameter uncertainty."""
    if draws:
        s = RNG.multivariate_normal(eta_mean, eta_cov, size=draws, method="cholesky")
        lh, la = np.exp(s[:, 0]), np.exp(s[:, 1])
    else:
        lh, la = np.array([np.exp(eta_mean[0])]), np.array([np.exp(eta_mean[1])])
    g = np.arange(MAXG + 1)
    ph = poisson.pmf(g[None, :], lh[:, None]); pa = poisson.pmf(g[None, :], la[:, None])
    grid = np.einsum("ni,nj->ij", ph, pa) / len(lh)
    return grid / grid.sum()


def outcome_probs(grid):
    return np.array([np.tril(grid, -1).sum(), np.trace(grid), np.triu(grid, 1).sum()])   # H, D, A


def run_target(m, part, stem, h, a, seasons, rcfg, form_rows, form_window, with_probs=False):
    out = []
    for season in seasons:
        sm = m[(m.season == season) & m[h].notna() & m[a].notna()]
        priors, _ = entrant_priors_for(m, part, h, a, season, rcfg)
        participants = part[part.season == season].team_id.tolist()
        for as_of, g in batches(sm):
            train = m[m.date < as_of]
            rf = ratings.fit(train, h, a, as_of, season, rcfg, participants, priors)
            bh, ba = ratings.baseline_rates(train, h, a, as_of, season, rcfg)
            ff = form.fit(form_rows, as_of, form_window) if form_rows is not None else None
            fr = form_rows[form_rows.match_id.isin(g.match_id)] if ff is not None else None
            for r in g.itertuples(index=False):
                em, ec = rf.eta(r.home_id, r.away_id)
                lam_r = np.exp(em + 0.5 * np.diag(ec))
                rec = {"season": season, "date": r.date, "match_id": r.match_id, "home": r.home_id, "away": r.away_id,
                       "y_h": getattr(r, h), "y_a": getattr(r, a),
                       "ratings_h": lam_r[0], "ratings_a": lam_r[1], "baseline_h": bh, "baseline_a": ba,
                       "eff_h": rf.eff_matches.get(r.home_id, 0.0), "eff_a": rf.eff_matches.get(r.away_id, 0.0)}
                if ff is not None:
                    x = fr[fr.match_id == r.match_id].set_index("team")
                    lam = ff.predict(x.loc[[r.home_id, r.away_id], form.FEATURES], x.loc[[r.home_id, r.away_id], "L"])
                    rec["form_h"], rec["form_a"] = lam
                if with_probs:
                    rec["p_ratings"] = outcome_probs(score_grid(em, ec))
                    rec["p_baseline"] = outcome_probs(score_grid(np.log([bh, ba]), None, draws=0))
                    if ff is not None:
                        rec["p_form"] = outcome_probs(score_grid(np.log(lam), None, draws=0))
                    rec["grid_ratings_over25"] = 1 - _under(score_grid(em, ec), 2.5)
                    for mdl in ("baseline", "form"):
                        if f"p_{mdl}" in rec:
                            lh, la = (bh, ba) if mdl == "baseline" else lam
                            rec[f"grid_{mdl}_over25"] = 1 - _under(score_grid(np.log([lh, la]), None, draws=0), 2.5)
                    rec["p_market"] = _market(r)
                    rec["market_over25"] = _market_ou(r)
                out.append(rec)
    return pd.DataFrame(out)


def _under(grid, line):
    i, j = np.indices(grid.shape)
    return grid[(i + j) < line].sum()


def _market(r):
    o = np.array([getattr(r, "mkt_avg_odds_home", np.nan), getattr(r, "mkt_avg_odds_draw", np.nan), getattr(r, "mkt_avg_odds_away", np.nan)], float)
    if not np.all(np.isfinite(o)) or np.any(o <= 1):
        return None
    p = 1 / o
    return p / p.sum()


def _market_ou(r):
    o, u = getattr(r, "mkt_avg_odds_over25", np.nan), getattr(r, "mkt_avg_odds_under25", np.nan)
    if not (np.isfinite(o) and np.isfinite(u)) or o <= 1 or u <= 1:
        return None
    return (1 / o) / (1 / o + 1 / u)


def poisson_dev(y, mu):
    y = np.asarray(y, float); mu = np.maximum(np.asarray(mu, float), 1e-9)
    t = np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / mu), 0.0)
    return float(np.mean(2 * (t - (y - mu))))


def count_metrics(df, model):
    y = np.concatenate([df.y_h, df.y_a]); mu = np.concatenate([df[f"{model}_h"], df[f"{model}_a"]])
    tot, tmu = df.y_h + df.y_a, df[f"{model}_h"] + df[f"{model}_a"]
    return {"poisson_deviance": poisson_dev(y, mu), "mae_side": float(np.mean(np.abs(y - mu))),
            "mae_total": float(np.mean(np.abs(tot - tmu))), "bias_total": float(np.mean(tmu - tot)), "n_matches": int(len(df))}


def outcome_metrics(df, col):
    d = df[df[col].notna()]
    if d.empty:
        return None
    P = np.vstack(d[col].to_numpy())
    res = np.select([d.y_h > d.y_a, d.y_h == d.y_a], [0, 1], 2)
    Y = np.eye(3)[res]
    ll = float(-np.mean(np.log(np.clip(P[np.arange(len(P)), res], 1e-12, 1))))
    brier = float(np.mean(np.sum((P - Y) ** 2, 1)))
    cp, cy = np.cumsum(P, 1)[:, :2], np.cumsum(Y, 1)[:, :2]
    rps = float(np.mean(np.sum((cp - cy) ** 2, 1) / 2))
    acc = float(np.mean(P.argmax(1) == res))
    return {"log_loss": ll, "brier": brier, "rps": rps, "accuracy": acc, "n_matches": int(len(d))}


def binary_metrics(df, col):
    d = df[df[col].notna()]
    if d.empty:
        return None
    p = d[col].astype(float).clip(1e-9, 1 - 1e-9).to_numpy()
    y = ((d.y_h + d.y_a) > 2.5).to_numpy(float)
    return {"log_loss": float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))), "brier": float(np.mean((p - y) ** 2)), "n_matches": int(len(d))}


def nb_dispersion(df, model="ratings"):
    """Method-of-moments NB size k:  Var = mu + mu^2 / k.  None -> Poisson is adequate."""
    y = np.concatenate([df.y_h, df.y_a]); mu = np.concatenate([df[f"{model}_h"], df[f"{model}_a"]])
    excess = np.sum((y - mu) ** 2 - mu)
    if excess <= 0:
        return None
    return float(np.sum(mu ** 2) / excess)


def interval_coverage(df, model, k, q=(0.1, 0.9)):
    from scipy.stats import nbinom
    y = np.concatenate([df.y_h, df.y_a]); mu = np.concatenate([df[f"{model}_h"], df[f"{model}_a"]])
    if k is None:
        lo, hi = poisson.ppf(q[0], mu), poisson.ppf(q[1], mu)
    else:
        p = k / (k + mu)
        lo, hi = nbinom.ppf(q[0], k, p), nbinom.ppf(q[1], k, p)
    return float(np.mean((y >= lo) & (y <= hi)))


def tune_ratings(m, part, stem, h, a, val_seasons):
    results = []
    for hl, sd, ps in itertools.product(*RATINGS_GRID.values()):
        cfg = ratings.RatingsConfig(hl, sd, ps)
        df = run_target(m, part, stem, h, a, val_seasons, cfg, None, None)
        results.append({"half_life_days": hl, "season_discount": sd, "prior_sd": ps,
                        "val_deviance": count_metrics(df, "ratings")["poisson_deviance"]})
    res = pd.DataFrame(results).sort_values("val_deviance")
    best = res.iloc[0]
    return ratings.RatingsConfig(float(best.half_life_days), float(best.season_discount), float(best.prior_sd)), res


def tune_form(form_rows, m, part, stem, h, a, val_seasons, rcfg):
    res = []
    for w in FORM_WINDOWS:
        df = run_target(m, part, stem, h, a, val_seasons, rcfg, form_rows, w)
        if "form_h" in df:
            res.append({"window": w, "val_deviance": count_metrics(df.dropna(subset=["form_h"]), "form")["poisson_deviance"]})
    res = pd.DataFrame(res).sort_values("val_deviance")
    return res.iloc[0].window, res
