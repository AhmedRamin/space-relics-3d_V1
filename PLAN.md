# Space Relics 3D — Architecture Plan

A single-view, file-backed 3D Solar System explorer. No database server, no accounts:
the whole catalogue lives in **one JSON data file** that the API reads at boot.

## Data file (the "database")
```
server/data/solar-system-dataset.json     ~530 KB, built from the Solar System Explorer workbook
server/data/source/*.xlsx                 the original workbook, kept so it can be replaced
tools/build-dataset.py             rebuilds the JSON from any workbook in the same shape
```
Content: **18 bodies · 460 moons · 211 missions · 19 space stations · 41 launch vehicles**, plus a
pre-computed `index` that maps every body to the hardware that belongs to it — that index is what
the 3D scene consumes.

### Dataset shape
```jsonc
{
  "meta":     { counts, sourceWorkbook, builtUtc },
  "bodies":   [{ id, name, type, isPlanet, isDwarf, meanDistanceAu, diameterKm, ... }],
  "moons":    [{ id, name, parentId, semiMajorAxisKm, meanRadiusKm, yearDiscovered, ... }],
  "missions": [{ id, name, agency, type, target, bodyId, visualKind, launchDate,
                 launchVehicle, status, statusGroup, workingNow, currentLocation,
                 story, achievement, imageUrl, referenceUrl }],
  "stations": [{ id, name, operator, type, firstModuleLaunch, status, workingNow, orbit, ... }],
  "rockets":  [{ id, name, country, manufacturer, firstFlight, heightM, payloadLeoKg, ... }],
  "index":    { "<bodyId>": { missions: [id], stations: [id], counts: { kind: n }, total } }
}
```
`visualKind` is the 3D contract: `rover | lander | helicopter | orbiter | satellite | telescope | probe | impactor | station`.

## Positions
The workbook has no coordinates, so positions live in a second editable file that is
merged over the dataset at load time:

```
server/data/coordinates.json
├── sites  { "<missionId>": { lat, lng, label, region, precision, source } }
└── orbits { "<id>": { altitudeKm, inclinationDeg, label, precision, source } }
```
`store.positionFor(id)` attaches `location`, `orbit`, `positionPrecision` and
`coordinateSource` to every hardware record, mission detail and station. The client
turns that into a position with `lib/position.js`:

```
published lat/lng   → point on the sphere, model stood on the local vertical
published altitude  → orbit radius (altitude compressed, never ignored) + real inclination
                      plane, plus a labelled ring drawn at the real altitude
no published data   → labelled shell (orbiters) or band (surface), flagged unpublished
```
Precision codes surfaced in the UI: `measured · reported · approximate · unlocated · shell`.
Coverage at build time: 52 landing sites, 163 orbital element sets, 88% of 211 missions.

## Realism stack
```
textures.js   value-noise fBm → equirectangular colour map + bump map per body profile,
              cached per body+resolution and disposed with the scene
Atmosphere    fresnel shader shell (Earth, Venus, Mars, giants) + separate cloud layer
SunGlow       three additive corona shells, toneMapped=false
Starfield     drei <Stars> shader point cloud
AsteroidBelt  1,100 instanced rocks between 2.15 and 3.3 AU
Materials     metalness/roughness/emissive PBR profiles for every hardware part
```

## Rendering and lighting contract
```
key light     pointLight at the Sun, decay 0, intensity ≈2.1   (museum lighting: every orbit stays legible)
fill          ambient 0.36 blue + hemisphere 0.22 + a top directional 0.22
tone mapping  ACES Filmic, exposure 1.15, sRGB output
textures      generated colour + bump maps; saturation pushed per profile so nothing is grey
```
Rule of thumb kept in code comments: this scene is compressed, not physical — light values in the
hundreds or thousands (correct in candela for a real sun) saturate every surface to white.

