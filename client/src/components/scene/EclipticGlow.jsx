import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/** A very faint disc in the orbital plane — gives the system depth without clutter. */
export function EclipticGlow({ radius, opacity = 0.075 }) {
  const texture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(150,190,255,0.85)');
    g.addColorStop(0.35, 'rgba(110,150,230,0.35)');
    g.addColorStop(1, 'rgba(40,70,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 96]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} side={2} />
    </mesh>
  );
}
