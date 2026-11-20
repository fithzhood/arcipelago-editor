// Plastilina: pezzi bitorzoluti, impronte di polpastrelli nella normale, luce avvolgente da studio.
// La superficie "bolle" 12 volte al secondo, come se qualcuno l'avesse toccata fra uno scatto e
// l'altro del passo uno. Il movimento invece resta fluido: a scatti sembrava il gioco che si impuntava.
// Materiale ripreso dalla demo "plastilina" dell'atlante Stili.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Base3D, pianoGlifo } from './base3d.js';
import { casuale, eIsola, contornoCelle } from '../forme.js';
import { texGlifo } from '../glifi.js';
import { coniglio, volpe, gatto, animaZampe } from './animali.js';
import { ZONE } from './zone.js';

const FIGURE = { coniglio, volpe, gatto };

const PAL = { T: '#2f6ad0', R: '#e07a18', M: '#8a48c8', D: '#169a6e', fantasma: '#9aa0a6', fondo: '#fbf4e4', pieno: true, bordo: '#3a2c30' };

const IMPRONTE = `
varying vec3 vOP;
uniform float uPosa, uBump, uScala; uniform vec3 uSSS;
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 h33(vec3 p){ return vec3(h31(p), h31(p + 17.3), h31(p + 41.7)); }
float vn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float polpastrello(vec3 q, float k, float sal){
  vec3 cell = floor(q * k), f = fract(q * k);
  vec3 r = h33(cell + sal);
  float d = length((f - (0.32 + r * 0.36)) * vec3(1.0, 1.4, 1.0));
  float mask = (1.0 - smoothstep(0.10, 0.24, d)) * step(0.4, r.x);
  float fr = d * 160.0;
  float aa = 1.0 - smoothstep(0.4, 1.2, fwidth(fr));
  return mask * (sin(fr + vn3(q * 9.0) * 5.0) * 0.5 * aa * 0.45 - 0.55);
}
float impronte(vec3 p){
  vec3 q = p + (h33(vec3(uPosa, 1.3, 7.1)) - 0.5) * 0.16;
  float h = (vn3(q * 2.3) - 0.5) * 0.9 + (vn3(q * 5.3 + 3.0) - 0.5) * 0.25 + (vn3(q * 13.0) - 0.5) * 0.04;
  h += (polpastrello(q, 1.7, 0.0) + polpastrello(q + 0.37, 2.3, 5.0) * 0.8) * 0.7;
  return h * 0.028;
}
vec3 perturbaNormale(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection){
  vec3 vSigmaX = dFdx(surf_pos), vSigmaY = dFdy(surf_pos), vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN), R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  vec3 n = abs(fDet) * surf_norm - vGrad;
  return dot(n, n) > 1e-24 ? normalize(n) : surf_norm;
}`;
const LUCI_CERA = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
  /float dotNL = saturate\( dot\( geometryNormal, directLight\.direction \) \);\s*vec3 irradiance = dotNL \* directLight\.color;/,
  `float nl = dot( geometryNormal, directLight.direction );
  float dotNL = saturate( ( nl + 0.45 ) / 1.45 );
  float fascia = smoothstep( -0.45, 0.0, nl ) * ( 1.0 - smoothstep( 0.0, 0.5, nl ) );
  vec3 irradiance = dotNL * directLight.color * mix( vec3( 1.0 ), uSSS, fascia );
  vec3 irrSpec = saturate( nl ) * directLight.color;`).replace(
  'reflectedLight.directSpecular += irradiance *', 'reflectedLight.directSpecular += irrSpec *');

