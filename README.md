# Space Relics 3D — Solar System Explorer

An interactive 3D Solar System where every planet is surrounded by the real hardware sent to it:
rovers, landers, orbiters, satellites, space telescopes, probes, impactor craft, helicopters and
space stations. Click any object to read its record; ask the built-in guide about it.

**Stack:** React + Vite · Three.js / @react-three/fiber / drei · Node.js + Express ·
**data file instead of a database** · no authentication.

## Prerequisites
- Node.js 18+ and npm 9+
- Nothing else. No MongoDB, no accounts, no API keys.

## Quick start
```bash
# terminal 1 — API (reads server/data/solar-system-dataset.json)
cd server
npm install
npm run dev            # http://localhost:4000

# terminal 2 — client
cd client
npm install
npm run dev            # http://localhost:5173
```

## Logo
The emblem lives in `client/public/logo.png` and is rendered in the top-left corner of the bar
(`.brand__logo` in `app.css`), at 36px on desktop and 32px on phones. The same file is the
favicon (`favicon.png`) and appears on the error screen.

The supplied source is a JPEG with the transparency checkerboard baked into the pixels, so it
is presented as a **circular seal**: the emblem's own pixels cropped to a circle, tinted into the
app palette and vignetted, with a dark rim. Nothing is keyed, so there are no halos or holes, and
at the size it is actually used the fine grid reads as badge texture.

`tools/make-logo.py` regenerates the asset (it locates the emblem silhouette, crops the seal,
tints, vignettes and exports both PNGs). If you have a **PNG or SVG with real transparency**, just
drop it in as `client/public/logo.png` — the app needs nothing else, and the cut-out version will
look sharper than any processing of the flattened JPEG can.

## The guide (chat)
The AI Mission Guide answers in three layers and always tells you which ones it used:

| Layer | What it does | Needs a key? |
|---|---|---|
| **Your database** | The dataset answers first — status, achievements, positions, counts, "which rovers stopped working on Mars". Authoritative and always available. | no |
| **Internet** | When the dataset cannot answer (concepts like "what is a sky crane landing?"), the server searches Wikipedia's public REST API and appends the background with links. Can be switched off in the chat header or with `WEB_KNOWLEDGE=false`. | no |
| **Free AI model** | A keyless free endpoint (Pollinations, OpenAI-compatible) rewrites the retrieved material into fluent prose. It is only ever asked to *reword* — never to supply facts. | no |
| **Your own model** | Set `AI_API_KEY` (+ `AI_BASE_URL`, `AI_MODEL`) and that provider is used instead. | optional |

The chat treats the dataset as authoritative: questions that match a record (or a subset such as "Mars rovers") are answered from the data and the web is only added as background, while conceptual questions lead with the web. If the free endpoint rate-limits (it does — HTTP 429 "queue full"), the server enters a cooldown and answers from data + web instead; nothing breaks and no answer is delayed by repeated retries. Every bubble carries source badges (Your database · Internet · Free AI model) and the links used.

## Realism
The Solar System is rendered physically rather than decoratively:

