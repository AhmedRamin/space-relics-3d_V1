#!/usr/bin/env python3
"""
Resolves a real photograph for every mission, station and body that the workbook does not
illustrate, and writes server/data/media.json.

Why: the workbook has an image for 153 of 211 missions. A record without one used to fall back
to its *destination's* photo, so clicking a satellite like Terra showed a picture of Earth —
which reads as "no picture". Wikipedia carries a lead image for almost every spacecraft, so it
is resolved here once, at build time, and stored in the repo: the app then works offline and the
file is easy to correct by hand.

Requests are batched (50 titles per call) and cached, because the API rate-limits aggressive
clients with HTTP 429.

Usage:  python3 tools/resolve-media.py [--refresh]
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "server", "data")
if not os.path.isdir(DATA_DIR):  # legacy root layout
    DATA_DIR = os.path.join(ROOT, "data")
DATASET = os.path.join(DATA_DIR, "solar-system-dataset.json")
OUT = os.path.join(DATA_DIR, "media.json")
CACHE = os.path.join(DATA_DIR, "media-cache.json")

UA = "SpaceRelics3D/2.0 (educational Solar System explorer; batch media index)"
BAD_FILENAME = re.compile(r"(logo|icon|flag|coat_of_arms|map_of|seamless|symbol|diagram|chart|signature)", re.I)
STOP = {"the", "and", "of", "mission", "spacecraft", "satellite", "programme", "program", "probe", "telescope"}

BATCH = 20
DELAY = 1.1


def call(params, tries=4):
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.load(r)
        except urllib.error.HTTPError as err:
            last = err
            if err.code in (429, 503):
                wait = 8 * (attempt + 1)
                print(f"    rate limited, waiting {wait}s…", flush=True)
                time.sleep(wait)
                continue
            return None
        except Exception as err:  # noqa: BLE001
            last = err
            time.sleep(2)
    print(f"    gave up: {last}", flush=True)
    return None


def tokens(text):
    return {t for t in re.split(r"[^a-z0-9]+", str(text).lower()) if len(t) > 2 and t not in STOP}


def pick(page, want):
    thumb = ((page.get("thumbnail") or {}).get("source")) or None
    title = page.get("title") or ""
    if not thumb or BAD_FILENAME.search(thumb):
        return None
    if len(tokens(title) & want) == 0 and len(want) > 1:
        return None
    return {"imageUrl": thumb, "title": title, "source": "Wikipedia"}


def batch_by_title(names):
    """Exact-title lookup, 20 names per request. Returns {name: entry}."""
    found = {}
    for i in range(0, len(names), BATCH):
        chunk = names[i:i + BATCH]
        data = call(
            {
                "action": "query",
                "format": "json",
                "titles": "|".join(chunk),
                "prop": "pageimages",
                "pithumbsize": 640,
                "redirects": 1,
                "formatversion": 2,
            }
        )
        if not data:
            continue
        pages = (data.get("query") or {}).get("pages") or []
        # map the requested name to the resolved title (redirects + normalisation)
        alias = {}
        for key in ("normalized", "redirects"):
            for row in data.get("query", {}).get(key, []) or []:
                alias[row.get("from", "").lower()] = row.get("to", "")
        for page in pages:
            title = page.get("title") or ""
            entry = pick(page, set())
            if not entry:
                continue
            for name in chunk:
                if name.lower() == title.lower() or alias.get(name.lower(), "").lower() == title.lower():
                    found[name] = entry
                    break
            else:
                # tolerate trivial differences (case, punctuation)
                for name in chunk:
                    if name.lower().replace("-", " ") == title.lower().replace("-", " "):
                        found[name] = entry
                        break
        print(f"  exact titles {min(i + BATCH, len(names))}/{len(names)} · matched {len(found)}", flush=True)
        time.sleep(DELAY)
    return found


def search_for(name, want):
    for query in (f"{name} spacecraft", f"{name} NASA", name):
        data = call(
            {
                "action": "query",
                "format": "json",
                "generator": "search",
                "gsrsearch": query,
                "gsrlimit": 3,
                "prop": "pageimages",
                "pithumbsize": 640,
                "redirects": 1,
                "formatversion": 2,
            }
        )
        pages = (data or {}).get("query", {}).get("pages") or []
        best = None
        for page in pages:
            entry = pick(page, want)
            if not entry:
                continue
            overlap = len(tokens(entry["title"]) & want)
            score = overlap * 10 - int(page.get("index", 9))
            if best is None or score > best[0]:
                best = (score, {**entry, "query": query})
        if best:
            return best[1]
        time.sleep(DELAY)
    return None


def main():
    refresh = "--refresh" in sys.argv
    dataset = json.load(open(DATASET, encoding="utf-8"))
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    media = json.load(open(OUT, encoding="utf-8")).get("images", {}) if os.path.exists(OUT) else {}

    targets = []
    for m in dataset["missions"]:
        if not m.get("imageUrl"):
            targets.append((m["id"], m["name"]))
    for s in dataset["stations"]:
        if not s.get("imageUrl"):
            targets.append((s["id"], s["name"]))
    for b in dataset["bodies"]:
        if not b.get("imageUrl"):
            targets.append((b["id"], b["name"]))

    todo = [(i, n) for i, n in targets if refresh or i not in media]
    print(f"{len(targets)} records need a picture · {len(media)} already resolved · {len(todo)} to do")

    # 1. exact-title batch pass
    print("pass 1 — exact titles")
    by_title = batch_by_title([n for _, n in todo])
    for ident, name in todo:
        entry = by_title.get(name) or cache.get(ident, {}).get("exact")
        if entry:
            media[ident] = {**entry, "name": name}
            cache.setdefault(ident, {})["exact"] = entry

    # 2. search pass for the rest
    remaining = [(i, n) for i, n in todo if i not in media]
    print(f"pass 2 — search ({len(remaining)} remaining)")
    for idx, (ident, name) in enumerate(remaining, 1):
        entry = search_for(name, tokens(name))
        if entry:
            media[ident] = {**entry, "name": name}
            cache.setdefault(ident, {})["search"] = entry
        if idx % 10 == 0 or idx == len(remaining):
            print(f"  {idx}/{len(remaining)} · resolved so far {len(media)}", flush=True)
        time.sleep(DELAY)

    resolved = len([1 for i, _ in targets if i in media])
    payload = {
        "meta": {
            "name": "Space Relics media index",
            "description": "Lead photograph per object, resolved from Wikipedia and merged over the dataset at load time, so every record can show a picture of itself.",
            "resolved": resolved,
            "requested": len(targets),
            "builtUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        "images": media,
    }
    json.dump(payload, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"wrote {OUT} · {resolved}/{len(targets)} records now have their own photograph "
          f"({round(100 * resolved / max(1, len(targets)))}%)")
    missing = [n for i, n in targets if i not in media]
    if missing:
        print("still without a picture:", ", ".join(missing[:14]), "…" if len(missing) > 14 else "")


if __name__ == "__main__":
    main()
