#!/usr/bin/env node
/**
 * Render smoke test.
 *
 * Renders every UI component on the server (see ENTRY below). The Vite build cannot see
 * render-time errors, and a per-component test misses the shell — which is how a
 * temporal-dead-zone bug ("Cannot access 'bodies' before initialization") reached the browser
 * and blanked the 3D scene behind the error boundary.
 *
 * Run with `npm run smoke`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const ENTRY_FILE = join(cwd, '.render-smoke-entry.jsx');
const BUNDLE = join(cwd, '.render-smoke.cjs');

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server';
import { Explorer } from './src/App.jsx';
import { ExplorerProvider } from './src/state/ExplorerContext.jsx';
import { Sidebar } from './src/components/panels/Sidebar.jsx';
import { InfoPanel } from './src/components/panels/InfoPanel.jsx';
import { TopBar } from './src/components/panels/TopBar.jsx';
import { PhoneBar } from './src/components/panels/PhoneBar.jsx';
import { WelcomeOverlay } from './src/components/panels/WelcomeOverlay.jsx';
import { ChatDock } from './src/components/chat/ChatDock.jsx';
import { RichText } from './src/components/chat/RichText.jsx';

const noop = () => {};
const counts = { missions: 211, stations: 19, rockets: 41, bodies: 19, moons: 460 };
const body = { id: 'mars', name: 'Mars', type: 'Terrestrial planet', total: 34, hardware: 34, isPlanet: true, isDwarf: false, moonsConfirmed: 2, meanDistanceAu: 1.52, diameterKm: 6779, moonCount: 2, counts: { rover: 7, lander: 10 }, workingNow: 9, imageUrl: 'https://example.org/mars.jpg' };
const mission = { id: 'perseverance', kind: 'mission', visualKind: 'rover', name: 'Perseverance', type: 'Rover', agency: 'NASA', status: 'Active', statusGroup: 'active', workingNow: true, bodyId: 'mars', target: 'Mars', imageUrl: 'https://example.org/p.jpg', imageCredit: 'Wikimedia Commons', location: { lat: 18.4447, lng: 77.4508, label: 'Jezero' }, positionPrecision: 'measured', coordinateSource: 'JPL', achievement: 'Caching samples', story: 'Landed in 2021' };
const plannedRover = { id: 'rosalind-franklin', kind: 'mission', visualKind: 'rover', name: 'Rosalind Franklin', type: 'Rover', agency: 'ESA', status: 'Planned (2028)', statusGroup: 'planned', workingNow: false, bodyId: 'mars', target: 'Mars', launchVehicle: 'Not yet assigned', currentLocation: 'On Earth, being built', location: { lat: 18.1, lng: -24.3, label: 'Oxia Planum (planned landing site)', region: 'Oxia Planum' }, positionPrecision: 'planned', coordinateSource: 'ESA ExoMars plans', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Rosalind_Franklin_rover.jpg/640px.jpg', imageCredit: 'Wikipedia · Rosalind Franklin (rover)', imageNote: 'The workbook illustrates this record with a portrait of Rosalind Franklin the chemist, not the ESA rover.' };
const station = { id: 'iss', kind: 'station', visualKind: 'station', name: 'International Space Station', operator: 'NASA et al', status: 'Active', statusGroup: 'active', workingNow: true, bodyId: 'earth', orbit: { altitudeKm: 408, inclinationDeg: 51.64, label: 'LEO 408 km' }, positionPrecision: 'measured' };
const facets = { kinds: [{ value: 'rover', count: 7 }, { value: 'satellite', count: 15 }], counts };

// \`allowEmpty\` marks components that legitimately render nothing on the server: the welcome
// overlay only opens after an effect reads localStorage, so SSR output is empty by design.
const cases = [
  ['explorer shell', () => <ExplorerProvider><Explorer /></ExplorerProvider>],
  ['sidebar (system)', () => <Sidebar view={{ mode: 'system' }} bodies={[body]} current={null} hardware={[]} selectedId={null} kindFilter={null} setKindFilter={noop} workingOnly={false} setWorkingOnly={noop} showDwarfs={false} setShowDwarfs={noop} facets={facets} onFocusBody={noop} onSelect={noop} renderAll={false} setRenderAll={noop} isPhone={false} />],
  ['sidebar (body, phone)', () => <Sidebar view={{ mode: 'body' }} bodies={[body]} current={body} hardware={[mission]} selectedId="perseverance" kindFilter="rover" setKindFilter={noop} workingOnly={false} setWorkingOnly={noop} showDwarfs={false} setShowDwarfs={noop} facets={facets} onFocusBody={noop} onSelect={noop} renderAll={false} setRenderAll={noop} isPhone={true} onClose={noop} />],
  ['sidebar (body, desktop)', () => <Sidebar view={{ mode: 'body' }} bodies={[body]} current={body} hardware={[mission]} selectedId={null} kindFilter={null} setKindFilter={noop} workingOnly={true} setWorkingOnly={noop} showDwarfs={true} setShowDwarfs={noop} facets={facets} onFocusBody={noop} onSelect={noop} renderAll={true} setRenderAll={noop} isPhone={false} />],
  ['info panel (mission)', () => <InfoPanel selected={{ kind: 'mission', id: 'perseverance', name: 'Perseverance', data: mission }} bodyNames={{ mars: 'Mars' }} bodyImages={{ mars: 'https://example.org/mars.jpg' }} onClose={noop} onAsk={noop} onFocusBody={noop} />],
  ['info panel (station, no own photo)', () => <InfoPanel selected={{ kind: 'station', id: 'iss', name: 'ISS', data: station }} bodyNames={{ earth: 'Earth' }} bodyImages={{}} onClose={noop} onAsk={noop} onFocusBody={noop} />],
  ['info panel (body, phone)', () => <InfoPanel selected={{ kind: 'body', id: 'mars', name: 'Mars', data: body }} bodyNames={{}} bodyImages={{}} isPhone={true} onClose={noop} onAsk={noop} onFocusBody={noop} />],
  ['top bar', () => <TopBar counts={counts} view={{ mode: 'system' }} onBack={noop} onJumpTo={noop} chatOpen={false} setChatOpen={noop} sidebarOpen={true} onToggleSidebar={noop} />],
  ['top bar (body view)', () => <TopBar counts={counts} view={{ mode: 'body', bodyId: 'mars' }} onBack={noop} onJumpTo={noop} chatOpen={true} setChatOpen={noop} sidebarOpen={false} onToggleSidebar={noop} />],
  ['phone bar', () => <PhoneBar view={{ mode: 'body' }} onToggleSidebar={noop} sidebarOpen={true} onOpenChat={noop} chatOpen={true} onBack={noop} />],
  ['welcome overlay (renders after mount)', () => <WelcomeOverlay counts={counts} onChoose={noop} />, true],
  ['chat dock', () => <ChatDock context={{ kind: 'mission', id: 'perseverance', name: 'Perseverance' }} onClose={noop} onSelectRef={noop} />],
  ['rich text', () => <RichText text={'**Bold** line\\n- one\\n- two\\n1. first\\nsee https://nasa.gov/x'} />],
  // Regression: a planned rover has a chosen landing site and no orbit, and the workbook's
  // image for it is the wrong subject. The panel must still show a picture, must not describe a
  // surface vehicle as an orbit, and must credit the replaced image.
  [
    'info panel (planned rover on a planned site)',
    () => <InfoPanel selected={{ kind: 'mission', id: plannedRover.id, name: plannedRover.name, data: plannedRover }} bodyNames={{ mars: 'Mars' }} bodyImages={{ mars: 'https://example.org/mars.jpg' }} onClose={noop} onAsk={noop} onFocusBody={noop} />,
    false,
    ['record-image', 'Planned site', 'Wikipedia · Rosalind Franklin (rover)', 'portrait of Rosalind Franklin the chemist', '18.1'],
  ],
  ['info panel (planned rover) must not claim an orbit', () => <InfoPanel selected={{ kind: 'mission', id: plannedRover.id, name: plannedRover.name, data: plannedRover }} bodyNames={{}} bodyImages={{}} onClose={noop} onAsk={noop} onFocusBody={noop} />, false, ['must-not:Orbit altitude not published']],
];

let failures = 0;
for (const [label, render, allowEmpty, must] of cases) {
  try {
    const html = renderToStaticMarkup(render());
    const problems = [];
    if (typeof html !== 'string' || (!html.length && !allowEmpty)) problems.push('rendered nothing');
    (must || []).forEach((expectation) => {
      if (expectation.startsWith('must-not:')) {
        const forbidden = expectation.slice('must-not:'.length);
        if (html.includes(forbidden)) problems.push(\`contains "\${forbidden}"\`);
      } else if (!html.includes(expectation)) {
        problems.push(\`missing "\${expectation}"\`);
      }
    });
    if (problems.length) failures += 1;
    console.log(\`\${problems.length ? 'FAIL' : 'PASS'}  \${label} (\${html.length} chars)\`);
    problems.forEach((problem) => console.log(\`      \${problem}\`));
  } catch (error) {
    failures += 1;
    console.log(\`FAIL  \${label}\`);
    console.log(\`      \${error.message}\`);
  }
}
console.log(\`\\n\${failures === 0 ? 'RENDER SMOKE PASSED' : failures + ' COMPONENT(S) THREW'}\`);
process.exit(failures ? 1 : 0);
`;

const esbuild = existsSync(join(cwd, 'node_modules/.bin/esbuild')) ? './node_modules/.bin/esbuild' : 'esbuild';

writeFileSync(ENTRY_FILE, ENTRY, 'utf8');
try {
  execFileSync(
    esbuild,
    [
      ENTRY_FILE,
      '--bundle',
      '--platform=node',
      '--format=cjs',
      '--jsx=automatic',
      '--define:process.env.NODE_ENV="production"',
      '--external:react',
      '--external:react-dom',
      '--external:react/jsx-runtime',
      '--external:three',
      '--external:@react-three/fiber',
      '--external:@react-three/drei',
      `--outfile=${BUNDLE}`,
    ],
    { stdio: 'inherit' }
  );
  execFileSync(process.execPath, [BUNDLE], { stdio: 'inherit' });
} finally {
  rmSync(ENTRY_FILE, { force: true });
  rmSync(BUNDLE, { force: true });
}
