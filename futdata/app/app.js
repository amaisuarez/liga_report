/* LaLiga Match Lab — client. All predictions are computed here from model parameters
   exported by pipeline/build.py (app/data.js). The FM namespace mirrors the Python
   model code and is unit-tested against it (tests/test_parity.py). */
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

if (typeof window !== "undefined") (function () {
  "use strict";
  const D = window.FUTDATA, FM = window.FM;
  const $app = document.getElementById("app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const name = (t) => (D.teams[t] ? D.teams[t].display : t);
  const pct = (x, d = 0) => (x == null ? "–" : (100 * x).toFixed(d) + "%");
  const f2 = (x, d = 2) => (x == null || isNaN(x) ? "–" : Number(x).toFixed(d));
  const store = { get(k, d) { try { const v = localStorage.getItem("ml." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("ml." + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } } };
  const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);
  const seasonsOf = (comp) => D.seasons.filter((s) => s.competition === comp).map((s) => s.season);
  const seasonInfo = (comp, season) => D.seasons.find((s) => s.competition === comp && s.season === season);
  const participants = (comp, season) => D.participation.filter((p) => p.competition === comp && p.season === season);
  const partRow = (comp, season, t) => D.participation.find((p) => p.competition === comp && p.season === season && p.team_id === t);
  const STATUS = {
    continuing: ["Continuing", ""], entered: ["Entered SP1", "warn"], first_in_dataset: ["First season in data", ""],
  };
  const MODEL_LABEL = { ratings: "Team ratings", form: "Form model", baseline: "League baseline" };
  const MI = D.matches.columns.reduce((o, c, i) => ((o[c] = i), o), {});
  const matches = D.matches.rows;

  document.getElementById("asof").textContent = `data to ${D.current.as_of}`;

  // ------------------------------------------------------------------ routing
  const TABS = ["predict", "seasons", "data", "validation"];
  function route() {
    const tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "predict";
    document.querySelectorAll(".tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === tab ? "page" : "false"));
    ({ predict: renderPredict, seasons: renderSeasons, data: renderData, validation: renderValidation })[tab]();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  // ------------------------------------------------------------------ evidence
  function evidence(comp, season, team) {
    const snap = D.models.goals.snapshots[season].ratings;
    const eff = snap.eff_by_season[team] || {}, nby = snap.n_by_season[team] || {};
    const cur = eff[season] || 0;
    let prev = 0; Object.entries(eff).forEach(([s, w]) => { if (s !== season) prev += w; });
    const prior = snap.prior_used[team] || "league_average";
    const sd = prior === "league_average" ? D.models.goals.config.ratings.prior_sd : (snap.entrant_prior ? snap.entrant_prior.sd_att : D.models.goals.config.ratings.prior_sd);
    const base = D.models.goals.snapshots[season].baseline, lam = (base[0] + base[1]) / 2;
    const priorEq = 1 / (sd * sd) / lam;                      // prior precision expressed as weighted matches
    const total = cur + prev + priorEq;
    const dataEff = cur + prev;
    const level = dataEff >= 15 ? ["Extensive evidence", "ok"] : dataEff >= 6 ? ["Moderate evidence", "warn"] : ["Limited evidence", "bad"];
    const shares = { cur: cur / total, prev: prev / total, prior: priorEq / total };
    const basis = shares.cur >= shares.prev && shares.cur >= shares.prior ? `mostly ${season} matches`
      : shares.prev >= shares.prior ? "mostly earlier seasons (time-discounted)" : prior === "empirical_entrant_prior" ? "mostly the prior learned from earlier promoted teams" : "mostly the league-average prior";
    const nCur = nby[season] || 0;
    let nPrev = 0; Object.entries(nby).forEach(([s, n]) => { if (s !== season) nPrev += n; });
    return { cur, prev, priorEq, shares, level, basis, nCur, nPrev, prior, nby, attSe: snap.att_se[team], att: snap.att[team], dfn: snap.dfn[team], inSnap: snap.teams.includes(team) };
  }

  function lastResults(season, team, beforeDate, n = 5) {
    const out = [];
    for (let i = matches.length - 1; i >= 0 && out.length < n; i--) {
      const r = matches[i];
      if (r[MI.season] !== season || (beforeDate && r[MI.date] >= beforeDate)) continue;
      const h = r[MI.home_id] === team, a = r[MI.away_id] === team;
      if (!h && !a) continue;
      const gf = h ? r[MI.home_goals] : r[MI.away_goals], ga = h ? r[MI.away_goals] : r[MI.home_goals];
      out.push({ res: gf > ga ? "W" : gf === ga ? "D" : "L", gf, ga, opp: h ? r[MI.away_id] : r[MI.home_id], home: h, date: r[MI.date] });
    }
    return out.reverse();
  }

  function evidenceCard(comp, season, team, side) {
    const e = evidence(comp, season, team);
    const p = partRow(comp, season, team);
    const ts = D.team_stats[team] || {};
    const seasons = seasonsOf(comp);
    const prevSeason = seasons[seasons.indexOf(season) - 1];
    const cur = ts[season] && ts[season].goals, prv = prevSeason && ts[prevSeason] && ts[prevSeason].goals;
    const lr = lastResults(season, team);
    const chips = [`<span class="chip ${e.level[1]}">${e.level[0]}</span>`];
    if (p) chips.push(`<span class="chip ${STATUS[p.status][1]}">${STATUS[p.status][0]}</span>`);
    else chips.push(`<span class="chip bad">Not in ${esc(season)}</span>`);
    if (e.prior === "empirical_entrant_prior") chips.push(`<span class="chip warn">Promoted-team prior</span>`);
    if (e.prior === "conservative_league_average") chips.push(`<span class="chip bad">Conservative prior</span>`);
    return `<div class="panel stack-s">
      <div class="row" style="justify-content:space-between"><h3 style="color:var(--${side})">${esc(name(team))}</h3><div class="row">${chips.join("")}</div></div>
      <div class="ev" role="img" aria-label="Evidence mix: ${pct(e.shares.cur)} this season, ${pct(e.shares.prev)} earlier seasons, ${pct(e.shares.prior)} prior">
        <div class="cur" style="width:${100 * e.shares.cur}%"></div><div class="prev" style="width:${100 * e.shares.prev}%"></div><div class="pri" style="width:${100 * e.shares.prior}%"></div></div>
      <div class="evlegend"><span><i style="background:var(--ink)"></i>${esc(season)} ${pct(e.shares.cur)}</span><span><i style="background:var(--ink-3)"></i>Earlier seasons ${pct(e.shares.prev)}</span><span><i style="background:var(--warn)"></i>Prior ${pct(e.shares.prior)}</span></div>
      <p class="sub">Rating based on ${esc(e.basis)}. ${e.nCur} match${e.nCur === 1 ? "" : "es"} in ${esc(season)}, ${e.nPrev} in earlier seasons of this dataset${e.nPrev && !e.nCur ? "" : ""}.</p>
      <div class="kv">
        <div><span class="label">Goals for / match</span><b>${cur ? f2(cur[0]) : "–"}</b><span class="sub">${prv ? `${esc(prevSeason)}: ${f2(prv[0])}` : "no previous SP1 season"}</span></div>
        <div><span class="label">Goals against / match</span><b>${cur ? f2(cur[1]) : "–"}</b><span class="sub">${prv ? `${esc(prevSeason)}: ${f2(prv[1])}` : "&nbsp;"}</span></div>
        <div><span class="label">Attack rating</span><b>${e.att == null ? "–" : (e.att >= 0 ? "+" : "") + f2(e.att)}</b><span class="sub">± ${f2(e.attSe)} (log scale)</span></div>
        <div><span class="label">Recent (${esc(season)})</span><span class="form5">${lr.map((x) => `<i class="${x.res}" title="${esc(x.date)} ${x.home ? "v" : "at"} ${esc(name(x.opp))} ${x.gf}-${x.ga}">${x.res}</i>`).join("") || '<span class="sub">no matches</span>'}</span></div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------ predict
  const P = Object.assign({ comp: D.current.competition, season: D.current.season, home: null, away: null, date: null, model: "ratings", hypo: false }, store.get("predict", {}));
  if (!seasonsOf(P.comp).includes(P.season)) { P.comp = D.current.competition; P.season = D.current.season; }

  function defaultDate(season) {
    const info = seasonInfo(P.comp, season);
    let d = addDays(info.last_date, 1);
    if (season === D.current.season) { while (new Date(d + "T12:00:00Z").getUTCDay() !== 6) d = addDays(d, 1); }
    return d;
  }

  function teamOptions(season, hypo) {
    const parts = participants(P.comp, season).map((p) => p.team_id).sort((a, b) => name(a).localeCompare(name(b)));
    const snapTeams = D.models.goals.snapshots[season].ratings.teams;
    const others = hypo ? snapTeams.filter((t) => !parts.includes(t)).sort((a, b) => name(a).localeCompare(name(b))) : [];
    return { parts, others };
  }

  function predictStat(stem, model, season, h, a, dateStr) {
    const M = D.models[stem];
    if (!M || !M.snapshots[season]) return { error: "No model for this season." };
    const S = M.snapshots[season];
    if (model === "ratings") {
      const eta = FM.ratingsEta(S.ratings, h, a);
      if (!eta) return { error: "Team not in the ratings model." };
      const draws = FM.lambdaDraws(eta, stem === "goals" ? 800 : 300, `${stem}|${season}|${h}|${a}`);
      const mean = [Math.exp(eta.m[0] + eta.S[0][0] / 2), Math.exp(eta.m[1] + eta.S[1][1] / 2)];
      return { draws, mean, sd: [Math.sqrt(eta.S[0][0]), Math.sqrt(eta.S[1][1])] };
    }
    if (model === "form") {
      const fs = S.form;
      if (!fs) return { error: `Form model not available for ${season} (warm-up season or too little training data).` };
      if (!fs.teams[h] || !fs.teams[a]) return { error: "Form model needs both teams to have played in this season; use Team ratings for teams outside it." };
      const rest = (t) => (fs.last_date[t] && dateStr ? daysBetween(fs.last_date[t], dateStr) : 21);
      const lh = FM.formLambda(fs, h, a, true, rest(h)), la = FM.formLambda(fs, a, h, false, rest(a));
      return { draws: [[lh, la]], mean: [lh, la], rest: [rest(h), rest(a)] };
    }
    const b = S.baseline;
    return { draws: [[b[0], b[1]]], mean: [b[0], b[1]] };
  }

  function playedBetween(season, h, a) {
    return matches.filter((r) => r[MI.season] === season && ((r[MI.home_id] === h && r[MI.away_id] === a) || (r[MI.home_id] === a && r[MI.away_id] === h)));
  }

  function renderPredict() {
    if (!P.date) P.date = defaultDate(P.season);
    const { parts, others } = teamOptions(P.season, P.hypo);
    if (!P.home || (!parts.includes(P.home) && !others.includes(P.home))) P.home = parts.includes("real-madrid") ? "real-madrid" : parts[0];
    if (!P.away || P.away === P.home || (!parts.includes(P.away) && !others.includes(P.away))) P.away = parts.find((t) => t !== P.home && t === "barcelona") || parts.find((t) => t !== P.home);
    store.set("predict", P);
    const opt = (list, sel) => list.map((t) => `<option value="${esc(t)}"${t === sel ? " selected" : ""}>${esc(name(t))}</option>`).join("");
    const teamSelect = (id, sel) => `<select id="${id}">${`<optgroup label="${esc(P.season)} participants">${opt(parts, sel)}</optgroup>`}${others.length ? `<optgroup label="Not in ${esc(P.season)} (hypothetical)">${opt(others, sel)}</optgroup>` : ""}</select>`;
    const isCurrent = P.season === D.current.season;
    const fixtures = (D.fixtures || []).filter((f) => f.competition === P.comp && f.date && f.date > D.current.as_of);
    const bt = D.backtest.goals && D.backtest.goals.metrics;

    $app.innerHTML = `<div class="stack">
      <div class="stack-s"><h1>Predict a match</h1>
        <p class="lede">Pick two teams and a date. Probabilities come from models trained only on matches played before the latest result in the data, ${esc(D.current.as_of)}.</p></div>
      <div class="grid2">
        <div class="sticky stack">
          <form class="panel stack" id="pf" onsubmit="return false">
            <div class="row" style="gap:10px">
              <div class="field" style="flex:1 1 140px"><label class="label" for="p-comp">Competition</label>
                <select id="p-comp">${Object.keys(D.competitions).map((c) => `<option value="${esc(c)}"${c === P.comp ? " selected" : ""}>${esc(D.competitions[c].name || c)}</option>`).join("")}</select></div>
              <div class="field" style="flex:1 1 110px"><label class="label" for="p-season">Season</label>
                <select id="p-season">${seasonsOf(P.comp).slice().reverse().map((s) => `<option value="${s}"${s === P.season ? " selected" : ""}>${s}${s === D.current.season ? " (current)" : ""}</option>`).join("")}</select></div>
            </div>
            <div class="fieldpair">
              <div class="field"><label class="label" for="p-home">Home</label>${teamSelect("p-home", P.home)}</div>
              <button type="button" class="swap" id="p-swap" aria-label="Swap home and away">⇄</button>
              <div class="field"><label class="label" for="p-away">Away</label>${teamSelect("p-away", P.away)}</div>
            </div>
            <label class="check"><input type="checkbox" id="p-hypo"${P.hypo ? " checked" : ""}> Include teams not in ${esc(P.season)} (labelled hypothetical)</label>
            <div class="row" style="gap:10px">
              <div class="field" style="flex:1 1 140px"><label class="label" for="p-date">Expected date</label><input type="date" id="p-date" value="${esc(P.date)}"></div>
              <div class="field" style="flex:1 1 140px"><label class="label" for="p-model">Model</label>
                <select id="p-model">${["ratings", "form", "baseline"].map((m) => `<option value="${m}"${m === P.model ? " selected" : ""}>${MODEL_LABEL[m]}</option>`).join("")}</select></div>
            </div>
            <p class="sub">${P.model === "ratings" ? "Team strengths with time decay and season discounting. Uncertainty about each team is carried into the probabilities." : P.model === "form" ? "Season-to-date, home/away and last 5/10/15 form, opponent strength and rest days. Does not widen for sparse evidence." : "League-average home and away rates; ignores who is playing. Reference point only."}
            ${bt && bt.test_outcome[P.model] ? ` Test-season 1X2 log loss ${f2(bt.test_outcome[P.model].log_loss, 3)} (market ${f2(bt.test_outcome.market.log_loss, 3)}).` : ""}</p>
          </form>
          <div class="panel stack-s"><h3>Fixture schedule</h3>
            ${fixtures.length ? `<div class="stack-s">${fixtures.slice(0, 12).map((f, i) => `<button type="button" class="btn ghost" data-fx="${i}">${esc(f.date)} · ${esc(name(f.home_id))} v ${esc(name(f.away_id))}</button>`).join("")}</div>`
              : `<p class="sub">No fixture list was imported, so no upcoming fixtures are shown. Set teams and a date above to create a fixture manually. To import one, add a CSV with Div, Date, HomeTeam, AwayTeam to the source folder and rebuild.</p>`}
          </div>
        </div>
        <div class="stack" id="p-out"></div>
      </div></div>`;

    const bind = (id, key, re) => document.getElementById(id).addEventListener("change", (e) => { P[key] = e.target.type === "checkbox" ? e.target.checked : e.target.value; if (re) re(); renderPredict(); });
    bind("p-comp", "comp", () => { P.season = seasonsOf(P.comp).slice(-1)[0]; P.date = null; });
    bind("p-season", "season", () => { P.date = null; });
    bind("p-home", "home"); bind("p-away", "away"); bind("p-hypo", "hypo"); bind("p-date", "date"); bind("p-model", "model");
    document.getElementById("p-swap").addEventListener("click", () => { [P.home, P.away] = [P.away, P.home]; renderPredict(); });
    document.querySelectorAll("[data-fx]").forEach((b) => b.addEventListener("click", () => { const f = fixtures[+b.dataset.fx]; Object.assign(P, { home: f.home_id, away: f.away_id, date: f.date, hypo: false }); renderPredict(); }));
    renderPrediction(isCurrent, parts);
  }

  function renderPrediction(isCurrent, parts) {
    const out = document.getElementById("p-out");
    const { home: h, away: a, season, model, date } = P;
    const notes = [];
    if (h === a) { out.innerHTML = `<div class="notice bad"><b>Choose two different teams.</b></div>`; return; }
    const outside = [h, a].filter((t) => !parts.includes(t));
    const info = seasonInfo(P.comp, season);
    if (!isCurrent) notes.push(["info", `<b>Historical matchup.</b> Uses ratings as they stood after the last ${esc(season)} match (${esc(info.last_date)}). It is not a forecast for a future fixture.`]);
    outside.forEach((t) => {
      const seen = D.participation.filter((p) => p.team_id === t).map((p) => p.season);
      const last = seen.filter((s) => s < season).slice(-1)[0], next = seen.filter((s) => s > season)[0];
      notes.push(["bad", `<b>${esc(name(t))} is not in ${esc(D.competitions[P.comp].name)} ${esc(season)}.</b> ${last ? `Its last season in this division in the data is ${esc(last)}` : `It first appears in ${esc(next)}`}. Its current division is not in the dataset, so this is a hypothetical matchup based on time-discounted SP1 results only.`]);
    });
    if (isCurrent && date && date <= D.current.as_of) notes.push(["warn", `This date is on or before the latest result (${esc(D.current.as_of)}). The prediction still uses only data available up to then.`]);
    if (date) { const y = +season.slice(0, 4); if (date < `${y}-07-01` || date > `${y + 1}-06-30`) notes.push(["warn", `${esc(date)} is outside the ${esc(season)} season window.`]); }
    const played = playedBetween(season, h, a);
    const fwd = played.filter((r) => r[MI.home_id] === h);
    if (fwd.length) notes.push(["info", `<b>Already played in ${esc(season)}:</b> ${fwd.map((r) => `${esc(r[MI.date])}, ${esc(name(h))} ${r[MI.home_goals]}–${r[MI.away_goals]} ${esc(name(a))}`).join("; ")}.`]);

    const g = predictStat("goals", model, season, h, a, date);
    if (g.error) { out.innerHTML = notes.map(([k, t]) => `<div class="notice ${k}">${t}</div>`).join("") + `<div class="notice bad">${esc(g.error)}</div>`; return; }
    const kGoals = D.models.goals.nb_size;
    const dist = FM.distribution(g.draws, kGoals, 10, true);
    let pH = 0, pD = 0, pA = 0; const cells = [];
    dist.G.forEach((row, i) => row.forEach((v, j) => { if (i > j) pH += v; else if (i === j) pD += v; else pA += v; cells.push([i, j, v]); }));
    cells.sort((x, y) => y[2] - x[2]);
    const btts = 1 - dist.H[0] - dist.A[0] + dist.G[0][0];
    const e1 = evidence(P.comp, season, h), e2 = evidence(P.comp, season, a);
    const weak = [e1, e2].some((e) => e.level[1] === "bad");
    if (weak && model !== "ratings") notes.push(["warn", `One team has limited evidence. The ${MODEL_LABEL[model]} does not widen its probabilities for this, so treat them with more caution than usual, or switch to Team ratings.`]);
    if (weak && model === "ratings") notes.push(["warn", `One team has limited evidence. Its rating is uncertain, and the probabilities below are flatter as a result.`]);

    const statRows = ["shots", "sot", "corners", "fouls", "yellows", "reds", "ht_goals"].filter((s) => D.models[s]).map((s) => {
      const r = predictStat(s, model, season, h, a, date);
      if (r.error) return `<tr><td>${esc(D.models[s].label)}</td><td colspan="4" class="sub">${esc(r.error)}</td></tr>`;
      const N = Math.ceil((r.mean[0] + r.mean[1]) * 2.5 + 12);
      const d = FM.distribution(r.draws, D.models[s].nb_size, N, false);
      const tot = r.mean[0] + r.mean[1];
      const line = Math.floor(tot) + 0.5;
      const bm = D.backtest[s] && D.backtest[s].metrics.test_overall;
      const noSkill = bm && model !== "baseline" && bm[model].poisson_deviance >= bm.baseline.poisson_deviance * 0.995;
      return `<tr><td>${esc(D.models[s].label)}${noSkill ? ' <span class="chip warn" title="In held-out seasons this model was no better than the league average for this statistic">no better than average</span>' : ""}</td><td class="n"><span class="home">${f2(r.mean[0], 1)}</span></td><td class="n"><span class="away">${f2(r.mean[1], 1)}</span></td>
        <td class="n">${FM.quantile(d.T, 0.1)}–${FM.quantile(d.T, 0.9)}</td><td class="n">${pct(FM.over(d.T, line))} <span class="sub">o${line}</span></td></tr>`;
    }).join("");
    const unmodelled = Object.entries(D.targets).filter(([, t]) => !t.eligible).map(([, t]) => t.label);

    out.innerHTML = `${notes.map(([k, t]) => `<div class="notice ${k}">${t}</div>`).join("")}
      <div class="panel stack">
        <div class="row" style="justify-content:space-between"><span class="label">${esc(MODEL_LABEL[model])} · ${esc(season)}${date ? " · " + esc(date) : ""}</span>${outside.length ? '<span class="chip bad">Hypothetical</span>' : !isCurrent ? '<span class="chip">Historical</span>' : ""}</div>
        <div class="board"><div class="team h">${esc(name(h))}</div>
          <div class="xg" aria-label="Expected goals"><span>${f2(g.mean[0])}</span><span class="sep">:</span><span>${f2(g.mean[1])}</span></div>
          <div class="team a">${esc(name(a))}</div></div>
        <p class="sub" style="text-align:center;max-width:none">expected goals from the model</p>
        <div class="bar" role="img" aria-label="Home ${pct(pH)}, draw ${pct(pD)}, away ${pct(pA)}">
          <div class="H" style="flex-basis:${100 * pH}%">${pH > 0.08 ? pct(pH) : ""}</div><div class="D" style="flex-basis:${100 * pD}%">${pD > 0.08 ? pct(pD) : ""}</div><div class="A" style="flex-basis:${100 * pA}%">${pA > 0.08 ? pct(pA) : ""}</div></div>
        <div class="barlegend"><div>Home win ${pct(pH, 1)}</div><div>Draw ${pct(pD, 1)}</div><div>Away win ${pct(pA, 1)}</div></div>
        <div class="kv">
          <div><span class="label">Over 1.5 goals</span><b>${pct(FM.over(dist.T, 1.5))}</b></div>
          <div><span class="label">Over 2.5 goals</span><b>${pct(FM.over(dist.T, 2.5))}</b></div>
          <div><span class="label">Over 3.5 goals</span><b>${pct(FM.over(dist.T, 3.5))}</b></div>
          <div><span class="label">Both teams score</span><b>${pct(btts)}</b></div>
          <div><span class="label">Fair odds 1 · X · 2</span><b>${f2(1 / pH)} · ${f2(1 / pD)} · ${f2(1 / pA)}</b></div>
        </div>
        <div class="stack-s"><span class="label">Most likely scores</span>
          <div class="scores">${cells.slice(0, 8).map(([i, j, v]) => `<div class="score"><b>${i}–${j}</b><span>${pct(v, 1)}</span></div>`).join("")}</div></div>
      </div>
      <div class="panel stack-s"><h3>Match statistics</h3>
        <div class="tablewrap"><table><thead><tr><th>Statistic</th><th class="n">${esc(name(h))}</th><th class="n">${esc(name(a))}</th><th class="n">80% range total</th><th class="n">P(over)</th></tr></thead><tbody>${statRows}</tbody></table></div>
        <p class="foot">Expected counts per team. Ranges use a negative-binomial spread estimated from backtest errors where counts vary more than Poisson. Not predicted: ${esc(unmodelled.join(", "))}. Reasons are listed under Dataset.</p>
      </div>
      <div class="stack-s"><h2>Evidence behind this prediction</h2>
        <p class="sub">Bars split each team's rating between ${esc(season)} matches, earlier seasons after time and season discounting, and the prior it starts from.</p></div>
      ${evidenceCard(P.comp, season, h, "home")}
      ${evidenceCard(P.comp, season, a, "away")}`;
  }

  // ------------------------------------------------------------------ seasons & teams
  const S = Object.assign({ comp: D.current.competition, season: D.current.season, team: null }, store.get("seasons", {}));
  if (!seasonsOf(S.comp).includes(S.season)) S.season = D.current.season;

  function renderSeasons() {
    store.set("seasons", S);
    const info = seasonInfo(S.comp, S.season);
    const seasons = seasonsOf(S.comp);
    const parts = participants(S.comp, S.season);
    const table = D.tables[S.season] || [];
    const pos = Object.fromEntries(table.map((r) => [r.team, r]));
    const entered = parts.filter((p) => p.status === "entered"), left = parts.filter((p) => p.left_after === true);
    const totalN = (t) => D.participation.filter((p) => p.team_id === t).reduce((s, p) => s + p.matches, 0);
    const notIn = Object.keys(D.teams).filter((t) => !parts.some((p) => p.team_id === t)).sort((a, b) => name(a).localeCompare(name(b)));
    const cov = info.coverage;
    const covChips = Object.entries(cov).filter(([k]) => D.targets[k]).map(([k, v]) => `<span class="chip ${v >= 0.9 ? "ok" : v > 0 ? "warn" : ""}">${esc(D.targets[k].label)} ${pct(v)}</span>`).join("");

    $app.innerHTML = `<div class="stack">
      <div class="stack-s"><h1>Seasons &amp; teams</h1><p class="lede">Who played in each season, who came up or went down, and how much data each team has.</p></div>
      <div class="row">
        <div class="field" style="flex:0 1 260px"><label class="label" for="s-comp">Competition</label><select id="s-comp">${Object.keys(D.competitions).map((c) => `<option value="${esc(c)}"${c === S.comp ? " selected" : ""}>${esc(D.competitions[c].name || c)}</option>`).join("")}</select></div>
        <div class="field" style="flex:0 1 160px"><label class="label" for="s-season">Season</label><select id="s-season">${seasons.slice().reverse().map((s) => `<option${s === S.season ? " selected" : ""}>${s}</option>`).join("")}</select></div>
      </div>
      ${info.state !== "complete" ? `<div class="notice"><b>${esc(S.season)} is in progress:</b> ${info.matches} of ${info.expected_matches_double_round_robin} matches (${pct(info.completeness)}). Tables and averages are season-to-date. Relegation is not yet known.</div>` : ""}
      ${seasons.indexOf(S.season) === 0 ? `<div class="notice info">${esc(S.season)} is the first season in the dataset, so whether each team was promoted into it cannot be established.</div>` : ""}
      <div class="panel stack-s">
        <div class="kv">
          <div><span class="label">Matches</span><b>${info.matches}</b></div><div><span class="label">Teams</span><b>${info.teams}</b></div>
          <div><span class="label">Dates</span><b style="font-size:15px">${esc(info.first_date)} → ${esc(info.last_date)}</b></div>
          <div><span class="label">Source file</span><b style="font-size:15px">${esc(info.files.join(", "))}</b></div>
        </div>
        <span class="label">Statistical coverage</span><div class="row" style="gap:6px">${covChips}</div>
      </div>
      <div class="grid2" style="grid-template-columns:minmax(0,1fr)">
        <div class="row" style="align-items:stretch">
          <div class="panel stack-s" style="flex:1 1 260px"><h3>Entered this season</h3>${entered.length ? entered.map((p) => `<div>${teamBtn(p.team_id)} <span class="sub">${p.prior_seasons_in_comp ? `returning, last SP1 season in data ${esc(p.last_prior_season)}` : "no earlier SP1 season in data"}</span></div>`).join("") : `<p class="sub">${seasons.indexOf(S.season) === 0 ? "Unknown (first season in data)." : "None."}</p>`}
            <p class="foot">Promoted from a lower division. The lower division itself is not in this dataset.</p></div>
          <div class="panel stack-s" style="flex:1 1 260px"><h3>Not in the next season</h3>${left.length ? left.map((p) => `<div>${teamBtn(p.team_id)}</div>`).join("") : `<p class="sub">${S.season === seasons[seasons.length - 1] ? "Not known yet." : "None."}</p>`}
            <p class="foot">Relegated. Their record stays available for historical analysis.</p></div>
        </div>
      </div>
      <div class="stack-s"><h2>${esc(S.season)} participants</h2>
        <div class="tablewrap"><table><thead><tr><th class="n">#</th><th>Team</th><th>Status</th><th class="n">P</th><th class="n">W</th><th class="n">D</th><th class="n">L</th><th class="n">GF</th><th class="n">GA</th><th class="n">Pts</th><th class="n">Matches in data</th></tr></thead><tbody>
        ${parts.slice().sort((x, y) => (pos[x.team_id]?.pos ?? 99) - (pos[y.team_id]?.pos ?? 99)).map((p) => { const r = pos[p.team_id] || {}; return `<tr class="${p.team_id === S.team ? "sel" : ""}"><td class="n">${r.pos ?? ""}</td><td>${teamBtn(p.team_id)}</td>
          <td><span class="chip ${STATUS[p.status][1]}">${STATUS[p.status][0]}</span>${p.left_after ? ' <span class="chip bad">Relegated</span>' : ""}</td>
          <td class="n">${r.p ?? 0}</td><td class="n">${r.w ?? 0}</td><td class="n">${r.d ?? 0}</td><td class="n">${r.l ?? 0}</td><td class="n">${r.gf ?? 0}</td><td class="n">${r.ga ?? 0}</td><td class="n"><b>${r.pts ?? 0}</b></td>
          <td class="n">${totalN(p.team_id)}${totalN(p.team_id) < 20 ? ' <span class="chip bad">small</span>' : ""}</td></tr>`; }).join("")}
        </tbody></table></div></div>
      <div id="profile"></div>
      <div class="stack-s"><h2>Teams not in ${esc(S.season)}</h2><p class="sub">Kept for historical analysis. Select one to see its record.</p>
        <div class="row" style="gap:8px 16px">${notIn.map((t) => { const seen = D.participation.filter((p) => p.team_id === t).map((p) => p.season); return `<span>${teamBtn(t)} <span class="sub">${esc(seen[0])}${seen.length > 1 ? "–" + esc(seen[seen.length - 1]) : ""}</span></span>`; }).join("")}</div></div>
      <div class="stack-s"><h2>Membership across seasons</h2>${membershipMatrix(S.comp)}</div>
    </div>`;
    document.getElementById("s-comp").addEventListener("change", (e) => { S.comp = e.target.value; S.season = seasonsOf(S.comp).slice(-1)[0]; renderSeasons(); });
    document.getElementById("s-season").addEventListener("change", (e) => { S.season = e.target.value; renderSeasons(); });
    document.querySelectorAll("[data-team]").forEach((b) => b.addEventListener("click", () => { S.team = b.dataset.team; renderSeasons(); document.getElementById("profile").scrollIntoView({ block: "start" }); }));
    if (S.team) renderProfile(S.team);
  }
  const teamBtn = (t) => `<button type="button" class="rowbtn" data-team="${esc(t)}">${esc(name(t))}</button>`;

  function membershipMatrix(comp) {
    const seasons = seasonsOf(comp);
    const teams = [...new Set(D.participation.filter((p) => p.competition === comp).map((p) => p.team_id))].sort((a, b) => name(a).localeCompare(name(b)));
    const sym = { continuing: "●", entered: "▲", first_in_dataset: "○" };
    return `<div class="tablewrap"><table class="matrix"><thead><tr><th>Team</th>${seasons.map((s) => `<th class="n">${s}</th>`).join("")}</tr></thead><tbody>
      ${teams.map((t) => `<tr><td>${esc(name(t))}</td>${seasons.map((s) => { const p = partRow(comp, s, t); return p ? `<td class="y" title="${esc(STATUS[p.status][0])}${p.left_after ? ", relegated after" : ""}">${sym[p.status]}${p.left_after ? "▼" : ""}</td>` : `<td class="no">·</td>`; }).join("")}</tr>`).join("")}
      </tbody></table></div><p class="foot">○ first season in data · ● continuing · ▲ entered (promoted or returning) · ▼ not in the next season (relegated)</p>`;
  }

  function renderProfile(t) {
    const el = document.getElementById("profile");
    const seasons = seasonsOf(S.comp);
    const ts = D.team_stats[t] || {};
    const cur = D.models.goals.snapshots[D.current.season].ratings;
    const stemCols = ["goals", "shots", "sot", "corners", "fouls", "yellows", "reds"];
    const recent = matches.filter((r) => r[MI.season] === S.season && (r[MI.home_id] === t || r[MI.away_id] === t));
    el.innerHTML = `<div class="panel stack">
      <div class="row" style="justify-content:space-between"><h2>${esc(name(t))}</h2><button type="button" class="btn ghost" id="pr-close">Close</button></div>
      <p class="sub">Names in the source files: ${esc((D.teams[t].raw_names || []).join(", "))}. Team id <span class="mono">${esc(t)}</span>.</p>
      <div class="timeline">${seasons.map((s) => { const p = partRow(S.comp, s, t); const r = (D.tables[s] || []).find((x) => x.team === t); return `<div class="${p ? "" : "off"}"><span class="label">${s}</span><b>${p ? (r ? r.pos + "th" : "–") : "not in SP1"}</b><span class="sub">${p ? `${p.matches} m${p.status === "entered" ? " · ▲" : ""}${p.left_after ? " · ▼" : ""}` : ""}</span></div>`; }).join("")}</div>
      ${cur.teams.includes(t) ? `<div class="kv"><div><span class="label">Current attack rating</span><b>${(cur.att[t] >= 0 ? "+" : "") + f2(cur.att[t])}</b><span class="sub">± ${f2(cur.att_se[t])}</span></div>
        <div><span class="label">Current defence rating</span><b>${(cur.dfn[t] >= 0 ? "+" : "") + f2(cur.dfn[t])}</b><span class="sub">± ${f2(cur.dfn_se[t])}; higher concedes more</span></div>
        <div><span class="label">Effective matches now</span><b>${f2(cur.eff[t], 1)}</b><span class="sub">after time discounting</span></div></div>` : ""}
      <div class="tablewrap"><table><thead><tr><th>Season</th>${stemCols.map((s) => `<th class="n">${esc(D.targets[s].label)} for / against</th>`).join("")}</tr></thead><tbody>
        ${seasons.filter((s) => ts[s]).map((s) => `<tr><td>${s}</td>${stemCols.map((st) => `<td class="n">${ts[s][st] ? f2(ts[s][st][0]) + " / " + f2(ts[s][st][1]) : "–"}</td>`).join("")}</tr>`).join("")}
      </tbody></table></div>
      ${recent.length ? `<details><summary>${esc(S.season)} matches (${recent.length})</summary><div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>Date</th><th>Match</th><th class="n">Score</th><th class="n">Shots</th><th class="n">On target</th><th class="n">Corners</th></tr></thead><tbody>
        ${recent.map((r) => `<tr><td class="mono">${r[MI.date]}</td><td>${esc(name(r[MI.home_id]))} v ${esc(name(r[MI.away_id]))}</td><td class="n">${r[MI.home_goals]}–${r[MI.away_goals]}</td><td class="n">${r[MI.home_shots]}–${r[MI.away_shots]}</td><td class="n">${r[MI.home_sot] ?? "–"}–${r[MI.away_sot] ?? "–"}</td><td class="n">${r[MI.home_corners]}–${r[MI.away_corners]}</td></tr>`).join("")}
      </tbody></table></div></details>` : `<p class="sub">No matches in ${esc(S.season)}.</p>`}
    </div>`;
    document.getElementById("pr-close").addEventListener("click", () => { S.team = null; renderSeasons(); });
  }

  // ------------------------------------------------------------------ dataset explorer
  const X = { q: "", view: store.get("dataview", "files") };
  function renderData() {
    const views = { files: "Files", targets: "Statistics", columns: "Columns", notes: "notes.txt", quality: "Quality", teams: "Team names" };
    $app.innerHTML = `<div class="stack">
      <div class="stack-s"><h1>Dataset explorer</h1><p class="lede">${D.files.length} CSV files from <span class="mono">${esc(D.source)}</span>, read together with notes.txt. Every original column is kept in output/raw_combined_all_columns.csv.</p></div>
      <div class="seg" role="group" aria-label="Dataset views">${Object.entries(views).map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="${k === X.view}">${v}</button>`).join("")}</div>
      <div id="dv" class="stack"></div></div>`;
    document.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => { X.view = b.dataset.v; X.q = ""; store.set("dataview", X.view); renderData(); }));
    const dv = document.getElementById("dv");
    ({ files: dvFiles, targets: dvTargets, columns: dvColumns, notes: dvNotes, quality: dvQuality, teams: dvTeams })[X.view](dv);
  }

  function dvFiles(el) {
    el.innerHTML = `<div class="tablewrap"><table><thead><tr><th>File</th><th>Competition</th><th>Season</th><th>State</th><th class="n">Rows</th><th class="n">Columns</th><th>Dates</th><th>Encoding</th></tr></thead><tbody>
      ${D.files.map((f) => { const si = D.seasons.find((s) => f.seasons.includes(s.season)); return `<tr><td class="mono">${esc(f.file)}</td><td>${esc(f.competitions.join(", "))}</td><td>${esc(f.seasons.join(", "))}</td><td>${si ? `<span class="chip ${si.state === "complete" ? "ok" : "warn"}">${esc(si.state)}</span>` : ""}</td><td class="n">${f.rows}</td><td class="n">${f.columns}</td><td class="mono">${esc(f.first_date)} → ${esc(f.last_date)}</td><td class="mono">${esc(f.encoding)}</td></tr>`; }).join("")}
      </tbody></table></div>
      <p class="sub">Seasons are worked out from match dates (a season runs July to June), not from file names. Other files found: ${esc(D.other_files.join(", ") || "none")}. Fixture files: ${esc(D.fixture_files.join(", ") || "none")}.</p>
      <h2>Schema differences</h2>${schemaMatrix()}`;
  }

  function schemaMatrix() {
    const files = D.files.map((f) => f.file);
    const rel = Object.entries(D.schema).filter(([c, v]) => v.normalized || v.documentation === "undocumented");
    const varying = Object.values(D.schema).filter((v) => v.files.length !== files.length).length;
    return `<p class="sub">${Object.keys(D.schema).length} distinct columns. ${varying} are missing from at least one file; nearly all of these are bookmaker odds, because the bookmakers listed change from season to season. The table shows the columns used for modelling plus every undocumented column.</p>
      <div class="tablewrap"><table class="matrix"><thead><tr><th>Column</th><th>Normalized as</th>${files.map((f) => `<th class="n">${esc(f)}</th>`).join("")}</tr></thead><tbody>
      ${rel.map(([c, v]) => `<tr><td class="mono">${esc(c)}${v.documentation === "undocumented" ? ' <span class="chip bad">undocumented</span>' : ""}</td><td class="mono">${esc(v.normalized || "kept as original")}</td>${files.map((f) => v.files.includes(f) ? `<td class="y">${v.missing[f] ? v.missing[f] + " missing" : "✓"}</td>` : `<td class="no">absent</td>`).join("")}</tr>`).join("")}
      </tbody></table></div>`;
  }

  function dvTargets(el) {
    const seasons = D.seasons.map((s) => s.season);
    el.innerHTML = `<p class="sub">A season counts for a statistic when at least 90% of its matches record it. Each statistic gets its own model, trained only on seasons where it exists.</p>
      <div class="tablewrap"><table><thead><tr><th>Statistic</th><th>Columns</th><th>Predicted</th>${seasons.map((s) => `<th class="n">${s}</th>`).join("")}<th>Notes</th></tr></thead><tbody>
      ${Object.entries(D.targets).map(([k, t]) => `<tr><td>${esc(t.label)}</td><td class="mono">${esc(t.original_columns.join(", ") || "–")}</td><td>${t.eligible ? '<span class="chip ok">yes</span>' : '<span class="chip">no</span>'}</td>
        ${seasons.map((s) => `<td class="n">${t.coverage[s] ? pct(t.coverage[s]) : "–"}</td>`).join("")}<td class="sub">${esc(t.reason || "")}${t.drift_flags.length ? " Drift flagged: " + esc(t.drift_flags.join(", ")) : ""}</td></tr>`).join("")}
      </tbody></table></div>
      <h2>Season-to-season levels</h2><p class="sub">Average per team per match. z compares one season with all the others. notes.txt records no change in how these are measured for Spain, so movement is treated as a real trend and handled with time-weighting and league-relative features.</p>
      <div class="tablewrap"><table><thead><tr><th>Statistic</th>${seasons.map((s) => `<th class="n">${s}</th>`).join("")}</tr></thead><tbody>
      ${Object.entries(D.quality.drift).map(([k, v]) => `<tr><td>${esc(v.label)}</td>${seasons.map((s) => { const p = v.seasons.find((x) => x.season === s); return `<td class="n">${p ? f2(p.mean) + ` <span class="sub">z ${p.z == null ? "–" : f2(p.z, 1)}</span>` : "–"}</td>`; }).join("")}</tr>`).join("")}
      </tbody></table></div>`;
  }

  function searchBox(id, ph) { return `<input type="search" id="${id}" placeholder="${esc(ph)}" value="${esc(X.q)}" aria-label="${esc(ph)}">`; }
  function bindSearch(id, fn) { const i = document.getElementById(id); i.addEventListener("input", () => { X.q = i.value; fn(); }); }

  function dvColumns(el) {
    const files = D.files.map((f) => f.file);
    const DOC = { documented: ["Listed in notes", "ok"], documented_rule: ["Notes rule (closing odds)", "ok"], inferred_pattern: ["Inferred from pattern", "warn"], undocumented: ["Undocumented", "bad"] };
    el.innerHTML = `${searchBox("cq", "Filter columns, e.g. HST or Pinnacle")}<div id="ct"></div>`;
    const draw = () => {
      const q = X.q.toLowerCase();
      const rows = Object.entries(D.schema).filter(([c, v]) => !q || c.toLowerCase().includes(q) || (v.description || "").toLowerCase().includes(q) || (v.normalized || "").includes(q));
      document.getElementById("ct").innerHTML = `<p class="sub">${rows.length} of ${Object.keys(D.schema).length} columns</p><div class="tablewrap"><table><thead><tr><th>Original</th><th>Normalized</th><th>Documentation</th><th>Meaning</th><th class="n">Files</th></tr></thead><tbody>
        ${rows.map(([c, v]) => `<tr><td class="mono">${esc(c)}</td><td class="mono">${esc(v.normalized || "")}</td><td><span class="chip ${DOC[v.documentation][1]}">${DOC[v.documentation][0]}</span></td><td>${esc(v.description || "Not explained by notes.txt. Kept and flagged.")}</td><td class="n">${v.files.length}/${files.length}</td></tr>`).join("")}
        </tbody></table></div>`;
    };
    draw(); bindSearch("cq", draw);
  }

  function dvNotes(el) {
    const seen = new Set(Object.keys(D.schema));
    el.innerHTML = `<div class="notice info">Columns that notes.txt does not explain: <b>HxG / AxG</b> (current season only; they look like expected goals, but the provider and method are unknown, so they are displayed and not modelled) and <b>SKB*</b> (bookmaker-style odds; notes.txt lists Skybet as SK*, so the code is ambiguous). Notes.txt defines no possession variable, so possession is not predicted.</div>
      ${searchBox("nq", "Search notes.txt variables")}<div id="nt"></div>`;
    const draw = () => {
      const q = X.q.toLowerCase();
      const rows = D.notes.entries.filter((e) => !q || e.code.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
      document.getElementById("nt").innerHTML = `<div class="tablewrap"><table><thead><tr><th>Code</th><th>Meaning (notes.txt)</th><th>Section</th><th>In data</th></tr></thead><tbody>
        ${rows.map((e) => `<tr><td class="mono">${esc(e.code)}</td><td>${esc(e.description)}</td><td class="sub">${esc(e.section.replace(/_/g, " "))}</td><td>${seen.has(e.code) ? '<span class="chip ok">yes</span>' : '<span class="chip">no</span>'}</td></tr>`).join("")}
        </tbody></table></div>`;
    };
    draw(); bindSearch("nq", draw);
  }

  function dvQuality(el) {
    const q = D.quality;
    const counts = {};
    q.issues.forEach((i) => { const k = i.check + "|" + i.severity + "|" + i.decision; counts[k] = (counts[k] || 0) + 1; });
    el.innerHTML = `<div class="kv panel">${D.seasons.map((s) => `<div><span class="label">${s.season}</span><b>${s.matches}</b><span class="sub">${s.state}</span></div>`).join("")}</div>
      <p class="sub">Checks: unreadable dates, duplicate matches, repeated pairings, result vs score, half-time vs full-time, shots on target vs shots, goals vs shots on target, negative and implausible values. Every flagged row is kept or excluded with a stated reason.</p>
      <div class="tablewrap"><table><thead><tr><th>Check</th><th>Severity</th><th class="n">Rows</th><th>Decision</th></tr></thead><tbody>
      ${Object.entries(counts).map(([k, n]) => { const [c, s, d] = k.split("|"); return `<tr><td>${esc(c)}</td><td><span class="chip ${s === "error" ? "bad" : s === "warning" ? "warn" : ""}">${esc(s)}</span></td><td class="n">${n}</td><td>${esc(d)}</td></tr>`; }).join("") || '<tr><td colspan="4">No issues found.</td></tr>'}
      </tbody></table></div>
      <details><summary>Flagged rows (${q.issues.length})</summary><div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>File</th><th class="n">Line</th><th>Date</th><th>Match</th><th>Check</th><th>Values</th></tr></thead><tbody>
      ${q.issues.map((i) => `<tr><td class="mono">${esc(i.file)}</td><td class="n">${i.line}</td><td class="mono">${esc(i.date)}</td><td>${esc(i.match)}</td><td>${esc(i.check)}</td><td class="mono">${esc(Object.entries(i.values).map(([k, v]) => k + "=" + v).join(" "))}</td></tr>`).join("")}
      </tbody></table></div></details>
      <h2>Matches per team</h2><div class="tablewrap"><table><thead><tr><th>Season</th><th class="n">Fewest</th><th class="n">Most</th></tr></thead><tbody>${q.team_counts.map((r) => `<tr><td>${r.season}</td><td class="n">${r.min_matches}</td><td class="n">${r.max_matches}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function dvTeams(el) {
    const pend = D.unknown_team_names.length + D.team_similarity_pending.length;
    el.innerHTML = `${pend ? `<div class="notice bad"><b>${pend} team name${pend > 1 ? "s" : ""} need manual confirmation.</b> They are kept separate until config/teams.json is updated.</div>` : `<div class="notice info">Every team name in the files maps to a confirmed club. Look-alike names such as Ath Madrid and Ath Bilbao are recorded as different clubs in config/teams.json.</div>`}
      ${D.unknown_team_names.map((p) => `<div class="notice">Unknown name <b>${esc(p.raw_name)}</b>, kept as ${esc(p.provisional_id)}. Similar: ${esc(p.similar_known.map((s) => s.alias + " (" + s.score + ")").join(", ") || "none")}.</div>`).join("")}
      ${D.team_similarity_pending.map((p) => `<div class="notice">${esc(p.a)} and ${esc(p.b)} look alike (${p.score}) and are mapped to different teams. Confirm they are different clubs.</div>`).join("")}
      <div class="tablewrap"><table><thead><tr><th>Team id</th><th>Display name</th><th>Names in files</th><th>Known aliases</th><th class="n">Seasons</th></tr></thead><tbody>
      ${Object.entries(D.teams).map(([t, v]) => `<tr><td class="mono">${esc(t)}</td><td>${esc(v.display)}</td><td class="mono">${esc(v.raw_names.join(", "))}</td><td class="sub">${esc(v.aliases.join(", "))}</td><td class="n">${D.participation.filter((p) => p.team_id === t).length}</td></tr>`).join("")}
      </tbody></table></div>`;
  }

  // ------------------------------------------------------------------ validation
  function renderValidation() {
    const B = D.backtest;
    if (!Object.keys(B).length) { $app.innerHTML = `<div class="notice">The backtest has not been run. Rebuild without --fast.</div>`; return; }
    const g = B.goals;
    const mrow = (label, v, extra = "") => v ? `<tr><td>${label}</td><td class="n">${v.n_matches}</td><td class="n">${f2(v.log_loss, 4)}</td><td class="n">${f2(v.brier, 4)}</td><td class="n">${f2(v.rps, 4)}</td><td class="n">${pct(v.accuracy, 1)}</td>${extra}</tr>` : "";
    const order = ["market", "ratings", "form", "baseline"], lab = { ...MODEL_LABEL, market: "Market odds (benchmark)" };
    $app.innerHTML = `<div class="stack">
      <div class="stack-s"><h1>Validation</h1><p class="lede">Each season is replayed week by week. Before every week, the models are refitted on earlier matches only. Settings were chosen on ${esc(g.validation_seasons.join(", "))}. ${esc(g.test_seasons.join(", "))} were held out and scored once.</p></div>
      <div class="panel stack-s"><h2>Match result (1X2)</h2>
        <div class="tablewrap"><table><thead><tr><th>Model · test seasons</th><th class="n">Matches</th><th class="n">Log loss</th><th class="n">Brier</th><th class="n">RPS</th><th class="n">Accuracy</th><th class="n">O/U 2.5 log loss</th></tr></thead><tbody>
        ${order.map((m) => mrow(lab[m], g.metrics.test_outcome[m], `<td class="n">${g.metrics.test_over25[m] ? f2(g.metrics.test_over25[m].log_loss, 4) : "–"}</td>`)).join("")}
        </tbody></table></div>
        <p class="foot">Lower is better for log loss, Brier and RPS. Market odds are the pre-closing market average with the margin removed. They are a benchmark only and are never a model input, since a hypothetical fixture has no odds. ${g.metrics.low_evidence && g.metrics.low_evidence.ratings ? `Matches involving a team with fewer than 8 effective matches: ${g.metrics.low_evidence.n_matches}, ratings log loss ${f2(g.metrics.low_evidence.ratings.log_loss, 4)}${g.metrics.low_evidence.market ? ` vs market ${f2(g.metrics.low_evidence.market.log_loss, 4)}` : ""}.` : ""}</p>
        <details><summary>By season</summary><div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>Season</th><th>Split</th>${order.map((m) => `<th class="n">${esc(lab[m])}</th>`).join("")}</tr></thead><tbody>
        ${Object.entries(g.metrics.by_season).map(([s, v]) => `<tr><td>${s}</td><td>${g.validation_seasons.includes(s) ? "validation" : "test"}</td>${order.map((m) => `<td class="n">${v.outcome[m] ? f2(v.outcome[m].log_loss, 4) : "–"}</td>`).join("")}</tr>`).join("")}
        </tbody></table></div></details>
      </div>
      <div class="stack-s"><h2>Every statistic</h2><p class="sub">Poisson deviance per team per match on the test seasons (lower is better), mean absolute error of the match total, and how often the actual count fell inside the 80% range. Counts are whole numbers and the range includes both ends, so low-count statistics such as goals and cards land above 80% by construction.</p>
        <p class="sub">Card counts depend heavily on the referee, and these files have no referee column. Team-based models barely improve on the league average for yellow cards and do not improve on it for red cards; the prediction screen labels these.</p></div>
      <div class="tablewrap"><table><thead><tr><th>Statistic</th><th>Model</th><th class="n">Deviance</th><th class="n">MAE total</th><th class="n">Bias total</th><th class="n">80% range hit</th><th>Settings chosen</th></tr></thead><tbody>
      ${Object.entries(B).map(([k, b]) => ["ratings", "form", "baseline"].map((m, i) => { const v = b.metrics.test_overall[m]; return `<tr><td>${i ? "" : esc(b.label)}</td><td>${MODEL_LABEL[m]}</td><td class="n">${f2(v.poisson_deviance, 4)}</td><td class="n">${f2(v.mae_total, 2)}</td><td class="n">${(v.bias_total >= 0 ? "+" : "") + f2(v.bias_total, 2)}</td><td class="n">${pct(v.interval80_coverage, 1)}</td>
        <td class="sub">${i === 0 ? `half-life ${b.config.ratings.half_life_days} days, ×${b.config.ratings.season_discount} per season back, prior sd ${b.config.ratings.prior_sd}` : i === 1 ? `training window: ${b.config.form_window === "all" ? "all seasons" : "last " + b.config.form_window + " seasons"}` : ""}</td></tr>`; }).join("")).join("")}
      </tbody></table></div>
      <div class="panel stack-s"><h3>How promoted teams are handled</h3>
        <p>No lower-division data was supplied, so promoted teams cannot be rated from their previous league. They start from a prior learned from how earlier promoted teams did in their first SP1 season.${D.models.goals.snapshots[D.current.season].ratings.entrant_prior ? ` For ${esc(D.current.season)} this prior comes from ${D.models.goals.snapshots[D.current.season].ratings.entrant_prior.n_teams} team-seasons (${esc(D.models.goals.snapshots[D.current.season].ratings.entrant_prior.seasons.join(", "))}): attack ${f2(D.models.goals.snapshots[D.current.season].ratings.entrant_prior.att)}, defence +${f2(D.models.goals.snapshots[D.current.season].ratings.entrant_prior.dfn)} on the log scale.` : ""} Each match they play then moves them away from it. When there are too few earlier promoted teams to learn from, they start at the league average with double the usual uncertainty, and the app says so.</p></div>
      <p class="foot">Built ${esc(D.generated_at)}. Full tables: output/backtest.md. Per-match predictions: output/backtest_predictions.csv.</p>
    </div>`;
  }

  route();
})();
