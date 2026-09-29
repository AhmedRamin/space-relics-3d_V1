import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Procedural hardware, built from three.js primitives with physical materials
 * (metalness / roughness / emissive) so the fleet reads as engineered hardware rather
 * than coloured blocks. `simple` drops the small greebles for crowded scenes.
 */

const MAT = {
  aluminium: { color: '#c8cfda', metalness: 0.82, roughness: 0.34 },
  titanium: { color: '#9aa3b2', metalness: 0.9, roughness: 0.28 },
  white: { color: '#e9edf4', metalness: 0.35, roughness: 0.45 },
  dark: { color: '#20242c', metalness: 0.45, roughness: 0.62 },
  gold: { color: '#c9a227', metalness: 0.95, roughness: 0.24 },
  solar: { color: '#101d3a', metalness: 0.5, roughness: 0.3, emissive: '#123a72', emissiveIntensity: 0.35 },
  radiator: { color: '#f2f4f8', metalness: 0.2, roughness: 0.75 },
  glass: { color: '#8fd0ff', metalness: 1.0, roughness: 0.08, emissive: '#2b6fa8', emissiveIntensity: 0.25 },
  regolith: { color: '#6d6255', metalness: 0.1, roughness: 0.95 },
};

/** One place where every material decision is made. */
function Pbr({ kind = 'aluminium', wireframe = false, ...rest }) {
  const m = MAT[kind] || MAT.aluminium;
  return (
    <meshStandardMaterial
      color={m.color}
      metalness={m.metalness}
      roughness={m.roughness}
      emissive={m.emissive || '#000000'}
      emissiveIntensity={m.emissiveIntensity || 0}
      wireframe={wireframe}
      {...rest}
    />
  );
}

function SolarWing({ w = 1, d = 0.5, y = 0, x = 0, tilt = 0, wireframe }) {
  return (
    <group position={[x, y, 0]} rotation={[0, 0, tilt]}>
      <mesh>
        <boxGeometry args={[w, 0.012, d]} />
        <Pbr kind="solar" wireframe={wireframe} />
      </mesh>
      {/* panel ribs */}
      {[-0.25, 0, 0.25].map((f) => (
        <mesh key={f} position={[w * f, 0.009, 0]}>
          <boxGeometry args={[0.008, 0.004, d]} />
          <Pbr kind="titanium" />
        </mesh>
      ))}
    </group>
  );
}

