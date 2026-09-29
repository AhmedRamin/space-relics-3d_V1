import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Corona: additive shells plus a soft sprite halo.
 *
 * The sprite is what gives the Sun a bloom-like falloff without a post-processing pass.
 */
export function SunGlow({ radius, color = '#ffb347', intensity = 1 }) {
  const group = useRef();

  const halo = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,247,224,0.95)');
    g.addColorStop(0.22, 'rgba(255,206,124,0.55)');
    g.addColorStop(0.5, 'rgba(255,164,64,0.20)');
    g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  useFrame((state, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.015;
  });

  return (
    <group ref={group}>
      {[1.06, 1.18, 1.42].map((scale, i) => (
        <mesh key={scale} scale={scale}>
          <sphereGeometry args={[radius, 32, 32]} />
          <meshBasicMaterial
            color={i === 2 ? '#ffe6b8' : color}
            transparent
            opacity={(0.4 - i * 0.11) * intensity}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      <sprite scale={[radius * 9, radius * 9, 1]}>
        <spriteMaterial
          map={halo}
          transparent
          opacity={0.75 * intensity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}
