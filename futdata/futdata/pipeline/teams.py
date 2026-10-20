"""Canonical team identity mapping and season-aware participation."""
import difflib
import json
import re
import unicodedata

SIMILARITY_FLAG = 0.72


def norm(name):
    s = unicodedata.normalize("NFKD", str(name)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


class TeamRegistry:
    def __init__(self, config_path):
        with open(config_path, encoding="utf-8") as fh:
            cfg = json.load(fh)
        self.competitions = cfg.get("competitions", {})
        self.teams = cfg["teams"]
        self.alias_to_id = {}
        for tid, t in self.teams.items():
            for a in t["aliases"]:
                self.alias_to_id[norm(a)] = tid
        self.distinct = {frozenset((norm(a), norm(b))) for a, b in cfg.get("confirmed_distinct", [])}
        self.provisional = {}     # raw name -> provisional id (unknown, not merged)
        self.pending = []         # similarity warnings needing manual confirmation

    def resolve(self, raw):
        key = norm(raw)
        if key in self.alias_to_id:
            return self.alias_to_id[key]
        if raw in self.provisional:
            return self.provisional[raw]
        pid = "unconfirmed:" + key.replace(" ", "-")
        self.provisional[raw] = pid
        close = [(a, difflib.SequenceMatcher(None, key, a).ratio()) for a in self.alias_to_id]
        close = sorted([c for c in close if c[1] >= SIMILARITY_FLAG], key=lambda c: -c[1])[:3]
        self.pending.append({
            "raw_name": raw, "provisional_id": pid,
            "similar_known": [{"alias": a, "team_id": self.alias_to_id[a], "score": round(s, 2)} for a, s in close],
            "action": "Add to config/teams.json as an alias of an existing team, or as a new team.",
        })
        return pid

    def similarity_audit(self, raw_names):
        """Flag pairs of observed raw names that look alike, are mapped to different ids,
        and have not been confirmed distinct."""
        names = sorted(set(raw_names))
        out = []
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                na, nb = norm(a), norm(b)
                s = difflib.SequenceMatcher(None, na, nb).ratio()
                if s < SIMILARITY_FLAG or self.resolve(a) == self.resolve(b):
                    continue
                if frozenset((na, nb)) in self.distinct:
                    continue
                out.append({"a": a, "b": b, "score": round(s, 2), "status": "needs confirmation"})
        return out

    def display(self, tid):
        if tid in self.teams:
            return self.teams[tid]["display"]
        return tid.split(":", 1)[-1] + " (unconfirmed)"


def participation(matches, seasons_by_comp):
    """Team x season x competition table with promotion/relegation status.

    status values (relative to the competition):
      first_in_dataset - first season of this competition in the data; prior status unknown
      continuing       - also played this competition in the previous season
      entered          - absent from the previous season (promoted or returning from a
                         lower division; the source division is not in the dataset unless noted)
    left_after: True if absent in the next season of the same competition, None if no next season.
    """
    rows = []
    for comp, seasons in seasons_by_comp.items():
        seasons = sorted(seasons)
        m = matches[matches.competition == comp]
        members = {s: set(m.loc[m.season == s, "home_id"]) | set(m.loc[m.season == s, "away_id"]) for s in seasons}
        for i, s in enumerate(seasons):
            prev = members[seasons[i - 1]] if i > 0 and _consecutive(seasons[i - 1], s) else None
            nxt = members[seasons[i + 1]] if i + 1 < len(seasons) and _consecutive(s, seasons[i + 1]) else None
            ms = m[m.season == s]
            for t in sorted(members[s]):
                home = ms[ms.home_id == t]
                away = ms[ms.away_id == t]
                earlier = [x for x in seasons[:i] if t in members[x]]
                if prev is None:
                    status = "first_in_dataset"
                elif t in prev:
                    status = "continuing"
                else:
                    status = "entered"
                rows.append({
                    "competition": comp, "season": s, "team_id": t,
                    "matches": len(home) + len(away), "home_matches": len(home), "away_matches": len(away),
                    "status": status,
                    "left_after": (None if nxt is None else t not in nxt),
                    "prior_seasons_in_comp": len(earlier),
                    "last_prior_season": earlier[-1] if earlier else None,
                })
    return rows


def _consecutive(a, b):
    return int(b[:4]) - int(a[:4]) == 1
