/* LaLiga Match Lab — model math (FM). The interface lives in ui.js. Predictions are computed from model parameters
   exported by pipeline/build.py (app/data.js). The FM namespace mirrors the Python
   model code and is unit-tested against it (tests/test_pipeline.py). */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------- model math
  const FM = {};

  FM.tri = (i, j) => (i >= j ? (i * (i + 1)) / 2 + j : (j * (j + 1)) / 2 + i);

  /** Mean and covariance of (log λ_home, log λ_away) from a ratings snapshot. */
  FM.ratingsEta = function (snap, home, away) {
    const T = snap.teams.length;
    const ih = snap.teams.indexOf(home), ia = snap.teams.indexOf(away);
    if (ih < 0 || ia < 0) return null;
    const xh = [0, 1, 2 + ih, 2 + T + ia], xa = [0, 2 + ia, 2 + T + ih];
    const th = snap.theta, C = snap.cov_lower;
    const q = (u, v) => { let s = 0; for (const i of u) for (const j of v) s += C[FM.tri(i, j)]; return s; };
    const mh = xh.reduce((s, i) => s + th[i], 0), ma = xa.reduce((s, i) => s + th[i], 0);
    return { m: [mh, ma], S: [[q(xh, xh), q(xh, xa)], [q(xh, xa), q(xa, xa)]] };
  };

  const lg = (x) => Math.log(Math.max(x, 0.05));

  /** Mirrors pipeline/form.py features_from_state(), using the compact exported state. */
  FM.formFeatures = function (ts, os, isHome, restDays, K) {
    const blend = (sum, n, prior) => (sum + K * prior) / (n + K);
    const form = (vals, prior, n) => { const last = vals.slice(-n); return (last.reduce((a, b) => a + b, 0) + (n - last.length) * prior) / n; };
    const tv = isHome ? ts.v1 : ts.v0;            // team at this venue
    const ov = isHome ? os.v0 : os.v1;            // opponent at the other venue
    const tFor = ts.last.map((x) => x[0]), oAg = os.last.map((x) => x[1]);
    return {
      is_home: isHome ? 1 : 0,
      log_s2d_for: lg(blend(ts.sf, ts.n, ts.prev_for)),
      log_venue_for: lg(blend(tv[1], tv[0], ts.prev_for)),
      log_form5_for: lg(form(tFor, ts.prev_for, 5)),
      log_form10_for: lg(form(tFor, ts.prev_for, 10)),
      log_form15_for: lg(form(tFor, ts.prev_for, 15)),
      log_s2d_ag: lg(blend(ts.sa, ts.n, ts.prev_ag)),
      log_opp_s2d_ag: lg(blend(os.sa, os.n, os.prev_ag)),
      log_opp_venue_ag: lg(blend(ov[2], ov[0], os.prev_ag)),
      log_opp_form5_ag: lg(form(oAg, os.prev_ag, 5)),
      log_opp_s2d_for: lg(blend(os.sf, os.n, os.prev_for)),
      entered_w: (ts.entered * K) / (ts.n + K),
      opp_entered_w: (os.entered * K) / (os.n + K),
      rest: Math.min(Math.max(restDays, 2), 21) / 7,
      opener: ts.n === 0 ? 1 : 0,
    };
  };

  FM.formLambda = function (fs, team, opp, isHome, restDays) {
    const ts = fs.teams[team], os = fs.teams[opp];
    if (!ts || !os) return null;
    const f = FM.formFeatures(ts, os, isHome, restDays, fs.constants.K);
    let z = fs.intercept;
    fs.features.forEach((name, i) => { z += fs.coef[i] * (f[name] - fs.mean[i]) / fs.scale[i]; });
    return fs.league_mean * Math.exp(z);
  };

  // seeded RNG so a given matchup always shows the same numbers
  FM.rng = function (seedStr) {
    let a = 2166136261;
    for (const c of seedStr) a = Math.imul(a ^ c.charCodeAt(0), 16777619);
    return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  FM.normalPair = function (r) { const u = Math.max(r(), 1e-12), v = r(); const R = Math.sqrt(-2 * Math.log(u)); return [R * Math.cos(2 * Math.PI * v), R * Math.sin(2 * Math.PI * v)]; };

  /** Draws of (λh, λa) integrating over parameter uncertainty (bivariate normal on log scale). */
  FM.lambdaDraws = function (eta, n, seed) {
    const r = FM.rng(seed);
    const [[a, b], [, d]] = eta.S;
    const l11 = Math.sqrt(Math.max(a, 1e-12)), l21 = b / l11, l22 = Math.sqrt(Math.max(d - l21 * l21, 1e-12));
    const out = [];
    for (let i = 0; i < n; i++) { const [z1, z2] = FM.normalPair(r); out.push([Math.exp(eta.m[0] + l11 * z1), Math.exp(eta.m[1] + l21 * z1 + l22 * z2)]); }
    return out;
  };

  /** pmf 0..N of Poisson (k null) or negative binomial with size k. */
  FM.pmf = function (mu, k, N) {
    const p = new Float64Array(N + 1);
    if (!k) { p[0] = Math.exp(-mu); for (let j = 1; j <= N; j++) p[j] = p[j - 1] * mu / j; }
    else { const q = k / (k + mu); p[0] = Math.pow(q, k); for (let j = 1; j <= N; j++) p[j] = p[j - 1] * ((j - 1 + k) / j) * (1 - q); }
    return p;
  };

  /** Mixture distributions for one statistic: home, away, total, and joint grid (small N). */
  FM.distribution = function (draws, k, N, wantGrid) {
    const H = new Float64Array(N + 1), A = new Float64Array(N + 1), Tt = new Float64Array(2 * N + 1);
    const G = wantGrid ? Array.from({ length: N + 1 }, () => new Float64Array(N + 1)) : null;
    for (const [lh, la] of draws) {
      const ph = FM.pmf(lh, k, N), pa = FM.pmf(la, k, N);
      for (let i = 0; i <= N; i++) { H[i] += ph[i]; A[i] += pa[i]; for (let j = 0; j <= N; j++) { const v = ph[i] * pa[j]; Tt[i + j] += v; if (G) G[i][j] += v; } }
    }
    const n = draws.length, norm = (arr) => { let s = 0; for (const v of arr) s += v; return arr.map((v) => v / s); };
    return { H: norm(H), A: norm(A), T: norm(Tt), G: G ? (() => { let s = 0; G.forEach((r) => r.forEach((v) => (s += v))); return G.map((r) => r.map((v) => v / s)); })() : null, n };
  };
  FM.quantile = (pmf, q) => { let c = 0; for (let i = 0; i < pmf.length; i++) { c += pmf[i]; if (c >= q) return i; } return pmf.length - 1; };
  FM.over = (pmf, line) => { let s = 0; for (let i = Math.ceil(line); i < pmf.length; i++) s += pmf[i]; return s; };

  if (typeof module !== "undefined" && module.exports) { module.exports = FM; return; }
  root.FM = FM;
})(typeof window !== "undefined" ? window : globalThis);

