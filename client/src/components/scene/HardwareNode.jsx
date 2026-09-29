import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { HardwareMesh } from '../hardware/HardwareMesh';
import { KINDS, PRECISION } from '../../lib/constants';
import { placeHardware } from '../../lib/position';

const BASE_SCALE = 0.5;

/**
 * One piece of hardware.
 *
 * Surface vehicles sit at their published latitude/longitude, standing on the local
 * vertical; orbiting hardware follows its published altitude and inclination. Records
 * without a published position are placed on a labelled band or shell and flagged as
 * such in the tooltip and the details panel.
 */
export function HardwareNode({ item, index, total, body, selected, onSelect, simple, spin = true }) {
  const orbitGroup = useRef();
  const tiltGroup = useRef();
  const model = useRef();
  const [hovered, setHovered] = useState(false);

  const place = useMemo(() => placeHardware(item, index, total, body), [item, index, total, body]);
  const meta = KINDS[item.visualKind] || KINDS.probe;
  const precision = PRECISION[place.published ? item.positionPrecision || 'measured' : place.mode === 'orbit' ? 'shell' : 'unlocated'];
  const scale = BASE_SCALE * (item.visualKind === 'station' ? 1.35 : item.visualKind === 'rover' ? 0.95 : 1);

  // Stand the model on the surface normal (or upright for orbiters).
  useEffect(() => {
    if (!model.current) return;
    if (place.mode === 'surface') {
      // Stand on the local vertical: the outward normal at the object's own position.
      const up = new THREE.Vector3(place.position[0], place.position[1], place.position[2]).normalize();
      model.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    } else {
      model.current.quaternion.identity();
    }
  }, [place.mode, place.position, item.id]);

  useFrame((state, delta) => {
    if (place.mode === 'orbit' && orbitGroup.current && spin) {
      orbitGroup.current.rotation.y += delta * 0.06 * (index % 2 ? 1 : -1);
    }
    if (model.current && (hovered || selected)) model.current.rotation.y += delta * 0.4;
  });

  const indicator = item.workingNow ? '#4fd6a0' : '#6b7690';

  const node = (
    <group
      ref={model}
      scale={hovered || selected ? scale * 1.25 : scale}
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
        onSelect(item);
      }}
    >
      <HardwareMesh kind={item.visualKind} simple={simple} />

      {/* status marker: ring = working, disc = ended */}
      {item.workingNow ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <ringGeometry args={[0.1, 0.125, 22]} />
          <meshBasicMaterial color={indicator} transparent opacity={0.95} side={2} />
        </mesh>
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <circleGeometry args={[0.07, 18]} />
          <meshBasicMaterial color={indicator} transparent opacity={0.5} side={2} />
        </mesh>
      )}

      {selected ? (
        <mesh>
          <sphereGeometry args={[0.28, 16, 16]} />
          <meshBasicMaterial color={meta.color} transparent opacity={0.14} wireframe />
        </mesh>
      ) : null}

      {hovered || selected ? (
        <Html center distanceFactor={9} position={[0, 0.34, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              whiteSpace: 'nowrap',
              padding: '3px 9px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              color: '#eaf1ff',
              background: 'rgba(6,10,22,0.92)',
              border: `1px solid ${meta.color}`,
            }}
          >
            {item.name}
            <span style={{ opacity: 0.7, marginLeft: 6 }}>
              {precision.symbol} {place.published ? 'positioned' : place.mode === 'orbit' ? 'shell' : 'band'}
            </span>
          </div>
        </Html>
      ) : null}
    </group>
  );

  if (place.mode === 'surface') {
    return <group position={place.position}>{node}</group>;
  }

  return (
    <group ref={tiltGroup} rotation={[place.inclination, 0, 0]}>
      <group ref={orbitGroup} rotation={[0, -place.angle, 0]}>
        <group position={[place.radius, 0, 0]}>{node}</group>
      </group>
    </group>
  );
}