| Element | How it is done |
|---|---|
| Planet surfaces | Generated at load time — value-noise fBm with per-world profiles (cratered, ocean/land with polar ice, rust with polar caps, banded gas giants with a warped flow field) painted into an equirectangular map plus a matching bump map |
| Lighting | One light source (the Sun) with inverse-square falloff off, low blue ambient, ACES Filmic tone mapping, sRGB output |
| Atmospheres | A fresnel shader shell gives Earth, Venus, Mars and the giants a real limb glow; Earth and Venus also get a separate cloud layer |
| Rings | Saturn, Uranus, Neptune and Jupiter draw their ring systems at the correct inner/outer radius multiples |
| Axial tilt | Every body is tilted by the workbook's own `axialTiltDeg` (Uranus at 98°, Venus at 177°) |
| Orbital inclination | Orbits are inclined by their real inclination to the ecliptic (Mercury 7°, Pluto 17.16°, Eris 44°) |
| Orbit spacing | `layoutOrbits()` in `lib/scale.js` is the single source of truth: a linear inner zone and a logarithmic outer zone, with the Sun's radius capped at 4.2 units and a guaranteed 1.2-unit gap between neighbours. Verified by `scale_test.mjs`, which checks every pair — radially and in real 3D positions — for intersection |
| Starfield | Shader point cloud (drei `<Stars>`) plus a faint procedural Milky Way band |
| Colour fidelity | The scopes are lit by one unattenuated sun light at intensity ≈2 (plus a cool ambient fill) and toned with ACES Filmic at exposure 1.15 — earlier values of a few thousand, correct for physical units, blew every texture out to white and left the night sides pure black |
| Sun | Emissive surface plus three additive corona shells, kept bright through tone mapping |
| Asteroid belt | 1,100 instanced rocks between 2.15 and 3.3 AU |

## Positions — measured, not guessed
`server/data/coordinates.json` carries the positions, separate from the workbook and editable:

* **52 landing sites** at published latitude/longitude (Apollo 11–17 from LROC's 2016 survey, the Mars rovers and landers from NASA/JPL, Chang'e, Surveyor, Luna, Chandrayaan-3, Venera and Vega).
* **163 orbital element sets** — altitude and inclination — covering all 19 space stations and 64 missions, from the ISS at 408 km / 51.64° to MRO at 300 km / 93°.
* **88% of all 211 missions** therefore have a published position. The remaining 25 are flybys and deep-space craft whose positions are inherently trajectory-dependent; they are drawn on a labelled shell and every surface record without a survey is drawn on a band **and flagged as unpublished** — the app never presents a guessed coordinate as a measured one.

The details panel shows the position with its precision code (◎ measured, ◉ reported, ◍ approximate, ≈ unpublished), the decimal latitude/longitude, the site name and the source. Published orbit altitudes are also drawn as labelled rings around the body so a satellite's place in the scene can be checked against its data.

## The data file
Everything the app knows comes from `server/data/solar-system-dataset.json`:

| Sheet in your workbook | Records in the file |
|---|---|
| Planets & Dwarf Planets | 15 bodies (+ the Sun and a small-bodies anchor added for the 3D scene) |
| Moons (all 460) | 460 moons |
| Missions | 211 missions |
| Space Stations | 19 stations |
| Launch Vehicles | 41 rockets |

To change the data you have two options:

1. **Edit the JSON directly** — it keeps the same shape for every record, then restart the server.
2. **Rebuild from a workbook** — drop a workbook with the same five sheets into `server/data/source/`
   and run `python3 tools/build-dataset.py` (needs `pandas` + `openpyxl`). The script rewrites
   `server/data/solar-system-dataset.json` and prints the new counts.

Extra fields in the JSON are ignored by the API; missing fields render as "—" in the UI.

### Dataset analysis
`docs/DATASET-ANALYSIS.md` is generated from the workbook and summarises what is actually in the
catalogue — volumes per sheet, missions by agency / type / status / decade, the busiest bodies,
tallest rockets, moons per planet, and the data-quality gaps. Current headline: **211 missions,
460 moons, 19 stations, 41 launch vehicles**, a photograph for every mission, and a published
position for 88% of them.

## Environment variables
| Variable | Used by | Default | Description |
|---|---|---|---|
| `PORT` | server | `4000` | API port |
| `DATASET_PATH` | server | `server/data/solar-system-dataset.json` | Path to the data file (auto-resolved; see Deploying below) |
| `COORDINATES_PATH` | server | `server/data/coordinates.json` | Landing sites and orbital elements, merged over the dataset |
| `CLIENT_DIST` | server | `client/dist` | Built client to serve (single-service mode) |
| `CLIENT_ORIGIN` | server | `http://localhost:5173` | CORS origin (comma separated) |
| `RATE_LIMIT_WINDOW_MS` | server | `900000` | Rate-limit window |
| `RATE_LIMIT_MAX` | server | `600` | Requests per window |
| `CHAT_RATE_LIMIT_MAX` | server | `60` | Chat requests per window |
| `AI_API_KEY` | server | *empty* | Optional. Server-side only; when empty the guide answers from the data file |
| `AI_BASE_URL` | server | `https://api.openai.com/v1` | Optional OpenAI-compatible endpoint |
| `AI_MODEL` | server | `gpt-4o-mini` | Optional model name |
| `VITE_API_URL` | client | `/api` (prod) · `http://localhost:4000/api` (dev) | API base URL; same-origin in production |

