# Data folder — this is the database

`solar-system-dataset.json` is the entire catalogue. The API loads it at boot and keeps it in
memory, so there is no database process to install, no schema migration and no credentials.

## Replace or refresh the data
1. Put a workbook with these five sheets in `server/data/source/`:
   `Planets & Dwarf Planets`, `Moons (all 460)`, `Missions`, `Space Stations`, `Launch Vehicles`.
2. `python3 tools/build-dataset.py` (requires `pandas` and `openpyxl`).
3. Restart the API.

Or edit `solar-system-dataset.json` by hand — every record is a flat JSON object and the API
tolerates missing fields.

## coordinates.json — where things actually are
A separate, curated file so positions can be corrected without touching the workbook:

```jsonc
{
  "sites":  { "perseverance": { "lat": 18.4447, "lng": 77.4508, "label": "…", "precision": "measured", "source": "NASA/JPL" } },
  "orbits": { "iss":          { "altitudeKm": 408, "inclinationDeg": 51.64, "precision": "measured", "source": "…" } }
}
```
* Keys are dataset ids (`missions[].id`, `stations[].id`).
* `precision` is one of `measured`, `reported`, `approximate`, `unlocated`, `shell` and is
  shown in the UI next to the coordinates.
* `source` is displayed in the details panel and in chat answers, so a claim can be checked.
* Longitudes may be given in signed form (-23.42) or 0-360 (336.58) — the renderer handles both.
* Current coverage: 56 landing sites, 163 orbital element sets, 88% of the 211 missions.
  Entries for missions you have not added yet are harmless: they simply never match.

## Image behaviour
`imageUrl` is used in the details panel. When a mission has none, the client falls back to
its destination body's `imageUrl` and labels the caption accordingly. Both come from the
workbook's `Image URL` columns.

## Fields the 3D scene depends on
| Field | Where | Used for |
|---|---|---|
| `missions[].bodyId` | missions | which body the hardware is drawn around |
| `missions[].visualKind` | missions | which procedural mesh to draw (rover, satellite, station, …) |
| `missions[].workingNow` | missions | glow + "working now" filter |
| `bodies[].meanDistanceAu` | bodies | orbit radius in the system view |
| `bodies[].diameterKm` | bodies | visual sphere size |
| `index.<bodyId>.counts` | index | cluster node sizes in the system view |
| `bodies[].axialTiltDeg` | bodies | real axial tilt of the rendered sphere |
| `missions[].imageUrl` | missions | photograph in the details panel |
| `coordinates.json` | positions | landing site lat/lng and orbit altitude/inclination |

## Derived values explained
- `statusGroup` normalises the workbook's free-text status into `active | ended | partial | failed | lost | planned`.
- `workingNow` is true only when the workbook's "Working now?" column starts with "Yes".
- `bodyId` comes from the mission Target, with the Category as a fallback; deep-space observatories
  (Universe, Exoplanets, the Milky Way) are attached to Earth, and asteroid/comet targets to the
  synthetic `asteroids` anchor.
- `visualKind` comes from the mission Type column.
