import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Shared react-three-fiber canvas.
 *
 * Tone mapping is set here: ACES Filmic with a deliberate exposure of 1.15, which keeps
 * saturated planet colours from clipping while leaving the corona bright.
 */
export function SceneHost({ children, camera, ...rest }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={camera}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor('#03050d', 1);
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      {...rest}
    >
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}
