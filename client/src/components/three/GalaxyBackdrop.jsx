import { useEffect } from 'react';
import * as THREE from 'three';
import { galaxyTexture } from '../../lib/textures';

/** A very faint Milky Way band on the inside of a large sphere. */
export function GalaxyBackdrop({ radius = 720 }) {
  const texture = galaxyTexture();

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshBasicMaterial map={texture} transparent opacity={0.5} depthWrite={false} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
}
