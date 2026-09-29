#!/usr/bin/env python3
"""
Rebuilds server/data/solar-system-dataset.json from a Solar System Explorer workbook.

Usage:
    python3 tools/build-dataset.py [path/to/workbook.xlsx]

Requires: pandas, openpyxl.
"""
import json
import math
import os
import re
import shutil
import sys

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# The database lives inside the server folder so a `server`-only deploy still carries it.
DATA_DIR = os.path.join(ROOT, "server", "data")
if not os.path.isdir(DATA_DIR):  # legacy root layout
    DATA_DIR = os.path.join(ROOT, "data")
DEFAULT_SRC = os.path.join(DATA_DIR, "source", "Solar_System_Explorer_Dataset.xlsx")
SRC = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
OUT = os.path.join(DATA_DIR, "solar-system-dataset.json")


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-") or "unknown"


def num(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    m = re.search(r"-?\d+(\.\d+)?", str(value).replace(",", ""))
    return float(m.group(0)) if m else None


def text(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    s = str(value).strip()
    return s or None


TARGET_RULES = [
    ("moon", ["moon", "lunar", "luna", "apollo", "surveyor"]),
    ("mars", ["mars", "phobos", "deimos"]),
    ("mercury", ["mercury"]),
    ("venus", ["venus"]),
    ("jupiter", ["jupiter", "europa", "io ", "ganymede", "callisto", "trojan"]),
    ("saturn", ["saturn", "titan", "enceladus", "huygens"]),
    ("uranus", ["uranus"]),
    ("neptune", ["neptune"]),
    ("pluto", ["pluto", "kuiper"]),
    ("ceres", ["ceres", "vesta"]),
    ("asteroids", ["asteroid", "comet", "bennu", "ryugu", "itokawa", "eros", "dimorphos", "psyche", "didymos", "apophis", "halley"]),
    ("earth", ["earth", "exoplanet", "universe", "galaxy", "milky way", "dark matter", "dark energy", "cosmic microwave", "near-earth"]),
    ("sun", ["sun", "solar", "heliospher", "heliocentric"]),
]
CATEGORY_BODY = {
    "MOON": "moon", "MARS": "mars", "VENUS": "venus", "MERCURY": "mercury",
    "JUPITER": "jupiter", "SATURN": "saturn", "URANUS": "uranus", "NEPTUNE": "neptune",
    "KUIPER BELT / PLUTO": "pluto", "ASTEROIDS AND COMETS": "asteroids",
    "ASTROPHYSICS AND SPACE TELESCOPES": "earth", "EARTH OBSERVATION AND CLIMATE": "earth",
    "SUN AND HELIOPHYSICS": "sun",
}
TYPE_RULES = [
    ("rover", ["rover"]),
    ("helicopter", ["helicopter", "rotorcraft"]),
    ("station", ["space station"]),
    ("telescope", ["space telescope"]),
    ("impactor", ["impactor"]),
    ("lander", ["lander", "crewed landing", "circumlunar"]),
    ("orbiter", ["orbiter", "orbiting"]),
    ("satellite", ["earth observation", "weather satellite"]),
    ("probe", ["probe", "observatory", "sampler", "constellation", "smallsat", "test flight", "flyby", "sample return", "atmospheric"]),
]


def status_group(status):
    s = (status or "").strip().lower()
    if s.startswith("active"):
        return "active"
    if s.startswith("planned"):
        return "planned"
    if s.startswith("lost"):
        return "lost"
    if s.startswith("partial"):
        return "partial"
    if "fail" in s:
        return "failed"
    return "ended"


def main():
    xl = pd.ExcelFile(SRC)

    sun = {
        "id": "sun", "name": "Sun", "type": "Star (G2V)", "isDwarf": False, "isPlanet": False,
        "orderFromSun": 0, "meanDistanceAu": 0.0, "diameterKm": 1392700.0,
        "atmosphere": "Plasma photosphere, chromosphere and corona",
        "explorationHistory": "Parker Solar Probe, SOHO, SDO, Ulysses, Solar Orbiter, Helios.",
        "notes": "Added for the 3D scene; not present in the workbook.",
    }

    bodies = [sun]
    for _, row in xl.parse("Planets & Dwarf Planets").iterrows():
        t = text(row["Type"]) or "Body"
        bodies.append({
            "id": slug(row["Body"]), "name": text(row["Body"]), "type": t,
            "isDwarf": "dwarf" in t.lower(),
            "isPlanet": "planet" in t.lower() and "dwarf" not in t.lower(),
            "orderFromSun": int(num(row["Order from Sun"])) if num(row["Order from Sun"]) is not None else None,
            "meanDistanceAu": num(row["Mean distance (AU)"]),
            "meanDistanceKm": num(row["Mean distance (km)"]),
            "orbitPeriodDays": num(row["Orbital period (days)"]),
            "rotationPeriodHours": num(row["Rotation period (hours)"]),
            "diameterKm": num(row["Equatorial diameter (km)"]),
            "surfaceGravity": num(row["Surface gravity (m/s2)"]),
            "meanTemperatureC": text(row["Mean surface temperature (C)"]),
            "atmosphere": text(row["Main atmosphere"]),
            "ringSystem": text(row["Ring system"]),
            "moonsConfirmed": int(num(row["Moons (IAU confirmed)"]) or 0),
            "notableMoons": text(row["Notable moons"]),
            "heliocentricLongitudeDeg": num(row["Current heliocentric longitude (deg)"]),
            "currentDistanceFromSunAu": num(row["Current distance from Sun (AU)"]),
            "currentDistanceFromEarthAu": num(row["Current distance from Earth (AU)"]),
            "positionSummary": text(row["Approximate current position"]),
            "explorationHistory": text(row["Exploration history"]),
            "notes": text(row["Notes"]),
            "imageUrl": text(row["Image URL"]),
        })
    # Earth's Moon is a mission destination in its own right (55 records), so it needs
    # a body entry even though the workbook lists it on the Moons sheet.
    bodies.append({
        "id": "moon", "name": "Moon", "type": "Natural satellite of Earth", "parentId": "earth",
        "isDwarf": False, "isPlanet": False, "meanDistanceAu": 1.00257,
        "meanDistanceKm": 384400.0, "orbitPeriodDays": 27.322, "rotationPeriodHours": 655.7,
        "diameterKm": 3474.8, "surfaceGravity": 1.62, "moonsConfirmed": 0,
        "meanTemperatureC": "-20 (range -173 to 127)",
        "atmosphere": "Almost none — a thin exosphere of helium, neon, hydrogen and argon",
        "ringSystem": "No",
        "positionSummary": "Orbits Earth every 27.3 days, 384,400 km away; the only other world humans have walked on.",
        "explorationHistory": "Luna program, Ranger and Surveyor, Apollo 11-17 (12 crewed landings and 6 landings), Lunokhod, Chang'e, Chandrayaan, LRO, LCROSS, SLIM, Artemis.",
        "notes": "Added as a first-class body so the 55 Moon-targeted missions have a destination in the 3D scene.",
    })

    bodies.append({
        "id": "asteroids", "name": "Asteroids & Comets", "type": "Small bodies (main belt, NEOs, comets)",
        "isDwarf": False, "isPlanet": False, "meanDistanceAu": 2.5, "diameterKm": None,
        "meanTemperatureC": None, "atmosphere": "Not applicable — these are small bodies",
        "explorationHistory": "Dawn, Hayabusa2, OSIRIS-REx, Rosetta, Deep Impact, Stardust, NEAR Shoemaker, DART, Lucy, Psyche.",
        "notes": "Synthetic scene anchor for asteroid and comet targets.",
    })

    moons = []
    for _, row in xl.parse("Moons (all 460)").iterrows():
        parent = text(row["Parent body"])
        moons.append({
            "id": slug(f"{row['Moon / satellite name']}-{parent}"), "name": text(row["Moon / satellite name"]),
            "parentId": slug(parent) if parent else None, "parentName": parent,
            "class": text(row["Class"]), "jplCode": text(row["JPL code"]),
            "semiMajorAxisKm": num(row["Semi-major axis (km)"]),
            "orbitalPeriodDays": num(row["Orbital period (days)"]),
            "eccentricity": num(row["Eccentricity"]), "inclinationDeg": num(row["Inclination (deg)"]),
            "meanRadiusKm": num(row["Mean radius (km)"]), "densityGCm3": num(row["Mean density (g/cm3)"]),
            "yearDiscovered": int(num(row["Year discovered"])) if num(row["Year discovered"]) is not None else None,
            "discoverer": text(row["Discoverer"]),
            "imageUrl": text(row["Image URL"]), "referenceUrl": text(row["Reference URL"]),
        })

    missions = []
    seen = {}
    for _, row in xl.parse("Missions").iterrows():
        category, mtype, target = text(row["Category"]), text(row["Type"]), text(row["Target"])
        status = text(row["Status"])
        working = text(row["Working now?"]) or ""
        launch = row["Launch date"]
        if hasattr(launch, "strftime"):
            launch = launch.strftime("%Y-%m-%d")

        body_id = "earth"
        t = (target or "").lower()
        for candidate, keys in TARGET_RULES:
            if any(k in t for k in keys):
                body_id = candidate
                break
        else:
            body_id = CATEGORY_BODY.get((category or "").upper().strip(), "earth")

        kind = "probe"
        v = (mtype or "").lower()
        for candidate, keys in TYPE_RULES:
            if any(k in v for k in keys):
                kind = candidate
                break

        mid = slug(row["Mission"])
        if mid in seen:
            seen[mid] += 1
            mid = f"{mid}-{seen[mid]}"
        else:
            seen[mid] = 0

        missions.append({
            "id": mid, "name": text(row["Mission"]), "category": category,
            "agency": text(row["Agency / country"]), "type": mtype, "target": target,
            "bodyId": body_id, "visualKind": kind, "launchDate": text(launch),
            "launchVehicle": text(row["Launch vehicle"]), "status": status,
            "statusGroup": status_group(status),
            "workingNow": working.lower().startswith("yes") or "lineage still flies" in working.lower(),
            "workingNowText": working, "currentLocation": text(row["Approximate current location"]),
            "story": text(row["Mission story"]), "achievement": text(row["What it achieved"]),
            "imageUrl": text(row["Image URL"]), "referenceUrl": text(row["Reference URL"]),
        })

    stations = []
    for _, row in xl.parse("Space Stations").iterrows():
        launched = row["First module launch"]
        if hasattr(launched, "strftime"):
            launched = launched.strftime("%Y-%m-%d")
        status = text(row["Status"])
        working = text(row["Working now?"]) or ""
        stations.append({
            "id": slug(row["Station"]), "name": text(row["Station"]), "operator": text(row["Operator"]),
            "type": text(row["Type"]), "firstModuleLaunch": text(launched),
            "launchVehicle": text(row["Launch vehicle"]), "status": status,
            "statusGroup": status_group(status), "workingNow": working.lower().startswith("yes"),
            "workingNowText": working, "orbit": text(row["Orbit"]), "story": text(row["Story"]),
            "achievement": text(row["What it achieved"]),
            "imageUrl": text(row["Image URL"]), "referenceUrl": text(row["Reference URL"]),
        })

    rockets = []
    for _, row in xl.parse("Launch Vehicles").iterrows():
        first = row["First flight"]
        if hasattr(first, "strftime"):
            first = first.strftime("%Y-%m-%d")
        status = text(row["Status"])
        flying = text(row["Flying today?"]) or ""
        rockets.append({
            "id": slug(row["Rocket"]), "name": text(row["Rocket"]), "country": text(row["Country / region"]),
            "manufacturer": text(row["Manufacturer"]), "firstFlight": text(first),
            "heightM": num(row["Height (m)"]), "payloadLeoKg": num(row["Payload to LEO (kg)"]),
            "payloadGtoKg": num(row["Payload to GTO (kg)"]), "status": status,
            "statusGroup": status_group(status), "flyingToday": flying.lower().startswith("yes"),
            "flyingTodayText": flying, "story": text(row["Story"]),
            "notableMissions": text(row["Notable missions"]),
            "imageUrl": text(row["Image URL"]), "referenceUrl": text(row["Reference URL"]),
        })

    index = {}
    for m in missions:
        index.setdefault(m["bodyId"], {"missions": [], "stations": [], "counts": {}})
        index[m["bodyId"]]["missions"].append(m["id"])
    for s in stations:
        index.setdefault("earth", {"missions": [], "stations": [], "counts": {}})
        index["earth"]["stations"].append(s["id"])

    kind_of = {m["id"]: m["visualKind"] for m in missions}
    for body_id, group in index.items():
        counts = {}
        for mid in group["missions"]:
            counts[kind_of[mid]] = counts.get(kind_of[mid], 0) + 1
        if group["stations"]:
            counts["station"] = len(group["stations"])
        group["counts"] = counts
        group["total"] = len(group["missions"]) + len(group["stations"])

    dataset = {
        "meta": {
            "name": "Solar System Explorer dataset",
            "sourceWorkbook": os.path.basename(SRC),
            "builtUtc": pd.Timestamp.now("UTC").strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sheets": xl.sheet_names,
            "counts": {
                "bodies": len(bodies), "moons": len(moons), "missions": len(missions),
                "stations": len(stations), "rockets": len(rockets),
            },
            "notes": "File-based database for Space Relics. Replace this file, or rebuild it, then restart the API.",
        },
        "bodies": bodies, "moons": moons, "missions": missions,
        "stations": stations, "rockets": rockets, "index": index,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(dataset, fh, ensure_ascii=False, indent=1)

    print("wrote", OUT)
    print("counts", dataset["meta"]["counts"])
    print("hardware per body", {k: v["total"] for k, v in sorted(index.items(), key=lambda kv: -kv[1]["total"])})


if __name__ == "__main__":
    main()
