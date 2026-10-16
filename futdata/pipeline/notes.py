"""Parse notes.txt into a column dictionary and classify CSV columns against it.

notes.txt is the primary reference. Columns are classified as:
  documented        - listed literally in notes.txt
  documented_rule   - covered by an explicit rule in notes.txt (closing odds = code + "C")
  inferred_pattern  - not listed, but built from a documented bookmaker prefix and a
                      documented market suffix (e.g. BFE>2.5). Flagged, not assumed.
  undocumented      - not explained by notes.txt. Preserved and flagged.
"""
import re

LINE = re.compile(r"^\s*([^\s=][^=]*?)\s+=\s+(.+?)\s*$")

MATCH_STAT_SECTION = "Match Statistics"


def parse_notes(text):
    entries = {}
    section = "general"
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("Key to results"):
            section = "results"
        elif line.startswith(MATCH_STAT_SECTION):
            section = "match_statistics"
        elif line.startswith("The following key to betting odds"):
            section = "odds_1x2"
        elif line.startswith("Key to total goals"):
            section = "odds_over_under"
        elif line.startswith("Key to Asian handicap"):
            section = "odds_asian_handicap"
        elif line.startswith("Football-Data would like"):
            section = "credits"
        m = LINE.match(line)
        if not m or section == "credits":
            continue
        codes, desc = m.group(1), m.group(2)
        for code in re.split(r"\s+and\s+", codes):
            code = code.strip()
            if " " in code or len(code) > 12:
                continue
            entries[code] = {"code": code, "description": desc, "section": section}
    rules = {
        "closing_odds_suffix": "C" if "additional \"C\" character" in text else None,
        "yellow_includes_second_yellow_for_european_games": "included as a yellow (plus red) for European games" in text,
        "fkc_instead_of_fouls_for": re.findall(r"\(([^)]*Belgium[^)]*)\)", text),
        "odds_collection_time": "Friday afternoons" in text,
        "pre_closing_odds": "pre-closing odds" in text,
    }
    return entries, rules


def _bookmaker_prefixes(entries):
    pref = {}
    for code, e in entries.items():
        if e["section"] == "odds_1x2" and code.endswith("H") and len(code) > 1:
            pref[code[:-1]] = e["description"].replace(" home win odds", "")
    return pref


def classify_column(col, entries, rules):
    if col in entries:
        return "documented", entries[col]["description"]
    suffix = rules.get("closing_odds_suffix")
    # closing odds rule: insert C after the bookmaker abbreviation / Max / Avg
    if suffix:
        for code, e in entries.items():
            if not e["section"].startswith("odds"):
                continue
            for cand in _closing_variants(code):
                if cand == col:
                    return "documented_rule", "Closing odds: " + e["description"]
    prefixes = _bookmaker_prefixes(entries)
    for market, label in ((">2.5", "over 2.5 goals"), ("<2.5", "under 2.5 goals"),
                          ("AHH", "Asian handicap home team odds"), ("AHA", "Asian handicap away team odds")):
        for closing in ("", "C"):
            if col.endswith(closing + market):
                p = col[: -len(closing + market)]
                if p in prefixes:
                    kind = "closing " if closing else ""
                    return "inferred_pattern", f"{prefixes[p]} {kind}{label} (pattern inferred, not listed in notes.txt)"
    return "undocumented", None


def _closing_variants(code):
    out = []
    for head in ("Max", "Avg", "BbMx", "BbAv"):
        if code.startswith(head):
            out.append(head + "C" + code[len(head):])
    m = re.match(r"^([A-Z0-9]+?)(H|D|A|>2\.5|<2\.5|AHH|AHA|AH)$", code)
    if m:
        out.append(m.group(1) + "C" + m.group(2))
    if code == "AHh":
        out.append("AHCh")
    return out