function Dish({ r = 0.28, position = [0, 0, 0], rotation = [0, 0, 0], wireframe }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <sphereGeometry args={[r, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
        <Pbr kind="white" side={THREE.DoubleSide} wireframe={wireframe} />
      </mesh>
      <mesh position={[0, r * 0.32, 0]}>
        <cylinderGeometry args={[0.014, 0.014, r * 0.5, 8]} />
        <Pbr kind="titanium" />
      </mesh>
    </group>
  );
}

/* ------------------------------- rover ------------------------------- */
function Rover({ simple, wireframe }) {
  const wheel = (x, z) => (
    <mesh key={`${x}-${z}`} position={[x * 0.34, 0.115, z]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.115, 0.115, 0.075, 16]} />
      <Pbr kind="dark" />
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[0.075, 0.012, 6, 14]} />
        <Pbr kind="titanium" />
      </mesh>
    </mesh>
  );

  return (
    <group>
      {/* chassis + rocker-bogie */}
      <mesh position={[0, 0.245, 0]}>
        <boxGeometry args={[0.42, 0.13, 0.3]} />
        <Pbr kind="white" wireframe={wireframe} />
      </mesh>
      <mesh position={[0, 0.245, 0]}>
        <boxGeometry args={[0.44, 0.03, 0.32]} />
        <Pbr kind="gold" wireframe={wireframe} />
      </mesh>
      {[-0.135, 0.135].map((z) => (
        <mesh key={z} position={[0, 0.19, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.5, 8]} />
          <Pbr kind="titanium" />
        </mesh>
      ))}
      {[-0.19, 0, 0.19].map((x) => [wheel(x, -0.145), wheel(x, 0.145)])}

      {/* mast with stereo cameras */}
      <mesh position={[-0.06, 0.36, 0.07]}>
        <cylinderGeometry args={[0.014, 0.014, 0.2, 10]} />
        <Pbr kind="titanium" />
      </mesh>
      <mesh position={[-0.06, 0.47, 0.07]}>
        <boxGeometry args={[0.09, 0.045, 0.035]} />
        <Pbr kind="white" />
      </mesh>
      <mesh position={[-0.06, 0.47, 0.092]}>
        <cylinderGeometry args={[0.011, 0.011, 0.012, 10]} />
        <Pbr kind="glass" />
      </mesh>

      {!simple ? (
        <>
          <SolarWing w={0.38} d={0.26} y={0.335} x={0} />
          {/* instrument arm + turret */}
          <mesh position={[0.2, 0.22, 0.08]} rotation={[0, 0.5, -0.5]}>
            <boxGeometry args={[0.22, 0.02, 0.024]} />
            <Pbr kind="titanium" />
          </mesh>
          <mesh position={[0.32, 0.15, 0.14]}>
            <cylinderGeometry args={[0.022, 0.022, 0.03, 10]} />
            <Pbr kind="gold" />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

/* ---------------------------- helicopter ---------------------------- */
function Helicopter({ simple, wireframe }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.11, 0.06, 0.11]} />
        <Pbr kind="gold" wireframe={wireframe} />
      </mesh>
      <mesh position={[0, 0.145, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.16, 0.16, 0.006]} />
        <Pbr kind="solar" wireframe={wireframe} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.1, 8]} />
        <Pbr kind="titanium" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={`u${i}`} position={[0, 0.26, 0]} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
          <boxGeometry args={[0.4, 0.005, 0.016]} />
          <Pbr kind="titanium" />
        </mesh>
      ))}
      {[0.6, 1.6, 2.6].map((a, i) => (
        <mesh key={`l${i}`} position={[0, 0.2, 0]} rotation={[0, (a * Math.PI) / 3, 0]}>
          <boxGeometry args={[0.4, 0.004, 0.012]} />
          <Pbr kind="white" />
        </mesh>
      ))}
      {!simple
        ? [
            [-0.07, -0.07],
            [0.07, -0.07],
            [-0.07, 0.07],
            [0.07, 0.07],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.045, z]} rotation={[0.18, 0, x > 0 ? -0.18 : 0.18]}>
              <cylinderGeometry args={[0.006, 0.006, 0.09, 6]} />
              <Pbr kind="titanium" />
            </mesh>
          ))
        : null}
    </group>
  );
}

/* ------------------------------- lander ------------------------------- */
function Lander({ simple, wireframe }) {
  return (
    <group>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.11, 0.125, 0.14, 8]} />
        <Pbr kind="white" wireframe={wireframe} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.115, 0.13, 0.03, 8]} />
        <Pbr kind="gold" />
      </mesh>
      <mesh position={[0, 0.235, 0]}>
        <cylinderGeometry args={[0.045, 0.06, 0.05, 8]} />
        <Pbr kind="titanium" />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[0.095, 0.09, 0]} rotation={[0, 0, -0.4]}>
              <boxGeometry args={[0.018, 0.2, 0.018]} />
              <Pbr kind="titanium" />
            </mesh>
            <mesh position={[0.145, 0.008, 0]}>
              <cylinderGeometry args={[0.038, 0.042, 0.012, 12]} />
              <Pbr kind="dark" />
            </mesh>
          </group>
        );
      })}
      {!simple ? (
        <>
          <Dish r={0.075} position={[0, 0.2, 0.075]} rotation={[-0.6, 0, 0]} />
          <SolarWing w={0.22} d={0.16} x={-0.17} y={0.14} />
        </>
      ) : null}
    </group>
  );
}

