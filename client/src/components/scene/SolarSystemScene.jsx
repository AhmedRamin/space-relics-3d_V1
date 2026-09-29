import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Starfield } from '../three/Starfield';
import { CameraRig } from '../three/CameraRig';
import { Atmosphere } from '../three/Atmosphere';
import { SunGlow } from '../three/SunGlow';
import { PlanetGlow } from '../three/PlanetGlow';
import { GalaxyBackdrop } from '../three/GalaxyBackdrop';
import { AsteroidBelt } from './AsteroidBelt';
import { EclipticGlow } from './EclipticGlow';
import { KINDS, KIND_ORDER, ATMOSPHERES, RINGS, ORBITAL_INCLINATION, bodyColor } from '../../lib/constants';
import { bodyRadius, orbitRadius, sunRadius, layoutOrbits, hash01 } from '../../lib/scale';
import { bodyTextures } from '../../lib/textures';

/**
 * Layer 1 — the Solar System.
 *
 * Layout guarantees live in `lib/scale.js` (`layoutOrbits`), not here: the Sun is capped, the
 * inner zone is linear so the first four planets are well separated, and a minimum gap is
 * enforced between every pair. This component only draws.
 */

function ClusterNode({ body, kind, count, max, onFocus }) {
  const [hovered, setHovered] = useState(false);
  const meta = KINDS[kind] || KINDS.probe;
  const size = 0.09 + (count / Math.max(1, max)) * 0.19;
  const angle = (KIND_ORDER.indexOf(kind) / KIND_ORDER.length) * Math.PI * 2;
  const row = KIND_ORDER.indexOf(kind);

  return (
    <group
      position={[Math.cos(angle) * 1.15, 0.26 + row * 0.13, Math.sin(angle) * 1.15]}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
      onClick={(event) => {
        event.stopPropagation();
        onFocus(body);
      }}
    >
      <mesh>
        <sphereGeometry args={[size, 16, 12]} />
        <meshStandardMaterial
          color={meta.color}
          emissive={meta.color}
          emissiveIntensity={hovered ? 1.1 : 0.42}
          metalness={0.4}
          roughness={0.35}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2.1, 0, 0]}>
        <ringGeometry args={[size * 1.5, size * 1.85, 24]} />
        <meshBasicMaterial color={meta.color} transparent opacity={hovered ? 0.85 : 0.35} side={2} depthWrite={false} />
      </mesh>
      {hovered ? (
        <Html center distanceFactor={30} style={{ pointerEvents: 'none' }}>
          <div className="scene-chip" style={{ borderColor: meta.color }}>
            {count}× {meta.label}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function Body({ body, angle, onFocus, selected, showLabel, textureSize, orbit }) {
  const spin = useRef();
  const clouds = useRef();
  const [hovered, setHovered] = useState(false);

  const isSun = body.id === 'sun';
  const radius = isSun ? sunRadius() : bodyRadius(body.diameterKm, body.isDwarf);
  const inclination = ((ORBITAL_INCLINATION[body.id] || 0) * Math.PI) / 180;
  const tilt = ((body.axialTiltDeg || 0) * Math.PI) / 180;

  const textures = useMemo(() => bodyTextures(body, textureSize), [body, textureSize]);
  const position = useMemo(() => {
    const x = Math.cos(angle) * orbit;
    const z = Math.sin(angle) * orbit;
    return [x, z * Math.sin(inclination), z * Math.cos(inclination)];
  }, [angle, orbit, inclination]);

  const counts = body.counts || {};
  const max = Math.max(1, ...Object.values(counts));
  const rings = RINGS[body.id];
  const tint = isSun ? '#ffcf8a' : bodyColor(body.id);

  useFrame((state, delta) => {
    if (spin.current) spin.current.rotation.y += delta * (isSun ? 0.015 : 0.05);
    if (clouds.current) clouds.current.rotation.y += delta * 0.012;
  });

  return (
    <group position={isSun ? [0, 0, 0] : position}>
      {!isSun ? <PlanetGlow radius={radius} color={tint} intensity={selected || hovered ? 0.7 : 0.42} /> : null}

      <group rotation={[0, 0, tilt]}>
        <group ref={spin}>
          <mesh
            onClick={(event) => {
              event.stopPropagation();
              onFocus(body);
            }}
            onPointerOver={(event) => {
              event.stopPropagation();
              setHovered(true);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHovered(false);
              document.body.style.cursor = 'auto';
            }}
          >
            <sphereGeometry args={[radius, 64, 64]} />
            <meshStandardMaterial
              map={textures.map}
              bumpMap={textures.bumpMap}
              bumpScale={textures.profile.bump * 0.045}
              emissiveMap={isSun ? textures.map : null}
              emissive={isSun ? '#ff9d2e' : '#000000'}
              emissiveIntensity={isSun ? 1.6 : 0}
              roughness={textures.profile.bands ? 0.55 : 0.86}
              metalness={0.03}
            />
          </mesh>
        </group>

        {textures.clouds ? (
          <mesh ref={clouds} scale={1.015}>
            <sphereGeometry args={[radius, 48, 48]} />
            <meshStandardMaterial
              map={textures.clouds}
              transparent
              opacity={body.id === 'earth' ? 0.85 : 1}
              depthWrite={false}
              roughness={0.9}
            />
          </mesh>
        ) : null}

        {isSun ? <SunGlow radius={radius} /> : null}
        {ATMOSPHERES[body.id] ? (
          <Atmosphere
            radius={radius}
            color={ATMOSPHERES[body.id].color}
            intensity={ATMOSPHERES[body.id].intensity}
            power={ATMOSPHERES[body.id].power}
          />
        ) : null}

        {rings ? (
          <>
            <mesh rotation={[-Math.PI / 2 + 0.06, 0, 0]}>
              <ringGeometry args={[radius * rings.inner, radius * rings.outer, 160]} />
              <meshBasicMaterial color={rings.color} transparent opacity={rings.opacity * 1.3} side={2} depthWrite={false} />
            </mesh>
            <mesh rotation={[-Math.PI / 2 + 0.06, 0, 0]}>
              <ringGeometry args={[radius * (rings.inner - 0.12), radius * (rings.inner - 0.02), 120]} />
              <meshBasicMaterial color={rings.color} transparent opacity={rings.opacity * 0.5} side={2} depthWrite={false} />
            </mesh>
          </>
        ) : null}
      </group>

      {hovered || selected ? (
        <mesh scale={1.28}>
          <sphereGeometry args={[radius, 24, 24]} />
          <meshBasicMaterial color={tint} transparent opacity={0.08} wireframe depthWrite={false} />
        </mesh>
      ) : null}

      {!isSun && body.total > 0
        ? Object.entries(counts).map(([kind, count]) => (
            <ClusterNode key={kind} body={body} kind={kind} count={count} max={max} onFocus={onFocus} />
          ))
        : null}

      {showLabel || hovered ? (
        <Html center distanceFactor={58} position={[0, -(radius + 0.95), 0]} style={{ pointerEvents: 'none' }}>
          <div className={hovered ? 'scene-label scene-label--on' : 'scene-label'}>
            {body.name}
            {body.total ? <span className="scene-label__count"> · {body.total}</span> : null}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

export function SolarSystemScene({ bodies, onFocusBody, selectedBodyId, showDwarfs, textureSize = 384 }) {
  const visible = useMemo(
    () => bodies.filter((body) => body.id !== 'moon' && (showDwarfs || !body.isDwarf) && body.id !== 'asteroids'),
    [bodies, showDwarfs]
  );
  const rocks = bodies.find((b) => b.id === 'asteroids');
  const earth = visible.find((b) => b.id === 'earth');
  const moon = bodies.find((b) => b.id === 'moon');

  const angles = useMemo(
    () =>
      visible.map((body) =>
        body.heliocentricLongitudeDeg ? (body.heliocentricLongitudeDeg * Math.PI) / 180 : hash01(body.id) * Math.PI * 2
      ),
    [visible]
  );

  const layout = useMemo(() => layoutOrbits(visible), [visible]);
  const orbits = useMemo(() => visible.map((body) => layout.get(body.id) ?? 0), [visible, layout]);
  const moonTextures = useMemo(() => (moon ? bodyTextures(moon, 256) : null), [moon]);
  const outer = useMemo(() => Math.max(...orbits, 100), [orbits]);

  return (
    <>
      <pointLight position={[0, 0, 0]} intensity={2.1} decay={0} color="#fff6e8" />
      <ambientLight intensity={0.36} color="#9db4e8" />
      <hemisphereLight intensity={0.22} color="#cfe0ff" groundColor="#241a12" />
      <directionalLight position={[0, 40, 0]} intensity={0.22} color="#8fb0ff" />

      <GalaxyBackdrop />
      <Starfield radius={560} count={9000} factor={7.5} speed={0.25} />
      <EclipticGlow radius={outer * 1.08} />

      <AsteroidBelt inner={orbitRadius(2.15)} outer={orbitRadius(3.3)} count={1400} />

      {visible.map((body, index) => (
        <group key={body.id}>
          {body.id !== 'sun' && body.id !== 'asteroids' ? (
            <mesh rotation={[-Math.PI / 2 + ((ORBITAL_INCLINATION[body.id] || 0) * Math.PI) / 180, 0, 0]}>
              <ringGeometry args={[orbits[index] - 0.025, orbits[index] + 0.025, 240]} />
              <meshBasicMaterial
                color={body.total > 0 ? '#7aa8e8' : '#33456e'}
                transparent
                opacity={body.total > 0 ? 0.3 : 0.16}
                side={2}
                depthWrite={false}
              />
            </mesh>
          ) : null}
          <Body
            body={body}
            angle={angles[index]}
            orbit={orbits[index]}
            onFocus={onFocusBody}
            selected={selectedBodyId === body.id}
            showLabel={body.isPlanet || body.total > 20}
            textureSize={textureSize}
          />
        </group>
      ))}

      {earth && moon && moonTextures ? (
        <group
          position={[
            Math.cos(angles[visible.indexOf(earth)]) * orbits[visible.indexOf(earth)] + 2.9,
            0.16,
            Math.sin(angles[visible.indexOf(earth)]) * orbits[visible.indexOf(earth)] - 1.4,
          ]}
          onClick={(event) => {
            event.stopPropagation();
            onFocusBody(moon);
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          <mesh>
            <sphereGeometry args={[0.42, 32, 32]} />
            <meshStandardMaterial map={moonTextures.map} bumpMap={moonTextures.bumpMap} bumpScale={0.04} roughness={0.94} />
          </mesh>
          <PlanetGlow radius={0.42} color="#cfd6e4" intensity={0.3} />
        </group>
      ) : null}

      {rocks && showDwarfs ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[orbitRadius(2.2), orbitRadius(3.2), 180]} />
          <meshBasicMaterial color="#6b5a44" transparent opacity={0.16} side={2} depthWrite={false} />
        </mesh>
      ) : null}

      <CameraRig target={[0, 0, 0]} distance={182} trigger="system" offsetRatio={0.34} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={26}
        maxDistance={640}
        rotateSpeed={0.45}
        zoomSpeed={0.75}
        maxPolarAngle={Math.PI * 0.92}
      />
    </>
  );
}
