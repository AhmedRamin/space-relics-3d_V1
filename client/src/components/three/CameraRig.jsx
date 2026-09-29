import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Flies the camera to a subject.
 *
 * Runs for a moment after the subject changes and stops the instant the visitor takes
 * the controls, so it never fights OrbitControls.
 */
export function CameraRig({ target = [0, 0, 0], distance = 20, trigger = 'default', offsetRatio = 0.45 }) {
  const { camera, controls } = useThree();
  const targetVec = useMemo(() => new THREE.Vector3(target[0], target[1], target[2]), [target[0], target[1], target[2]]);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const until = useRef(0);

  useEffect(() => {
    until.current = performance.now() + 1700;
    if (!controls) return undefined;
    const stop = () => {
      until.current = 0;
    };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls, trigger, targetVec, distance, offsetRatio]);

  useFrame(() => {
    if (!controls || performance.now() > until.current) return;
    // Approach along the direction the subject faces so the surface is not occluded.
    const dir = targetVec.lengthSq() > 0.001 ? targetVec.clone().normalize() : new THREE.Vector3(0, 0.2, 1);
    desired
      .copy(targetVec)
      .add(dir.multiplyScalar(distance * offsetRatio))
      .add(new THREE.Vector3(0, distance * 0.2, distance * 0.75));
    camera.position.lerp(desired, 0.075);
    controls.target.lerp(targetVec, 0.09);
    controls.update();
  });

  return null;
}