// rumore per far bitorzoli veri sulla geometria (non solo nella luce)
const hh = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function rumore(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let xf = x - xi, yf = y - yi, zf = z - zi; xf *= xf * (3 - 2 * xf); yf *= yf * (3 - 2 * yf); zf *= zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hh(xi, yi, zi), hh(xi + 1, yi, zi), xf), L(hh(xi, yi + 1, zi), hh(xi + 1, yi + 1, zi), xf), yf),
    L(L(hh(xi, yi, zi + 1), hh(xi + 1, yi, zi + 1), xf), L(hh(xi, yi + 1, zi + 1), hh(xi + 1, yi + 1, zi + 1), xf), yf), zf);
}
function bitorzola(geo, amp, scala = 3, seme = 0) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = (rumore(x * scala + seme, y * scala, z * scala) - 0.5) * amp;
    p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
  }
  return geo;
}

/** Il materiale e gli attrezzi della plastilina, da usare anche fuori dal gioco (banco di prova). */
export function kitArgilla() {
  const POSA = { value: 0 }, materiali = [];
  const argilla = (colore, opz = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: colore, map: opz.map || null, roughness: opz.rough ?? 0.6, metalness: 0 });
    const u = { uPosa: POSA, uBump: { value: opz.bump ?? 1 }, uScala: { value: opz.scala ?? 1.4 }, uSSS: { value: new THREE.Color(opz.sss ?? 0xffa080).multiplyScalar(1.5) } };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + IMPRONTE)
        .replace('#include <lights_physical_pars_fragment>', LUCI_CERA)
        // colore non uniforme: la plastilina impastata a mano ha zone più chiare e più scure
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 0.9 + 0.2 * vn3(vOP * uScala * 2.7 + 11.0);')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          { float h = impronte(vOP * uScala);
            float fronte = smoothstep(0.08, 0.4, abs(dot(normal, normalize(vViewPosition))));
            vec2 dh = vec2(dFdx(h), dFdy(h)) * uBump * fronte;
            normal = perturbaNormale(-vViewPosition, normal, dh, faceDirection); }`);
    };
    m.customProgramCacheKey = () => 'argilla';
    materiali.push(m);
    return m;
  };
  const cache = new Map();
  const A = (c, o) => { const k = c + JSON.stringify(o || {}); if (!cache.has(k)) cache.set(k, argilla(c, o)); return cache.get(k); };
  const mesh = (geo, c, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, typeof c === 'string' ? A(c) : c); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };
  const palla = (r, seg = 28) => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7));
  const scurisci = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
  // argilla(colore, { map }) dà un materiale nuovo, non condiviso: serve per i manti dipinti
  return { POSA, materiali, A, argilla, mesh, palla, bitorzola, scurisci, dispose: () => materiali.forEach((m) => { m.map?.dispose(); m.dispose(); }) };
}

/**
 * Il segno inciso sulle pietre dei sigilli: quattro punte a croce, "qui si muove", diverso da ogni
 * glifo del gioco perché non lo si scambi per uno da usare. Bianco: il colore lo dà il materiale.
 */
function texSigillo() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d');
  x.translate(S / 2, S / 2); x.scale(S / 128, S / 128);
  x.strokeStyle = x.fillStyle = '#fff'; x.lineCap = x.lineJoin = 'round';
  x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 50, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 8;
  for (let i = 0; i < 4; i++) {
    x.save(); x.rotate((i * Math.PI) / 2);
    x.beginPath(); x.moveTo(-10, -34); x.lineTo(0, -44); x.lineTo(10, -34); x.stroke();
    x.beginPath(); x.moveTo(0, -14); x.lineTo(0, -38); x.stroke();
    x.restore();
  }
  x.beginPath(); x.arc(0, 0, 8, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/**
 * Dentro un sigillo: le isole restano quelle della zona (si riconosce dove si è), ma il cielo è un
 * crepuscolo viola, le nuvole sono lilla e la luce di taglio è rosa. È un altro posto, fatto di magia.
 */
const incanta = (Z) => ({
  ...Z,
  cielo: [[0, '#1d1840'], [0.45, '#3e2f72'], [0.8, '#8a5ea8'], [1, '#e2a9c8']],
  nebbia: '#4a3a7a', nuvole: ['#e6dcf6', '#9d8cc8'],
  luce: { ...Z.luce, cielo: '#d9ccff', terra: '#3a2a55', amb: Z.luce.amb * 0.85, riflesso: '#ff8fd0', forzaRiflesso: 1.1 },
});

/** La trama della cortina di luce: chiara in basso, svanisce in alto, con venature verticali. */
function texCortina() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const x = cv.getContext('2d');
  for (let i = 0; i < 64; i++) {
    const v = 0.55 + 0.45 * Math.sin(i * 0.7) * Math.sin(i * 0.23 + 1);
    const gr = x.createLinearGradient(0, 64, 0, 0);
    gr.addColorStop(0, `rgba(255,255,255,${0.9 * v})`); gr.addColorStop(0.35, `rgba(255,255,255,${0.35 * v})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(i, 0, 1, 64);
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function crea(renderer, gioco, anim, opz = {}) {
  const K = kitArgilla(), { POSA, materiali, A, mesh, palla, scurisci } = K;
  const geoS = bitorzola(palla(0.08, 10), 0.03, 9);
  const nubi = new Map(), sbuffi = [], trame = new Map();
  const sbuffo = (i) => (sbuffi[i] ??= bitorzola(palla(1, 12), 0.16, 1.4, i));
  const caselle = [];
  const casella = (i) => (caselle[i] ??= [bitorzola(new RoundedBoxGeometry(0.92, 0.26, 0.92, 4, 0.1), 0.05, 3, i), bitorzola(palla(0.34, 16), 0.1, 4, i)]);
  // i sottolivelli (dentro un sigillo) hanno la meta o la zona tratteggiata
  const sotto = !!(gioco.liv.meta || gioco.liv.sagoma);
  const Z = sotto ? incanta(ZONE[opz.zona] || ZONE.iniziale) : ZONE[opz.zona] || ZONE.iniziale;
  let scintille = null, cortina = null;
  // gli attrezzi passati alle zone: il kit della plastilina più le varianti condivise e due materiali
  const scorta = new Map(), varia = (k, fab) => { if (!scorta.has(k)) scorta.set(k, fab()); return scorta.get(k); };
  const accesi = new Map(), lucente = (col, forza = 1.5) => {
    const k = col + forza;
    if (!accesi.has(k)) { const m = K.argilla(col, { bump: 0.3 }); m.emissive.set(col); m.emissiveIntensity = forza; accesi.set(k, m); }
    return accesi.get(k);
  };
  const vetro = (col) => A(col, { rough: 0.18, bump: 0.15 });
  let vita = null;
  const segue = []; // oggetti che stanno sempre sotto la telecamera (il mare di lava)
  const sorgenti = [];
  const pietraIn = (x, y) => anim.pietre.some((p) => p.x === x && p.y === y);

  /**
   * Il confine del sottolivello: non ci passa niente (il bordo ferma lastre e coniglio), e deve
   * vedersi. Cippi di pietra bassi con un cristallo acceso in cima, uno ogni casella e mezza lungo il
   * perimetro, e fra l'uno e l'altro una cortina di luce lilla che sale e svanisce. Più in là,
   * scintille che salgono dal vuoto.
   */
  function recinto(k, liv) {
    const x0 = -0.62, z0 = -0.62, x1 = liv.W - 0.38, z1 = liv.H - 0.38;
    const cippo = varia('cippo', () => bitorzola(new RoundedBoxGeometry(0.2, 0.62, 0.2, 2, 0.06), 0.02, 6));
    const cristallo = varia('cristallo', () => bitorzola(new THREE.OctahedronGeometry(0.11, 1), 0.01, 8));
    const lato = (ax, az, bx, bz) => {
      const l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(l / 1.5));
      for (let i = 0; i < n; i++) {
        const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        k.add(mesh(cippo, '#9c90a8', x, -0.05, z));
        const c = mesh(cristallo, lucente('#c8a8ff', 1.6), x, 0.36, z); c.scale.y = 1.6; c.castShadow = false; k.add(c);
      }
      // la cortina: un piano verticale per lato, appena dentro i cippi
      const m = new THREE.Mesh(new THREE.PlaneGeometry(l, 1.2), cortina);
      m.position.set((ax + bx) / 2, 0.3, (az + bz) / 2); m.rotation.y = -Math.atan2(bz - az, bx - ax);
      m.renderOrder = 4; k.add(m);
    };
    const tc = texCortina(); tc.repeat.set(3, 1);
    cortina = new THREE.MeshBasicMaterial({ map: tc, color: '#c4a8ff', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
    materiali.push(cortina);
    lato(x0, z0, x1, z0); lato(x1, z0, x1, z1); lato(x1, z1, x0, z1); lato(x0, z1, x0, z0);
    // le scintille: punti che salgono e respirano, sparsi sul quadro e appena fuori
    const N = 110, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = -1.5 + Math.random() * (liv.W + 2); pos[i * 3 + 1] = -2.5 + Math.random() * 4.5; pos[i * 3 + 2] = -1.5 + Math.random() * (liv.H + 2);
      vel.push({ v: 0.12 + Math.random() * 0.25, f: Math.random() * 6 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const g2 = cv.getContext('2d'), rg = g2.createRadialGradient(16, 16, 0, 16, 16, 16);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.4, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = rg; g2.fillRect(0, 0, 32, 32);
    const mat = new THREE.PointsMaterial({ size: 0.2, map: new THREE.CanvasTexture(cv), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    materiali.push(mat);
    const punti = new THREE.Points(geo, mat); punti.frustumCulled = false;
    scintille = { punti, vel, alto: 2 };
    return punti;
  }
  // le scintille non vanno fra gli statici (si muovono): le aggiunge ogniFotogramma alla prima occasione
  const muoviMagia = (scene, dt, t) => {
    if (!scintille) return;
    if (!scintille.punti.parent) scene.add(scintille.punti);
    const P = scintille.punti.geometry.attributes.position, C = scintille.punti.geometry.attributes.color;
    scintille.vel.forEach((q, i) => {
      let y = P.getY(i) + q.v * dt;
      if (y > scintille.alto) y = -2.5;
      P.setY(i, y);
      const b = (0.45 + 0.55 * Math.sin(t * 2.3 + q.f)) * Math.min(1, (scintille.alto - y) * 0.8);
      C.setXYZ(i, b, b * 0.88, b * 0.62 + 0.1);
    });
    P.needsUpdate = true; C.needsUpdate = true;
    if (cortina) cortina.map.offset.x = (t * 0.04) % 1;
  };
  let segnoSigillo = null;
  const nube = (c) => { if (!nubi.has(c)) { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }); nubi.set(c, m); materiali.push(m); } return nubi.get(c); };

  // fondale dipinto: cielo da teatrino, più chiaro in basso
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 256;
  const g2 = cv.getContext('2d'), gr = g2.createLinearGradient(0, 0, 0, 256);
  for (const [t, c] of Z.cielo) gr.addColorStop(t, c);
  g2.fillStyle = gr; g2.fillRect(0, 0, 16, 256);
  const fondale = new THREE.CanvasTexture(cv); fondale.colorSpace = THREE.SRGBColorSpace;

  return new Base3D(renderer, gioco, anim, {
    cielo: fondale, coloreNebbia: Z.nebbia, nebbia: [22, 60], bolle: 12, glifiOpachi: true,
    luci(scene, centro) {
      const L = Z.luce;
      scene.add(new THREE.HemisphereLight(L.cielo, L.terra, L.amb));
      const s = new THREE.DirectionalLight(L.sole, L.forza);
      s.position.set(centro.x - 9, 16, centro.z + 6); s.target.position.copy(centro);
      s.castShadow = true; s.shadow.mapSize.set(2048, 2048); s.shadow.radius = 6;
      Object.assign(s.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
      s.shadow.bias = -0.0005; s.shadow.normalBias = 0.03;
      scene.add(s, s.target);
      const r = new THREE.DirectionalLight(L.riflesso, L.forzaRiflesso); r.position.set(centro.x + L.daRiflesso[0], L.daRiflesso[1], centro.z + L.daRiflesso[2]);
      r.target.position.copy(centro); scene.add(r, r.target);
      return s; // il sole segue la telecamera: su un mondo grande l'ombra deve stare dove si guarda
    },
    isole(scene, liv) {
      const rnd = casuale(17), fiamme = [];
      // Le geometrie ripetute si fanno una volta in poche varianti e si riusano (`varia`): con mille
      // caselle di isola, rifare i bitorzoli per ciascuna costava secondi di caricamento. Suddivisioni
      // misurate sull'overworld finto (strumenti/mondo-finto.js): la cassetta a 3, la pancia a 14.
      // Forme, colori e oggetti vengono dalla zona (zone.js).
      const VAR = 8, C = Z.cima, k = { ...K, varia, lucente, vetro, add: (o) => scene.add(o) };
      const LATI = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const { x, y, c } of liv.celle) {
        if ('#bt'.includes(c)) {
          // un pezzo di plastilina per casella, appena più largo: si schiacciano l'uno contro l'altro
          const v = (x * 7 + y) % VAR, w = (x + y * 9) % VAR;
          scene.add(mesh(varia('cima' + v, () => bitorzola(new RoundedBoxGeometry(1.06, 0.34, 1.06, 3, C.raggio), C.bitorzoli, 2.5, v)), C.colori[(x * 3 + y * 5) % C.colori.length], x, -0.17, y));
          let d = 0; while (d < 3 && LATI.every(([a, b]) => eIsola(liv, x + a * (d + 1), y + b * (d + 1)))) d++;
          const sotto = mesh(varia('pancia' + w, () => bitorzola(palla(0.58, 14), 0.18, 2.2, w)), Z.pancia[rnd() < 0.5 ? 0 : 1], x, -0.36 - 0.58 * (1 + d * 0.45) * 0.85, y);
          // la pancia sta sotto l'isola: la sua ombra cadrebbe nel vuoto, e nel passaggio delle ombre era metà dei triangoli
          sotto.scale.set(1, 1 + d * 0.45, 1); sotto.castShadow = false; scene.add(sotto);
          for (const ver of LATI) if (!eIsola(liv, x + ver[0], y + ver[1])) Z.bordo?.(k, x, y, ver, rnd);
          if (c === 'b') Z.cespuglio(k, x, y, rnd);
          else if (c === 't') Z.albero(k, x, y, rnd);
          else if (!pietraIn(x, y)) Z.arredo?.(k, x, y, rnd); // sulle pietre niente fiori né sassi
        } else if (c === 'o' || c === 'p') {
          scene.add(mesh(varia('scoglio' + (x % VAR), () => bitorzola(new RoundedBoxGeometry(0.88, 0.32, 0.88, 3, C.raggio), C.bitorzoli, 3, x % VAR)), Z.roccia, x, -0.16, y));
          const s = mesh(varia('radice' + (y % VAR), () => bitorzola(palla(0.45, 14), 0.15, 2.5, y % VAR)), Z.radice, x, -0.6, y); s.scale.y = 1.3; scene.add(s);
          if (c === 'o') Z.scoglio(k, x, y, rnd); else Z.pilastro(k, x, y, rnd);
        } else if (c === 'f') {
          // il fuoco sospeso è un elemento del gioco: uguale in tutte le zone
          scene.add(mesh(bitorzola(new THREE.CylinderGeometry(0.32, 0.25, 0.16, 20, 2), 0.05, 4), '#4a3a3e', x, -0.42, y));
          for (const [dx, dz, h, col] of [[0, 0, 0.5, '#ff6a1a'], [0.12, 0.07, 0.32, '#ffc040'], [-0.11, -0.06, 0.36, '#ffc040']]) {
            const f = mesh(bitorzola(new THREE.ConeGeometry(0.13, h, 16, 4).translate(0, h / 2, 0), 0.05, 6), A(col, { sss: 0xffe060 }), x + dx, -0.36, y + dz);
            scene.add(f); fiamme.push(f);
          }
        }
      }
      // le scenografie stanno fuori dalla griglia, oltre il bordo in alto: per ora in posti fissi,
      // nell'overworld li deciderà la mappa. Le nuvole si aprono attorno.
      // nell'overworld i posti li dà la mappa (strato segni di Tiled)
      const dalla = liv.posti?.casa && [liv.posti.casa, liv.posti.arco || liv.posti.casa];
      // nei sottolivelli (quelli con la meta o la zona tratteggiata) niente casa né rovine: si è dentro il sigillo
      const posti = liv.meta || liv.sagoma ? [] : opz.posti || dalla || [[liv.W * 0.15, -2.2], [liv.W * 0.85, -1.8]];
      if (posti.length) Z.scenografia?.(k, posti, sorgenti);
      // sotto il quadro, lontani: isolotti di sfondo a maglie larghe, mai sotto la scenografia.
      // Non fanno ombra: sull'overworld finto raddoppiavano i triangoli del passaggio delle ombre
      const ks = { ...k, mesh: (...a) => { const m = mesh(...a); m.castShadow = false; return m; } };
      // (nel mondo che si richiude, solo dentro la mappa: fuori ci sono le copie)
      const fx = liv.toroide ? 0 : 4, fz = liv.toroide ? 0 : 3;
      // nell'overworld più radi e più in basso: fra isole vere vicine, quelli fitti sembravano isole del gioco
      const passo = liv.toroide ? 6.5 : 4.5, giu = liv.toroide ? -10 : -7.5;
      if (Z.sfondo) for (let gx = -fx; gx <= liv.W + fx - (liv.toroide ? 3 : 0); gx += passo) for (let gz = -fz; gz <= liv.H + fz - (liv.toroide ? 3 : 0); gz += passo * 0.9) {
        const x = gx + (rnd() - 0.5) * 2.5, z = gz + (rnd() - 0.5) * 2;
        if (rnd() < 0.3 || posti.some(([px, pz]) => Math.hypot(x - px, z - pz) < 3)) continue;
        Z.sfondo(ks, x, z, giu - rnd() * 3, rnd);
      }
      if (Z.fondo) { const f = Z.fondo(k, liv); scene.add(f); segue.push(f); }
      if (sotto) recinto(k, liv);
      return { fiamme, radure: posti.map(([x, z]) => [x, z, 2.4]) };
    },
    // la casella da sola: si vede solo quando la lastra si sgretola o brucia
    lastra(a) {
      const g = new THREE.Group(), col = a.colore || '#c2ccd8';
      const [cima, goccia] = casella(a.id % 8);
      g.add(mesh(cima, col, 0, -0.13, 0));
      const s = mesh(goccia, scurisci(col, 0.72), 0, -0.33, 0); s.scale.y = 0.75; g.add(s);
      return g;
    },
    // la lastra intera: un solo pezzo di pasta col contorno della forma (anche coi buchi),
    // solchi leggeri fra una casella e l'altra per poterle contare, e una goccia sotto ogni casella
    blocco(off, colore) {
      const g = new THREE.Group(), col = colore || '#c2ccd8', seme = off.length * 13 + off[0][0];
      for (const f of contornoCelle(off)) {
        const forma = new THREE.Shape(f.esterno.map(([x, z]) => new THREE.Vector2(x, -z)));
        for (const b of f.buchi) forma.holes.push(new THREE.Path(b.map(([x, z]) => new THREE.Vector2(x, -z))));
        const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelOffset: -0.12, bevelSegments: 4 });
        geo.rotateX(-Math.PI / 2); geo.translate(0, -0.22, 0);
        g.add(mesh(bitorzola(geo, 0.03, 3, seme), col));
      }
      for (const [x, z] of off) {
        const s = mesh(casella(((x * 7 + z + seme) % 8 + 8) % 8)[1], scurisci(col, 0.72), x, -0.36, z); s.scale.y = 0.75; g.add(s);
      }
      const piene = new Set(off.map((o) => o.join(','))), solco = scurisci(col, 0.84);
      for (const [x, z] of off) {
        if (piene.has(x + 1 + ',' + z)) g.add(mesh(new THREE.BoxGeometry(0.035, 0.012, 0.6), solco, x + 0.5, 0.002, z));
        if (piene.has(x + ',' + (z + 1))) g.add(mesh(new THREE.BoxGeometry(0.6, 0.012, 0.035), solco, x, 0.002, z + 0.5));
      }
      return g;
    },
    glifo(g) {
      // disco pieno come nell'ibrido, e un'ombra sotto quando galleggia
      // una trama per glifo diverso, non per ogni glifo del mondo
      const kt = [g.tipo, g.d, g.n, g.giro, g.asse, !!g.fantasma].join('|');
      const o = pianoGlifo(trame.get(kt) ?? trame.set(kt, texGlifo(g, PAL)).get(kt), 0.78);
      if (!g.fantasma) {
        const om = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshBasicMaterial({ color: '#2a2030', transparent: true, opacity: 0.2, depthWrite: false }));
        om.rotation.x = -Math.PI / 2; om.position.set(0.12, -0.6, 0.18); o.add(om); o.userData.ombra = om;
      }
      return o;
    },
    // la pietra del sigillo (e la meta, la sua gemella): un disco di pietra bassa col segno inciso,
    // che quando è acceso brilla d'oro con un alone; spento, il segno è solo un solco scuro
    pietra(p) {
      const g = new THREE.Group();
      g.add(mesh(varia('pietra', () => bitorzola(new THREE.CylinderGeometry(0.42, 0.45, 0.1, 28, 2), 0.025, 5)), '#a99d8b', 0, 0.02, 0));
      segnoSigillo ??= texSigillo();
      const segno = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.66), new THREE.MeshBasicMaterial({ map: segnoSigillo, transparent: true, depthWrite: false, color: '#ffb020' }));
      segno.rotation.x = -Math.PI / 2; segno.position.y = 0.075; segno.renderOrder = 2; g.add(segno);
      const alone = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.52, 40), new THREE.MeshBasicMaterial({ color: '#ffd070', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      alone.rotation.x = -Math.PI / 2; alone.position.y = 0.08; alone.renderOrder = 3; g.add(alone);
      materiali.push(segno.material, alone.material);
      g.userData = { segno, alone, fase: (p.x * 7 + p.y * 3) % 6 };
      return g;
    },
    pietraPosa(o, p, t) {
      const { segno, alone, fase } = o.userData, pulsa = 0.5 + 0.5 * Math.sin(t * 2.2 + fase);
      // spento: il segno si scurisce fino al colore del solco
      segno.material.color.setRGB(0.3 + 0.7 * p.luce, 0.27 + 0.42 * p.luce, 0.24 - 0.12 * p.luce);
      alone.material.opacity = p.luce * (0.18 + 0.12 * pulsa) + p.imp * 0.4;
      alone.scale.setScalar(1 + p.imp * 0.15);
    },
    // la zona tratteggiata (come in Opera): trattini di pasta chiara sospesi all'altezza delle lastre
    // lungo il contorno, e un velo appena visibile dentro. Quando una lastra la riempie diventano verdi.
    sagoma(celle) {
      const g = new THREE.Group(), dentro = new Set(celle.map(([x, y]) => x + ',' + y));
      const mat = K.argilla('#fbf3df', { bump: 0.2 }); mat.emissive.set('#fbf3df'); mat.emissiveIntensity = 0.35;
      const geo = varia('trattino', () => new RoundedBoxGeometry(0.26, 0.05, 0.07, 2, 0.025));
      for (const [x, y] of celle) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (dentro.has(x + dx + ',' + (y + dy))) continue;
        // il lato della casella verso fuori: due trattini, così il tratteggio continua da un lato all'altro
        for (const t of [-0.25, 0.25]) {
          const o = new THREE.Mesh(geo, mat);
          o.position.set(x + dx * 0.5 + (dy ? t : 0), 0.04, y + dy * 0.5 + (dx ? t : 0));
          if (dx) o.rotation.y = Math.PI / 2;
          o.castShadow = true; g.add(o);
        }
      }
      const velo = new THREE.MeshBasicMaterial({ color: '#fbf3df', transparent: true, opacity: 0.12, depthWrite: false });
      for (const [x, y] of celle) { const q = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), velo); q.rotation.x = -Math.PI / 2; q.position.set(x, 0.03, y); g.add(q); }
      materiali.push(velo);
      g.userData = { mat, velo };
      return g;
    },
    sagomaPosa(o, luce, t) {
      const { mat, velo } = o.userData;
      // da crema a verde ("a posto", come in Opera); finché è vuota respira appena
      mat.color.setRGB(0.98 - 0.8 * luce, 0.95 - 0.2 * luce, 0.87 - 0.72 * luce);
      mat.emissive.copy(mat.color);
      mat.emissiveIntensity = 0.3 + 0.1 * Math.sin(t * 2.4) * (1 - luce) - 0.05 * luce;
      velo.opacity = 0.12 * (1 - luce);
      o.position.y = 0.015 * Math.sin(t * 1.6) * (1 - luce);
    },
    chiuso: !!opz.chiuso,
    // i personaggi: il coniglio e, nei livelli in due, il gatto
    figura: (chi) => (FIGURE[chi] || coniglio)(K),
    figuraPosa(k, c, A, i) {
      // un quadrupede saltella meno del coniglio, e cammina muovendo le zampe (solo chi sta camminando)
      k.position.y = c.y * (k.userData.salto ?? 1);
      animaZampe(k, c, !!A.corrente?.cammina && A.corrente.chi === i, A.tempo);
    },
    // il segno sotto chi si comanda: un anello color glifo, schiacciato sulla casella
    segno() {
      const o = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 32), A('#f2c040', { sss: 0xfff0a0 }));
      o.rotation.x = -Math.PI / 2; o.scale.z = 0.5; return o;
    },
    // le nuvole coprono mezzo schermo: con lo shader delle impronte costavano piu' di tutto il resto,
    // e i bitorzoli della geometria bastano a farle sembrare di plastilina
    nuvola(rnd, s, profonda) {
      const g = new THREE.Group(), col = profonda ? Z.nuvole[1] : Z.nuvole[0];
      for (let i = 0, n = 4 + Math.floor(rnd() * 3); i < n; i++) {
        // poche palle bitorzolute di raggio 1, riusate e ingrandite: rifarle per ogni nuvola costava più di un secondo
        const r = (0.5 + rnd() * 0.5) * s, b = new THREE.Mesh(sbuffo(i % 6), nube(col));
        b.position.set((rnd() - 0.5) * 2 * s, (rnd() - 0.2) * 0.35 * s, (rnd() - 0.5) * 1.2 * s); b.scale.set(r, r * 0.62, r); g.add(b);
      }
      return g;
    },
    segue,
    // le nuvole sopra i tratti non ancora scoperti: gli stessi sbuffi delle altre nuvole
    coperta: () => ({ geo: sbuffo(0), mat: nube(Z.nuvole[0]) }),
    scheggia: (tipo) => new THREE.Mesh(geoS, tipo === 'fuoco' ? A('#ff7a20') : A('#c2ccd8')),
    ogniFotogramma(p, dt) {
      POSA.value = p.ultimaPosa;
      vita ??= Z.vita?.({ ...K, varia, lucente, vetro }, p.scene, p.gioco.liv, sorgenti) || (() => {});
      vita(dt, p.anim.tempo);
      muoviMagia(p.scene, dt, p.anim.tempo);
    },
    dispose: () => { materiali.forEach((m) => m.dispose()); geoS.dispose(); fondale.dispose(); },
  });
}
