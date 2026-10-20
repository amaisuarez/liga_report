/* LaLiga Match Lab — interfaz en español. Usa los datos reales de data.js (generado por
   pipeline/build.py) y las funciones de modelo de app.js (FM). Las predicciones guardadas,
   los partidos creados y las preferencias se guardan solo en este navegador (localStorage). */
(function () {
  "use strict";
  const D = window.FUTDATA, FM = window.FM;
  const $ = (id) => document.getElementById(id);
  const $app = $("app");

  // ---------------------------------------------------------------- utilidades
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const NF = {};
  const nf = (x, d = 1) => (x == null || !isFinite(x) ? "–" : (NF[d] || (NF[d] = new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }))).format(x));
  const pc = (x, d = 0) => (x == null || !isFinite(x) ? "–" : nf(100 * x, d) + " %");
  const signed = (x, d = 2) => (x == null ? "–" : (x >= 0 ? "+" : "−") + nf(Math.abs(x), d));
  const fdate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "–");
  const fstamp = (iso) => { try { return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return iso; } };
  const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);
  const store = {
    get(k, d) { try { const v = localStorage.getItem("ml." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("ml." + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem("ml." + k); } catch (e) { /* almacenamiento no disponible */ } },
  };
  let toastTimer;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2800); }

  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/>',
    bars: '<path d="M4 20V11M10 20V5M16 20v-8M21 20H3"/>',
    layers: '<path d="M12 3 2.5 8 12 13l9.5-5z"/><path d="m2.5 13 9.5 5 9.5-5"/>',
    db: '<ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5v13c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8v-13M4 12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5M12 7.5V12l3 2"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/><path d="M12 7V3.5M16 10l3.5-1.5M14.5 14.5l2 3.5M9.5 14.5l-2 3.5M8 10 4.5 8.5"/>',
  };
  const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

  // ---------------------------------------------------------------- textos
  const STAT = {
    goals: "Goles", shots: "Remates totales", sot: "Remates a puerta", corners: "Córneres", fouls: "Faltas cometidas",
    yellows: "Tarjetas amarillas", reds: "Tarjetas rojas", ht_goals: "Goles al descanso", woodwork: "Remates al palo",
    offsides: "Fueras de juego", fk_conceded: "Tiros libres concedidos", booking_pts: "Puntos de amonestación",
    xg_undocumented: "xG (columna sin documentar)", possession: "Posesión",
  };
  const STAT_HELP = {
    goals: "FTHG y FTAG en notes.txt: goles del local y del visitante al final del partido.",
    shots: "HS y AS: remates totales de cada equipo, vayan o no a puerta.",
    sot: "HST y AST: remates a puerta. Los goles en propia puerta no cuentan como remate del equipo que marca.",
    corners: "HC y AC: saques de esquina a favor de cada equipo.",
    fouls: "HF y AF: faltas cometidas. En España se registran las faltas directamente, no los tiros libres concedidos.",
    yellows: "HY y AY: tarjetas amarillas. Según notes.txt, fuera de Inglaterra y Escocia la segunda amarilla que lleva a la roja también cuenta como amarilla.",
    reds: "HR y AR: tarjetas rojas de cada equipo.",
    ht_goals: "HTHG y HTAG: goles de cada equipo al descanso.",
    possession: "notes.txt no define la posesión y ningún CSV la incluye, así que no se puede estimar.",
    xg_undocumented: "HxG y AxG solo aparecen en la temporada actual y notes.txt no los explica. Parecen goles esperados (xG), pero se desconoce el proveedor y el método.",
  };
  const MODEL = {
    auto: { name: "Recomendado", desc: "Para cada estadística usa el modelo que mejor funcionó en las temporadas de prueba." },
    ratings: { name: "Fuerza de equipos", desc: "Estima el ataque y la defensa de cada equipo con todos sus partidos anteriores. Los antiguos pesan menos y la incertidumbre crece cuando hay pocos datos." },
    form: { name: "Forma reciente", desc: "Usa la temporada en curso: últimos 5, 10 y 15 partidos, rendimiento en casa o fuera, nivel del rival y días de descanso." },
    baseline: { name: "Media de la liga", desc: "Promedio de la liga en casa y fuera. No distingue equipos; sirve de referencia." },
    market: { name: "Cuotas del mercado", desc: "Media de las casas de apuestas antes del cierre, sin margen. Solo se usa como comparación." },
  };
  const STATUS = { continuing: ["Continúa", ""], entered: ["Ascendido o regresa", "warn"], first_in_dataset: ["Primera temporada del archivo", ""] };
  const STATE = { complete: ["Completa", "ok"], "partial (in progress)": ["En curso", "warn"] };
  const CHECK = {
    "unparseable date": "Fecha ilegible", "home team equals away team": "Local igual a visitante", "duplicate match (same date and teams)": "Partido duplicado",
    "same home/away pairing twice in one season": "Emparejamiento repetido en la temporada", "FTR inconsistent with goals": "El resultado (FTR) no cuadra con los goles",
    "half-time goals exceed full-time": "Más goles al descanso que al final", "shots on target exceed shots": "Más remates a puerta que remates",
    "goals exceed shots on target": "Más goles que remates a puerta", "negative statistic": "Valor negativo", "implausibly large value": "Valor improbable",
  };
  const DECISION = {
    "kept: consistent with own goals, which are not shots by the scoring side": "Se conserva: lo explican los goles en propia puerta, que no cuentan como remate del equipo que marca.",
    "excluded from modelling": "Se excluye del modelado.", "later copy excluded": "Se excluye la copia posterior.", "kept; verify": "Se conserva; conviene revisarlo.",
    "goals trusted, FTR recomputed": "Se confía en los goles y se recalcula el resultado.", "half-time values excluded": "Se descartan los valores al descanso.",
    "shot values excluded for this match": "Se descartan los remates de este partido.", "value excluded": "Se descarta el valor.",
  };
  const SEVERITY = { error: ["Error", "bad"], warning: ["Aviso", "warn"], info: ["Informativo", ""] };
  const DOCKIND = { documented: ["En notes.txt", "ok"], documented_rule: ["Regla de notes.txt", "ok"], inferred_pattern: ["Deducido por patrón", "warn"], undocumented: ["Sin documentar", "bad"] };
  const CORE_ES = {
    Div: "División", Date: "Fecha del partido (dd/mm/aa)", Time: "Hora de inicio", HomeTeam: "Equipo local", AwayTeam: "Equipo visitante",
    FTHG: "Goles del local al final", HG: "Goles del local al final", FTAG: "Goles del visitante al final", AG: "Goles del visitante al final",
    FTR: "Resultado final (H = gana local, D = empate, A = gana visitante)", Res: "Resultado final (H = gana local, D = empate, A = gana visitante)",
    HTHG: "Goles del local al descanso", HTAG: "Goles del visitante al descanso", HTR: "Resultado al descanso (H, D, A)",
    Attendance: "Asistencia de público", Referee: "Árbitro", HS: "Remates del local", AS: "Remates del visitante", HST: "Remates a puerta del local", AST: "Remates a puerta del visitante",
    HHW: "Remates al palo del local", AHW: "Remates al palo del visitante", HC: "Córneres del local", AC: "Córneres del visitante",
    HF: "Faltas cometidas por el local", AF: "Faltas cometidas por el visitante", HFKC: "Tiros libres concedidos por el local", AFKC: "Tiros libres concedidos por el visitante",
    HO: "Fueras de juego del local", AO: "Fueras de juego del visitante", HY: "Tarjetas amarillas del local", AY: "Tarjetas amarillas del visitante",
    HR: "Tarjetas rojas del local", AR: "Tarjetas rojas del visitante", HBP: "Puntos de amonestación del local (10 amarilla, 25 roja)", ABP: "Puntos de amonestación del visitante (10 amarilla, 25 roja)",
  };
  function bookES(b) {
    return b.replace(/^Market maximum$/, "máximo del mercado").replace(/^Market average$/, "media del mercado").replace(/^Betbrain maximum$/, "máximo de Betbrain")
      .replace(/^Betbrain average$/, "media de Betbrain").replace(/^Market$/, "mercado").replace(" (now BetVictor, see above)", " (ahora BetVictor)");
  }
  /** Traduce una descripción de notes.txt (o derivada de sus reglas) al español. */
  function descES(code, desc) {
    if (CORE_ES[code]) return CORE_ES[code];
    if (!desc) return "notes.txt no explica esta columna. Se conserva y se marca para revisar.";
    let d = desc, suffix = "", closing = false;
    if (d.includes("(pattern inferred, not listed in notes.txt)")) { d = d.replace(" (pattern inferred, not listed in notes.txt)", ""); suffix = " (deducido por patrón; no figura en notes.txt)"; }
    if (d.startsWith("Closing odds: ")) { d = d.slice(14); closing = true; }
    if (/ closing /.test(d)) { d = d.replace(" closing ", " "); closing = true; }
    const note = d.match(/ \((since [^)]*|now BetVictor[^)]*)\)$/);
    if (note) d = d.replace(note[0], "");
    const cl = closing ? " de cierre" : "";
    const P = [
      [/^Number of BetBrain bookmakers.*$/, () => "Número de casas de BetBrain usadas para calcular medias y máximos"],
      [/^(.*?) home win odds$/, (b) => `Cuota${cl} de victoria local · ${bookES(b)}`],
      [/^(.*?) draw (?:win )?odds$/, (b) => `Cuota${cl} de empate · ${bookES(b)}`],
      [/^(.*?) away win odds$/, (b) => `Cuota${cl} de victoria visitante · ${bookES(b)}`],
      [/^(.*?) over 2\.5 goals$/, (b) => `Cuota${cl} a más de 2,5 goles · ${bookES(b)}`],
      [/^(.*?) under 2\.5 goals$/, (b) => `Cuota${cl} a menos de 2,5 goles · ${bookES(b)}`],
      [/^(.*?) Asian handicap home team odds$/, (b) => `Cuota${cl} de hándicap asiático, local · ${bookES(b)}`],
      [/^(.*?) Asian handicap away team odds$/, (b) => `Cuota${cl} de hándicap asiático, visitante · ${bookES(b)}`],
      [/^(.*?) size of handicap \(home team\)$/, (b) => `Tamaño del hándicap${cl} (local) · ${bookES(b)}`],
    ];
    for (const [re, fn] of P) { const m = d.match(re); if (m) return fn(m[1]) + (note ? (note[1].startsWith("since") ? " (desde " + note[1].slice(6) + ")" : " (ahora BetVictor)") : "") + suffix; }
    return desc;
  }
  const SECTION_ES = { results: "Resultados", match_statistics: "Estadísticas del partido", odds_1x2: "Cuotas 1X2", odds_over_under: "Cuotas de goles (más/menos de 2,5)", odds_asian_handicap: "Cuotas de hándicap asiático", general: "General" };
  const GLOSSARY = {
    logloss: ["Pérdida logarítmica (log loss)", "Penaliza dar poca probabilidad al resultado que ocurrió. Cuanto más baja, mejor. Una predicción que siempre diera un tercio a cada resultado obtendría 1,099."],
    brier: ["Puntuación de Brier", "Distancia media entre las probabilidades y lo que pasó (0 sería perfecto). Cuanto más baja, mejor."],
    rps: ["RPS (puntuación de probabilidad ordenada)", "Como Brier, pero tiene en cuenta que el empate está entre la victoria local y la visitante. Cuanto más baja, mejor."],
    deviance: ["Desviación de Poisson", "Mide lo lejos que quedan los recuentos reales (goles, córneres…) de la media estimada, de forma adecuada para números enteros. Cuanto más baja, mejor."],
    mae: ["MAE (error absoluto medio)", "Diferencia media, en unidades de la estadística, entre el total estimado y el real. Por ejemplo, un MAE de 2,6 en córneres significa que el total real se separó en promedio 2,6 córneres de la estimación."],
    bias: ["Sesgo", "Diferencia media entre lo estimado y lo real. Positivo: el modelo tiende a pasarse; negativo: se queda corto."],
    coverage: ["Cobertura del rango del 80 %", "Porcentaje de partidos en los que el valor real cayó dentro del rango que da el modelo. Lo ideal es cerca del 80 %; en estadísticas con números pequeños sale algo más alto porque el rango incluye sus extremos."],
    accuracy: ["Acierto", "Porcentaje de partidos en los que el resultado más probable fue el que ocurrió. Es fácil de leer pero engañoso: no valora si las probabilidades eran razonables."],
  };
  const gl = (k) => `<abbr title="${esc(GLOSSARY[k][1])}">${esc(GLOSSARY[k][0])}</abbr>`;

  // ---------------------------------------------------------------- navegación
  const NAV = [
    { id: "inicio", label: "Inicio", icon: "home", bottom: true },
    { id: "predecir", label: "Predecir partido", short: "Predecir", icon: "target", bottom: true },
    { id: "partidos", label: "Partidos", icon: "calendar", bottom: true },
    { id: "equipos", label: "Equipos", icon: "shield", bottom: true },
    { id: "estadisticas", label: "Estadísticas", icon: "bars" },
    { id: "modelos", label: "Modelos", icon: "layers" },
    { id: "datos", label: "Datos", icon: "db" },
    { id: "historial", label: "Historial", icon: "history" },
    { id: "configuracion", label: "Configuración", icon: "sliders" },
  ];
  const LEGACY = { predict: "predecir", seasons: "equipos", data: "datos", validation: "modelos" };

  function buildNav() {
    ["brand-mark-1", "brand-mark-2"].forEach((id) => { const e = $(id); if (e) e.innerHTML = icon("ball"); });
    $("sidenav").innerHTML = NAV.map((n, i) => `${i === 4 ? '<div class="sep" role="presentation"></div>' : ""}<a href="#${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join("");
    $("bottomnav").innerHTML = NAV.filter((n) => n.bottom).map((n) => `<a href="#${n.id}" data-nav="${n.id}"><span class="ico">${icon(n.icon)}</span><span>${n.short || n.label}</span></a>`).join("")
      + `<button type="button" id="morebtn" aria-expanded="false" aria-controls="moresheet"><span class="ico">${icon("more")}</span><span>Más</span></button>`;
    $("moresheet").innerHTML = NAV.filter((n) => !n.bottom).map((n) => `<a href="#${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join("");
    $("morebtn").addEventListener("click", () => toggleMore());
    $("moresheet").addEventListener("click", (e) => { if (e.target.closest("a")) toggleMore(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggleMore(false); });
    if (D) $("sidefoot").innerHTML = `<span class="chip ok">Datos hasta el ${fdate(D.current.as_of)}</span><span>Temporada ${esc(D.current.season)} · ${esc(compName(D.current.competition))}</span>`;
  }
  function toggleMore(force) {
    const sheet = $("moresheet"), btn = $("morebtn");
    const open = force === undefined ? sheet.hidden : force;
    sheet.hidden = !open; btn.setAttribute("aria-expanded", String(open));
  }

  function route() {
    const [raw, ...rest] = location.hash.slice(1).split("/");
    let id = LEGACY[raw] || raw;
    const detail = id === "partido";
    if (!detail && !NAV.some((n) => n.id === id)) id = "inicio";
    const navId = detail ? "partidos" : id;
    document.querySelectorAll("[data-nav]").forEach((a) => a.setAttribute("aria-current", a.dataset.nav === navId ? "page" : "false"));
    const more = NAV.find((n) => n.id === navId && !n.bottom);
    const mb = $("morebtn"); if (mb) mb.style.color = more ? "var(--accent-ink)" : "";
    $("where").textContent = detail ? "Ficha del partido" : NAV.find((n) => n.id === id).label;
    toggleMore(false);
    if (!D) { renderNoData(id); return; }
    window.scrollTo(0, 0);
    try {
      if (detail) renderPartido(decodeURIComponent(rest.join("/"))); else PAGES[id]();
      const pg = $app.firstElementChild; if (pg) pg.classList.add("enter");   // animación de entrada solo al cambiar de sección
    } catch (err) {
      console.error(err);
      $app.innerHTML = `<div class="page"><div class="notice bad"><b>No se pudo mostrar esta sección.</b> Recarga la página; si el problema sigue, vuelve a preparar los datos con python3 -m pipeline.build.</div><a class="btn secondary" href="#inicio">Ir al inicio</a></div>`;
    }
  }

  // ---------------------------------------------------------------- tema
  const rootEl = document.documentElement;
  const hostTheme = rootEl.getAttribute("data-theme");
  const prefs = Object.assign({ theme: "oscuro", model: "auto" }, store.get("prefs", {}));
  function applyTheme() {
    if (prefs.theme === "claro") rootEl.setAttribute("data-theme", "light");
    else if (prefs.theme === "oscuro") rootEl.setAttribute("data-theme", "dark");
    else if (hostTheme) rootEl.setAttribute("data-theme", hostTheme);
    else rootEl.removeAttribute("data-theme");
  }
  applyTheme();

  // ---------------------------------------------------------------- sin datos
  function renderNoData() {
    $app.innerHTML = `<div class="page"><div class="head"><span class="eyebrow">Bienvenido</span><h1>Todavía no hay datos cargados</h1>
      <p class="lede">Match Lab necesita los CSV históricos de football-data.co.uk y su archivo notes.txt para preparar los modelos.</p></div>
      ${importGuide()}</div>`;
  }
  function importGuide() {
    return `<div class="card"><h2>Cómo importar los datos</h2>
      <ol class="clean">
        <li>Reúne en un ZIP (o en una carpeta) los CSV de cada temporada y el archivo <span class="mono">notes.txt</span>, que explica qué significa cada columna.</li>
        <li>En la carpeta del proyecto ejecuta:<br><span class="mono">python3 -m pipeline.build --source ruta/al/archivo.zip</span></li>
        <li>El proceso revisa los archivos, une las temporadas, detecta ascensos y descensos, comprueba la calidad, entrena los modelos y los valida temporada a temporada. Tarda unos minutos.</li>
        <li>Recarga esta página. Los informes completos quedan en la carpeta <span class="mono">output/</span>.</li>
      </ol>
      <div class="row"><button type="button" class="btn secondary small" id="copycmd">Copiar el comando</button></div>
      <p class="foot">Esta aplicación web no lee el ZIP por sí misma: la importación, la limpieza y el entrenamiento los hace el proceso de preparación del proyecto, y la web muestra el resultado.</p></div>`;
  }
  function bindImportGuide() {
    const b = $("copycmd"); if (!b) return;
    b.addEventListener("click", () => {
      const cmd = "python3 -m pipeline.build --source ruta/al/archivo.zip";
      if (navigator.clipboard) navigator.clipboard.writeText(cmd).then(() => toast("Comando copiado"), () => toast("No se pudo copiar; selecciónalo a mano"));
      else toast("No se pudo copiar; selecciónalo a mano");
    });
  }

  if (!D) { buildNav(); window.addEventListener("hashchange", route); route(); return; }

  // ---------------------------------------------------------------- datos
  const MI = D.matches.columns.reduce((o, c, i) => ((o[c] = i), o), {});
  const matches = D.matches.rows;
  const name = (t) => (D.teams[t] ? D.teams[t].display : t);
  const compName = (c) => ({ SP1: "LaLiga · Primera División", SP2: "Segunda División" }[c] || (D.competitions[c] && D.competitions[c].name) || c);
  const seasonsOf = (comp) => D.seasons.filter((s) => s.competition === comp).map((s) => s.season);
  const seasonInfo = (comp, season) => D.seasons.find((s) => s.competition === comp && s.season === season);
  const participants = (comp, season) => D.participation.filter((p) => p.competition === comp && p.season === season);
  const partRow = (comp, season, t) => D.participation.find((p) => p.competition === comp && p.season === season && p.team_id === t);
  const PRED_STATS = ["shots", "sot", "corners", "fouls", "yellows", "reds", "ht_goals"].filter((s) => D.models[s]);
  const modelStems = Object.keys(D.models);
  const stateChip = (st) => { const s = STATE[st] || [st, ""]; return `<span class="chip ${s[1]}">${s[0]}</span>`; };

  /** Mejor modelo por estadística según la validación en temporadas de prueba. */
  function bestModel(stem) {
    const b = D.backtest[stem];
    if (!b) return "ratings";
    if (stem === "goals" && b.metrics.test_outcome) { const o = b.metrics.test_outcome; return o.form && o.form.log_loss < o.ratings.log_loss ? "form" : "ratings"; }
    const t = b.metrics.test_overall;
    return t.form && t.form.poisson_deviance < t.ratings.poisson_deviance ? "form" : "ratings";
  }

  function predictStat(stem, model, season, h, a, dateStr) {
    const M = D.models[stem];
    if (!M || !M.snapshots[season]) return { error: "No hay modelo para esta temporada." };
    const S = M.snapshots[season];
    let used = model === "auto" ? bestModel(stem) : model, fallback = false;
    if (used === "form" && (!S.form || !S.form.teams[h] || !S.form.teams[a])) {
      if (model === "form") return { error: !S.form ? `El modelo de forma reciente no está disponible en ${season} (es la primera temporada del archivo).` : "La forma reciente necesita que los dos equipos hayan jugado esta temporada. Usa «Fuerza de equipos»." };
      used = "ratings"; fallback = true;
    }
    if (used === "ratings") {
      const eta = FM.ratingsEta(S.ratings, h, a);
      if (!eta) return { error: "Uno de los equipos no está en el modelo." };
      const draws = FM.lambdaDraws(eta, stem === "goals" ? 800 : 300, `${stem}|${season}|${h}|${a}`);
      return { used, fallback, draws, mean: [Math.exp(eta.m[0] + eta.S[0][0] / 2), Math.exp(eta.m[1] + eta.S[1][1] / 2)] };
    }
    if (used === "form") {
      const fs = S.form;
      const rest = (t) => (fs.last_date[t] && dateStr ? daysBetween(fs.last_date[t], dateStr) : 21);
      const lh = FM.formLambda(fs, h, a, true, rest(h)), la = FM.formLambda(fs, a, h, false, rest(a));
      return { used, fallback, draws: [[lh, la]], mean: [lh, la], rest: [rest(h), rest(a)] };
    }
    return { used, fallback, draws: [S.baseline.slice()], mean: S.baseline.slice() };
  }

  function evidence(season, team) {
    const snap = D.models.goals.snapshots[season].ratings;
    const eff = snap.eff_by_season[team] || {}, nby = snap.n_by_season[team] || {};
    const cur = eff[season] || 0;
    let prev = 0; Object.entries(eff).forEach(([s, w]) => { if (s !== season) prev += w; });
    const prior = snap.prior_used[team] || "league_average";
    const cfg = D.models.goals.config.ratings;
    const sd = prior !== "league_average" && snap.entrant_prior ? snap.entrant_prior.sd_att : cfg.prior_sd;
    const base = D.models.goals.snapshots[season].baseline;
    const priorEq = 1 / (sd * sd) / ((base[0] + base[1]) / 2);   // peso del punto de partida, en partidos equivalentes
    const total = cur + prev + priorEq, data = cur + prev;
    const level = data >= 15 ? ["Muchos datos", "ok"] : data >= 6 ? ["Datos moderados", "warn"] : ["Pocos datos", "bad"];
    const shares = { cur: cur / total, prev: prev / total, prior: priorEq / total };
    const basis = shares.cur >= shares.prev && shares.cur >= shares.prior ? `sobre todo en partidos de ${season}`
      : shares.prev >= shares.prior ? "sobre todo en temporadas anteriores, con menos peso cuanto más antiguas"
        : prior === "empirical_entrant_prior" ? "sobre todo en el punto de partida aprendido de otros equipos ascendidos" : "sobre todo en la media de la liga";
    let nPrev = 0; Object.entries(nby).forEach(([s, n]) => { if (s !== season) nPrev += n; });
    return { cur, prev, priorEq, shares, level, basis, nCur: nby[season] || 0, nPrev, prior, att: snap.att[team], dfn: snap.dfn[team], attSe: snap.att_se[team], dfnSe: snap.dfn_se[team], eff: data };
  }

  function lastResults(season, team, n = 5, before = null) {
    const out = [];
    for (let i = matches.length - 1; i >= 0 && out.length < n; i--) {
      const r = matches[i];
      if (r[MI.season] !== season || (before && r[MI.date] >= before)) continue;
      const h = r[MI.home_id] === team, a = r[MI.away_id] === team;
      if (!h && !a) continue;
      const gf = h ? r[MI.home_goals] : r[MI.away_goals], ga = h ? r[MI.away_goals] : r[MI.home_goals];
      out.push({ res: gf > ga ? "W" : gf === ga ? "D" : "L", gf, ga, opp: h ? r[MI.away_id] : r[MI.home_id], home: h, date: r[MI.date], id: mid(r) });
    }
    return out.reverse();
  }
  const RES_ES = { W: ["G", "Victoria"], D: ["E", "Empate"], L: ["P", "Derrota"] };
  const formChips = (lr) => lr.length ? `<span class="form5" role="img" aria-label="Últimos resultados: ${lr.map((x) => RES_ES[x.res][1]).join(", ")}">${lr.map((x) => `<i class="${x.res}" title="${fdate(x.date)} · ${x.home ? "contra" : "en casa de"} ${esc(name(x.opp))} · ${x.gf}-${x.ga}">${RES_ES[x.res][0]}</i>`).join("")}</span>` : '<span class="sub">Sin partidos</span>';

  // ---------------------------------------------------------------- almacenamiento local
  const saved = () => store.get("saved", []);
  const customs = () => store.get("custom", []);

  // ---------------------------------------------------------------- identidad visual de los equipos
  // Monogramas con los colores de cada club: sirven para reconocerlos de un vistazo; no son escudos oficiales.
  const CLUB = {
    alaves: ["ALA", "#1d4fa0", "#ffffff"], almeria: ["ALM", "#c8102e", "#ffffff"], "ath-bilbao": ["ATH", "#d81e2c", "#ffffff"],
    "ath-madrid": ["ATM", "#cb3524", "#ffffff"], barcelona: ["BAR", "#a50044", "#ffd23f"], betis: ["BET", "#00954c", "#ffffff"],
    cadiz: ["CAD", "#fde100", "#0047ab"], celta: ["CEL", "#8ac3ee", "#0b2b4c"], elche: ["ELC", "#ffffff", "#00843d"],
    espanyol: ["ESP", "#1d6fb8", "#ffffff"], getafe: ["GET", "#005999", "#ffffff"], girona: ["GIR", "#c8102e", "#ffffff"],
    granada: ["GRA", "#c8102e", "#ffffff"], "la-coruna": ["DEP", "#1c5ba2", "#ffffff"], "las-palmas": ["LPA", "#ffe400", "#0c4da2"],
    leganes: ["LEG", "#1f4f9c", "#ffffff"], levante: ["LEV", "#00529f", "#ffffff"], malaga: ["MAL", "#0d6fb8", "#ffffff"],
    mallorca: ["MLL", "#d9000d", "#ffffff"], osasuna: ["OSA", "#c8161d", "#ffffff"], oviedo: ["OVI", "#0b5ba3", "#ffffff"],
    "real-madrid": ["RMA", "#ffffff", "#1c2c5b"], santander: ["RAC", "#ffffff", "#00704a"], sevilla: ["SEV", "#ffffff", "#d4021d"],
    sociedad: ["RSO", "#0067b1", "#ffffff"], valencia: ["VAL", "#ffffff", "#111111"], valladolid: ["VLL", "#6c2c8a", "#ffffff"],
    vallecano: ["RAY", "#ffffff", "#d52b1e"], villarreal: ["VIL", "#ffe667", "#005187"],
  };
  const crest = (t, size = "") => {
    const c = CLUB[t] || [name(t).normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase(), "", ""];
    return `<span class="crest ${size}"${c[1] ? ` style="--c1:${c[1]};--c2:${c[2]}"` : ""} aria-hidden="true">${c[0]}</span>`;
  };
  const tm = (t, size = "sm") => `<span class="tm">${crest(t, size)}<span>${esc(name(t))}</span></span>`;
  const hint = (txt) => `<details class="hint"><summary aria-label="Más información">?</summary><span class="hp">${txt}</span></details>`;
  const TAG_REAL = '<span class="tag real">Dato real</span>', TAG_MODEL = '<span class="tag model">Estimación del modelo</span>';
  const DF = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const DM = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
  const DL = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const utc = (iso) => new Date(iso + "T12:00:00Z");
  const dshort = (iso) => DF.format(utc(iso));
  const dlong = (iso) => DL.format(utc(iso));
  const fold = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // ---------------------------------------------------------------- partidos y pronósticos
  const mid = (r) => `${r[MI.competition]}_${r[MI.date].replace(/-/g, "")}_${r[MI.home_id]}_${r[MI.away_id]}`;
  const MATCH_BY_ID = new Map(matches.map((r) => [mid(r), r]));
  const outcomeIdx = (hg, ag) => (hg > ag ? 0 : hg === ag ? 1 : 2);
  const argmax = (p) => p.indexOf(Math.max(...p));

  /** Redondea las tres probabilidades a enteros que suman exactamente 100 (método del mayor resto). */
  function pct3(p) {
    const s = p[0] + p[1] + p[2] || 1, raw = p.map((x) => (100 * x) / s), fl = raw.map(Math.floor);
    let rem = 100 - fl[0] - fl[1] - fl[2];
    raw.map((v, i) => [v - fl[i], i]).sort((x, y) => y[0] - x[0]).forEach(([, i]) => { if (rem > 0) { fl[i]++; rem--; } });
    return fl;
  }
  function probBar(p, h, a, opts = {}) {
    const q = pct3(p), hit = opts.hit ?? -1, top = argmax(p), cls = (k, i) => k + (i === top ? " top" : "");
    return `<div class="pb${opts.lg ? " lg" : ""}" role="img" aria-label="Victoria de ${esc(name(h))} ${q[0]} %, empate ${q[1]} %, victoria de ${esc(name(a))} ${q[2]} %${hit >= 0 ? ". Recuadrado: lo que pasó" : ""}">${["H", "D", "A"].map((k, i) => `<i class="${k}${i === hit ? " hit" : ""}" style="flex:${p[i]}"></i>`).join("")}</div>
      <div class="pbl" aria-hidden="true"><span class="${cls("h", 0)}">1 · ${q[0]} %</span><span class="${cls("d", 1)}">X · ${q[1]} %</span><span class="${cls("a", 2)}">2 · ${q[2]} %</span></div>`;
  }

  const PM = D.prematch, PMI = PM ? PM.columns.reduce((o, c, i) => ((o[c] = i), o), {}) : {};
  /** Pronóstico hecho antes del partido en la validación semana a semana: el modelo solo conocía partidos anteriores. */
  function prematch(r) {
    const row = PM && PM.rows[mid(r)];
    if (!row) return null;
    const want = bestModel("goals"), model = row[PMI["p_" + want]] ? want : "ratings", p = row[PMI["p_" + model]];
    if (!p) return null;
    const stat = (s) => {
      if (PMI[`${s}_rh`] == null) return null;
      const k = bestModel(s) === "form" && row[PMI[`${s}_fh`]] != null ? "f" : "r";
      const h = row[PMI[`${s}_${k}h`]], a = row[PMI[`${s}_${k}a`]];
      return h == null ? null : { h, a, model: k === "f" ? "form" : "ratings" };
    };
    return { split: row[PMI.split], p, model, market: row[PMI.p_market], stat };
  }

  /** Probabilidades 1X2 y goles esperados de un partido futuro con el modelo recomendado. */
  const FC = new Map();
  function forecast(h, a, date) {
    const key = [h, a, date].join("|");
    if (FC.has(key)) return FC.get(key);
    const g = predictStat("goals", "auto", D.current.season, h, a, date);
    let out = null;
    if (!g.error) {
      const dist = FM.distribution(g.draws, D.models.goals.nb_size, 10, true);
      let pH = 0, pD = 0, pA = 0;
      dist.G.forEach((row, i) => row.forEach((v, j) => { if (i > j) pH += v; else if (i === j) pD += v; else pA += v; }));
      out = { p: [pH, pD, pA], xg: g.mean, model: g.used };
    }
    FC.set(key, out);
    return out;
  }

  const CLAR = [{ k: "alta", min: 0.55, label: "Favorito claro", cls: "ok" }, { k: "media", min: 0.42, label: "Favorito ajustado", cls: "warn" }, { k: "baja", min: 0, label: "Partido abierto", cls: "" }];
  const clarity = (p) => CLAR.find((c) => Math.max(...p) >= c.min);
  let CAL = null;
  /** Con qué frecuencia ganó el favorito en cada nivel de claridad, en las temporadas de prueba. */
  function calibration() {
    if (CAL) return CAL;
    CAL = Object.fromEntries(CLAR.map((c) => [c.k, { n: 0, hit: 0 }]));
    for (const r of matches) {
      const pm = prematch(r);
      if (!pm || pm.split !== "test") continue;
      const c = CAL[clarity(pm.p).k]; c.n++;
      if (argmax(pm.p) === outcomeIdx(r[MI.home_goals], r[MI.away_goals])) c.hit++;
    }
    return CAL;
  }
  function clarityHelp() {
    const c = calibration();
    const lines = CLAR.filter((x) => c[x.k].n).map((x) => `${x.label}: el favorito ganó el ${pc(c[x.k].hit / c[x.k].n)} de las veces (${c[x.k].n} partidos).`);
    return `Indica cuánto destaca el resultado más probable: 55 % o más es «favorito claro», de 42 % a 55 % «favorito ajustado» y por debajo «partido abierto». Es una estimación, no una garantía.${lines.length ? ` En las temporadas de prueba: ${lines.join(" ")}` : ""}`;
  }

  /** Agrupa partidos en semanas de martes a lunes: una jornada de LaLiga suele ir de viernes a lunes. */
  const weekOf = (iso) => { const d = utc(iso); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 5) % 7)); return d.toISOString().slice(0, 10); };
  function dateBlocks(items, getDate) {
    const out = [];
    for (const it of items) {
      const d = getDate(it), k = weekOf(d), last = out[out.length - 1];
      if (last && last.key === k) { last.items.push(it); if (d > last.end) last.end = d; if (d < last.start) last.start = d; }
      else out.push({ key: k, start: d, end: d, items: [it] });
    }
    return out;
  }
  const blockLabel = (b) => (b.start === b.end ? dlong(b.start) : `Del ${DM.format(utc(b.start))} al ${DM.format(utc(b.end))} de ${b.end.slice(0, 4)}`);

  const upcomingFixtures = () => (D.fixtures || []).filter((f) => f.date && f.date > D.current.as_of && (!f.season || f.season === D.current.season))
    .sort((x, y) => (x.date + (x.kickoff || "")).localeCompare(y.date + (y.kickoff || "")));
  function calendarStatus() {
    const st = D.fixtures_status, n = upcomingFixtures().length;
    if (n) return `${n} partido${n > 1 ? "s" : ""} próximo${n > 1 ? "s" : ""} importado${n > 1 ? "s" : ""} del calendario${st ? ` (comprobado el ${fstamp(st.checked_at)})` : ""}.`;
    if (st) return `Calendario comprobado el ${fstamp(st.checked_at)} en football-data.co.uk: ${st.already_played ? `los ${st.already_played} partidos publicados ya están jugados y` : ""} aún no se ha publicado la próxima jornada.`;
    return "No se ha importado ningún calendario de próximos partidos.";
  }

  function playedCard(r) {
    const h = r[MI.home_id], a = r[MI.away_id], hg = r[MI.home_goals], ag = r[MI.away_goals], k = outcomeIdx(hg, ag);
    const pm = prematch(r);
    let pred = "";
    if (pm) {
      const top = argmax(pm.p), q = pct3(pm.p)[k];
      const v = top === k ? ["Ganó el favorito", "ok"] : q < 25 ? ["Sorpresa", "bad"] : ["Falló el pronóstico", "warn"];
      if (top === k && k === 1) v[0] = "Acertó el empate";
      pred = `<div class="mc-pred"><div class="lbl"><span>Pronóstico previo: ${q} % a este resultado</span><span class="chip ${v[1]}">${v[0]}</span></div>${probBar(pm.p, h, a, { hit: k })}</div>`;
    }
    return `<a class="mcard" href="#partido/${esc(mid(r))}" aria-label="${esc(name(h))} ${hg}, ${esc(name(a))} ${ag}, ${esc(dshort(r[MI.date]))}. Abrir la ficha del partido">
      <div class="mc-top"><span>${esc(dshort(r[MI.date]))}${r[MI.kickoff] ? " · " + esc(r[MI.kickoff]) : ""}</span><span class="tag real">Final</span></div>
      <div class="mc-team${k === 2 ? " lost" : ""}">${crest(h)}<span class="nm">${esc(name(h))}</span><b class="sc">${hg}</b></div>
      <div class="mc-team${k === 0 ? " lost" : ""}">${crest(a)}<span class="nm">${esc(name(a))}</span><b class="sc">${ag}</b></div>${pred}</a>`;
  }
  function upcomingCard(f, ref) {
    const fc = forecast(f.home_id, f.away_id, f.date), c = fc && clarity(fc.p);
    return `<button type="button" class="mcard" data-up="${ref}" aria-label="${esc(name(f.home_id))} contra ${esc(name(f.away_id))}, ${esc(dshort(f.date))}. Abrir la predicción detallada">
      <div class="mc-top"><span>${esc(dshort(f.date))}${f.kickoff ? " · " + esc(f.kickoff) : ""}</span><span class="chip">${ref.startsWith("c") ? "Creado por ti" : "Próximo"}</span></div>
      <div class="mc-team">${crest(f.home_id)}<span class="nm">${esc(name(f.home_id))}</span><b class="sc xg" title="Goles esperados">${fc ? nf(fc.xg[0], 1) : ""}</b></div>
      <div class="mc-team">${crest(f.away_id)}<span class="nm">${esc(name(f.away_id))}</span><b class="sc xg" title="Goles esperados">${fc ? nf(fc.xg[1], 1) : ""}</b></div>
      ${fc ? `<div class="mc-pred"><div class="lbl"><span>Estimación · a la derecha, goles esperados</span><span class="chip ${c.cls}">${c.label}</span></div>${probBar(fc.p, f.home_id, f.away_id)}</div>` : '<p class="sub">No se puede estimar este partido con los datos disponibles.</p>'}
    </button>`;
  }
  function bindUpcoming(list) {
    document.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => {
      const f = list[b.dataset.up];
      if (f) goPredict({ season: f.season || D.current.season, home: f.home_id, away: f.away_id, date: f.date });
    }));
  }
  function goPredict(o) {
    const season = o.season || D.current.season, ids = participants(D.current.competition, season).map((p) => p.team_id);
    Object.assign(P, { comp: D.current.competition, season, home: o.home, away: o.away, date: o.date || null, hypo: !(ids.includes(o.home) && ids.includes(o.away)) });
    G = Object.assign({}, P); location.hash = "#predecir";
  }
  function openTeam(t, season) {
    S.comp = D.current.competition; S.season = season || D.current.season; S.team = t; S.scroll = true;
    if (location.hash === "#equipos") renderEquipos(); else location.hash = "#equipos";
  }
  const FRESH = (() => {
    const seen = store.get("seenAsOf", null);
    store.set("seenAsOf", D.current.as_of);
    return seen && seen < D.current.as_of ? matches.filter((r) => r[MI.date] > seen && r[MI.date] <= D.current.as_of).length : 0;
  })();

  function evalSaved(s) {
    const rows = matches.filter((r) => r[MI.season] === s.season && r[MI.home_id] === s.home && r[MI.away_id] === s.away);
    if (!rows.length) return { state: "pending" };
    const r = s.date ? rows.slice().sort((x, y) => Math.abs(daysBetween(x[MI.date], s.date)) - Math.abs(daysBetween(y[MI.date], s.date)))[0] : rows[0];
    const hg = r[MI.home_goals], ag = r[MI.away_goals];
    const k = hg > ag ? 0 : hg === ag ? 1 : 2;
    const pick = s.probs.indexOf(Math.max(...s.probs));
    const before = r[MI.date] <= s.asOf;
    return { state: before ? "before" : "done", date: r[MI.date], hg, ag, k, hit: pick === k, p: s.probs[k], ll: -Math.log(Math.max(s.probs[k], 1e-9)) };
  }

  // ================================================================ INICIO
  function seasonAgg(rows) {
    let g = 0, hw = 0, dr = 0;
    rows.forEach((r) => { g += r[MI.home_goals] + r[MI.away_goals]; const k = outcomeIdx(r[MI.home_goals], r[MI.away_goals]); if (k === 0) hw++; else if (k === 1) dr++; });
    const n = rows.length || NaN;
    return { n: rows.length, gpm: g / n, hw: hw / n, dr: dr / n };
  }

  function renderInicio() {
    const comp = D.current.competition, season = D.current.season;
    const cur = seasonInfo(comp, season);
    const curM = matches.filter((r) => r[MI.season] === season && r[MI.competition] === comp);
    const prevS = seasonsOf(comp).filter((s) => s < season);
    const A = seasonAgg(curM), B = seasonAgg(matches.filter((r) => prevS.includes(r[MI.season])));
    const fav = { n: 0, hit: 0, mkN: 0, mk: 0 };
    curM.forEach((r) => {
      const pm = prematch(r); if (!pm) return;
      const k = outcomeIdx(r[MI.home_goals], r[MI.away_goals]);
      fav.n++; if (argmax(pm.p) === k) fav.hit++;
      if (pm.market) { fav.mkN++; if (argmax(pm.market) === k) fav.mk++; }
    });
    const blocks = dateBlocks(curM, (r) => r[MI.date]);
    const latest = blocks.length ? blocks[blocks.length - 1] : null;
    const up = upcomingFixtures();
    const upList = Object.fromEntries(up.slice(0, 10).map((f, i) => ["f" + i, f]));
    const surprises = curM.map((r) => { const pm = prematch(r); return pm ? [r, pct3(pm.p)[outcomeIdx(r[MI.home_goals], r[MI.away_goals])]] : null; })
      .filter(Boolean).sort((x, y) => x[1] - y[1]).slice(0, 4);
    const table = D.tables[season] || [];
    const nTeams = participants(comp, season).length;
    const sv = saved(), recent = sv.slice(-3).reverse();
    const nErr = D.quality.issues.filter((i) => i.severity === "error").length;
    const delta = (a, b, d, unit) => (isFinite(a) && isFinite(b) ? `${a >= b ? "+" : "−"}${nf(Math.abs(a - b) * (unit === "%" ? 100 : 1), d)}${unit === "%" ? " puntos" : ""} frente a ${esc(prevS[0])}–${esc(prevS[prevS.length - 1])}` : "");

    $app.innerHTML = `<div class="page">
      ${FRESH ? `<div class="notice ok" role="status"><b>Datos actualizados desde tu última visita.</b> ${FRESH} resultado${FRESH > 1 ? "s" : ""} nuevo${FRESH > 1 ? "s" : ""}; ahora llegan hasta el ${fdate(D.current.as_of)}.</div>` : ""}
      <section class="hero" aria-labelledby="hero-h">
        <div class="head"><span class="eyebrow">${esc(compName(comp))}</span><h1 id="hero-h">Temporada ${esc(season)}</h1>
          <p class="lede">${cur.state === "complete" ? `Temporada completa: ${cur.matches} partidos.` : `${cur.matches} de ${cur.expected_matches_double_round_robin} partidos jugados.`} Último resultado incluido: ${esc(dlong(D.current.as_of))}.</p></div>
        <div class="progress" role="img" aria-label="${pc(cur.completeness)} de la temporada jugada"><i style="width:${100 * cur.completeness}%"></i></div>
        <div class="row" style="gap:8px"><span class="chip ok">Datos hasta el ${fdate(D.current.as_of)}</span><span class="chip">Fuente: football-data.co.uk</span><span class="chip ${nErr ? "warn" : ""}">${nErr ? `${nErr} errores en la revisión de datos` : "Datos revisados, sin errores"}</span></div>
        <p class="sub">${esc(calendarStatus())}</p>
        <div class="row"><a class="btn primary" href="#predecir">${icon("target")} Predecir un partido</a><a class="btn secondary" href="#partidos">${icon("calendar")} Explorar partidos</a></div>
      </section>

      <div class="statrow">
        <div class="stat"><span class="label">Goles por partido</span><b>${nf(A.gpm, 2)}</b><span class="delta">${delta(A.gpm, B.gpm, 2)}</span></div>
        <div class="stat"><span class="label">Victorias locales</span><b>${pc(A.hw)}</b><span class="delta">${delta(A.hw, B.hw, 0, "%")}</span></div>
        <div class="stat"><span class="label">Empates</span><b>${pc(A.dr)}</b><span class="delta">${delta(A.dr, B.dr, 0, "%")}</span></div>
        <div class="stat"><span class="label">Favorito del modelo acertado ${hint(`Partidos de ${esc(season)} en los que el resultado más probable según el pronóstico previo fue el que ocurrió. Cada pronóstico se calculó solo con partidos anteriores a esa semana. Como referencia, el favorito de las casas de apuestas acertó ${fav.mkN ? `${fav.mk} de ${fav.mkN}` : "–"}.`)}</span>
          <b>${fav.n ? pc(fav.hit / fav.n) : "–"}</b><span class="delta">${fav.hit} de ${fav.n} partidos${fav.mkN ? ` · mercado: ${pc(fav.mk / fav.mkN)}` : ""}</span></div>
      </div>

      <div class="cols main-side">
        <div class="stack" style="gap:22px">
          <section class="stack" aria-labelledby="up-h">
            <div class="sec-h"><h2 id="up-h">Próximos partidos</h2>${up.length ? '<a href="#partidos">Ver todos</a>' : ""}</div>
            ${up.length ? `<div class="mgrid">${Object.entries(upList).map(([k, f]) => upcomingCard(f, k)).join("")}</div>`
              : `<div class="empty"><p><b>Todavía no hay próximos partidos publicados.</b> ${esc(calendarStatus())} Para no inventar fechas ni emparejamientos, aquí solo aparecen partidos de un calendario real.</p>
                <p class="sub">Mientras tanto puedes estimar cualquier enfrentamiento o crear tus propios partidos.</p>
                <div class="row"><a class="btn secondary small" href="#predecir">Predecir un enfrentamiento</a><a class="btn quiet small" href="#partidos">Crear un partido</a></div></div>`}
          </section>
          ${latest ? `<section class="stack" aria-labelledby="lr-h">
            <div class="sec-h"><h2 id="lr-h">Últimos resultados</h2><a href="#partidos">Todos los resultados</a></div>
            <p class="sub">${esc(blockLabel(latest))} · ${latest.items.length} partidos. Cada tarjeta muestra el resultado real y, debajo, lo que pronosticó el modelo antes del partido; el tramo recuadrado es lo que ocurrió.</p>
            <div class="mgrid">${latest.items.slice().reverse().map(playedCard).join("")}</div></section>` : ""}
        </div>
        <div class="stack" style="gap:18px">
          <section class="card tight" aria-labelledby="tb-h"><div class="card-h"><h2 id="tb-h">Clasificación</h2><a class="sub" href="#equipos">Completa</a></div>
            <div class="tablewrap" style="border:0"><table class="tbl-mini"><thead><tr><th class="n">#</th><th>Equipo</th><th class="n">PJ</th><th class="n">DG</th><th class="n">Pts</th></tr></thead><tbody>
              ${table.map((x) => `<tr class="clickrow${x.pos > nTeams - 3 && cur.state !== "complete" ? " rel" : ""}" data-team="${esc(x.team)}" tabindex="0"><td class="n">${x.pos}</td><td>${tm(x.team)}</td><td class="n">${x.p}</td><td class="n">${signed(x.gf - x.ga, 0).replace("+0", "0").replace("−0", "0")}</td><td class="n"><b>${x.pts}</b></td></tr>`).join("")}
            </tbody></table></div>
            <p class="foot">La línea roja marca los tres últimos puestos, que descienden al final de la temporada. Pulsa un equipo para ver su ficha.</p></section>
          ${surprises.length ? `<section class="card tight" aria-labelledby="sp-h"><h2 id="sp-h">Mayores sorpresas de ${esc(season)}</h2>
            <p class="sub">Resultados a los que el pronóstico previo daba menos probabilidad.</p>
            <div class="list">${surprises.map(([r, q]) => `<a href="#partido/${esc(mid(r))}" class="row" style="justify-content:space-between;text-decoration:none"><span>${tm(r[MI.home_id])} <b>${r[MI.home_goals]}-${r[MI.away_goals]}</b> ${tm(r[MI.away_id])}</span><span class="chip bad">${q} %</span></a>`).join("")}</div></section>` : ""}
          <section class="card tight" aria-labelledby="rp-h"><div class="card-h"><h2 id="rp-h">Tus predicciones</h2>${sv.length ? '<a class="sub" href="#historial">Historial</a>' : ""}</div>
            ${recent.length ? `<div class="list">${recent.map((s) => { const e = evalSaved(s); return `<div class="row" style="justify-content:space-between"><span><b>${esc(name(s.home))}</b> – <b>${esc(name(s.away))}</b><br><span class="sub">${s.date ? fdate(s.date) : "sin fecha"}</span></span>
              <span class="chip ${e.state === "done" ? (e.hit ? "ok" : "bad") : ""}">${e.state === "done" ? `${e.hg}-${e.ag} · ${e.hit ? "acertada" : "fallada"}` : e.state === "before" ? "ya jugado" : "pendiente"}</span></div>`; }).join("")}</div>`
              : '<p class="sub">Guarda una predicción y aquí verás si acertó cuando se juegue el partido.</p>'}
          </section>
        </div>
      </div>

      <section aria-labelledby="qa-h" class="stack"><div class="sec-h"><h2 id="qa-h">Explorar</h2></div>
        <div class="tiles">
          <a class="tile" href="#equipos"><span class="ico">${icon("shield")}</span><b>Equipos</b><span class="sub">Fichas, forma reciente, clasificación, ascensos y descensos.</span></a>
          <a class="tile" href="#estadisticas"><span class="ico">${icon("bars")}</span><b>Estadísticas</b><span class="sub">Compara equipos y sigue la evolución de la liga.</span></a>
          <a class="tile" href="#modelos"><span class="ico">${icon("layers")}</span><b>Modelos</b><span class="sub">Cómo se calculan los pronósticos y cuánto aciertan.</span></a>
          <a class="tile" href="#datos"><span class="ico">${icon("db")}</span><b>Datos</b><span class="sub">Archivos, calidad de los datos y cómo actualizarlos.</span></a>
        </div></section>
    </div>`;
    bindUpcoming(upList);
    document.querySelectorAll("tr[data-team]").forEach((tr) => {
      const go = () => openTeam(tr.dataset.team, season);
      tr.addEventListener("click", go);
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
  }

  // ================================================================ PREDECIR
  const P = Object.assign({ comp: D.current.competition, season: D.current.season, home: null, away: null, date: null, model: prefs.model, hypo: false }, store.get("predict2", {}));
  if (!seasonsOf(P.comp).includes(P.season)) { P.comp = D.current.competition; P.season = D.current.season; }
  if (!MODEL[P.model] || P.model === "market") P.model = "auto";
  let G = null;              // selección con la que se generó el resultado visible
  let lastResult = null;

  function defaultDate(season) {
    const info = seasonInfo(P.comp, season);
    let d = addDays(info.last_date, 1);
    if (season === D.current.season) while (new Date(d + "T12:00:00Z").getUTCDay() !== 6) d = addDays(d, 1);
    return d;
  }
  function teamLists(season, hypo) {
    const parts = participants(P.comp, season).map((p) => p.team_id).sort((a, b) => name(a).localeCompare(name(b), "es"));
    const others = hypo ? D.models.goals.snapshots[season].ratings.teams.filter((t) => !parts.includes(t)).sort((a, b) => name(a).localeCompare(name(b), "es")) : [];
    return { parts, others };
  }
  function normalizeP() {
    if (!P.date) P.date = defaultDate(P.season);
    const { parts, others } = teamLists(P.season, P.hypo);
    const ok = (t) => parts.includes(t) || others.includes(t);
    if (!P.home || !ok(P.home)) P.home = parts.includes("real-madrid") ? "real-madrid" : parts[0];
    if (!P.away || !ok(P.away) || P.away === P.home) P.away = parts.find((t) => t !== P.home && t === "barcelona") || parts.find((t) => t !== P.home);
    store.set("predict2", P);
    return { parts, others };
  }
  const selKey = (x) => x && [x.comp, x.season, x.home, x.away, x.date, x.model, x.hypo].join("|");

  function renderPredecir() {
    const { parts, others } = normalizeP();
    if (!G) G = Object.assign({}, P);
    const stale = selKey(P) !== selKey(G);
    const opt = (list, sel, dis) => list.map((t) => `<option value="${esc(t)}"${t === sel ? " selected" : ""}${t === dis ? " disabled" : ""}>${esc(name(t))}${t === dis ? " (ya elegido)" : ""}</option>`).join("");
    const teamSel = (id, sel, dis) => `<select id="${id}"><optgroup label="Equipos de ${esc(P.season)}">${opt(parts, sel, dis)}</optgroup>${others.length ? `<optgroup label="Fuera de ${esc(P.season)} (hipotético)">${opt(others, sel, dis)}</optgroup>` : ""}</select>`;
    const tag = (t) => { const p = partRow(P.comp, P.season, t); const e = evidence(P.season, t);
      return `${p ? (p.status === "entered" ? '<span class="chip warn">Ascendido o regresa</span>' : "") : '<span class="chip bad">No juega esta temporada</span>'}${e.level[1] === "bad" ? '<span class="chip bad">Pocos datos</span>' : ""}`; };
    const isCurrent = P.season === D.current.season;

    $app.innerHTML = `<div class="page">
      <div class="head"><span class="eyebrow">Predicción de partidos</span><h1>Predecir partido</h1>
        <p class="lede">Sigue los pasos y pulsa «Generar predicción». Los modelos solo usan partidos jugados antes del ${fdate(D.current.as_of)}.</p></div>
      <div class="cols side">
        <form class="card stick" id="pf" novalidate>
          <div class="steps">
            <div class="step done"><span class="step-n" aria-hidden="true">1</span><div class="step-b"><span class="step-t">Competición y temporada</span>
              <div class="row" style="gap:10px;align-items:end">
                <div class="field" style="flex:1 1 150px"><label for="p-comp">Competición</label><select id="p-comp">${Object.keys(D.competitions).map((c) => `<option value="${esc(c)}"${c === P.comp ? " selected" : ""}>${esc(compName(c))}</option>`).join("")}</select></div>
                <div class="field" style="flex:1 1 120px"><label for="p-season">Temporada</label><select id="p-season">${seasonsOf(P.comp).slice().reverse().map((s) => `<option value="${s}"${s === P.season ? " selected" : ""}>${s}${s === D.current.season ? " (actual)" : ""}</option>`).join("")}</select></div>
              </div>${isCurrent ? "" : `<p class="sub">Temporada pasada: se usarán los modelos tal como quedaron al final de ${esc(P.season)}.</p>`}</div></div>
            <div class="step done"><span class="step-n" aria-hidden="true">2</span><div class="step-b"><span class="step-t">Equipos</span>
              <div class="pair">
                <div class="field"><label for="p-home">Local</label>${teamSel("p-home", P.home, P.away)}</div>
                <button type="button" class="swap" id="p-swap" aria-label="Intercambiar local y visitante">${icon("swap")}</button>
                <div class="field"><label for="p-away">Visitante</label>${teamSel("p-away", P.away, P.home)}</div>
              </div>
              <div class="row" style="justify-content:space-between;gap:6px"><span class="row" style="gap:6px">${tag(P.home)}</span><span class="row" style="gap:6px">${tag(P.away)}</span></div>
              <label class="check"><input type="checkbox" id="p-hypo"${P.hypo ? " checked" : ""}> Incluir equipos que no juegan en ${esc(P.season)} (enfrentamiento hipotético)</label></div></div>
            <div class="step done"><span class="step-n" aria-hidden="true">3</span><div class="step-b"><span class="step-t">Fecha del partido</span>
              <div class="field"><label for="p-date">Fecha prevista</label><input type="date" id="p-date" value="${esc(P.date)}"></div>
              <p class="sub">Último partido con datos: ${fdate(seasonInfo(P.comp, P.season).last_date)}. La fecha sirve para calcular los días de descanso.</p></div></div>
            <div class="step done"><span class="step-n" aria-hidden="true">4</span><div class="step-b"><span class="step-t" id="m-legend">Modelo</span>
              <div class="choices" role="radiogroup" aria-labelledby="m-legend">${["auto", "ratings", "form", "baseline"].map((m) => `<label class="choice"><input type="radio" name="p-model" value="${m}"${m === P.model ? " checked" : ""}><span><b>${MODEL[m].name}${m === "auto" ? " · aconsejado" : ""}</b><span>${MODEL[m].desc}</span></span></label>`).join("")}</div></div></div>
            <div class="step"><span class="step-n" aria-hidden="true">5</span><div class="step-b"><span class="step-t">Generar</span>
              <button type="submit" class="btn primary lg block">${icon("target")} Generar predicción</button>
              ${stale ? '<p class="sub" role="status">Has cambiado la selección. Pulsa «Generar predicción» para actualizar el resultado.</p>' : ""}</div></div>
          </div>
        </form>
        <div id="res" class="stack ${stale ? "stale" : ""}" aria-live="polite"></div>
      </div></div>`;

    const upd = (key, fn) => (e) => { P[key] = e.target.type === "checkbox" ? e.target.checked : e.target.value; if (fn) fn(); renderPredecir(); };
    $("p-comp").addEventListener("change", upd("comp", () => { P.season = seasonsOf(P.comp).slice(-1)[0]; P.date = null; }));
    $("p-season").addEventListener("change", upd("season", () => { P.date = null; }));
    $("p-home").addEventListener("change", upd("home"));
    $("p-away").addEventListener("change", upd("away"));
    $("p-hypo").addEventListener("change", upd("hypo"));
    $("p-date").addEventListener("change", upd("date"));
    document.querySelectorAll('input[name="p-model"]').forEach((r) => r.addEventListener("change", upd("model")));
    $("p-swap").addEventListener("click", () => { [P.home, P.away] = [P.away, P.home]; renderPredecir(); });
    $("pf").addEventListener("submit", (e) => {
      e.preventDefault();
      if (P.home === P.away) { toast("Elige dos equipos distintos"); return; }
      G = Object.assign({}, P); renderPredecir();
      if (window.innerWidth < 1100) { const r = $("res"); if (r && r.scrollIntoView) r.scrollIntoView({ block: "start" }); }
    });
    renderResult();
  }

  function cmpRow(label, hv, av, extra, chips) {
    const mx = Math.max(hv, av, 1e-9);
    return `<div class="cmp"><div class="cmp-h"><span class="t">${label}${chips || ""}</span><span class="sub">${extra || ""}</span></div>
      <div class="cmp-r" role="img" aria-label="${esc(label)}: local ${nf(hv)}, visitante ${nf(av)}"><b class="h">${nf(hv)}</b><div class="track l"><i style="width:${(100 * hv) / mx}%"></i></div><div class="track r"><i style="width:${(100 * av) / mx}%"></i></div><b class="a">${nf(av)}</b></div></div>`;
  }

  function renderResult() {
    const out = $("res");
    const { comp, season, home: h, away: a, model, date } = G;
    const notes = [];
    if (h === a) { out.innerHTML = `<div class="notice bad"><b>Elige dos equipos distintos.</b></div>`; return; }
    const parts = participants(comp, season).map((p) => p.team_id);
    const outside = [h, a].filter((t) => !parts.includes(t));
    const isCurrent = season === D.current.season;
    const info = seasonInfo(comp, season);
    if (!isCurrent) notes.push(["info", `<b>Enfrentamiento histórico.</b> Usa los modelos tal como quedaron tras el último partido de ${esc(season)} (${fdate(info.last_date)}). No es un pronóstico de un partido futuro.`]);
    outside.forEach((t) => {
      const seen = D.participation.filter((p) => p.team_id === t).map((p) => p.season);
      const last = seen.filter((s) => s < season).slice(-1)[0], next = seen.filter((s) => s > season)[0];
      notes.push(["bad", `<b>${esc(name(t))} no juega en ${esc(compName(comp))} en ${esc(season)}.</b> ${last ? `Su última temporada en esta división dentro de los datos es ${esc(last)}` : `Aparece por primera vez en ${esc(next)}`}. Su división actual no está en los datos: es un enfrentamiento hipotético basado solo en resultados antiguos de Primera.`]);
    });
    if (isCurrent && date && date <= D.current.as_of) notes.push(["warn", `<b>La fecha no es posterior al último dato (${fdate(D.current.as_of)}).</b> La predicción solo usa información disponible hasta ese día.`]);
    if (date) { const y = +season.slice(0, 4); if (date < `${y}-07-01` || date > `${y + 1}-06-30`) notes.push(["warn", `<b>El ${fdate(date)} queda fuera de la temporada ${esc(season)}.</b>`]); }
    const played = matches.filter((r) => r[MI.season] === season && r[MI.home_id] === h && r[MI.away_id] === a);
    if (played.length) notes.push(["info", `<b>Este partido ya se jugó en ${esc(season)}:</b> ${played.map((r) => `<a href="#partido/${esc(mid(r))}">${fdate(r[MI.date])}, ${esc(name(h))} ${r[MI.home_goals]}-${r[MI.away_goals]} ${esc(name(a))}</a>`).join("; ")}.`]);

    const g = predictStat("goals", model, season, h, a, date);
    if (g.error) { out.innerHTML = notes.map(([k, t]) => `<div class="notice ${k}">${t}</div>`).join("") + `<div class="notice bad"><b>No se puede predecir.</b> ${esc(g.error)}</div>`; lastResult = null; return; }
    const dist = FM.distribution(g.draws, D.models.goals.nb_size, 10, true);
    let pH = 0, pD = 0, pA = 0; const cells = [];
    dist.G.forEach((row, i) => row.forEach((v, j) => { if (i > j) pH += v; else if (i === j) pD += v; else pA += v; cells.push([i, j, v]); }));
    cells.sort((x, y) => y[2] - x[2]);
    const btts = 1 - dist.H[0] - dist.A[0] + dist.G[0][0];
    const e1 = evidence(season, h), e2 = evidence(season, a);
    const weak = [[h, e1], [a, e2]].filter(([, e]) => e.level[1] === "bad");
    if (weak.length) notes.push(["warn", `<b>${weak.map(([t]) => esc(name(t))).join(" y ")} ${weak.length > 1 ? "tienen" : "tiene"} pocos datos.</b> ${g.used === "ratings" ? "Su valoración es incierta y por eso las probabilidades salen más repartidas." : "Este modelo no amplía la incertidumbre por ello; tómalo con más cautela o usa «Fuerza de equipos»."}`]);
    if (g.fallback) notes.push(["info", `<b>Se usa «Fuerza de equipos» para los goles</b> porque la forma reciente necesita que ambos equipos hayan jugado en ${esc(season)}.`]);

    const used = { goals: g.used };
    const stats = {};
    PRED_STATS.forEach((s) => {
      const r = predictStat(s, model, season, h, a, date);
      if (r.error) { stats[s] = { error: r.error }; return; }
      used[s] = r.used;
      const N = Math.ceil((r.mean[0] + r.mean[1]) * 2.5 + 12);
      const d = FM.distribution(r.draws, D.models[s].nb_size, N, false);
      const tot = r.mean[0] + r.mean[1], line = Math.floor(tot) + 0.5;
      const bm = D.backtest[s] && D.backtest[s].metrics.test_overall;
      const noSkill = bm && r.used !== "baseline" && bm[r.used].poisson_deviance >= bm.baseline.poisson_deviance * 0.995;
      stats[s] = { mean: r.mean, lo: FM.quantile(d.T, 0.1), hi: FM.quantile(d.T, 0.9), line, pOver: FM.over(d.T, line), noSkill, used: r.used };
    });
    const statRow = (s) => {
      const x = stats[s];
      if (!x) return "";
      if (x.error) return `<div class="cmp"><div class="cmp-h"><span class="t">${STAT[s]}</span></div><p class="sub">${esc(x.error)}</p></div>`;
      return cmpRow(STAT[s], x.mean[0], x.mean[1], `Total estimado ${nf(x.mean[0] + x.mean[1])} · 80 % entre ${x.lo} y ${x.hi} · más de ${nf(x.line)}: ${pc(x.pOver)}`,
        x.noSkill ? ' <span class="chip warn" title="En las temporadas de prueba este modelo no mejoró a la media de la liga para esta estadística">no mejora a la media</span>' : "");
    };
    const modelLabel = model === "auto" ? `Recomendado (${[...new Set(Object.values(used))].map((m) => MODEL[m].name.toLowerCase()).join(" y ")})` : MODEL[model].name;
    lastResult = { comp, season, home: h, away: a, date, model, asOf: isCurrent ? D.current.as_of : info.last_date, probs: [pH, pD, pA], xg: g.mean,
      top: cells.slice(0, 3).map(([i, j, v]) => [i, j, v]), stats: Object.fromEntries(Object.entries(stats).filter(([, v]) => v.mean).map(([k, v]) => [k, v.mean])), hypothetical: outside.length > 0, historical: !isCurrent };
    const q3 = pct3([pH, pD, pA]);
    const bt = D.backtest.goals && D.backtest.goals.metrics.test_outcome;
    const modelLL = bt && bt[g.used] ? bt[g.used].log_loss : null;
    const homeAdv = Math.exp(D.models.goals.snapshots[season].ratings.theta[1]) - 1;

    out.innerHTML = `${notes.map(([k, t]) => `<div class="notice ${k}">${t}</div>`).join("")}
      <section class="card" aria-labelledby="r-h">
        <div class="card-h"><span class="label" id="r-h">${esc(compName(comp))} · ${esc(season)}${date ? " · " + fdate(date) : ""}</span>
          <span class="row" style="gap:6px">${outside.length ? '<span class="chip bad">Hipotético</span>' : !isCurrent ? '<span class="chip">Histórico</span>' : ""}<span class="chip acc">${esc(modelLabel)}</span></span></div>
        <div class="match"><div class="side-t h">${crest(h, "lg")}<span class="label">Local</span><span class="tn">${esc(name(h))}</span>${formChips(lastResults(season, h))}</div>
          <span class="vs">vs</span>
          <div class="side-t a">${crest(a, "lg")}<span class="label">Visitante</span><span class="tn">${esc(name(a))}</span>${formChips(lastResults(season, a))}</div></div>
      </section>
      <section class="card" aria-labelledby="rp1"><div class="card-h"><h2 id="rp1">Resultado probable</h2>${TAG_MODEL}</div>
        <div class="pbar" role="img" aria-label="Victoria local ${q3[0]} %, empate ${q3[1]} %, victoria visitante ${q3[2]} %">
          <div class="H" style="flex:${pH}">${pH > 0.1 ? "1" : ""}</div><div class="D" style="flex:${pD}">${pD > 0.1 ? "X" : ""}</div><div class="A" style="flex:${pA}">${pA > 0.1 ? "2" : ""}</div></div>
        <div class="pvals">${[`1 · Gana ${esc(name(h))}`, "X · Empate", `2 · Gana ${esc(name(a))}`].map((l, i) => `<div${i === argmax([pH, pD, pA]) ? ' class="top"' : ""}><span class="label">${l}</span><b>${q3[i]} %</b></div>`).join("")}</div>
        <div class="row" style="gap:8px"><span class="chip ${clarity([pH, pD, pA]).cls}">${clarity([pH, pD, pA]).label}</span>${hint(esc(clarityHelp()))}</div>
        <p class="foot">Son estimaciones, no garantías. Cuota justa equivalente: ${nf(1 / pH, 2)} · ${nf(1 / pD, 2)} · ${nf(1 / pA, 2)}. ${modelLL ? `En las temporadas de prueba este modelo obtuvo una ${gl("logloss")} de ${nf(modelLL, 3)} (cuotas del mercado: ${nf(bt.market.log_loss, 3)}).` : ""}</p>
      </section>
      <section class="card" aria-labelledby="rp2"><div class="card-h"><h2 id="rp2">Goles esperados</h2>${TAG_MODEL}</div>
        <div class="xg"><div class="h"><span class="label">${esc(name(h))}</span><b>${nf(g.mean[0], 2)}</b></div><div class="mid">media<br>estimada</div><div class="a"><span class="label">${esc(name(a))}</span><b>${nf(g.mean[1], 2)}</b></div></div>
        <p class="sub">Son medias, no un marcador: un 1,6 significa que, repitiendo este partido muchas veces, el equipo marcaría de media 1,6 goles.</p>
        <div class="stack"><span class="label">Marcadores más probables</span>
          <div class="scores">${cells.slice(0, 8).map(([i, j, v]) => `<div class="score"><b>${i}-${j}</b><span class="sub">${pc(v, 1)}</span><span class="mini"><i style="width:${(100 * v) / cells[0][2]}%"></i></span></div>`).join("")}</div></div>
        <div class="minis">
          <div><span class="label">Más de 1,5 goles</span><b>${pc(FM.over(dist.T, 1.5))}</b></div>
          <div><span class="label">Más de 2,5 goles</span><b>${pc(FM.over(dist.T, 2.5))}</b></div>
          <div><span class="label">Más de 3,5 goles</span><b>${pc(FM.over(dist.T, 3.5))}</b></div>
          <div><span class="label">Marcan ambos</span><b>${pc(btts)}</b></div>
        </div>
      </section>
      <section class="card tight" aria-labelledby="rp3"><h2 id="rp3">Remates</h2><div class="teamkey"><span class="h">${esc(name(h))}</span><span class="a">${esc(name(a))}</span></div>${statRow("shots")}${statRow("sot")}</section>
      <section class="card tight" aria-labelledby="rp4"><h2 id="rp4">Córneres</h2><div class="teamkey"><span class="h">${esc(name(h))}</span><span class="a">${esc(name(a))}</span></div>${statRow("corners")}</section>
      <section class="card tight" aria-labelledby="rp5"><h2 id="rp5">Disciplina</h2><div class="teamkey"><span class="h">${esc(name(h))}</span><span class="a">${esc(name(a))}</span></div>${statRow("yellows")}${statRow("reds")}${statRow("fouls")}
        <p class="foot">Las tarjetas dependen mucho del árbitro, y los archivos no incluyen esa información.</p></section>
      <section class="card tight" aria-labelledby="rp6"><h2 id="rp6">Posesión</h2><p class="sub">No disponible. ${esc(STAT_HELP.possession)}</p></section>
      <section class="card tight" aria-labelledby="rp7"><h2 id="rp7">Otros indicadores</h2><div class="teamkey"><span class="h">${esc(name(h))}</span><span class="a">${esc(name(a))}</span></div>${statRow("ht_goals")}
        <p class="foot">Valores medios estimados por equipo. El rango del 80 % indica entre qué valores debería quedar el total del partido en 8 de cada 10 casos.</p></section>
      <div class="row"><button type="button" class="btn primary" id="save">Guardar predicción</button><a class="btn secondary" href="#historial">Ver historial</a></div>
      <details class="why"><summary>¿Por qué esta predicción?</summary><div>
        <p><b>Modelo.</b> ${esc(modelLabel)}. ${esc(MODEL[g.used].desc)}</p>
        <ul class="clean">
          <li>Jugar en casa añade de media un ${pc(homeAdv)} de goles al local según los datos.</li>
          ${[[h, e1], [a, e2]].map(([t, e]) => `<li><b>${esc(name(t))}</b>: ${e.att == null ? "sin valoración" : `marca un ${pc(Math.abs(Math.exp(e.att) - 1))} ${e.att >= 0 ? "más" : "menos"} y encaja un ${pc(Math.abs(Math.exp(e.dfn) - 1))} ${e.dfn >= 0 ? "más" : "menos"} que un equipo medio`}. Valoración basada ${esc(e.basis)}.</li>`).join("")}
        </ul>
        ${[[h, e1, "home"], [a, e2, "away"]].map(([t, e, side]) => evidenceBlock(season, t, e, side)).join("")}
        <div><b>Limitaciones</b><ul class="clean">
          <li>Los modelos no conocen alineaciones, lesiones, fichajes ni el árbitro.</li>
          <li>Los equipos ascendidos parten de lo que hicieron otros ascendidos en su primera temporada; no hay datos de Segunda División.</li>
          <li>Las probabilidades se calculan suponiendo que los goles de cada equipo son independientes entre sí.</li>
          <li>La posesión no está en los datos y no se estima.</li>
        </ul></div>
      </div></details>`;
    $("save").addEventListener("click", () => {
      if (!lastResult) return;
      const list = saved();
      list.push(Object.assign({ id: Date.now().toString(36), savedAt: new Date().toISOString() }, lastResult));
      toast(store.set("saved", list) ? "Predicción guardada en el historial" : "No se pudo guardar: el almacenamiento del navegador no está disponible");
    });
  }

  function evidenceBlock(season, t, e, side) {
    const p = partRow(P.comp, season, t);
    const chips = [`<span class="chip ${e.level[1]}">${e.level[0]}</span>`];
    if (p) chips.push(`<span class="chip ${STATUS[p.status][1]}">${STATUS[p.status][0]}</span>`); else chips.push(`<span class="chip bad">No juega en ${esc(season)}</span>`);
    if (e.prior === "empirical_entrant_prior") chips.push('<span class="chip warn">Punto de partida de ascendidos</span>');
    if (e.prior === "conservative_league_average") chips.push('<span class="chip bad">Punto de partida prudente</span>');
    return `<div class="stack" style="border-top:1px solid var(--line-2);padding-top:12px">
      <div class="row" style="justify-content:space-between"><h3 style="color:var(--${side})">${esc(name(t))}</h3><div class="row" style="gap:6px">${chips.join("")}</div></div>
      <div class="ev" role="img" aria-label="De dónde sale la valoración: ${pc(e.shares.cur)} de ${esc(season)}, ${pc(e.shares.prev)} de temporadas anteriores, ${pc(e.shares.prior)} del punto de partida"><div class="cur" style="width:${100 * e.shares.cur}%"></div><div class="prev" style="width:${100 * e.shares.prev}%"></div><div class="pri" style="width:${100 * e.shares.prior}%"></div></div>
      <div class="legend"><span><i style="background:var(--accent)"></i>${esc(season)}: ${pc(e.shares.cur)}</span><span><i style="background:var(--text-3)"></i>Temporadas anteriores: ${pc(e.shares.prev)}</span><span><i style="background:var(--warn)"></i>Punto de partida: ${pc(e.shares.prior)}</span></div>
      <p class="sub">${e.nCur} partido${e.nCur === 1 ? "" : "s"} en ${esc(season)} y ${e.nPrev} en temporadas anteriores del archivo. Ataque ${signed(e.att)} ± ${nf(e.attSe, 2)}, defensa ${signed(e.dfn)} ± ${nf(e.dfnSe, 2)} (escala logarítmica; en defensa, más alto significa que encaja más).</p></div>`;
  }

  // ================================================================ PARTIDOS
  const PF_DEFAULT = { season: D.current.season, team: "", status: "todos", from: "", to: "", clar: "todas", q: "" };
  const PF = Object.assign({}, PF_DEFAULT, store.get("partidos", {}));
  let pfLimit = 6;

  function renderPartidos() {
    const comp = D.current.competition, seasons = seasonsOf(comp);
    if (!seasons.includes(PF.season)) PF.season = D.current.season;
    const parts = participants(comp, PF.season).map((p) => p.team_id).sort((a, b) => name(a).localeCompare(name(b), "es"));
    if (PF.team && !parts.includes(PF.team)) PF.team = "";
    const curParts = participants(comp, D.current.season).map((p) => p.team_id).sort((a, b) => name(a).localeCompare(name(b), "es"));
    const cs = customs();
    const sel = (id, label, opts, val, extra = "") => `<div class="field"><label for="${id}">${label}${extra}</label><select id="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === val ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`;
    $app.innerHTML = `<div class="page">
      <div class="head"><span class="eyebrow">${esc(compName(comp))}</span><h1>Partidos</h1>
        <p class="lede">Resultados reales de cada temporada, próximos partidos y los que crees tú. Pulsa un partido para ver su ficha.</p></div>
      <form class="filters" id="pf-form" role="search" aria-label="Filtrar partidos" onsubmit="return false">
        ${sel("f-season", "Temporada", seasons.slice().reverse().map((s) => [s, s + (s === D.current.season ? " (actual)" : "")]), PF.season)}
        ${sel("f-team", "Equipo", [["", "Todos los equipos"]].concat(parts.map((t) => [t, name(t)])), PF.team)}
        ${sel("f-status", "Estado", [["todos", "Todos"], ["jugados", "Jugados"], ["proximos", "Próximos (calendario)"], ["creados", "Creados por ti"]], PF.status)}
        ${sel("f-clar", "Claridad del pronóstico", [["todas", "Todas"], ["alta", "Favorito claro"], ["media", "Favorito ajustado"], ["baja", "Partido abierto"]], PF.clar, hint(esc(clarityHelp())))}
        <div class="field"><label for="f-from">Desde</label><input type="date" id="f-from" value="${esc(PF.from)}"></div>
        <div class="field"><label for="f-to">Hasta</label><input type="date" id="f-to" value="${esc(PF.to)}"></div>
        <div class="field"><label for="f-q">Buscar equipo</label><input type="search" id="f-q" value="${esc(PF.q)}" placeholder="Por ejemplo, Betis" autocomplete="off"></div>
        <button type="button" class="btn quiet" id="f-reset">Restablecer</button>
      </form>
      <div id="pf-list" class="stack" style="gap:18px" aria-live="polite"></div>
      <details class="adv" id="cu-box"><summary>Crear un partido (${cs.length} guardado${cs.length === 1 ? "" : "s"})</summary><div>
        <p class="sub">Para estimar un enfrentamiento que aún no está en el calendario. Se guarda solo en este navegador y aparece en la lista con el estado «Creados por ti».</p>
        <form id="cf" class="stack" novalidate>
          <div class="pair"><div class="field"><label for="c-home">Local</label><select id="c-home">${curParts.map((t) => `<option value="${t}">${esc(name(t))}</option>`).join("")}</select></div><span></span>
            <div class="field"><label for="c-away">Visitante</label><select id="c-away">${curParts.map((t, i) => `<option value="${t}"${i === 1 ? " selected" : ""}>${esc(name(t))}</option>`).join("")}</select></div></div>
          <div class="row" style="align-items:end"><div class="field" style="flex:1 1 160px"><label for="c-date">Fecha</label><input type="date" id="c-date" value="${defaultDate(D.current.season)}"></div>
            <button type="submit" class="btn primary">Añadir partido</button></div>
          <p class="sub" id="c-msg" role="status"></p>
        </form>
        ${cs.length ? `<div class="list">${cs.map((c, i) => `<div class="row" style="justify-content:space-between"><span>${tm(c.home)} – ${tm(c.away)}<br><span class="sub">${fdate(c.date)} · ${esc(c.season)}</span></span>
          <button type="button" class="btn quiet small" data-cd="${i}" aria-label="Eliminar ${esc(name(c.home))} contra ${esc(name(c.away))}">Eliminar</button></div>`).join("")}</div>` : ""}
      </div></details>
    </div>`;

    const save = () => store.set("partidos", PF);
    const on = (id, key, full) => $(id).addEventListener(id === "f-q" ? "input" : "change", (e) => { PF[key] = e.target.value; pfLimit = 6; save(); if (full) renderPartidos(); else drawPartidosList(); });
    on("f-season", "season", true); on("f-team", "team"); on("f-status", "status"); on("f-clar", "clar"); on("f-from", "from"); on("f-to", "to"); on("f-q", "q");
    $("f-reset").addEventListener("click", () => { Object.assign(PF, PF_DEFAULT); pfLimit = 6; save(); renderPartidos(); });
    document.querySelectorAll("[data-cd]").forEach((b) => b.addEventListener("click", () => { const l = customs(); l.splice(+b.dataset.cd, 1); store.set("custom", l); toast("Partido eliminado"); renderPartidos(); $("cu-box").open = true; }));
    $("cf").addEventListener("submit", (e) => {
      e.preventDefault();
      const c = { home: $("c-home").value, away: $("c-away").value, date: $("c-date").value, season: D.current.season };
      if (c.home === c.away) { $("c-msg").textContent = "El local y el visitante deben ser equipos distintos."; return; }
      if (!c.date) { $("c-msg").textContent = "Indica la fecha del partido."; return; }
      const l = customs(); l.push(c);
      if (!store.set("custom", l)) { $("c-msg").textContent = "No se pudo guardar: el almacenamiento del navegador no está disponible."; return; }
      toast("Partido añadido"); renderPartidos(); $("cu-box").open = true;
    });
    drawPartidosList();
  }

  function drawPartidosList() {
    const out = $("pf-list"); if (!out) return;
    const comp = D.current.competition, q = fold(PF.q.trim());
    const teamOk = (h, a) => (!PF.team || h === PF.team || a === PF.team) && (!q || fold(name(h)).includes(q) || fold(name(a)).includes(q));
    const dateOk = (d) => (!PF.from || d >= PF.from) && (!PF.to || d <= PF.to);
    const clarOk = (p) => PF.clar === "todas" || (p && clarity(p).k === PF.clar);
    const upRef = {};
    let upcoming = [];
    if (PF.season === D.current.season && (PF.status === "todos" || PF.status === "proximos")) upcoming = upcoming.concat(upcomingFixtures().map((f, i) => ["f" + i, f]));
    if (PF.status === "todos" || PF.status === "creados") upcoming = upcoming.concat(customs().map((c, i) => ["c" + i, { season: c.season, date: c.date, home_id: c.home, away_id: c.away }]).filter(([, f]) => f.season === PF.season));
    upcoming = upcoming.filter(([, f]) => teamOk(f.home_id, f.away_id) && dateOk(f.date) && (PF.clar === "todas" || clarOk((forecast(f.home_id, f.away_id, f.date) || {}).p)));
    upcoming.sort((x, y) => x[1].date.localeCompare(y[1].date));
    upcoming.forEach(([k, f]) => (upRef[k] = f));
    const played = PF.status === "todos" || PF.status === "jugados"
      ? matches.filter((r) => r[MI.season] === PF.season && r[MI.competition] === comp && teamOk(r[MI.home_id], r[MI.away_id]) && dateOk(r[MI.date]) && (PF.clar === "todas" || clarOk((prematch(r) || {}).p)))
      : [];
    const blocks = dateBlocks(played, (r) => r[MI.date]).reverse();
    const shown = PF.team || PF.q.trim() ? blocks : blocks.slice(0, pfLimit);   // un equipo juega como mucho 38 partidos: se ven todos
    const total = upcoming.length + played.length;
    const active = Object.keys(PF_DEFAULT).filter((k) => k !== "season" && PF[k] !== PF_DEFAULT[k]).length;
    out.innerHTML = `<div class="resbar"><span class="sub">${total} partido${total === 1 ? "" : "s"}${active ? ` con ${active} filtro${active > 1 ? "s" : ""} activo${active > 1 ? "s" : ""}` : ""} en ${esc(PF.season)}${PF.clar !== "todas" ? ". Solo se incluyen los partidos con pronóstico" : ""}.</span></div>
      ${upcoming.length ? `<section class="stack" aria-labelledby="pu-h"><div class="wk"><h3 id="pu-h">Próximos y creados por ti</h3><span class="sub">${TAG_MODEL}</span></div><div class="mgrid">${upcoming.map(([k, f]) => upcomingCard(f, k)).join("")}</div></section>`
        : PF.season === D.current.season && (PF.status === "proximos" || PF.status === "todos") && !active ? `<div class="notice info"><b>Sin próximos partidos.</b> ${esc(calendarStatus())}</div>` : ""}
      ${shown.map((b) => `<section class="stack"><div class="wk"><h3>${esc(blockLabel(b))}</h3><span class="sub">${b.items.length} partido${b.items.length > 1 ? "s" : ""}</span></div>
        <div class="mgrid">${b.items.slice().reverse().map(playedCard).join("")}</div></section>`).join("")}
      ${blocks.length > shown.length ? `<div class="row" style="justify-content:center"><button type="button" class="btn secondary" id="pf-more">Mostrar más fechas (${blocks.length - shown.length} restantes)</button></div>` : ""}
      ${!total ? `<div class="empty"><p><b>Ningún partido coincide con los filtros.</b> Prueba con otra temporada, otro equipo o un rango de fechas más amplio.</p><button type="button" class="btn secondary small" id="pf-clear">Quitar filtros</button></div>` : ""}`;
    bindUpcoming(upRef);
    const more = $("pf-more"); if (more) more.addEventListener("click", () => { pfLimit += 6; drawPartidosList(); });
    const clr = $("pf-clear"); if (clr) clr.addEventListener("click", () => { Object.assign(PF, PF_DEFAULT, { season: PF.season }); store.set("partidos", PF); renderPartidos(); });
  }

  // ================================================================ FICHA DE PARTIDO
  const MATCH_STATS = [["goals", "Goles"], ["ht_goals", "Goles al descanso"], ["shots", "Remates"], ["sot", "Remates a puerta"], ["corners", "Córneres"], ["fouls", "Faltas cometidas"], ["yellows", "Tarjetas amarillas"], ["reds", "Tarjetas rojas"]];
  const STAT_COLS = { goals: ["home_goals", "away_goals"], ht_goals: ["ht_home_goals", "ht_away_goals"], shots: ["home_shots", "away_shots"], sot: ["home_sot", "away_sot"], corners: ["home_corners", "away_corners"], fouls: ["home_fouls", "away_fouls"], yellows: ["home_yellows", "away_yellows"], reds: ["home_reds", "away_reds"] };

  function renderPartido(id) {
    const r = id && MATCH_BY_ID.get(id);
    if (!r) {
      $app.innerHTML = `<div class="page"><div class="empty"><h2>No se ha encontrado el partido</h2><p>Puede que el enlace sea de una versión anterior de los datos.</p><a class="btn primary" href="#partidos">Ver todos los partidos</a></div></div>`;
      return;
    }
    const h = r[MI.home_id], a = r[MI.away_id], hg = r[MI.home_goals], ag = r[MI.away_goals], season = r[MI.season], date = r[MI.date];
    const k = outcomeIdx(hg, ag), pm = prematch(r);
    const statRows = MATCH_STATS.map(([s, label]) => {
      const [ch, ca] = STAT_COLS[s]; const vh = r[MI[ch]], va = r[MI[ca]];
      if (vh == null || va == null) return "";
      const mx = Math.max(vh, va, 1e-9), ex = pm && pm.stat(s);
      return `<div class="vsrow" role="img" aria-label="${esc(label)}: ${esc(name(h))} ${vh}, ${esc(name(a))} ${va}${ex ? `; esperado ${nf(ex.h)} y ${nf(ex.a)}` : ""}"><b class="h">${vh}</b>
        <div class="mid"><span>${esc(label)}</span><div class="bars"><div class="track l"><i style="width:${(100 * vh) / mx}%"></i></div><div class="track r"><i style="width:${(100 * va) / mx}%"></i></div></div>
        ${ex ? `<span class="exp">Esperado antes del partido: ${nf(ex.h)} – ${nf(ex.a)}</span>` : ""}</div><b class="a">${va}</b></div>`;
    }).join("");
    const xgH = r[MI.home_xg_undocumented], xgA = r[MI.away_xg_undocumented];
    const formBefore = (t) => lastResults(season, t, 5, date);
    const h2h = matches.filter((x) => (x[MI.home_id] === h && x[MI.away_id] === a) || (x[MI.home_id] === a && x[MI.away_id] === h));
    const rec = { h: 0, d: 0, a: 0 };
    h2h.filter((x) => x[MI.date] < date).forEach((x) => { const hgx = x[MI.home_id] === h ? x[MI.home_goals] : x[MI.away_goals], agx = x[MI.home_id] === h ? x[MI.away_goals] : x[MI.home_goals]; rec[hgx > agx ? "h" : hgx === agx ? "d" : "a"]++; });
    const firstVal = D.backtest.goals ? D.backtest.goals.validation_seasons[0] : null;
    const formList = (t) => { const lr = formBefore(t); return lr.length ? `<div class="formlist">${lr.slice().reverse().map((x) => `<a href="#partido/${esc(x.id)}"><i class="${x.res}">${RES_ES[x.res][0]}</i><span>${x.home ? "vs" : "en"} ${esc(name(x.opp))} <span class="sub">· ${fdate(x.date)}</span></span><b>${x.gf}-${x.ga}</b></a>`).join("")}</div>` : `<p class="sub">Es su primer partido de ${esc(season)}.</p>`; };
    const mq = pm && pm.market ? pct3(pm.market) : null;
    const gx = pm && pm.stat("goals");

    $app.innerHTML = `<div class="page">
      <div class="row" style="justify-content:space-between"><a class="btn quiet small" href="#partidos">← Volver a partidos</a><span class="row" style="gap:6px">${TAG_REAL}<span class="chip">${esc(compName(r[MI.competition]))} · ${esc(season)}</span></span></div>
      <section class="hero" aria-labelledby="m-h">
        <h1 id="m-h" class="sr-only">${esc(name(h))} ${hg}-${ag} ${esc(name(a))}</h1>
        <div class="scorehead">
          <div class="t h">${crest(h, "lg")}<b>${esc(name(h))}</b><button type="button" class="btn quiet small" data-team="${esc(h)}">Ficha del equipo</button></div>
          <div class="bigscore">${hg} – ${ag}<small>${r[MI.ht_home_goals] != null ? `Descanso ${r[MI.ht_home_goals]} – ${r[MI.ht_away_goals]}` : ""}</small></div>
          <div class="t a">${crest(a, "lg")}<b>${esc(name(a))}</b><button type="button" class="btn quiet small" data-team="${esc(a)}">Ficha del equipo</button></div>
        </div>
        <p class="sub" style="text-align:center;margin:0 auto">${esc(dlong(date))}${r[MI.kickoff] ? ` · ${esc(r[MI.kickoff])}` : ""} · Archivo ${esc(r[MI.source_file])}</p>
      </section>
      <div class="cols two">
        <section class="card" aria-labelledby="ms-h"><div class="card-h"><h2 id="ms-h">Estadísticas del partido</h2>${TAG_REAL}</div>
          <div class="teamkey"><span class="h">${esc(name(h))}</span><span class="a">${esc(name(a))}</span></div>
          <div>${statRows}</div>
          ${xgH != null && xgA != null ? `<p class="foot">xG en el archivo: ${nf(xgH, 2)} – ${nf(xgA, 2)} ${hint(esc(STAT_HELP.xg_undocumented))}</p>` : ""}
          <p class="foot">Datos de football-data.co.uk. La posesión no está en los archivos.</p></section>
        <section class="card" aria-labelledby="pp-h"><div class="card-h"><h2 id="pp-h">Pronóstico previo</h2>${TAG_MODEL}</div>
          ${pm ? `<p class="sub">Calculado solo con los partidos jugados antes de esa semana, con el modelo «${esc(MODEL[pm.model].name)}». El tramo recuadrado es lo que pasó. ${hint("Es la validación cronológica: para cada semana se reentrena el modelo sin ver esos partidos ni los posteriores. Así se comprueba cómo habría acertado de verdad.")}</p>
            ${probBar(pm.p, h, a, { hit: k, lg: true })}
            <div class="minis">
              <div><span class="label">Probabilidad del resultado real</span><b>${pct3(pm.p)[k]} %</b></div>
              ${gx ? `<div><span class="label">Goles esperados</span><b>${nf(gx.h, 2)} – ${nf(gx.a, 2)}</b></div>` : ""}
              <div><span class="label">Claridad ${hint(esc(clarityHelp()))}</span><b style="font-size:20px">${clarity(pm.p).label}</b></div>
            </div>
            ${mq ? `<p class="foot">Referencia de las casas de apuestas (media, sin margen): 1 · ${mq[0]} %, X · ${mq[1]} %, 2 · ${mq[2]} %. Nunca se usa para predecir.</p>` : ""}
            <p class="foot">Son estimaciones, no garantías: si el modelo da un 60 % a un resultado, cabe esperar que no se cumpla en unas 4 de cada 10 situaciones parecidas.</p>`
            : `<div class="empty"><p>No hay pronóstico previo para este partido. ${firstVal ? `La validación empieza en ${esc(firstVal)}; las temporadas anteriores solo sirven para entrenar.` : "Los modelos se prepararon sin evaluación."}</p></div>`}
          <div class="row"><button type="button" class="btn secondary small" id="m-pred">Predecir este enfrentamiento hoy</button></div>
        </section>
      </div>
      <section class="card" aria-labelledby="mf-h"><div class="card-h"><h2 id="mf-h">Forma antes del partido</h2>${TAG_REAL}</div>
        <div class="cols two"><div class="stack"><h3 style="color:var(--home)">${esc(name(h))}</h3>${formList(h)}</div><div class="stack"><h3 style="color:var(--away)">${esc(name(a))}</h3>${formList(a)}</div></div>
        <p class="foot">Últimos cinco partidos de ${esc(season)} antes de esta fecha; el más reciente, arriba.</p></section>
      <section class="card" aria-labelledby="hh-h"><div class="card-h"><h2 id="hh-h">Historial de enfrentamientos</h2>${TAG_REAL}</div>
        <div class="h2h"><div><b style="color:var(--home)">${rec.h}</b><span class="sub">Victorias de ${esc(name(h))}</span></div><div><b>${rec.d}</b><span class="sub">Empates</span></div><div><b style="color:var(--away)">${rec.a}</b><span class="sub">Victorias de ${esc(name(a))}</span></div></div>
        <p class="sub">Antes de este partido, en las temporadas del archivo (${esc(seasonsOf(r[MI.competition])[0])} en adelante).</p>
        <div class="formlist h2hl">${h2h.slice().reverse().map((x) => `<a href="#partido/${esc(mid(x))}"${mid(x) === id ? ' aria-current="true"' : ""}><span class="sub">${fdate(x[MI.date])}</span><span>${esc(name(x[MI.home_id]))} – ${esc(name(x[MI.away_id]))}</span><b>${x[MI.home_goals]}-${x[MI.away_goals]}</b></a>`).join("")}</div></section>
    </div>`;
    document.querySelectorAll("[data-team]").forEach((b) => b.addEventListener("click", () => openTeam(b.dataset.team, season)));
    $("m-pred").addEventListener("click", () => goPredict({ home: h, away: a, date: null }));
  }

  // ================================================================ EQUIPOS
  const S = Object.assign({ comp: D.current.competition, season: D.current.season, team: null }, store.get("teams2", {}));
  if (!seasonsOf(S.comp).includes(S.season)) S.season = D.current.season;
  const teamBtn = (t) => `<button type="button" class="linkbtn tm" data-team="${esc(t)}">${crest(t, "sm")}<span>${esc(name(t))}</span></button>`;

  function renderEquipos() {
    store.set("teams2", { comp: S.comp, season: S.season, team: S.team });
    const info = seasonInfo(S.comp, S.season), seasons = seasonsOf(S.comp);
    const parts = participants(S.comp, S.season);
    const table = D.tables[S.season] || [];
    const pos = Object.fromEntries(table.map((r) => [r.team, r]));
    const entered = parts.filter((p) => p.status === "entered"), left = parts.filter((p) => p.left_after === true);
    const totalN = (t) => D.participation.filter((p) => p.team_id === t).reduce((s, p) => s + p.matches, 0);
    const notIn = Object.keys(D.teams).filter((t) => !parts.some((p) => p.team_id === t)).sort((a, b) => name(a).localeCompare(name(b), "es"));
    const first = seasons.indexOf(S.season) === 0, last = S.season === seasons[seasons.length - 1];
    $app.innerHTML = `<div class="page">
      <div class="head"><span class="eyebrow">Equipos</span><h1>Equipos por temporada</h1><p class="lede">Quién jugó cada temporada, quién subió o bajó y cuántos datos hay de cada equipo.</p></div>
      <div class="row" style="align-items:end">
        <div class="field" style="flex:0 1 260px"><label for="s-comp">Competición</label><select id="s-comp">${Object.keys(D.competitions).map((c) => `<option value="${esc(c)}"${c === S.comp ? " selected" : ""}>${esc(compName(c))}</option>`).join("")}</select></div>
        <div class="field" style="flex:0 1 170px"><label for="s-season">Temporada</label><select id="s-season">${seasons.slice().reverse().map((s) => `<option value="${s}"${s === S.season ? " selected" : ""}>${s}${s === D.current.season ? " (actual)" : ""}</option>`).join("")}</select></div>
      </div>
      <div id="profile"></div>
      ${info.state !== "complete" ? `<div class="notice"><b>${esc(S.season)} está en curso:</b> ${info.matches} de ${info.expected_matches_double_round_robin} partidos (${pc(info.completeness)}). La clasificación y las medias son hasta la fecha, y aún no se sabe quién desciende.</div>` : ""}
      ${first ? `<div class="notice info"><b>${esc(S.season)} es la primera temporada del archivo,</b> así que no se puede saber qué equipos venían de ascender.</div>` : ""}
      <div class="cols two">
        <section class="card tight" aria-labelledby="en-h"><h2 id="en-h">Ascendidos o que regresan</h2>
          ${entered.length ? `<div class="list">${entered.map((p) => `<div>${teamBtn(p.team_id)}<br><span class="sub">${p.prior_seasons_in_comp ? `Regresa; su última temporada en Primera dentro de los datos fue ${esc(p.last_prior_season)}` : "Sin temporadas anteriores en Primera dentro de los datos"}</span></div>`).join("")}</div>` : `<p class="sub">${first ? "Desconocido (primera temporada del archivo)." : "Ninguno."}</p>`}
          <p class="foot">Vienen de una división inferior que no está en los datos.</p></section>
        <section class="card tight" aria-labelledby="le-h"><h2 id="le-h">Descendidos al terminar</h2>
          ${left.length ? `<div class="list">${left.map((p) => `<div>${teamBtn(p.team_id)}</div>`).join("")}</div>` : `<p class="sub">${last ? "Aún no se sabe." : "Ninguno."}</p>`}
          <p class="foot">Su historial sigue disponible para el análisis.</p></section>
      </div>
      <section class="stack" aria-labelledby="pt-h"><h2 id="pt-h">Clasificación ${esc(S.season)}${info.state !== "complete" ? " (hasta la fecha)" : ""}</h2>
        <div class="tablewrap"><table><thead><tr><th class="n">Pos.</th><th>Equipo</th><th>Situación</th><th class="n">PJ</th><th class="n">G</th><th class="n">E</th><th class="n">P</th><th class="n">GF</th><th class="n">GC</th><th class="n">Pts</th><th>Forma</th><th class="n">Partidos en datos</th></tr></thead><tbody>
        ${parts.slice().sort((x, y) => (pos[x.team_id]?.pos ?? 99) - (pos[y.team_id]?.pos ?? 99)).map((p) => { const r = pos[p.team_id] || {}; const n = totalN(p.team_id);
          return `<tr class="${p.team_id === S.team ? "sel" : ""}"><td class="n">${r.pos ?? ""}</td><td>${teamBtn(p.team_id)}</td>
          <td><span class="row" style="gap:4px;flex-wrap:nowrap"><span class="chip ${STATUS[p.status][1]}">${STATUS[p.status][0]}</span>${p.left_after ? '<span class="chip bad">Desciende</span>' : ""}</span></td>
          <td class="n">${r.p ?? 0}</td><td class="n">${r.w ?? 0}</td><td class="n">${r.d ?? 0}</td><td class="n">${r.l ?? 0}</td><td class="n">${r.gf ?? 0}</td><td class="n">${r.ga ?? 0}</td><td class="n"><b>${r.pts ?? 0}</b></td>
          <td>${formChips(lastResults(S.season, p.team_id))}</td><td class="n">${n}${n < 20 ? ' <span class="chip bad">pocos</span>' : ""}</td></tr>`; }).join("")}
        </tbody></table></div>
        <p class="foot">PJ jugados · G ganados · E empatados · P perdidos · GF goles a favor · GC goles en contra · Forma: G victoria, E empate, P derrota (más reciente a la derecha).</p></section>
      <section class="stack" aria-labelledby="ni-h"><h2 id="ni-h">Equipos que no juegan en ${esc(S.season)}</h2><p class="sub">Se conservan para el análisis histórico. Pulsa uno para ver su ficha.</p>
        <div class="row" style="gap:8px 18px">${notIn.map((t) => { const seen = D.participation.filter((p) => p.team_id === t).map((p) => p.season); return `<span>${teamBtn(t)} <span class="sub">${esc(seen[0])}${seen.length > 1 ? " a " + esc(seen[seen.length - 1]) : ""}</span></span>`; }).join("")}</div></section>
      <section class="stack" aria-labelledby="mm-h"><h2 id="mm-h">Presencia en Primera por temporada</h2>${membershipMatrix(S.comp)}</section>
    </div>`;
    $("s-comp").addEventListener("change", (e) => { S.comp = e.target.value; S.season = seasonsOf(S.comp).slice(-1)[0]; renderEquipos(); });
    $("s-season").addEventListener("change", (e) => { S.season = e.target.value; renderEquipos(); });
    document.querySelectorAll("[data-team]").forEach((b) => b.addEventListener("click", () => { S.team = b.dataset.team; renderEquipos(); const p = $("profile"); if (p.scrollIntoView) p.scrollIntoView({ block: "start" }); }));
    if (S.team) { renderProfile(S.team); if (S.scroll) { const p = $("profile"); if (p.scrollIntoView) p.scrollIntoView({ block: "start" }); } }
    S.scroll = false;
  }

  function membershipMatrix(comp) {
    const seasons = seasonsOf(comp);
    const teams = [...new Set(D.participation.filter((p) => p.competition === comp).map((p) => p.team_id))].sort((a, b) => name(a).localeCompare(name(b), "es"));
    const sym = { continuing: "●", entered: "▲", first_in_dataset: "○" };
    return `<div class="tablewrap"><table><thead><tr><th>Equipo</th>${seasons.map((s) => `<th class="c">${s}</th>`).join("")}</tr></thead><tbody>
      ${teams.map((t) => `<tr><td>${esc(name(t))}</td>${seasons.map((s) => { const p = partRow(comp, s, t); return p ? `<td class="c" title="${esc(STATUS[p.status][0])}${p.left_after ? ", desciende" : ""}">${sym[p.status]}${p.left_after ? "▼" : ""}</td>` : '<td class="c sub">·</td>'; }).join("")}</tr>`).join("")}
      </tbody></table></div><p class="foot">○ primera temporada del archivo · ● continúa · ▲ asciende o regresa · ▼ desciende al terminar · · no juega en Primera</p>`;
  }

  function renderProfile(t) {
    const el = $("profile"), seasons = seasonsOf(S.comp), ts = D.team_stats[t] || {};
    const cur = D.models.goals.snapshots[D.current.season].ratings;
    const stems = ["goals", "shots", "sot", "corners", "fouls", "yellows", "reds"];
    const rec = matches.filter((r) => r[MI.season] === S.season && (r[MI.home_id] === t || r[MI.away_id] === t));
    const gfSeries = seasons.filter((s) => ts[s] && ts[s].goals).map((s) => [s, ts[s].goals[0], ts[s].goals[1]]);
    const posNow = (D.tables[S.season] || []).find((x) => x.team === t);
    const parts = participants(D.current.competition, D.current.season).map((p) => p.team_id);
    el.innerHTML = `<section class="card" aria-labelledby="pf-h">
      <div class="card-h"><span class="tm" style="gap:14px">${crest(t, "lg")}<span><h2 id="pf-h">${esc(name(t))}</h2><span class="sub">${posNow ? `${posNow.pos}º en ${esc(S.season)} · ${posNow.pts} puntos en ${posNow.p} partidos` : `No jugó en Primera en ${esc(S.season)}`}</span></span></span>
        <span class="row" style="gap:8px">${parts.includes(t) ? '<button type="button" class="btn secondary small" id="pr-pred">Predecir un partido</button>' : ""}<button type="button" class="btn quiet small" id="pr-close">Cerrar ficha</button></span></div>
      ${rec.length ? `<div class="cols two">
        <div class="stack"><div class="row" style="justify-content:space-between"><span class="label">Últimos partidos de ${esc(S.season)}</span>${TAG_REAL}</div>
          <div class="formlist">${lastResults(S.season, t, 6).reverse().map((x) => `<a href="#partido/${esc(x.id)}"><i class="${x.res}">${RES_ES[x.res][0]}</i><span>${x.home ? "vs" : "en"} ${esc(name(x.opp))} <span class="sub">· ${fdate(x.date)}</span></span><b>${x.gf}-${x.ga}</b></a>`).join("")}</div></div>
        <div class="stack"><div class="row" style="justify-content:space-between"><span class="label">Por partido frente a la media de la liga</span>${TAG_REAL}</div>
          <div class="teamkey"><span class="h">${esc(name(t))}</span><span class="a">Media de la liga</span></div>
          <div>${stems.map((s) => { const v = (ts[S.season] || {})[s], lg = (D.quality.drift[s] || { seasons: [] }).seasons.find((x) => x.season === S.season);
            return v && lg ? cmpRow(`${STAT[s]} a favor`, v[0], lg.mean, `En contra: ${nf(v[1], 2)}`) : ""; }).join("")}</div></div>
      </div>` : ""}
      <p class="sub">Nombre en los archivos: ${esc((D.teams[t].raw_names || []).join(", "))}.</p>
      <div class="timeline">${seasons.map((s) => { const p = partRow(S.comp, s, t); const r = (D.tables[s] || []).find((x) => x.team === t); return `<div class="${p ? "" : "off"}"><span class="label">${s}</span><b>${p ? (r ? r.pos + "º" : "–") : "–"}</b><span class="sub">${p ? `${p.matches} partidos${p.status === "entered" ? " · ▲" : ""}${p.left_after ? " · ▼" : ""}` : "no está en Primera"}</span></div>`; }).join("")}</div>
      ${cur.teams.includes(t) ? `<div class="minis"><div><span class="label">Ataque actual</span><b>${signed(cur.att[t])}</b><span class="sub">± ${nf(cur.att_se[t], 2)} · marca un ${pc(Math.abs(Math.exp(cur.att[t]) - 1))} ${cur.att[t] >= 0 ? "más" : "menos"} que la media</span></div>
        <div><span class="label">Defensa actual</span><b>${signed(cur.dfn[t])}</b><span class="sub">± ${nf(cur.dfn_se[t], 2)} · encaja un ${pc(Math.abs(Math.exp(cur.dfn[t]) - 1))} ${cur.dfn[t] >= 0 ? "más" : "menos"} que la media</span></div>
        <div><span class="label">Partidos efectivos</span><b>${nf(cur.eff[t], 1)}</b><span class="sub">tras restar peso a los antiguos</span></div></div>` : ""}
      ${gfSeries.length > 1 ? `<div class="stack"><span class="label">Goles por partido y temporada</span>${lineChart(gfSeries.map((x) => x[0]), [{ vals: gfSeries.map((x) => x[1]), cls: "home", label: "A favor" }, { vals: gfSeries.map((x) => x[2]), cls: "away", label: "En contra" }], 2)}</div>` : ""}
      <div class="tablewrap"><table><thead><tr><th>Temporada</th>${stems.map((s) => `<th class="n">${STAT[s]}<br><span style="text-transform:none;letter-spacing:0">a favor / en contra</span></th>`).join("")}</tr></thead><tbody>
        ${seasons.filter((s) => ts[s]).map((s) => `<tr><td>${s}</td>${stems.map((st) => `<td class="n">${ts[s][st] ? nf(ts[s][st][0], 2) + " / " + nf(ts[s][st][1], 2) : "–"}</td>`).join("")}</tr>`).join("")}
      </tbody></table></div>
      ${rec.length ? `<details class="adv"><summary>Partidos de ${esc(S.season)} (${rec.length})</summary><div><div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Partido</th><th class="c">Resultado</th><th class="n">Remates</th><th class="n">A puerta</th><th class="n">Córneres</th></tr></thead><tbody>
        ${rec.map((r) => `<tr><td>${fdate(r[MI.date])}</td><td><a href="#partido/${esc(mid(r))}">${esc(name(r[MI.home_id]))} – ${esc(name(r[MI.away_id]))}</a></td><td class="c"><b>${r[MI.home_goals]}-${r[MI.away_goals]}</b></td><td class="n">${r[MI.home_shots] ?? "–"}-${r[MI.away_shots] ?? "–"}</td><td class="n">${r[MI.home_sot] ?? "–"}-${r[MI.away_sot] ?? "–"}</td><td class="n">${r[MI.home_corners] ?? "–"}-${r[MI.away_corners] ?? "–"}</td></tr>`).join("")}
      </tbody></table></div></div></details>` : `<p class="sub">No jugó en Primera en ${esc(S.season)}.</p>`}
    </section>`;
    $("pr-close").addEventListener("click", () => { S.team = null; renderEquipos(); });
    const pp = $("pr-pred"); if (pp) pp.addEventListener("click", () => goPredict({ home: t, away: parts.find((x) => x !== t) }));
  }

  /** Gráfico de líneas en SVG con una escala común para ejes, marcas y etiquetas. */
  function lineChart(xs, series, dec) {
    const W = 640, H = 220, L = 44, R = 16, T = 16, B = 30;
    const all = series.flatMap((s) => s.vals).filter((v) => v != null);
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.15 || hi * 0.1 || 1; lo = Math.max(0, lo - pad); hi = hi + pad;
    const step = niceStep((hi - lo) / 4); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const x = (i) => L + (xs.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (xs.length - 1));
    const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
    const ticks = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
    const color = { home: "var(--home)", away: "var(--away)", acc: "var(--accent)" };
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((s) => `${s.label}: ${s.vals.map((v, i) => xs[i] + " " + nf(v, dec)).join(", ")}`).join(". "))}">
      ${ticks.map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${nf(v, step < 1 ? (step < 0.1 ? 2 : 1) : 0)}</text>`).join("")}
      ${xs.map((s, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(s)}</text>`).join("")}
      ${series.map((s) => `<polyline fill="none" stroke="${color[s.cls]}" stroke-width="2.5" points="${s.vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")}"/>
        ${s.vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === s.vals.length - 1 ? 5 : 3.5}" fill="${color[s.cls]}"><title>${esc(s.label)} · ${esc(xs[i])}: ${nf(v, dec)}</title></circle>`).join("")}`).join("")}
    </svg>${series.length > 1 ? `<div class="legend">${series.map((s) => `<span><i style="background:${color[s.cls]}"></i>${esc(s.label)}</span>`).join("")}</div>` : ""}`;
  }
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }

  // ================================================================ ESTADÍSTICAS
  const ST = Object.assign({ stem: "goals", season: D.current.season, a: null, b: null }, store.get("stats", {}));
  function renderEstadisticas() {
    const stems = Object.keys(D.quality.drift).filter((s) => STAT[s] && s !== "xg_undocumented");
    if (!stems.includes(ST.stem)) ST.stem = "goals";
    const seasons = seasonsOf(D.current.competition);
    if (!seasons.includes(ST.season)) ST.season = D.current.season;
    const parts = participants(D.current.competition, ST.season).map((p) => p.team_id).sort((a, b) => name(a).localeCompare(name(b), "es"));
    if (!parts.includes(ST.a)) ST.a = parts.includes("barcelona") ? "barcelona" : parts[0];
    if (!parts.includes(ST.b) || ST.b === ST.a) ST.b = parts.find((t) => t !== ST.a && t === "real-madrid") || parts.find((t) => t !== ST.a);
    store.set("stats", ST);
    const dr = D.quality.drift[ST.stem].seasons;
    const rank = parts.map((t) => { const v = (D.team_stats[t] || {})[ST.season]; return [t, v && v[ST.stem] ? v[ST.stem] : null]; }).filter((x) => x[1]).sort((x, y) => y[1][0] - x[1][0]);
    const mx = Math.max(...rank.map((x) => x[1][0]), 1e-9);
    const ta = (D.team_stats[ST.a] || {})[ST.season] || {}, tb = (D.team_stats[ST.b] || {})[ST.season] || {};
    $app.innerHTML = `<div class="page">
      <div class="head"><span class="eyebrow">Estadísticas</span><h1>Análisis estadístico</h1><p class="lede">Valores medios por equipo y partido, calculados con los resultados reales de cada temporada.</p></div>
      <div class="row" style="align-items:end">
        <div class="field" style="flex:1 1 200px;max-width:280px"><label for="t-stem">Estadística</label><select id="t-stem">${stems.map((s) => `<option value="${s}"${s === ST.stem ? " selected" : ""}>${STAT[s]}</option>`).join("")}</select></div>
        <div class="field" style="flex:0 1 170px"><label for="t-season">Temporada</label><select id="t-season">${seasons.slice().reverse().map((s) => `<option value="${s}"${s === ST.season ? " selected" : ""}>${s}</option>`).join("")}</select></div>
        <button type="button" class="btn quiet" id="t-reset">Restablecer filtros</button>
      </div>
      <p class="sub">${esc(STAT_HELP[ST.stem] || "")}</p>
      <div class="cols two">
        <section class="card" aria-labelledby="ev-h"><h2 id="ev-h">Evolución de la liga</h2><p class="sub">${STAT[ST.stem]} por equipo y partido en cada temporada.</p>
          ${lineChart(dr.map((p) => p.season), [{ vals: dr.map((p) => p.mean), cls: "acc", label: STAT[ST.stem] }], 2)}
          <p class="foot">${dr.some((p) => p.flag) ? "Hay temporadas con un cambio fuera de lo normal. " : "Ningún cambio entre temporadas es lo bastante grande como para sospechar un cambio de definición. "}notes.txt no indica cambios en cómo se miden estas variables en España, así que las diferencias se tratan como tendencias reales.</p></section>
        <section class="card" aria-labelledby="rk-h"><h2 id="rk-h">Clasificación por ${STAT[ST.stem].toLowerCase()}</h2><p class="sub">Media a favor por partido en ${esc(ST.season)}.</p>
          <div class="hbars">${rank.map(([t, v]) => `<div class="hbar"><span class="nm">${esc(name(t))}</span><span class="bt"><i style="width:${(100 * v[0]) / mx}%"></i></span><span class="v">${nf(v[0], 2)}</span></div>`).join("")}</div></section>
      </div>
      <section class="card" aria-labelledby="cp-h"><h2 id="cp-h">Comparar dos equipos</h2>
        <div class="pair"><div class="field"><label for="t-a">Equipo A</label><select id="t-a">${parts.map((t) => `<option value="${t}"${t === ST.a ? " selected" : ""}${t === ST.b ? " disabled" : ""}>${esc(name(t))}</option>`).join("")}</select></div>
          <button type="button" class="swap" id="t-swap" aria-label="Intercambiar equipos">${icon("swap")}</button>
          <div class="field"><label for="t-b">Equipo B</label><select id="t-b">${parts.map((t) => `<option value="${t}"${t === ST.b ? " selected" : ""}${t === ST.a ? " disabled" : ""}>${esc(name(t))}</option>`).join("")}</select></div></div>
        <div class="teamkey"><span class="h">${esc(name(ST.a))}</span><span class="a">${esc(name(ST.b))}</span></div>
        <div>${["goals", "shots", "sot", "corners", "fouls", "yellows", "reds"].map((s) => (ta[s] && tb[s] ? cmpRow(`${STAT[s]} a favor`, ta[s][0], tb[s][0], `En contra: ${nf(ta[s][1], 2)} · ${nf(tb[s][1], 2)}`) : "")).join("")}</div>
        <p class="foot">Medias por partido en ${esc(ST.season)}: ${ta.goals ? ta.goals[2] : 0} partidos de ${esc(name(ST.a))} y ${tb.goals ? tb.goals[2] : 0} de ${esc(name(ST.b))}.${ST.season === D.current.season ? " Con pocos partidos jugados, las medias aún varían mucho." : ""}</p>
      </section>
    </div>`;
    const set = (k) => (e) => { ST[k] = e.target.value; renderEstadisticas(); };
    $("t-stem").addEventListener("change", set("stem")); $("t-season").addEventListener("change", set("season"));
    $("t-a").addEventListener("change", set("a")); $("t-b").addEventListener("change", set("b"));
    $("t-swap").addEventListener("click", () => { [ST.a, ST.b] = [ST.b, ST.a]; renderEstadisticas(); });
    $("t-reset").addEventListener("click", () => { Object.assign(ST, { stem: "goals", season: D.current.season, a: null, b: null }); renderEstadisticas(); });
  }

  // ================================================================ MODELOS
  function renderModelos() {
    const B = D.backtest;
    const has = Object.keys(B).length > 0;
    const g = B.goals;
    const ready = modelStems.every((s) => D.models[s].snapshots[D.current.season]);
    const usable = D.targets.goals.usable_seasons;
    const testN = has ? g.metrics.test_overall.ratings.n_matches : 0;
    const status = !modelStems.length ? ["Sin entrenar", ""] : ready ? ["Listo para predecir", "ok"] : ["Revisar datos", "warn"];
    const ep = D.models.goals.snapshots[D.current.season].ratings.entrant_prior;
    const order = ["market", "ratings", "form", "baseline"];
    const improve = (b, m) => 1 - b.metrics.test_overall[m].poisson_deviance / b.metrics.test_overall.baseline.poisson_deviance;
    const stems = Object.keys(B);
    const ext = Math.max(0.05, ...stems.flatMap((s) => ["ratings", "form"].map((m) => Math.abs(improve(B[s], m)))));
    $app.innerHTML = `<div class="page">
      <div class="head"><span class="eyebrow">Entrenamiento y evaluación</span><h1>Modelos</h1>
        <p class="lede">Cada estadística tiene sus propios modelos. Se evalúan repitiendo cada temporada semana a semana: antes de cada jornada se reentrenan solo con los partidos anteriores.</p></div>
      ${!has ? `<div class="notice"><b>No hay evaluación.</b> Los modelos se prepararon en modo rápido. Vuelve a preparar los datos sin --fast para validarlos.</div>` : ""}
      <div class="cols three">
        ${["ratings", "form", "baseline"].map((m) => `<section class="card tight" aria-labelledby="mc-${m}"><div class="card-h"><h2 id="mc-${m}">${MODEL[m].name}</h2><span class="chip ${status[1]}">${status[0]}</span></div>
          <p class="sub">${esc(MODEL[m].desc)}</p>
          <div class="list">
            <div><span class="label">Estadísticas</span><br>${modelStems.map((s) => STAT[s]).join(", ")}</div>
            <div><span class="label">Temporadas de entrenamiento</span><br>${m === "form" ? `${esc(usable[1])} a ${esc(D.current.season)} (${esc(usable[0])} solo sirve de arranque)` : `${esc(usable[0])} a ${esc(D.current.season)}`}</div>
            ${has ? `<div><span class="label">Evaluación</span><br>Ajuste en ${esc(g.validation_seasons.join(", "))}; prueba en ${esc(g.test_seasons.join(", "))} (${testN} partidos)</div>` : ""}
            <div><span class="label">Último entrenamiento</span><br>${fstamp(D.generated_at)}</div>
          </div></section>`).join("")}
      </div>
      ${has ? `<section class="card" aria-labelledby="ox-h"><h2 id="ox-h">Resultado del partido (1X2)</h2>
        <div class="tablewrap"><table><thead><tr><th>Modelo</th><th class="n">Partidos</th><th class="n">${gl("logloss")}</th><th class="n">${gl("brier")}</th><th class="n">${gl("rps")}</th><th class="n">${gl("accuracy")}</th><th class="n">Más/menos de 2,5 goles (log loss)</th></tr></thead><tbody>
        ${order.map((m) => { const v = g.metrics.test_outcome[m], o = g.metrics.test_over25[m]; return v ? `<tr class="${m === bestModel("goals") ? "best" : ""}"><td>${MODEL[m].name}${m === "market" ? ' <span class="chip">referencia</span>' : ""}${m === bestModel("goals") ? ' <span class="chip ok">mejor modelo</span>' : ""}</td><td class="n">${v.n_matches}</td><td class="n">${nf(v.log_loss, 3)}</td><td class="n">${nf(v.brier, 3)}</td><td class="n">${nf(v.rps, 3)}</td><td class="n">${pc(v.accuracy, 1)}</td><td class="n">${o ? nf(o.log_loss, 3) : "–"}</td></tr>` : ""; }).join("")}
        </tbody></table></div>
        <p class="foot">Temporadas de prueba ${esc(g.test_seasons.join(", "))}. En todas las métricas, más bajo es mejor salvo en el acierto. Las cuotas del mercado son solo una referencia y nunca se usan para predecir: un partido hipotético no tiene cuotas. Ningún modelo propio las supera, algo esperable porque el mercado conoce lesiones y alineaciones.</p>
      </section>
      <section class="card" aria-labelledby="im-h"><h2 id="im-h">Mejora sobre la media de la liga</h2>
        <p class="sub">Cuánto reduce cada modelo la ${gl("deviance")} respecto a la media de la liga en las temporadas de prueba. A la derecha del cero, mejora; a la izquierda, empeora.</p>
        ${improvementChart(stems, improve, ext)}
      </section>
      <section class="stack" aria-labelledby="bt-h"><h2 id="bt-h">Mejor modelo para cada estadística</h2>
        <div class="tablewrap"><table><thead><tr><th>Estadística</th><th>Mejor modelo</th><th class="n">${gl("deviance")}<br>fuerza · forma · media</th><th class="n">${gl("mae")} del total</th><th class="n">${gl("bias")}</th><th class="n">${gl("coverage")}</th><th>Ajustes elegidos</th></tr></thead><tbody>
        ${stems.map((s) => { const b = B[s], t = b.metrics.test_overall, bm = bestModel(s), beats = t[bm].poisson_deviance < t.baseline.poisson_deviance * 0.995;
          return `<tr><td>${STAT[s]}</td><td><span class="chip ${beats ? "ok" : "warn"}">${MODEL[bm].name}</span>${beats ? "" : '<br><span class="sub">no mejora a la media</span>'}</td>
          <td class="n">${nf(t.ratings.poisson_deviance, 3)} · ${nf(t.form.poisson_deviance, 3)} · ${nf(t.baseline.poisson_deviance, 3)}</td><td class="n">${nf(t[bm].mae_total, 2)}</td><td class="n">${signed(t[bm].bias_total, 2)}</td><td class="n">${pc(t[bm].interval80_coverage, 1)}</td>
          <td class="sub">Memoria de ${Math.round(b.config.ratings.half_life_days)} días; cada temporada anterior pesa ×${nf(b.config.ratings.season_discount, 1)}</td></tr>`; }).join("")}
        </tbody></table></div>
        <p class="foot">Las tarjetas dependen mucho del árbitro y los archivos no lo incluyen: los modelos apenas mejoran la media en amarillas y no la mejoran en rojas. La pantalla de predicción lo indica.</p></section>` : ""}
      <section class="card" aria-labelledby="pr-h"><h2 id="pr-h">Equipos ascendidos</h2>
        <p>No hay datos de Segunda División, así que no se puede valorar a un ascendido por su liga anterior. Parte de un punto aprendido de cómo les fue a otros ascendidos en su primera temporada en Primera${ep && ep.n_teams ? `: ${ep.n_teams} casos de ${esc(ep.seasons.join(", "))}, que marcaron un ${pc(1 - Math.exp(ep.att))} menos y encajaron un ${pc(Math.exp(ep.dfn) - 1)} más que un equipo medio` : ""}. Cada partido que juegan acerca su valoración a su rendimiento real. Si no hay ascendidos anteriores de los que aprender, parten de la media de la liga con el doble de incertidumbre, y la aplicación lo avisa.</p></section>
      <section class="card" aria-labelledby="gl-h"><h2 id="gl-h">¿Qué significa cada métrica?</h2>
        <dl class="list" style="margin:0">${Object.values(GLOSSARY).map(([t, d]) => `<div><dt><b>${esc(t)}</b></dt><dd style="margin:2px 0 0" class="sub">${esc(d)}</dd></div>`).join("")}</dl></section>
    </div>`;
  }
  function improvementChart(stems, improve, ext) {
    const rowH = 46, W = 640, L = 150, R = 60, H = stems.length * rowH + 24;
    const x0 = L + (W - L - R) / 2, sc = (W - L - R) / 2 / ext;
    const rows = stems.map((s, i) => {
      const y = 12 + i * rowH;
      return `<text x="0" y="${y + 20}" class="val">${esc(STAT[s])}</text>` + ["ratings", "form"].map((m, k) => {
        const v = improve(D.backtest[s], m), w = Math.abs(v) * sc, yy = y + 6 + k * 16;
        return `<rect x="${v >= 0 ? x0 : x0 - w}" y="${yy}" width="${Math.max(w, 1)}" height="12" rx="3" fill="${m === "ratings" ? "var(--accent)" : "var(--home)"}"/><text x="${v >= 0 ? x0 + w + 6 : x0 - w - 6}" y="${yy + 10}" text-anchor="${v >= 0 ? "start" : "end"}">${(v >= 0 ? "+" : "−") + nf(Math.abs(100 * v), 1)} %</text>`;
      }).join("");
    }).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(stems.map((s) => `${STAT[s]}: fuerza ${nf(100 * improve(D.backtest[s], "ratings"), 1)} %, forma ${nf(100 * improve(D.backtest[s], "form"), 1)} %`).join("; "))}">
      <line class="axis" x1="${x0}" x2="${x0}" y1="4" y2="${H - 4}"/>${rows}</svg>
      <div class="legend"><span><i style="background:var(--accent)"></i>Fuerza de equipos</span><span><i style="background:var(--home)"></i>Forma reciente</span></div>`;
  }

  // ================================================================ DATOS
  const X = { q: "" };
  function renderDatos() {
    const issues = D.quality.issues;
    const nErr = issues.filter((i) => i.severity === "error").length, nWarn = issues.filter((i) => i.severity === "warning").length, nInfo = issues.filter((i) => i.severity === "info").length;
    const complete = D.seasons.filter((s) => s.state === "complete").length;
    const undoc = Object.entries(D.schema).filter(([, v]) => v.documentation === "undocumented");
    const teams = Object.keys(D.teams).length;
    const counts = {};
    issues.forEach((i) => { const k = i.check + "|" + i.severity + "|" + i.decision; counts[k] = (counts[k] || 0) + 1; });
    const pend = D.unknown_team_names.length + D.team_similarity_pending.length;
    $app.innerHTML = `<div class="page">
      <div class="head"><span class="eyebrow">Centro de datos</span><h1>Datos</h1><p class="lede">Qué se importó, cómo está de completo y qué hacer para añadir más.</p></div>
      <div class="kpis">
        <div class="kpi"><span class="label">Temporadas</span><b>${D.seasons.length}</b><span class="sub">${complete} completas, ${D.seasons.length - complete} en curso</span></div>
        <div class="kpi"><span class="label">Partidos</span><b>${D.matches.rows.length.toLocaleString("es-ES")}</b><span class="sub">${issues.some((i) => i.check.startsWith("duplicate")) ? `${issues.filter((i) => i.check.startsWith("duplicate")).length} duplicados excluidos` : "sin duplicados"}</span></div>
        <div class="kpi"><span class="label">Equipos</span><b>${teams}</b><span class="sub">${pend ? `${pend} por confirmar` : "todos identificados"}</span></div>
        <div class="kpi"><span class="label">Revisión de calidad</span><b>${nErr}</b><span class="sub">errores · ${nWarn} avisos · ${nInfo} informativos</span></div>
      </div>
      <div class="notice ${nErr || pend ? "" : "ok"}"><b>Siguiente paso recomendado:</b> ${nErr ? "revisa las filas con error en «Calidad de los datos» antes de fiarte de las predicciones." : pend ? "confirma los nombres de equipo pendientes en config/teams.json y vuelve a preparar los datos." : "los datos están listos. Puedes ir a <a href=\"#predecir\">Predecir partido</a>, o añadir una temporada nueva siguiendo la guía de importación."}</div>
      <section class="stack" aria-labelledby="ss-h"><h2 id="ss-h">Temporadas importadas</h2>
        <div class="seasons">${D.seasons.slice().reverse().map((s) => { const ps = participants(s.competition, s.season); const en = ps.filter((p) => p.status === "entered").length, lf = ps.filter((p) => p.left_after === true).length;
          const covered = Object.entries(s.coverage).filter(([k, v]) => v >= 0.9 && D.targets[k] && D.targets[k].eligible).length, tot = Object.values(D.targets).filter((t) => t.eligible).length;
          return `<div class="card tight"><div class="card-h"><h3>${esc(s.season)}</h3>${stateChip(s.state)}</div>
            <span class="sub">${esc(compName(s.competition))} · ${esc(s.files.join(", "))}</span>
            <div class="minis"><div><span class="label">Partidos</span><b>${s.matches}</b></div><div><span class="label">Equipos</span><b>${s.teams}</b></div></div>
            <span class="sub">${fdate(s.first_date)} a ${fdate(s.last_date)}</span>
            <span class="sub">Estadísticas: ${covered} de ${tot}${s.coverage.xg_undocumented ? " · incluye xG sin documentar" : ""}</span>
            <span class="sub">${s.season === D.seasons[0].season ? "Ascensos: desconocidos" : `${en} ascendidos o que regresan`}${s.state === "complete" && s.season !== D.current.season ? ` · ${lf} descendidos` : ""}</span></div>`; }).join("")}</div></section>
      <section class="card" aria-labelledby="q-h"><h2 id="q-h">Calidad de los datos</h2>
        <p class="sub">Se revisa cada fila: fechas, duplicados, resultado frente a goles, descanso frente a final, remates a puerta frente a remates, goles frente a remates a puerta, valores negativos y valores improbables. Ninguna fila se descarta sin indicar el motivo.</p>
        <div class="tablewrap"><table><thead><tr><th>Comprobación</th><th>Tipo</th><th class="n">Filas</th><th>Decisión</th></tr></thead><tbody>
          ${Object.entries(counts).map(([k, n]) => { const [c, s, d] = k.split("|"); const sv = SEVERITY[s] || [s, ""]; return `<tr><td>${esc(CHECK[c] || c)}</td><td><span class="chip ${sv[1]}">${sv[0]}</span></td><td class="n">${n}</td><td>${esc(DECISION[d] || d)}</td></tr>`; }).join("") || '<tr><td colspan="4">No se ha encontrado ningún problema.</td></tr>'}
        </tbody></table></div>
        ${undoc.length ? `<div class="notice"><b>Columnas sin documentar en notes.txt:</b> ${esc(undoc.map(([c]) => c).join(", "))}. HxG y AxG parecen goles esperados, pero solo están en la temporada actual y no se sabe cómo se calculan: se muestran pero no se usan. Las columnas SKB* parecen cuotas, pero notes.txt llama SK* a Skybet, así que son ambiguas. Todas se conservan.</div>` : ""}
      </section>
      <section class="stack" aria-labelledby="st-h"><h2 id="st-h">Qué estadísticas se pueden predecir</h2>
        <div class="tablewrap"><table><thead><tr><th>Estadística</th><th>Columnas</th><th>¿Se predice?</th>${D.seasons.map((s) => `<th class="n">${s.season}</th>`).join("")}<th>Motivo</th></tr></thead><tbody>
          ${Object.entries(D.targets).map(([k, t]) => `<tr><td>${STAT[k] || esc(t.label)}</td><td class="mono">${esc(t.original_columns.join(", ") || "–")}</td><td>${t.eligible ? '<span class="chip ok">Sí</span>' : '<span class="chip">No</span>'}</td>
            ${D.seasons.map((s) => `<td class="n">${t.coverage[s.season] ? pc(t.coverage[s.season]) : "–"}</td>`).join("")}<td class="sub">${esc(targetReason(k, t))}</td></tr>`).join("")}
        </tbody></table></div>
        <p class="foot">El porcentaje es la parte de los partidos de cada temporada que registra la estadística. Una temporada cuenta si llega al 90 %.</p></section>
      ${importGuide()}
      <section class="stack" aria-labelledby="adv-h"><h2 id="adv-h">Diagnóstico avanzado</h2>
        <details class="adv"><summary>Archivos (${D.files.length})</summary><div>
          <div class="tablewrap"><table><thead><tr><th>Archivo</th><th>Competición</th><th>Temporada</th><th class="n">Filas</th><th class="n">Columnas</th><th>Fechas</th><th>Codificación</th><th>Separador</th></tr></thead><tbody>
            ${D.files.map((f) => `<tr><td class="mono">${esc(f.file)}</td><td>${esc(f.competitions.map(compName).join(", "))}</td><td>${esc(f.seasons.join(", "))}</td><td class="n">${f.rows}</td><td class="n">${f.columns}</td><td>${fdate(f.first_date)} a ${fdate(f.last_date)}</td><td class="mono">${esc(f.encoding)}</td><td class="mono">${esc(f.delimiter === "," ? "coma" : f.delimiter)}</td></tr>`).join("")}
          </tbody></table></div>
          <p class="sub">La temporada se deduce de las fechas (de julio a junio), no del nombre del archivo. Otros archivos: ${esc(D.other_files.join(", ") || "ninguno")}. Calendarios: ${esc(D.fixture_files.join(", ") || "ninguno")}.</p></div></details>
        <details class="adv"><summary>Diferencias entre archivos</summary><div>${schemaMatrix()}</div></details>
        <details class="adv" id="adv-cols"><summary>Columnas originales y normalizadas (${Object.keys(D.schema).length})</summary><div>
          <input type="search" id="cq" placeholder="Filtrar, por ejemplo HST o Pinnacle" aria-label="Filtrar columnas"><div id="ct"></div></div></details>
        <details class="adv"><summary>Variables de notes.txt (${D.notes.entries.length})</summary><div>
          <input type="search" id="nq" placeholder="Buscar en notes.txt" aria-label="Buscar variables de notes.txt"><div id="nt"></div></div></details>
        <details class="adv"><summary>Nombres de equipos</summary><div>${teamNames()}</div></details>
        <details class="adv"><summary>Filas marcadas (${issues.length})</summary><div>
          <div class="tablewrap"><table><thead><tr><th>Archivo</th><th class="n">Línea</th><th>Fecha</th><th>Partido</th><th>Comprobación</th><th>Valores</th></tr></thead><tbody>
            ${issues.map((i) => `<tr><td class="mono">${esc(i.file)}</td><td class="n">${i.line}</td><td>${fdate(i.date)}</td><td>${esc(i.match)}</td><td>${esc(CHECK[i.check] || i.check)}</td><td class="mono">${esc(Object.entries(i.values).map(([k, v]) => k + "=" + v).join(" "))}</td></tr>`).join("")}
          </tbody></table></div></div></details>
      </section>
    </div>`;
    bindImportGuide();
    const drawCols = () => {
      const q = X.q.toLowerCase(), files = D.files.length;
      const rows = Object.entries(D.schema).filter(([c, v]) => !q || c.toLowerCase().includes(q) || descES(c, v.description).toLowerCase().includes(q) || (v.description || "").toLowerCase().includes(q) || (v.normalized || "").includes(q));
      $("ct").innerHTML = `<p class="sub">${rows.length} de ${Object.keys(D.schema).length} columnas</p><div class="tablewrap"><table><thead><tr><th>Original</th><th>Nombre interno</th><th>Documentación</th><th>Significado</th><th class="n">Archivos</th></tr></thead><tbody>
        ${rows.map(([c, v]) => `<tr><td class="mono">${esc(c)}</td><td class="mono">${esc(v.normalized || "se conserva igual")}</td><td><span class="chip ${DOCKIND[v.documentation][1]}">${DOCKIND[v.documentation][0]}</span></td><td>${esc(descES(c, v.description))}</td><td class="n">${v.files.length}/${files}</td></tr>`).join("")}
        </tbody></table></div>`;
    };
    const seen = new Set(Object.keys(D.schema));
    const drawNotes = () => {
      const q = X.q.toLowerCase();
      const rows = D.notes.entries.filter((e) => !q || e.code.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || descES(e.code, e.description).toLowerCase().includes(q));
      $("nt").innerHTML = `<div class="tablewrap"><table><thead><tr><th>Código</th><th>Significado</th><th>Apartado</th><th>¿En los datos?</th></tr></thead><tbody>
        ${rows.map((e) => `<tr><td class="mono">${esc(e.code)}</td><td>${esc(descES(e.code, e.description))}<br><span class="sub" lang="en">Texto original: ${esc(e.description)}</span></td><td class="sub">${esc(SECTION_ES[e.section] || e.section)}</td><td>${seen.has(e.code) ? '<span class="chip ok">Sí</span>' : '<span class="chip">No</span>'}</td></tr>`).join("")}
        </tbody></table></div>`;
    };
    drawCols(); drawNotes();
    $("cq").addEventListener("input", (e) => { X.q = e.target.value; drawCols(); });
    $("nq").addEventListener("input", (e) => { X.q = e.target.value; drawNotes(); });
  }
  function targetReason(k, t) {
    if (t.eligible) return t.drift_flags.length ? `Cambio llamativo en ${t.drift_flags.join(", ")}` : "";
    if (k === "possession") return "notes.txt no define la posesión y ningún CSV la incluye.";
    if (!t.usable_seasons.length) return t.documented ? "Está en notes.txt, pero no aparece en ningún CSV." : "No aparece en ningún CSV.";
    if (!t.documented) return "Columna sin documentar en notes.txt: se muestra, pero no se modela.";
    return "Hay muy pocas temporadas para validarla.";
  }
  function schemaMatrix() {
    const files = D.files.map((f) => f.file);
    const rel = Object.entries(D.schema).filter(([, v]) => v.normalized || v.documentation === "undocumented");
    const varying = Object.values(D.schema).filter((v) => v.files.length !== files.length).length;
    return `<p class="sub">${Object.keys(D.schema).length} columnas distintas; ${varying} faltan en algún archivo. Casi todas son cuotas, porque las casas de apuestas incluidas cambian de una temporada a otra. Abajo aparecen las columnas que usan los modelos y las que no están documentadas.</p>
      <div class="tablewrap"><table><thead><tr><th>Columna</th><th>Nombre interno</th>${files.map((f) => `<th class="c">${esc(f)}</th>`).join("")}</tr></thead><tbody>
      ${rel.map(([c, v]) => `<tr><td class="mono">${esc(c)}${v.documentation === "undocumented" ? ' <span class="chip bad">sin documentar</span>' : ""}</td><td class="mono">${esc(v.normalized || "se conserva igual")}</td>${files.map((f) => (v.files.includes(f) ? `<td class="c">${v.missing[f] ? v.missing[f] + " vacías" : "✓"}</td>` : '<td class="c sub">no está</td>')).join("")}</tr>`).join("")}
      </tbody></table></div>`;
  }
  function teamNames() {
    const pend = D.unknown_team_names.length + D.team_similarity_pending.length;
    return `${pend ? `<div class="notice bad"><b>${pend} nombre${pend > 1 ? "s" : ""} de equipo por confirmar.</b> Se mantienen separados hasta que se actualice config/teams.json.</div>` : `<div class="notice ok"><b>Todos los nombres corresponden a un club confirmado.</b> Nombres parecidos, como Ath Madrid y Ath Bilbao, constan como clubes distintos en config/teams.json.</div>`}
      ${D.unknown_team_names.map((p) => `<div class="notice">Nombre desconocido <b>${esc(p.raw_name)}</b>, guardado como ${esc(p.provisional_id)}. Parecidos: ${esc(p.similar_known.map((s) => s.alias).join(", ") || "ninguno")}.</div>`).join("")}
      ${D.team_similarity_pending.map((p) => `<div class="notice">${esc(p.a)} y ${esc(p.b)} se parecen y están asignados a equipos distintos. Confirma que son clubes diferentes.</div>`).join("")}
      <div class="tablewrap"><table><thead><tr><th>Identificador</th><th>Nombre</th><th>Nombre en los archivos</th><th>Variantes reconocidas</th><th class="n">Temporadas</th></tr></thead><tbody>
      ${Object.entries(D.teams).map(([t, v]) => `<tr><td class="mono">${esc(t)}</td><td>${esc(v.display)}</td><td class="mono">${esc(v.raw_names.join(", "))}</td><td class="sub">${esc(v.aliases.join(", "))}</td><td class="n">${D.participation.filter((p) => p.team_id === t).length}</td></tr>`).join("")}
      </tbody></table></div>`;
  }

  // ================================================================ HISTORIAL
  function renderHistorial() {
    const list = saved().map((s, i) => Object.assign({ i, ev: evalSaved(s) }, s)).reverse();
    const done = list.filter((s) => s.ev.state === "done");
    const hits = done.filter((s) => s.ev.hit).length;
    const ll = done.length ? done.reduce((a, s) => a + s.ev.ll, 0) / done.length : null;
    $app.innerHTML = `<div class="page">
      <div class="head"><span class="eyebrow">Historial</span><h1>Predicciones guardadas</h1><p class="lede">Cuando los datos incluyan el resultado real, cada predicción se compara con lo que pasó.</p></div>
      ${list.length ? `<div class="kpis">
        <div class="kpi"><span class="label">Guardadas</span><b>${list.length}</b><span class="sub">en este navegador</span></div>
        <div class="kpi"><span class="label">Ya con resultado</span><b>${done.length}</b><span class="sub">jugadas después de predecir</span></div>
        <div class="kpi"><span class="label">Resultado más probable acertado</span><b>${done.length ? pc(hits / done.length) : "–"}</b><span class="sub">${hits} de ${done.length}</span></div>
        <div class="kpi"><span class="label">Log loss media</span><b>${ll == null ? "–" : nf(ll, 3)}</b><span class="sub">más baja es mejor; 1,099 = al azar</span></div>
      </div>
      <p class="sub">Los resultados nuevos llegan al volver a preparar los datos con un CSV actualizado. Los partidos que ya se habían jugado cuando hiciste la predicción no cuentan en el balance.</p>
      <div class="stack">${list.map((s) => { const e = s.ev; const k = e.state === "done" ? e.k : -1;
        return `<article class="card tight"><div class="card-h"><h3>${esc(name(s.home))} – ${esc(name(s.away))}</h3>
          <span class="chip ${e.state === "done" ? (e.hit ? "ok" : "bad") : e.state === "before" ? "" : "warn"}">${e.state === "done" ? (e.hit ? "Acertada" : "Fallada") : e.state === "before" ? "Ya jugado al predecir" : "Pendiente de resultado"}</span></div>
          <span class="sub">${s.date ? "Partido del " + fdate(s.date) : "Sin fecha"} · ${esc(s.season)} · ${esc(MODEL[s.model] ? MODEL[s.model].name : s.model)} · guardada el ${fstamp(s.savedAt)}${s.hypothetical ? " · hipotético" : s.historical ? " · histórico" : ""}</span>
          ${probBar(s.probs, s.home, s.away, { hit: k })}
          <div class="row" style="justify-content:space-between"><span>Goles esperados <b>${nf(s.xg[0], 2)} – ${nf(s.xg[1], 2)}</b></span>
            ${e.state === "done" || e.state === "before" ? `<span>Resultado real <b>${e.hg}-${e.ag}</b> <span class="sub">(${fdate(e.date)}${k >= 0 ? `, probabilidad dada: ${pc(e.p)}` : ""})</span></span>` : ""}</div>
          <div class="row" id="del-${s.i}"><button type="button" class="btn quiet small" data-del="${s.i}">Eliminar</button></div></article>`; }).join("")}</div>`
        : `<div class="empty"><h2>Aún no hay predicciones guardadas</h2><p>Genera una predicción y pulsa «Guardar predicción». Aquí verás si acertó cuando se conozca el resultado.</p><a class="btn primary" href="#predecir">Predecir partido</a></div>`}
    </div>`;
    document.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      const i = +b.dataset.del, box = $("del-" + i);
      box.innerHTML = `<span>¿Eliminar esta predicción?</span><button type="button" class="btn danger small" id="yes-${i}">Sí, eliminar</button><button type="button" class="btn quiet small" id="no-${i}">Cancelar</button>`;
      $("yes-" + i).addEventListener("click", () => { const l = saved(); l.splice(i, 1); store.set("saved", l); toast("Predicción eliminada"); renderHistorial(); });
      $("no-" + i).addEventListener("click", renderHistorial);
    }));
  }

  // ================================================================ CONFIGURACIÓN
  function renderConfiguracion() {
    const sv = saved(), cs = customs();
    let storageOk = true; try { localStorage.setItem("ml.__t", "1"); localStorage.removeItem("ml.__t"); } catch (e) { storageOk = false; }
    $app.innerHTML = `<div class="page">
      <div class="head"><span class="eyebrow">Configuración</span><h1>Preferencias</h1><p class="lede">Apariencia, modelo por defecto y los datos que guarda este navegador.</p></div>
      <section class="card" aria-labelledby="ap-h"><h2 id="ap-h">Apariencia</h2>
        <div class="seg" role="group" aria-label="Tema">${[["sistema", "Según el sistema"], ["claro", "Claro"], ["oscuro", "Oscuro"]].map(([k, l]) => `<button type="button" data-theme-set="${k}" aria-pressed="${prefs.theme === k}">${l}</button>`).join("")}</div></section>
      <section class="card" aria-labelledby="dm-h"><h2 id="dm-h">Modelo por defecto</h2>
        <div class="field" style="max-width:360px"><label for="cfg-model">Al abrir «Predecir partido» se usará</label><select id="cfg-model">${["auto", "ratings", "form", "baseline"].map((m) => `<option value="${m}"${prefs.model === m ? " selected" : ""}>${MODEL[m].name}</option>`).join("")}</select></div></section>
      <section class="card" aria-labelledby="ld-h"><h2 id="ld-h">Datos guardados en este navegador</h2>
        ${storageOk ? "" : '<div class="notice bad"><b>El almacenamiento del navegador no está disponible</b> (modo privado o bloqueado). No se podrán guardar predicciones ni preferencias.</div>'}
        <p>${sv.length} predicciones guardadas y ${cs.length} partidos creados. Solo están en este dispositivo; no se envían a ningún sitio.</p>
        <div class="row"><button type="button" class="btn secondary" id="bk-exp">Exportar copia de seguridad</button>
          <label class="btn secondary" for="bk-file">Importar copia</label><input type="file" id="bk-file" accept="application/json,.json" hidden>
          <span id="clr-box" class="row"><button type="button" class="btn quiet" id="bk-clear">Borrar datos locales</button></span></div>
        <div id="bk-out" class="stack"></div></section>
      <section class="card" aria-labelledby="ab-h"><h2 id="ab-h">Acerca de los datos</h2>
        <div class="list">
          <div><span class="label">Preparados</span><br>${fstamp(D.generated_at)}</div>
          <div><span class="label">Último partido incluido</span><br>${fdate(D.current.as_of)} · ${esc(D.current.season)}</div>
          <div><span class="label">Origen</span><br><span class="mono">${esc(D.source)}</span></div>
          <div><span class="label">Fuente</span><br>Archivos de football-data.co.uk, interpretados con su notes.txt.</div>
        </div></section>
    </div>`;
    document.querySelectorAll("[data-theme-set]").forEach((b) => b.addEventListener("click", () => { prefs.theme = b.dataset.themeSet; store.set("prefs", prefs); applyTheme(); renderConfiguracion(); toast("Tema actualizado"); }));
    $("cfg-model").addEventListener("change", (e) => { prefs.model = e.target.value; P.model = prefs.model; store.set("prefs", prefs); toast("Modelo por defecto guardado"); });
    $("bk-exp").addEventListener("click", () => {
      const json = JSON.stringify({ app: "match-lab", version: 1, exportedAt: new Date().toISOString(), saved: saved(), custom: customs(), prefs }, null, 1);
      try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = `match-lab-copia-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { /* algunas vistas bloquean descargas */ }
      $("bk-out").innerHTML = `<p class="sub">Si la descarga no empieza (algunas vistas la bloquean), copia este texto y guárdalo en un archivo .json:</p><textarea id="bk-text" readonly aria-label="Copia de seguridad en formato JSON">${esc(json)}</textarea><div class="row"><button type="button" class="btn secondary small" id="bk-copy">Copiar texto</button></div>`;
      $("bk-copy").addEventListener("click", () => { const t = $("bk-text"); if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(() => toast("Copia copiada"), () => { t.select(); toast("Selecciona el texto y cópialo"); }); else { t.select(); toast("Selecciona el texto y cópialo"); } });
    });
    $("bk-file").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const o = JSON.parse(rd.result);
          if (o.app !== "match-lab" || !Array.isArray(o.saved)) throw new Error("formato");
          const ids = new Set(saved().map((s) => s.id));
          store.set("saved", saved().concat(o.saved.filter((s) => !ids.has(s.id))));
          store.set("custom", customs().concat(Array.isArray(o.custom) ? o.custom : []));
          toast(`Copia importada: ${o.saved.length} predicciones`); renderConfiguracion();
        } catch (err) { $("bk-out").innerHTML = '<div class="notice bad"><b>No se pudo importar.</b> El archivo no es una copia de seguridad de Match Lab.</div>'; }
      };
      rd.readAsText(f);
    });
    $("bk-clear").addEventListener("click", () => {
      $("clr-box").innerHTML = `<span>Se borrarán ${sv.length} predicciones, ${cs.length} partidos y tus preferencias.</span><button type="button" class="btn danger" id="clr-yes">Sí, borrar</button><button type="button" class="btn quiet" id="clr-no">Cancelar</button>`;
      $("clr-yes").addEventListener("click", () => { ["saved", "custom", "prefs", "predict2", "teams2", "stats"].forEach(store.del); prefs.theme = "oscuro"; prefs.model = "auto"; applyTheme(); toast("Datos locales borrados"); renderConfiguracion(); });
      $("clr-no").addEventListener("click", renderConfiguracion);
    });
  }

  const PAGES = { inicio: renderInicio, predecir: renderPredecir, partidos: renderPartidos, equipos: renderEquipos, estadisticas: renderEstadisticas, modelos: renderModelos, datos: renderDatos, historial: renderHistorial, configuracion: renderConfiguracion };
  buildNav();
  window.addEventListener("hashchange", route);
  route();
})();
