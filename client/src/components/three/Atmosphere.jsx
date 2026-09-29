import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

const VERTEX = `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT = `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uPower;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), uPower);
  gl_FragColor = vec4(uColor, rim * uIntensity);
}
`;

/**
 * Fresnel atmosphere shell — the rim of light that makes a planet read as a world with
 * air rather than a painted ball. Rendered front-side additive over the surface.
 */
export function Atmosphere({ radius, color = '#5aa7ff', intensity = 0.85, power = 2.6, scale = 1.035 }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uIntensity: { value: intensity },
          uPower: { value: power },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        depthWrite: false,
      }),
    [color, intensity, power]
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh scale={scale}>
      <sphereGeometry args={[radius, 48, 48]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
