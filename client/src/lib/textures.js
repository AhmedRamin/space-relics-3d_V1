import * as THREE from 'three';

/**
 * Procedural planetary textures.
 *
 * Generated on a canvas at load time (no image assets, no network): an equirectangular
 * colour map plus a matching bump map, per world profile. Everything is cached per
 * body + resolution and disposed when the cache is cleared.
 *
 * Note on colour: a planet's look is decided here, not by the lights. The scenes light
 * the spheres close to neutral so these maps reach the screen unchanged.
 */

const cache = new Map();

/* ----------------------------- value noise ----------------------------- */
function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = (t) => t * t * (3 - 2 * t);

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf);
  const v = smooth(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, y, seed, octaves = 5, gain = 0.5, lac = 2) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let freq = 1;
  for (let i = 0; i < octaves; i += 1) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

/** fBm on a cylinder so the left and right edges of the map meet without a seam. */
function fbmWrap(u, v, seed, octaves = 5) {
  const angle = u * Math.PI * 2;
  return fbm(Math.cos(angle) * 2.4 + 8, Math.sin(angle) * 2.4 + 8 + v * 5.2, seed, octaves);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

/** Push a colour away from grey — the single biggest "not washed out" win. */
function saturate(color, amount) {
  const grey = color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114;
  return [
    clamp01((grey + (color[0] - grey) * amount) / 255) * 255,
    clamp01((grey + (color[1] - grey) * amount) / 255) * 255,
    clamp01((grey + (color[2] - grey) * amount) / 255) * 255,
  ];
}

/* ----------------------------- world profiles ----------------------------- */
const PROFILES = {
  star: {
    base: [255, 196, 96],
    hot: [255, 252, 236],
    cool: [242, 128, 26],
    bump: 0.4,
    saturate: 1.15,
    emissive: true,
  },
  cratered: {
    base: [148, 141, 132],
    hot: [214, 208, 198],
    cool: [72, 66, 60],
    bump: 1,
    saturate: 1.12,
    maria: { count: 7, color: [84, 82, 86], radius: 0.22, strength: 0.75 },
    craters: 1,
  },
  rocky: {
    base: [176, 138, 106],
    hot: [224, 196, 164],
    cool: [96, 68, 50],
    bump: 0.9,
    saturate: 1.2,
    craters: 0.6,
  },
  ocean: {
    base: [22, 74, 132],
    hot: [196, 220, 240],
    cool: [8, 34, 74],
    bump: 0.5,
    saturate: 1.25,
    land: true,
  },
  rust: {
    base: [176, 78, 40],
    hot: [230, 148, 92],
    cool: [96, 42, 26],
    bump: 0.85,
    saturate: 1.22,
    caps: true,
    canyons: true,
  },
  banded: {
    base: [214, 178, 132],
    hot: [250, 238, 212],
    cool: [138, 96, 62],
    bump: 0.14,
    saturate: 1.25,
    bands: 18,
    spot: true,
  },
  icy: {
    base: [104, 186, 216],
    hot: [214, 244, 250],
    cool: [52, 112, 168],
    bump: 0.14,
    saturate: 1.3,
    bands: 9,
  },
  dwarf: {
    base: [156, 138, 124],
    hot: [212, 198, 184],
    cool: [80, 68, 62],
    bump: 1,
    saturate: 1.18,
    craters: 0.8,
  },
};

function profileFor(body) {
  const id = body.id || '';
  const type = String(body.type || '').toLowerCase();
  if (id === 'sun') return PROFILES.star;
  if (type.includes('gas giant')) return PROFILES.banded;
  if (type.includes('ice giant')) return PROFILES.icy;
  if (id === 'earth') return PROFILES.ocean;
  if (id === 'mars') return PROFILES.rust;
  if (id === 'moon' || id === 'mercury' || id === 'ceres') return PROFILES.cratered;
  if (body.isDwarf) return PROFILES.dwarf;
  return PROFILES.rocky;
}

/* Deterministic blob list for maria, spots and old impact basins. */
function blobs(seed, count, radius) {
  return Array.from({ length: count }, (_, i) => ({
    u: hash2(i * 7 + 1, 3, seed),
    v: 0.16 + hash2(i * 5 + 2, 11, seed) * 0.68,
    r: radius * (0.55 + hash2(i * 9 + 3, 17, seed) * 0.9),
    depth: 0.6 + hash2(i * 3 + 4, 23, seed) * 0.4,
  }));
}

function blobAt(u, v, list, aspect) {
  let best = 0;
  for (let i = 0; i < list.length; i += 1) {
    const b = list[i];
    let du = u - b.u;
    if (du > 0.5) du -= 1;
    if (du < -0.5) du += 1;
    const dv = (v - b.v) * aspect;
    const d2 = (du * du + dv * dv) / (b.r * b.r);
    if (d2 < 1) best = Math.max(best, (1 - d2) * b.depth);
  }
  return best;
}

/* ----------------------------- painters ----------------------------- */
function paintBodyTexture(body, width, height, profile) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const seed = (body.id || 'x').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 7);
  const bands = profile.bands || 0;
  const aspect = width / height;
  const maria = profile.maria ? blobs(seed + 31, profile.maria.count, profile.maria.radius) : null;
  const craters = profile.craters ? blobs(seed + 57, 26, 0.035) : null;
  const spot = profile.spot ? { u: 0.68, v: 0.61, r: 0.075 } : null;

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    const lat = (v - 0.5) * Math.PI;

    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const i = (y * width + x) * 4;

      let t;
      if (bands) {
        const warp = (fbmWrap(u, v, seed + 91, 3) - 0.5) * 0.075;
        const band = Math.sin((v + warp) * Math.PI * bands);
        const grain = fbmWrap(u, v, seed + 5, 4);
        t = clamp01(0.5 + band * 0.36 + (grain - 0.5) * 0.4);
      } else {
        t = fbmWrap(u, v, seed, 5);
      }

      let color = mix(profile.cool, profile.hot, clamp01(t));

      if (profile.land) {
        const continents = fbmWrap(u, v, seed + 3, 5);
        const landMask = clamp01((continents - 0.5) * 5.5);
        const landColor = mix([38, 96, 40], [186, 166, 108], fbmWrap(u, v, seed + 11, 4));
        const desert = clamp01((fbmWrap(u, v, seed + 23, 3) - 0.6) * 4.5) * (1 - clamp01(Math.abs(lat) - 0.5));
        color = mix(color, mix(landColor, [198, 166, 100], desert), landMask);
        const ice = clamp01((Math.abs(lat) - 1.2) * 5) + clamp01((continents - 0.74) * 3);
        color = mix(color, [238, 244, 252], clamp01(ice));
      }

      if (profile.caps) {
        const cap = clamp01((Math.abs(lat) - 1.16) * 6);
        color = mix(color, [244, 246, 250], cap * 0.95);
      }

      if (profile.canyons) {
        const streak = clamp01((fbmWrap(u, v, seed + 41, 4) - 0.62) * 5) * (1 - clamp01(Math.abs(lat) - 0.4));
        color = mix(color, [104, 44, 28], streak * 0.7);
      }

      if (maria) {
        const m = blobAt(u, v, maria, aspect) * profile.maria.strength;
        color = mix(color, profile.maria.color, m);
      }

      if (spot) {
        let du = u - spot.u;
        if (du > 0.5) du -= 1;
        const d2 = (du * du + ((v - spot.v) * aspect * 0.8) ** 2) / (spot.r * spot.r);
        if (d2 < 1) color = mix(color, [186, 92, 58], (1 - d2) * 0.85);
      }

      if (craters) {
        const c = blobAt(u, v, craters, aspect);
        if (c > 0.35) {
          // bright rim
          color = mix(color, profile.hot, (c - 0.35) * 0.9);
        }
      }

      color = saturate(color, profile.saturate);
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function paintBumpTexture(body, width, height, profile) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const seed = (body.id || 'x').split('').reduce((acc, ch) => acc + ch.charCodeAt(0) * 3, 11);

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const h = fbmWrap(x / width, v, seed, 4);
      const value = 128 + (h - 0.5) * 255 * profile.bump;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function paintCloudTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const data = image.data;

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const i = (y * width + x) * 4;
      const swirl = fbmWrap(u * 1.15, v * 1.5, 999, 5);
      const bands = 0.5 + 0.5 * Math.sin(((v * 7 + swirl) * Math.PI * 2));
      // Keep the spiral bands but cut the thin haze so the surface stays visible.
      const alpha = clamp01((swirl - 0.5) * 3.4) * (0.42 + bands * 0.58);
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = alpha * 225;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** A soft band of light for the far background — the Milky Way, cheaply. */
function paintGalaxyTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const data = image.data;

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const i = (y * width + x) * 4;
      const band = Math.exp(-((v - 0.5) ** 2) / 0.012);
      const dust = fbmWrap(u * 2.2, v * 4, 4242, 5);
      const glow = band * (0.35 + dust * 0.65);
      data[i] = 120 + glow * 120;
      data[i + 1] = 132 + glow * 130;
      data[i + 2] = 190 + glow * 65;
      data[i + 3] = clamp01(glow * 0.5) * 210;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