## Chat pipeline
```
question ──▶ answerEngine (dataset)          → grounded answer + confidence + matched kind
          ──▶ webKnowledge (Wikipedia REST)  → only when the dataset cannot answer, or the
                                               question is conceptual ("what is…", "why do…")
          ──▶ modelProviders.reword()        → optional: paid key, else keyless free endpoint,
                                               with a cooldown after rate-limit failures
          ──▶ answer + sources[] + citations → the UI renders source badges per bubble
```

## Scene layout contract (lib/scale.js)
```
layoutOrbits(bodies) → Map<id, radius>
   inner zone  (≤ 1.6 AU)  linear:  20 + 16·AU          generous spacing for Mercury…Mars
   outer zone  (> 1.6 AU)  log:     45.6 + 25.3·ln(AU/1.6), capped at 232
   sunRadius()             capped at 4.2 units          (true size would swallow Mercury)
   minOrbitRadius(r)       4.2 + r + 3.4                nothing may intersect the Sun
   fan-out                 neighbour gap ≥ 1.2 units    handles near-identical orbits
                                                        (Haumea 43.13 vs Quaoar 43.69 AU)
```
Both the scene and the test call this one function, so a new dataset cannot silently
reintroduce an overlap.

## Details panel media
```
record.imageUrl → destination body imageUrl → generated SVG card (data URI)
```
The catalog payload carries `imageUrl` for every body; that omission was why ISS records
showed no picture (ISS has no photo of its own, so it depends on Earth's).

## Responsive layout
```
≤700px    phone   ☰ drawer rail · bottom-sheet info · full-screen guide · FAB
≤1080px   tablet  rail as a drawer with a scrim, narrower info panel
≥1440px   desktop roomier rail/info/chat, larger gaps
≥1920px   large   320px rail, 430px info panel
```

## Server (Express, no database driver)
```
server/src/data/store.js     loads the JSON once, builds Maps, exposes lookups + filters
server/src/services/answerEngine.js   rule + retrieval based chat, grounded in the JSON
```
Routes:
```
GET  /api/health
GET  /api/catalog                     bodies + per-body hardware index + dataset counts
GET  /api/bodies                      all bodies with hardware counts
GET  /api/bodies/:id                  body + its missions, stations, moons, hardware histogram
GET  /api/bodies/:id/hardware         ordered hardware list for the 3D scene (kind, size, orbit hint)
GET  /api/missions                    filters: body, category, kind, status, agency, q, working, page
GET  /api/missions/:id
GET  /api/stations                    filters: operator, status, working
GET  /api/stations/:id
GET  /api/rockets                     filters: country, status, flying
GET  /api/rockets/:id
GET  /api/moons                       ?parent=earth&limit=&page=
GET  /api/moons/:id
GET  /api/search?q=
GET  /api/facets
POST /api/chat                        { message, context: { kind, id }, history }
```

## Client (React + Vite, react-three-fiber)
One route, two 3D layers:
```
Layer 1  System view   Sun, 8 planets, dwarf toggle, orbit rings,
                       hardware clusters per body (one glowing node per hardware kind,
                       sized by count, labelled with the body total)
Layer 2  Body view     the focused body rendered with every piece of its hardware:
                       rovers/landers/helicopters on the surface (golden-angle spiral),
                       orbiters/satellites/telescopes/probes in orbit shells,
                       space stations on dedicated Earth orbit rings
```
Selection anywhere → glass info panel (status, agency, launch, vehicle, current location,
achievement, story, reference link) and it becomes the chat context.

## Removed from the previous build
MongoDB/Mongoose, JWT auth, bcrypt, all login/registration UI, favourites, admin CRUD routes,
multi-page routing, Tailwind-style layout scaffolding. Auth is gone entirely; there is nothing
to sign in to.

## Verification
`npm run verify` in `server/` parses every source file; the client must build with `npm run build`;
a smoke script hits every endpoint and the chat engine against the shipped data file.
