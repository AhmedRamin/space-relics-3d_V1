import { Stars } from '@react-three/drei';

/**
 * Real-scale procedural star field (drei's <Stars> is a shader-based point cloud, so
 * there is no texture to load and nothing to dispose).
 */
export function Starfield({ radius = 320, count = 6000, factor = 6, speed = 0.3 }) {
  return <Stars radius={radius} depth={80} count={count} factor={factor} saturation={0} fade speed={speed} />;
}