/* ----------------------------- public API ----------------------------- */
export function bodyTextures(body, size = 512) {
  const key = `${body.id}-${size}`;
  if (cache.has(key)) return cache.get(key);

  const profile = profileFor(body);
  const height = size / 2;

  const map = new THREE.CanvasTexture(paintBodyTexture(body, size, height, profile));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  map.wrapS = THREE.RepeatWrapping;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(paintBumpTexture(body, size, height, profile));
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.needsUpdate = true;

  let clouds = null;
  if (body.id === 'earth' || body.id === 'venus') {
    clouds = new THREE.CanvasTexture(paintCloudTexture(size, height));
    clouds.colorSpace = THREE.SRGBColorSpace;
    clouds.wrapS = THREE.RepeatWrapping;
    clouds.needsUpdate = true;
  }

  const entry = { map, bumpMap, clouds, profile };
  cache.set(key, entry);
  return entry;
}

/** Background galaxy band, cached at module scope. */
export function galaxyTexture(width = 2048, height = 1024) {
  if (cache.has('galaxy')) return cache.get('galaxy');
  const tex = new THREE.CanvasTexture(paintGalaxyTexture(width, height));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cache.set('galaxy', tex);
  return tex;
}

export function disposeTextures() {
  cache.forEach((entry) => {
    if (entry.map) entry.map.dispose();
    if (entry.bumpMap) entry.bumpMap.dispose();
    if (entry.clouds) entry.clouds.dispose();
  });
  cache.clear();
}