/* ---------------------------- space station ---------------------------- */
function Station({ simple, wireframe }) {
  return (
    <group>
      {/* truss */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, 0.42, 8]} />
        <Pbr kind="titanium" />
      </mesh>
      {/* pressurised modules */}
      {[-0.13, 0.13].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.032, 0.032, 0.16, 16]} />
          <Pbr kind="white" wireframe={wireframe} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.2, 16]} />
        <Pbr kind="white" />
      </mesh>
      {!simple ? (
        <>
          {/* solar arrays on both ends of the truss */}
          {[-1, 1].map((dir) => (
            <mesh key={dir} position={[dir * 0.42, 0, 0]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.26, 0.008, 0.16]} />
              <Pbr kind="solar" wireframe={wireframe} />
            </mesh>
          ))}
          {/* radiators */}
          {[-1, 1].map((dir) => (
            <mesh key={`r${dir}`} position={[0, dir * 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[0.2, 0.004, 0.09]} />
              <Pbr kind="radiator" />
            </mesh>
          ))}
        </>
      ) : null}
    </group>
  );
}

/* --------------------- orbiter / satellite / telescope / probe --------------------- */
function Orbiter({ simple, wireframe, variant }) {
  const bus = variant === 'satellite' ? [0.1, 0.1, 0.1] : [0.13, 0.12, 0.13];
  return (
    <group>
      <mesh>
        <boxGeometry args={bus} />
        <Pbr kind="white" wireframe={wireframe} />
      </mesh>
      <mesh>
        <boxGeometry args={[bus[0] * 1.02, bus[1] * 0.2, bus[2] * 1.02]} />
        <Pbr kind="gold" />
      </mesh>
      {[-1, 1].map((dir) => (
        <SolarWing key={dir} w={0.2} d={variant === 'satellite' ? 0.13 : 0.16} x={dir * 0.17} />
      ))}
      <Dish r={variant === 'orbiter' ? 0.085 : 0.06} position={[0, 0.075, -0.06]} rotation={[-0.9, 0, 0]} />

      {!simple && variant === 'telescope' ? (
        <>
          <mesh position={[0, 0, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.062, 0.062, 0.16, 22]} />
            <Pbr kind="titanium" wireframe={wireframe} />
          </mesh>
          <mesh position={[0, 0, 0.21]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.068, 0.068, 0.012, 22]} />
            <Pbr kind="glass" />
          </mesh>
        </>
      ) : null}

      {!simple && variant === 'probe' ? (
        <>
          <mesh position={[-0.14, -0.045, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.022, 0.022, 0.1, 10]} />
            <Pbr kind="titanium" />
          </mesh>
          <mesh position={[0.22, 0.02, 0]}>
            <boxGeometry args={[0.36, 0.008, 0.008]} />
            <Pbr kind="titanium" />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

function Impactor({ simple, wireframe }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.07, 0.14, 18]} />
        <Pbr kind="white" wireframe={wireframe} />
      </mesh>
      <mesh position={[0, 0, -0.11]}>
        <boxGeometry args={[0.09, 0.09, 0.08]} />
        <Pbr kind="gold" />
      </mesh>
      {!simple ? <SolarWing w={0.16} d={0.1} y={0.08} /> : null}
    </group>
  );
}

export function HardwareMesh({ kind, simple = false, wireframe = false }) {
  const node = useMemo(() => {
    switch (kind) {
      case 'rover':
        return <Rover simple={simple} wireframe={wireframe} />;
      case 'helicopter':
        return <Helicopter simple={simple} wireframe={wireframe} />;
      case 'lander':
        return <Lander simple={simple} wireframe={wireframe} />;
      case 'station':
        return <Station simple={simple} wireframe={wireframe} />;
      case 'orbiter':
        return <Orbiter simple={simple} wireframe={wireframe} variant="orbiter" />;
      case 'satellite':
        return <Orbiter simple={simple} wireframe={wireframe} variant="satellite" />;
      case 'telescope':
        return <Orbiter simple={simple} wireframe={wireframe} variant="telescope" />;
      case 'probe':
        return <Orbiter simple={simple} wireframe={wireframe} variant="probe" />;
      case 'impactor':
        return <Impactor simple={simple} wireframe={wireframe} />;
      default:
        return <Orbiter simple={simple} wireframe={wireframe} variant="probe" />;
    }
  }, [kind, simple, wireframe]);

  return node;
}

export const SURFACE_KINDS = ['rover', 'helicopter', 'lander', 'impactor'];
