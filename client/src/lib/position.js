import { orbitRadius, bodyRadius, hash01 } from './scale';

/**
 * Where a piece of hardware actually is.
 *
 * Order of truth:
 *   1. a published landing site  → exact latitude/longitude on the sphere
 *   2. a published orbit         → altitude + inclination, scaled into the scene
 *   3. no published position     → a labelled shell (orbiters) or a band (surface),
 *                                 flagged as unpublished so the UI never implies a
 *                                 coordinate it does not have
 */

export const SURFACE_KINDS = ['rover', 'helicopter', 'lander', 'impactor'];

export function isSurfaceKind(kind) {
  return SURFACE_KINDS.includes(kind);
}

/** Latitude/longitude (degrees) → unit vector with +Y as the north pole. */
export function latLngToVector3(lat, lng) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return [
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ];
}

/** Tangent frame at a point on the sphere: up = outward normal, north = +Y projected. */
export function surfaceFrame(lat, lng) {
  const up = latLngToVector3(lat, lng);
  const north = [0, 1, 0];
  // east = north × up
  const east = [
    north[1] * up[2] - north[2] * up[1],
    north[2] * up[0] - north[0] * up[2],
    north[0] * up[1] - north[1] * up[0],
  ];
  const eastLen = Math.hypot(...east) || 1;
  const e = east.map((c) => c / eastLen);
  // north = up × east
  const n = [
    up[1] * e[2] - up[2] * e[1],
    up[2] * e[0] - up[0] * e[2],
    up[0] * e[1] - up[1] * e[0],
  ];
  return { up, east: e, north: n };
}

/**
 * Real altitude above a body is invisible at scene scale (the ISS sits 6% above the
 * surface), so altitude is compressed rather than ignored — the ordering is preserved
 * and the true value is always shown in the UI.
 */
export function altitudeToSceneRadius(altitudeKm, bodyRadiusKm, radiusUnits) {
  const ratio = (altitudeKm || 0) / (bodyRadiusKm || 1);
  const visual = Math.min(2.6, Math.max(0.22, ratio * 18));
  return radiusUnits * (1 + visual);
}

/**
 * Full placement for one hardware record.
 * Returns { mode, position, radius, inclination, published, label }.
 */
export function placeHardware(item, index, total, body) {
  const radiusUnits = bodyRadius(body.diameterKm, body.isDwarf);
  const published = Boolean(item.location) || Boolean(item.orbit && item.orbit.altitudeKm !== null && item.orbit.altitudeKm !== undefined);

  // 1. published landing site ------------------------------------------------
  if (item.location && typeof item.location.lat === 'number' && typeof item.location.lng === 'number') {
    const [x, y, z] = latLngToVector3(item.location.lat, item.location.lng);
    const r = radiusUnits * 1.002;
    return {
      mode: 'surface',
      published: true,
      position: [x * r, y * r, z * r],
      radius: r,
      inclination: 0,
      label: item.location.label,
    };
  }

  // 2. published orbit -------------------------------------------------------
  if (item.orbit && typeof item.orbit.altitudeKm === 'number') {
    const r = altitudeToSceneRadius(item.orbit.altitudeKm, body.diameterKm / 2, radiusUnits);
    const angle = ((index + 0.5) / Math.max(1, total)) * Math.PI * 2;
    const inclination = ((item.orbit.inclinationDeg || 0) * Math.PI) / 180;
    // Rotate the circular orbit plane by the real inclination about the X axis.
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    return {
      mode: 'orbit',
      published: true,
      radius: r,
      inclination,
      angle,
      position: [x, z * Math.sin(inclination), z * Math.cos(inclination)],
      label: item.orbit.label,
    };
  }

  // 3. unpublished ----------------------------------------------------------
  if (isSurfaceKind(item.visualKind)) {
    // Spread along a band that stays visible, deterministic by id so it never jumps.
    const t = hash01(item.id);
    const lat = (t - 0.5) * 52;
    const lng = (hash01(`${item.id}-lng`) - 0.5) * 300;
    const [x, y, z] = latLngToVector3(lat, lng);
    const r = radiusUnits * 1.002;
    return { mode: 'surface', published: false, position: [x * r, y * r, z * r], radius: r, inclination: 0, label: null };
  }

  const shell = Math.floor(index / Math.max(1, Math.ceil(total / 3)));
  const perShell = Math.max(1, Math.ceil(total / 3));
  const r = radiusUnits * (1.85 + shell * 0.5);
  const angle = ((index % perShell) / perShell) * Math.PI * 2 + shell * 0.6;
  const inclination = (hash01(`inc-${item.id}`) - 0.5) * 0.5;
  return {
    mode: 'orbit',
    published: false,
    radius: r,
    inclination,
    angle,
    position: [Math.cos(angle) * r, Math.sin(inclination) * r * 0.35, Math.sin(angle) * r],
    label: null,
  };
}

/** Orbit ring description for a group of orbiting objects. */
export function orbitRing(paths) {
  return paths;
}

export { orbitRadius };
