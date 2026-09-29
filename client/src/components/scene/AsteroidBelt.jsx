import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Instanced main-belt rocks between Mars and Jupiter — cheap and reads as depth. */
export function AsteroidBelt({ inner, outer, count = 900, thickness = 0.6 }) {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(0.045, 0), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#7a6f62', roughness: 0.95, metalness: 0.05 }),
    []
  );

  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = inner + Math.random() * (outer - inner);
        const y = (Math.random() - 0.5) * thickness * Math.min(2.5, radius * 0.06);
        const size = 0.5 + Math.random() * 1.4;
        return { angle, radius, y, size, speed: 0.004 + Math.random() * 0.006 };
      }),
    [count, inner, outer, thickness]
  );

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    seeds.forEach((seed, i) => {
      const angle = seed.angle + t * seed.speed;
      dummy.position.set(Math.cos(angle) * seed.radius, seed.y, Math.sin(angle) * seed.radius);
      dummy.rotation.set(angle * 2, angle * 3, angle);
      dummy.scale.setScalar(seed.size);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />
  );
}