## API
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | liveness + dataset counts |
| GET | `/api/catalog` | bodies, per-body hardware index, counts |
| GET | `/api/bodies` | all bodies with hardware totals |
| GET | `/api/bodies/:id` | body detail + missions + stations + moons + histogram |
| GET | `/api/bodies/:id/hardware` | hardware list shaped for the 3D scene |
| GET | `/api/missions` | `?body=&category=&kind=&status=&agency=&working=true&q=&page=&limit=` |
| GET | `/api/missions/:id` | one mission + dataset sources |
| GET | `/api/stations` | `?operator=&status=&working=true` |
| GET | `/api/stations/:id` | one station |
| GET | `/api/rockets` | `?country=&status=&flying=true` |
| GET | `/api/rockets/:id` | one launch vehicle |
| GET | `/api/moons` | `?parent=mars&limit=&page=` |
| GET | `/api/moons/:id` | one moon |
| GET | `/api/search` | `?q=spirit` across missions, stations, rockets, bodies, moons |
| GET | `/api/facets` | filter counts used by the UI chips |
| POST | `/api/chat` | `{ "message": "...", "context": { "kind": "mission", "id": "spirit" }, "history": [] }` |

### When the workbook's image is the wrong subject
One record was illustrated with a portrait of **Rosalind Franklin the chemist** rather than the ESA
rover of the same name. `server/data/media.json` entries may therefore carry `"override": true`, which wins
over the workbook's image; the panel credits the replacement (`Wikipedia · Rosalind Franklin (rover)`)
and prints the reason in the caption. Planned vehicles are also placed at their chosen landing site
with a `planned` precision code, so a rover is never described as an orbit.

### Photographs are resolved per object
`server/data/media.json` (built by `tools/resolve-media.py`) carries a Wikipedia lead photograph for every
object the workbook does not illustrate — 68 of the 70 records that needed one. The server merges it,
so clicking Terra, Aqua, Aura or the ISS shows a picture **of that object** rather than its
destination's photo. The workbook's own image always wins; the media index only fills gaps, and the
caption names the source (`Wikimedia Commons` vs `Wikipedia · <article>`).

### Nothing is hidden in the body view
Every object at a body is drawn — the previous build capped the fleet at 22 models, which silently
hid 40 of Earth's 62 objects and looked like missing satellites. Detail now adapts to the count
(lighter meshes above 18 objects) and the rail's chip forces full detail on all of them.

### Photographs
Clicking any rover, lander, orbiter, satellite, telescope, probe, impactor, helicopter or station
opens its details panel with a picture **of that object**:

1. the record's own `imageUrl` from the workbook (credited to Wikimedia Commons),
2. else its resolved Wikipedia/Wikimedia photograph from `media.json`,
3. else its destination body's photograph, captioned as such,
4. else a **generated SVG card** with the object's name and type.

The panel walks this list on the fly: if a photograph fails to load (offline, blocked, dead link)
the next candidate is tried, so the picture area is never blank. Images are requested with
`referrerPolicy="no-referrer"` and the server's CSP explicitly allows `https:` and `data:` image
sources — the default Helmet policy would otherwise block every Commons photograph. The render
smoke test asserts an `<img>` is present for a mission with a photo, a station without one, and a
planned rover whose workbook image is the wrong subject.

### Scene clutter rules
* At most **three** published-orbit shells are drawn at a body, chosen by how many objects use them (the selected object's shell is always included), and only the selected shell gets a text label — previously every distinct altitude drew its own ring *and* its own DOM label, which stacked into an unreadable pile.
* Hardware is capped at **22 rendered models** per body by default; the rail's count chip switches to "all" when you want the rest.
* The hint bar and the render-all control hide as soon as a panel is open, so nothing overlaps the details card.

### What the chat guide can answer
Grounded entirely in the data file: status and "is it still working", why a mission ended,
what a mission achieved, where it is now, launch date and launch vehicle, which missions went to
a body, which rocket launched a mission, moons of a body, counts and totals, "tallest rocket",
and "compare A and B". It resolves pronouns from the object you have selected ("why did it stop?").
If `AI_API_KEY` is set, the same grounded answer is passed to the model for rewording — the model
never supplies facts, and the key stays on the server.

## Run commands
| Location | Command | Purpose |
|---|---|---|
| root | `npm run dev:server` / `npm run dev:client` | start either side |
| root | `npm run build:client` | production build of the client |
| server | `npm run dev` / `npm start` / `npm run verify` | nodemon / node / syntax check |
| client | `npm run dev` / `npm run build` / `npm run preview` | Vite |
| client | `npm run smoke` | renders **every** UI component on the server — catches render-time crashes the build cannot see |
| root | `npm run verify:all` | server syntax + client build + render smoke |

## 3D controls
| Input | Action |
|---|---|
| Drag | orbit the camera |
| Scroll / pinch | zoom |
| Click a planet or hardware cluster | travel to that body |
| Click a hardware object | open its record and set the chat context |
| `Esc` / ← Back | return to the system view |
| `F` | toggle the "show only working hardware" filter |
| `D` | toggle dwarf planets |

## Why the smoke test exists
The Vite build only parses; it cannot see a render-time throw. A hook dependency array that
references a `const` declared later in the same component throws *"Cannot access 'x' before
initialization"* during render, which blanks the whole app behind the error boundary — and that is
exactly what happened once here. `npm run smoke` renders the explorer shell plus every panel,
overlay and chat bubble on the server, so that class of bug fails a check instead of reaching a
browser.

## Deployment

### The database ships inside the server
The catalogue is `server/data/solar-system-dataset.json` (plus `coordinates.json` and `media.json`).
It lives **inside the server folder**, so a host that deploys only that folder still carries it.
`server/src/data/store.js` resolves the file in this order and uses the first one that exists:

1. `DATASET_PATH` (when set)
2. `server/data/`  ← bundled default
3. `./data/` (process working directory)
4. `./server/data/`
5. `<repo>/data/` (legacy layout)

So no environment variable is required in any of the common layouts, and `/api/health` reports the
path that was actually used.

### Render — single web service (recommended)
One Node service serves the API **and** the built client. `render.yaml` at the repo root is a
one-click Blueprint:

* **Build command:** `npm run render:build` (installs server + client, builds the client bundle)
* **Start command:** `npm start` (`node server/src/index.js`)
* **Health check:** `/api/health`

```bash
# what those commands do, to run them by hand:
npm run render:build
npm start          # → http://localhost:4000  (API + client on one port)
```

Point the service at the repo root and it just works. `HELMET`'s Content-Security-Policy is
configured so `https://` photographs (Wikimedia/Commons) and the generated `data:` picture cards
render, and the client calls the API on its own origin (`/api`).

### Render — two services (client on a static site)
If you prefer a static site for the client instead:

* Client: publish directory `client/dist`, build `npm --prefix client install && npm --prefix client run build`.
* Server: root `server`, build `npm install`, start `npm start` (the dataset is already inside it).
* Set `CLIENT_ORIGIN` on the server to the static site URL, and `VITE_API_URL` on the client to
  `https://<your-api>.onrender.com/api` at build time.

> Only the single-service layout needs no configuration at all — prefer it unless you have a
> reason to split.
