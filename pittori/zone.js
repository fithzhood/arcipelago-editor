// L'aspetto delle zone. Ogni zona prende l'aspetto dalla sua meccanica e cambia quattro cose oltre
// alla tavolozza: la forma e il materiale delle isole, gli oggetti sparsi, il cielo con la luce, e una
// piccola vita che si muove. Le rovine dei maghi ci sono in tutte, ognuna con la sua architettura.
//
// Regole per chi aggiunge oggetti:
// - gli arredi stanno negli angoli delle caselle, bassi: il centro è del personaggio;
// - niente che sembri un ostacolo dove non lo è (staccionate, muretti sui bordi): ostacoli e
//   cespugli sono regole del gioco, l'arredo no;
// - il fuoco sospeso ('f') è un elemento del gioco e resta uguale in tutte le zone;
// - ogni oggetto ripetuto per casella va misurato sull'overworld finto (?prova=grande).
//
// Ogni funzione riceve `k`, gli attrezzi della plastilina (vedi `attrezzi()` in plastilina.js).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const ANGOLI = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
// un punto vicino a un angolo della casella, lontano dal centro dove sta il personaggio
const angolo = (rnd, i) => { const [a, b] = ANGOLI[i % 4]; return [a * (0.27 + rnd() * 0.1), b * (0.27 + rnd() * 0.1)]; };

/** Un isolotto rotondo fuori griglia, per le scenografie. Restituisce il gruppo, con la cima a y = 0. */
function isolotto(k, r, cima, pancia) {
  const g = new THREE.Group();
  g.add(k.mesh(k.varia('isolotto' + r, () => k.bitorzola(new THREE.CylinderGeometry(r, r * 0.94, 0.34, 18, 2), 0.06, 2.5, 3)), cima, 0, -0.17, 0));
  const p = k.mesh(k.varia('pancia-isolotto' + r, () => k.bitorzola(k.palla(r * 0.88, 14), 0.2, 2, 5)), pancia, 0, -0.75 - r * 0.4, 0);
  p.scale.y = 1.15; p.castShadow = false; g.add(p);
  return g;
}

/** Particelle semplici: un insieme di mesh che una funzione muove a ogni fotogramma. */
function sciame(scene, n, fab) { const v = []; for (let i = 0; i < n; i++) { const o = fab(i); scene.add(o); v.push(o); } return v; }

export const ZONE = {
  // Zona iniziale: si cammina e si trasla. Prato e frutteto, la casa del coniglio crollata.
  iniziale: {
    nome: 'Prato',
    cielo: [[0, '#5c93d1'], [0.6, '#a9cde8'], [1, '#efe3c6']],
    nebbia: '#b8d4e8', nuvole: ['#fbfbf8', '#c6dcef'],
    luce: { cielo: '#fff4e4', terra: '#6a5040', amb: 1.1, sole: '#ffe8cc', forza: 2.6, riflesso: '#bcd4ff', forzaRiflesso: 0.7, daRiflesso: [10, 6, -8] },
    cima: { colori: ['#6fb04a', '#78b852', '#66a642'], raggio: 0.12, bitorzoli: 0.06 },
    pancia: ['#9a6a48', '#8a5e40'], roccia: '#a88464', radice: '#8a5e40',

    arredo(k, x, y, rnd) {
      if (rnd() > 0.8) return;
      for (let n = 1 + (rnd() < 0.5 ? 1 : 0), i = Math.floor(rnd() * 4); n > 0; n--, i++) {
        const [dx, dz] = angolo(rnd, i), r = rnd(), px = x + dx, pz = y + dz;
        if (r < 0.4) { // ciuffo d'erba
          for (let j = 0; j < 5; j++) {
            const f = k.mesh(k.varia('filo', () => k.palla(1, 6)), j % 2 ? '#4f9a3a' : '#5eaa44', px + (rnd() - 0.5) * 0.14, 0.09, pz + (rnd() - 0.5) * 0.14);
            f.scale.set(0.035, 0.16 + rnd() * 0.07, 0.035); f.castShadow = false; f.rotation.set((rnd() - 0.5) * 0.7, 0, (rnd() - 0.5) * 0.7); k.add(f);
          }
        } else if (r < 0.75) { // fiori
          const col = ['#fbf6ee', '#f6d24a', '#f0a0c0', '#b8a0e8'][Math.floor(rnd() * 4)];
          for (let j = 0; j < 4; j++) {
            const fx = px + (rnd() - 0.5) * 0.22, fz = pz + (rnd() - 0.5) * 0.22, h = 0.05 + rnd() * 0.06;
            const st = k.mesh(k.varia('stelo', () => new THREE.CylinderGeometry(0.008, 0.01, 1, 4).translate(0, 0.5, 0)), '#4f9a3a', fx, 0, fz); st.scale.y = h; k.add(st);
            const p = k.mesh(k.varia('petali', () => k.palla(0.07, 7)), col, fx, h + 0.02, fz); p.scale.y = 0.45; p.castShadow = st.castShadow = false; k.add(p);
            k.add(k.mesh(k.varia('pistillo', () => k.palla(0.026, 6)), '#e8a020', fx, h + 0.045, fz));
          }
        } else if (r < 0.9) { // sasso
          const s = k.mesh(k.varia('sasso', () => k.bitorzola(k.palla(0.08, 8), 0.03, 8)), '#b8b0a4', px, 0.01, pz); s.scale.y = 0.55; k.add(s);
        } else { // fungo
          k.add(k.mesh(k.varia('gambo', () => new THREE.CylinderGeometry(0.022, 0.03, 0.09, 6)), '#f0e6d2', px, 0.045, pz));
          const c = k.mesh(k.varia('cappello', () => k.palla(0.065, 10)), '#d0463a', px, 0.1, pz); c.scale.y = 0.55; k.add(c);
          for (const [a, b] of [[0.03, 0.01], [-0.02, 0.03]]) k.add(k.mesh(k.varia('puntino', () => k.palla(0.013, 5)), '#fbf6ee', px + a, 0.125, pz + b));
        }
      }
    },
    // sotto i bordi: radici che pendono e ciuffi d'edera, così l'isola non è nuda di lato
    bordo(k, x, y, verso, rnd) {
      if (rnd() > 0.5) return;
      const [vx, vz] = verso;
      for (let j = 0; j < 2; j++) {
        const t = (rnd() - 0.5) * 0.7, px = x + vx * 0.48 + vz * t, pz = y + vz * 0.48 + vx * t;
        const r = k.mesh(k.varia('radichetta', () => k.palla(1, 6)), '#7a5236', px, -0.5 - rnd() * 0.15, pz);
        r.scale.set(0.03, 0.22 + rnd() * 0.12, 0.03); r.castShadow = false; k.add(r);
      }
      if (rnd() < 0.5) {
        const e = k.mesh(k.varia('edera', () => k.bitorzola(k.palla(0.12, 8), 0.05, 6)), '#4a9a3e', x + vx * 0.5, -0.32, y + vz * 0.5);
        e.scale.set(1, 1.4, 1); e.castShadow = false; k.add(e);
      }
    },
    cespuglio(k, x, y, rnd) {
      for (let i = 0; i < 3; i++) k.add(k.mesh(k.varia('cespo' + i, () => k.bitorzola(k.palla(0.2, 12), 0.08, 6, i)), '#3f8f3a', x + (rnd() - 0.5) * 0.35, 0.16, y + (rnd() - 0.5) * 0.35));
    },
    albero(k, x, y) {
      k.add(k.mesh(k.varia('tronco', () => k.bitorzola(new THREE.CylinderGeometry(0.08, 0.12, 0.6, 10, 3), 0.04, 6)), '#7a4e30', x, 0.3, y));
      const ch = k.mesh(k.varia('chioma', () => k.bitorzola(k.palla(0.42, 18), 0.14, 3)), '#3a8f44', x, 0.85, y); ch.scale.y = 0.85; k.add(ch);
      for (let i = 0; i < 5; i++) k.add(k.mesh(k.varia('mela', () => k.palla(0.05, 8)), '#e04a3a', x + Math.cos(i * 1.3) * 0.36, 0.8 + (i % 2) * 0.15, y + Math.sin(i * 1.3) * 0.36));
    },
    scoglio(k, x, y) {
      for (let i = 0; i < 3; i++) k.add(k.mesh(k.varia('cespo' + (i + 4), () => k.bitorzola(k.palla(0.2, 12), 0.08, 6, i + 4)), '#3f8f3a', x + (i - 1) * 0.17, 0.16, y + (i % 2) * 0.1));
    },
    pilastro(k, x, y) {
      k.add(k.mesh(k.varia('colonna', () => k.bitorzola(new THREE.CylinderGeometry(0.28, 0.33, 1.3, 20, 6), 0.08, 3)), '#ddd2be', x, 0.65, y));
    },

    // la casa del coniglio, crollata col terremoto, e un arco dei maghi
    scenografia(k, [[hx, hz], [ax, az]]) {
      const casa = isolotto(k, 1.5, '#72b34c', '#8a5e40'); casa.position.set(hx, -0.25, hz); k.add(casa);
      const m = (geo, col, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = k.mesh(geo, col, x, y, z); o.rotation.set(rx, ry, rz); casa.add(o); return o; };
      const muro = '#ead9b8', tetto = '#b0503a';
      m(k.bitorzola(new RoundedBoxGeometry(1.4, 0.95, 0.18, 3, 0.06), 0.03, 4), muro, 0, 0.47, -0.5);
      m(k.bitorzola(new RoundedBoxGeometry(0.18, 0.85, 1.0, 3, 0.06), 0.03, 4, 1), muro, -0.62, 0.42, 0);
      m(k.bitorzola(new RoundedBoxGeometry(0.18, 0.45, 0.55, 3, 0.06), 0.03, 4, 2), muro, 0.62, 0.22, -0.2); // il muro crollato
      m(k.bitorzola(new RoundedBoxGeometry(0.45, 0.6, 0.18, 3, 0.06), 0.03, 4, 3), muro, -0.4, 0.3, 0.5);
      // finestra tonda sul muro di fondo
      m(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 20), '#4a3428', 0.3, 0.58, -0.4, Math.PI / 2);
      m(new THREE.TorusGeometry(0.18, 0.035, 6, 20), '#8a5a36', 0.3, 0.58, -0.39);
      // il tetto caduto, appoggiato di traverso
      m(k.bitorzola(new RoundedBoxGeometry(1.3, 0.09, 0.85, 3, 0.04), 0.03, 4, 4), tetto, 0.05, 0.42, 0.05, 0.15, 0.25, -0.5);
      m(k.bitorzola(new RoundedBoxGeometry(0.24, 0.55, 0.24, 3, 0.05), 0.03, 4, 5), '#a86048', 0.48, 0.95, -0.52);
      for (let i = 0; i < 5; i++) m(new RoundedBoxGeometry(0.16, 0.07, 0.1, 2, 0.02), '#c07050', 0.2 + Math.cos(i * 2.1) * 0.5, 0.035, 0.75 + Math.sin(i * 2.1) * 0.2, 0, i);
      // l'orto: un solco di terra con le carote
      m(k.bitorzola(new RoundedBoxGeometry(0.95, 0.07, 0.26, 2, 0.03), 0.02, 5), '#7a5236', -0.55, 0.035, 0.95, 0, 0.3);
      for (let i = 0; i < 4; i++) {
        const cx = -0.92 + i * 0.25, cz = 1.06 - i * 0.075;
        m(k.palla(0.045, 8), '#f08a2a', cx, 0.07, cz);
        for (const s of [-0.4, 0, 0.4]) { const f = m(k.palla(1, 6), '#4f9a3a', cx, 0.15, cz, 0, 0, s); f.scale.set(0.02, 0.08, 0.02); }
      }

      // l'arco dei maghi: pietra chiara, una runa azzurra che ancora brilla
      const arco = isolotto(k, 1.0, '#7ab654', '#8a5e40'); arco.position.set(ax, -0.4, az); k.add(arco);
      const a = (geo, col, x, y, z, rz = 0) => { const o = k.mesh(geo, col, x, y, z); o.rotation.z = rz; arco.add(o); return o; };
      a(k.bitorzola(new THREE.CylinderGeometry(0.15, 0.19, 1.3, 12, 4), 0.04, 4), '#ddd4c2', -0.42, 0.65, 0);
      a(k.bitorzola(new THREE.CylinderGeometry(0.15, 0.19, 0.7, 12, 3), 0.04, 4, 1), '#ddd4c2', 0.42, 0.35, 0);
      a(k.bitorzola(new RoundedBoxGeometry(1.15, 0.2, 0.3, 3, 0.06), 0.03, 4), '#e4dccc', -0.05, 1.12, 0, -0.35);
      a(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 16), k.lucente('#5aa0ff', 1.6), -0.1, 1.12, 0.16, 0).rotation.set(Math.PI / 2, 0, -0.35);
      a(k.bitorzola(new RoundedBoxGeometry(0.4, 0.2, 0.28, 2, 0.05), 0.04, 4), '#d6ccb8', 0.5, 0.1, 0.4, 0.3);
    },

    // isolotti lontani, piu' in basso: frutteti e capanne. Riempiono i vuoti fra un'isola e l'altra
    // e danno profondita'; la nebbia li stinge, cosi' non sembrano isole su cui si cammina
    sfondo(k, x, z, y, rnd) {
      // colori già stinti verso il cielo: da vicino sembravano isole del quadro
      const r = 0.8 + rnd() * 0.7, g = isolotto(k, Math.round(r * 2) / 2, '#a4c890', '#b8a08c'); g.position.set(x, y, z); g.scale.setScalar(0.8); k.add(g);
      const n = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const a = i * 2.3 + rnd(), d = n > 1 ? r * 0.45 : 0, tx = Math.cos(a) * d, tz = Math.sin(a) * d;
        g.add(k.mesh(k.varia('tronco', () => k.bitorzola(new THREE.CylinderGeometry(0.08, 0.12, 0.6, 10, 3), 0.04, 6)), '#a8907c', tx, 0.3, tz));
        const ch = k.mesh(k.varia('chioma', () => k.bitorzola(k.palla(0.42, 18), 0.14, 3)), i % 2 ? '#8cbc90' : '#80b488', tx, 0.85, tz); ch.scale.y = 0.85; g.add(ch);
      }
      if (rnd() < 0.35) { // una capanna
        g.add(k.mesh(k.varia('capanna', () => k.bitorzola(new RoundedBoxGeometry(0.5, 0.4, 0.45, 2, 0.05), 0.03, 4)), '#f0e6d4', -r * 0.35, 0.2, r * 0.3));
        const t = k.mesh(k.varia('tettino', () => k.bitorzola(new RoundedBoxGeometry(0.62, 0.08, 0.56, 2, 0.03), 0.02, 4)), '#cc9888', -r * 0.35, 0.47, r * 0.3); t.rotation.z = 0.12; g.add(t);
      }
    },

    // farfalle che girano sopra le isole
    vita(k, scene, liv) {
      const ali = k.palla(1, 8), corpo = k.palla(0.022, 6), cx = liv.W / 2, cz = liv.H / 2;
      const colori = ['#fbf6ee', '#f6d24a', '#f39a3a', '#9ec8f0'];
      const farfalle = sciame(scene, 7, (i) => {
        const g = new THREE.Group(), col = k.A(colori[i % 4]);
        const c = new THREE.Mesh(corpo, k.A('#3a2c30')); c.scale.set(0.7, 0.7, 2); g.add(c);
        for (const s of [-1, 1]) {
          const p = new THREE.Group(), w = new THREE.Mesh(ali, col);
          w.scale.set(0.075, 0.008, 0.06); w.position.x = s * 0.07; p.add(w); p.userData.lato = s; g.add(p);
        }
        g.userData = { a: 0.13 + i * 0.031, b: 0.17 + i * 0.023, f: i * 1.9, rx: cx * (0.5 + (i % 3) * 0.15), rz: cz * (0.6 + (i % 2) * 0.2) };
        return g;
      });
      return (dt, t) => {
        for (const g of farfalle) {
          const u = g.userData, x = cx + Math.sin(t * u.a + u.f) * u.rx, z = cz + Math.sin(t * u.b + u.f * 1.3) * u.rz;
          g.rotation.y = Math.atan2(x - g.position.x, z - g.position.z) || g.rotation.y;
          g.position.set(x, 0.55 + Math.sin(t * 2.3 + u.f) * 0.2, z);
          const batti = 0.25 + 1.1 * Math.abs(Math.sin(t * 16 + u.f));
          g.children.forEach((p) => { if (p.userData.lato) p.rotation.z = p.userData.lato * batti; });
        }
      };
    },
  },

  // Zona del fuoco: roccia vulcanica, la fucina dei maghi, cenere che cade e braci che salgono.
  fuoco: {
    nome: 'Fuoco',
    cielo: [[0, '#2e1a2a'], [0.55, '#7a3a32'], [1, '#e8904a']],
    nebbia: '#6a3a34', nuvole: ['#cdbfb8', '#5a3c40'],
    // il riflesso viene dal basso: è il bagliore della lava che illumina la pancia delle isole
    luce: { cielo: '#ffc0a0', terra: '#40201a', amb: 0.95, sole: '#ffc890', forza: 2.1, riflesso: '#ff6a30', forzaRiflesso: 1.6, daRiflesso: [4, -8, 4] },
    cima: { colori: ['#3d3437', '#463c3f', '#383132'], raggio: 0.05, bitorzoli: 0.08 },
    pancia: ['#2a2426', '#332b2c'], roccia: '#3c3436', radice: '#2a2426',

    arredo(k, x, y, rnd) {
      // chiazze di cenere chiara: rompono il nero uniforme della roccia
      if (rnd() < 0.35) {
        const c = k.mesh(k.varia('cenere' + Math.floor(rnd() * 3), () => k.bitorzola(new THREE.CylinderGeometry(0.2, 0.22, 0.02, 10), 0.04, 6, rnd() * 9)), '#7a6e6c', x + (rnd() - 0.5) * 0.4, 0.004, y + (rnd() - 0.5) * 0.4);
        c.scale.set(0.8 + rnd() * 0.8, 1, 0.6 + rnd() * 0.6); c.rotation.y = rnd() * 3; c.castShadow = false; k.add(c);
      }
      // una crepa che brilla, a zig-zag, piatta: ci si può camminare sopra
      if (rnd() < 0.4) {
        const a = rnd() * Math.PI, l = 0.25 + rnd() * 0.15, ox = (rnd() - 0.5) * 0.3, oz = (rnd() - 0.5) * 0.3;
        for (const s of [-1, 1]) {
          const c = k.mesh(k.varia('crepa', () => new THREE.BoxGeometry(1, 0.02, 0.035)), k.lucente('#ff6420', 1.4), x + ox + Math.cos(a) * l * 0.45 * s, 0.003, y + oz - Math.sin(a) * l * 0.45 * s);
          c.scale.x = l; c.rotation.y = a + s * 0.5; c.castShadow = false; k.add(c);
        }
      }
      if (rnd() > 0.55) return;
      const [dx, dz] = angolo(rnd, Math.floor(rnd() * 4)), r = rnd(), px = x + dx, pz = y + dz;
      if (r < 0.45) { // schegge di ossidiana
        for (let j = 0; j < 2 + Math.floor(rnd() * 2); j++) {
          const o = k.mesh(k.varia('ossidiana', () => new THREE.OctahedronGeometry(0.08, 0)), k.vetro('#1e1a26'), px + (rnd() - 0.5) * 0.12, 0.06, pz + (rnd() - 0.5) * 0.12);
          o.scale.set(0.7, 1.4 + rnd() * 0.8, 0.7); o.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6); k.add(o);
        }
      } else if (r < 0.8) { // brace in una conca di roccia
        const s = k.mesh(k.varia('conca', () => k.bitorzola(k.palla(0.09, 8), 0.03, 8)), '#2a2426', px, 0.0, pz); s.scale.y = 0.45; k.add(s);
        k.add(k.mesh(k.varia('brace', () => k.palla(0.045, 8)), k.lucente('#ff8a2a', 1.8), px, 0.03, pz));
      } else { // sassi neri
        for (let j = 0; j < 2; j++) { const s = k.mesh(k.varia('sasso', () => k.bitorzola(k.palla(0.08, 8), 0.03, 8)), '#24201f', px + j * 0.1, 0.01, pz); s.scale.y = 0.6; k.add(s); }
      }
    },
    // sotto i bordi: gocce di lava che pendono
    bordo(k, x, y, verso, rnd) {
      if (rnd() > 0.4) return;
      const [vx, vz] = verso, t = (rnd() - 0.5) * 0.6;
      const g = k.mesh(k.varia('goccia-lava', () => k.palla(1, 8)), k.lucente('#ff6a20', 1.6), x + vx * 0.42 + vz * t, -0.55 - rnd() * 0.2, y + vz * 0.42 + vx * t);
      g.scale.set(0.07, 0.2 + rnd() * 0.1, 0.07); g.castShadow = false; k.add(g);
    },
    // il cespuglio secco: rami spogli (si brucia col talismano, deve sembrare che possa bruciare)
    cespuglio(k, x, y, rnd) {
      for (let i = 0; i < 6; i++) {
        const g = new THREE.Group(); g.position.set(x + (rnd() - 0.5) * 0.15, 0, y + (rnd() - 0.5) * 0.15); g.rotation.y = i * 1.05 + rnd();
        const r = k.mesh(k.varia('rametto', () => new THREE.CylinderGeometry(0.018, 0.03, 0.48, 5).translate(0, 0.24, 0)), '#9a7a5e', 0, 0, 0);
        r.rotation.z = 0.45 + rnd() * 0.35; g.add(r); k.add(g);
      }
      for (let i = 0; i < 2; i++) k.add(k.mesh(k.varia('cespo-secco', () => k.bitorzola(k.palla(0.13, 8), 0.05, 6)), '#a08a4a', x + (i - 0.5) * 0.22, 0.14, y + (rnd() - 0.5) * 0.2));
    },
    // l'albero bruciato, con le braci in punta ai rami
    albero(k, x, y) {
      k.add(k.mesh(k.varia('tronco-bruciato', () => k.bitorzola(new THREE.CylinderGeometry(0.07, 0.15, 0.95, 8, 4), 0.04, 6)), '#6a5650', x, 0.47, y));
      for (let i = 0; i < 4; i++) {
        const g = new THREE.Group(); g.position.set(x, 0.55 + (i % 2) * 0.2, y); g.rotation.y = i * 1.7 + 0.4;
        const s = new THREE.Group(); s.rotation.z = -0.8 - (i % 2) * 0.25; g.add(s);
        s.add(k.mesh(k.varia('ramo', () => new THREE.CylinderGeometry(0.022, 0.045, 0.5, 6).translate(0, 0.25, 0)), '#6a5650'));
        const b = k.mesh(k.varia('brace', () => k.palla(0.045, 8)), k.lucente('#ff8a2a', 1.8), 0, 0.5, 0); s.add(b);
        k.add(g);
      }
    },
    scoglio(k, x, y) {
      const c = k.mesh(k.varia('crepa', () => new THREE.BoxGeometry(1, 0.02, 0.035)), k.lucente('#ff6420', 1.4), x, 0.005, y); c.scale.x = 0.5; c.rotation.y = 0.6; c.castShadow = false; k.add(c);
      for (let j = 0; j < 3; j++) { const o = k.mesh(k.varia('ossidiana', () => new THREE.OctahedronGeometry(0.08, 0)), k.vetro('#1e1a26'), x + (j - 1) * 0.2, 0.09, y + (j % 2) * 0.12 - 0.06); o.scale.set(0.8, 2, 0.8); o.rotation.y = j; k.add(o); }
    },
    // colonne di basalto a sei facce, una alta e due basse
    pilastro(k, x, y) {
      k.add(k.mesh(k.varia('basalto', () => k.bitorzola(new THREE.CylinderGeometry(0.24, 0.26, 1.3, 6, 3), 0.03, 4)), '#3d3538', x - 0.05, 0.65, y));
      k.add(k.mesh(k.varia('basalto-basso', () => k.bitorzola(new THREE.CylinderGeometry(0.16, 0.18, 0.7, 6, 2), 0.03, 4, 1)), '#4a4044', x + 0.22, 0.35, y + 0.12));
      k.add(k.mesh(k.varia('basalto-tozzo', () => k.bitorzola(new THREE.CylinderGeometry(0.14, 0.15, 0.45, 6, 2), 0.03, 4, 2)), '#352e31', x + 0.05, 0.22, y + 0.26));
    },

    // la fucina dei maghi, e rocce di lava sospese
    scenografia(k, [[hx, hz], [ax, az]], sorgenti) {
      const fu = isolotto(k, 1.5, '#3d3437', '#2a2426'); fu.position.set(hx, -0.25, hz); k.add(fu);
      const m = (geo, col, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = k.mesh(geo, col, x, y, z); o.rotation.set(rx, ry, rz); fu.add(o); return o; };
      // il forno a cupola, con la bocca accesa
      const forno = m(k.bitorzola(k.palla(0.6, 16), 0.08, 4), '#6a3a2e', 0.35, 0.15, -0.45); forno.scale.y = 0.85;
      m(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 18), k.lucente('#ffa040', 2.2), 0.35, 0.28, 0.12, Math.PI / 2 - 0.15);
      m(k.bitorzola(new THREE.CylinderGeometry(0.15, 0.2, 1.3, 10, 4), 0.04, 4), '#5a3228', 0.65, 0.9, -0.75);
      // l'incudine
      m(k.bitorzola(new RoundedBoxGeometry(0.26, 0.3, 0.26, 2, 0.04), 0.02, 5), '#3a3a42', -0.55, 0.15, 0.25);
      m(k.bitorzola(new RoundedBoxGeometry(0.62, 0.15, 0.28, 2, 0.04), 0.02, 5, 1), '#4c4c56', -0.55, 0.37, 0.25);
      const corno = m(k.palla(1, 10), '#4c4c56', -0.92, 0.38, 0.25); corno.scale.set(0.18, 0.06, 0.09);
      // il calderone di lava
      const cal = m(k.bitorzola(k.palla(0.26, 14), 0.04, 5), '#26262c', 0.6, 0.18, 0.55); cal.scale.y = 0.75;
      m(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16), k.lucente('#ff7a20', 2), 0.6, 0.36, 0.55);
      // gocce di lava sotto l'isolotto
      for (let i = 0; i < 6; i++) { const g = m(k.palla(1, 8), k.lucente('#ff6a20', 1.6), Math.cos(i * 1.1) * 1.1, -0.7 - (i % 3) * 0.2, Math.sin(i * 1.1) * 1.1); g.scale.set(0.09, 0.28, 0.09); g.castShadow = false; }
      sorgenti.push([hx + 0.65, 1.3, hz - 0.75]); // il fumo esce dal camino

      // rocce di lava sospese, con le crepe accese
      [[0, 0, 0, 0.55], [1.3, -0.5, 0.6, 0.35], [-1.0, -0.8, 0.9, 0.3]].forEach(([dx, dy, dz, r], i) => {
        const g = new THREE.Group(); g.position.set(ax + dx, dy - 0.2, az + dz); k.add(g);
        const s = k.mesh(k.bitorzola(new THREE.IcosahedronGeometry(r, 1), r * 0.25, 3, i), '#2e2729'); s.scale.y = 0.8; g.add(s);
        const c = k.mesh(new THREE.BoxGeometry(r * 1.6, 0.03, 0.05), k.lucente('#ff6420', 1.6), 0, r * 0.62, 0); c.rotation.y = i; g.add(c);
        for (let j = 0; j < 2; j++) { const o = k.mesh(new THREE.OctahedronGeometry(r * 0.25, 0), k.vetro('#1e1a26'), (j - 0.5) * r * 0.6, r * 0.75, (j - 0.5) * r * 0.3); o.scale.y = 1.8; o.rotation.y = j + i; g.add(o); }
      });
    },

    // in basso, lontano: rocce di lava sospese e, in fondo a tutto, il mare di lava
    sfondo(k, x, z, y, rnd) {
      const r = 0.5 + rnd() * 0.7, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rnd() * 6; g.scale.setScalar(0.8); k.add(g);
      const v = Math.floor(rnd() * 4);
      const s = k.mesh(k.varia('masso' + v, () => k.bitorzola(new THREE.IcosahedronGeometry(1, 1), 0.3, 3, v)), '#5a4446'); s.scale.set(r, r * 0.8, r); g.add(s);
      const c = k.mesh(k.varia('crepa', () => new THREE.BoxGeometry(1, 0.02, 0.035)), k.lucente('#ff6420', 1.4), 0, r * 0.62, 0); c.scale.set(r * 1.4, 1, 1.6); g.add(c);
      if (rnd() < 0.5) g.add(k.mesh(k.varia('basalto', () => k.bitorzola(new THREE.CylinderGeometry(0.24, 0.26, 1.3, 6, 3), 0.03, 4)), '#3d3538', r * 0.2, r * 0.5 + 0.4, 0));
      if (rnd() < 0.6) { const d = k.mesh(k.varia('goccia-lava', () => k.palla(1, 8)), k.lucente('#ff6a20', 1.6), 0, -r * 0.85, 0); d.scale.set(0.12, 0.35, 0.12); d.castShadow = false; g.add(d); }
    },
    fondo(k, liv) {
      // una tela grande e lontana, con chiazze accese: la nebbia la scalda e la sfuma
      const cv = document.createElement('canvas'); cv.width = cv.height = 256;
      const x = cv.getContext('2d'); x.fillStyle = '#7a2a14'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 70; i++) {
        const px = Math.random() * 256, py = Math.random() * 256, r = 8 + Math.random() * 30, gr = x.createRadialGradient(px, py, 0, px, py, r);
        gr.addColorStop(0, i % 3 ? '#ff8a2a' : '#ffd060'); gr.addColorStop(1, 'rgba(122,42,20,0)'); x.fillStyle = gr; x.fillRect(px - r, py - r, r * 2, r * 2);
      }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4);
      const m = new THREE.MeshBasicMaterial({ map: t }); k.materiali.push(m);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), m); p.rotation.x = -Math.PI / 2; p.position.set(liv.W / 2, -18, liv.H / 2);
      p.userData.mobile = true; // resta fuori dalla fusione: e' un pezzo solo, enorme
      return p;
    },

    // braci che salgono, cenere che scende, fumo dalla fucina
    vita(k, scene, liv, sorgenti) {
      const W = liv.W, H = liv.H, rnd = Math.random;
      const geoB = k.palla(0.022, 5), braceMat = new THREE.MeshBasicMaterial({ color: '#ffb050' });
      const cenereMat = new THREE.MeshBasicMaterial({ color: '#9a9094' }), geoC = new THREE.PlaneGeometry(0.04, 0.04);
      const fumoMat = new THREE.MeshBasicMaterial({ color: '#4a4044', transparent: true, opacity: 0.5, depthWrite: false });
      const geoF = k.palla(0.18, 8);
      k.materiali.push(braceMat, cenereMat, fumoMat);
      const nuova = (o, alto) => { o.position.set(-2 + rnd() * (W + 4), alto ? -3 + rnd() * 6 : -3, -2 + rnd() * (H + 4)); o.userData.v = 0.35 + rnd() * 0.5; o.userData.f = rnd() * 6; };
      const braci = sciame(scene, 45, () => { const o = new THREE.Mesh(geoB, braceMat); nuova(o, true); return o; });
      const cenere = sciame(scene, 40, () => { const o = new THREE.Mesh(geoC, cenereMat); nuova(o, true); o.position.y += 2; o.rotation.set(rnd() * 3, rnd() * 3, 0); return o; });
      const fumi = sorgenti.flatMap((s) => sciame(scene, 7, (i) => { const o = new THREE.Mesh(geoF, fumoMat.clone()); k.materiali.push(o.material); o.userData = { s, fase: i / 7 }; return o; }));
      return (dt, t) => {
        for (const o of braci) {
          const u = o.userData; o.position.y += u.v * dt; o.position.x += Math.sin(t * 1.3 + u.f) * dt * 0.15;
          o.scale.setScalar(0.6 + 0.4 * Math.sin(t * 9 + u.f * 3));
          if (o.position.y > 3.5) nuova(o, false);
        }
        for (const o of cenere) {
          const u = o.userData; o.position.y -= u.v * 0.45 * dt; o.position.x += Math.sin(t * 0.9 + u.f) * dt * 0.25; o.rotation.x += dt * 1.5;
          if (o.position.y < -3) { nuova(o, false); o.position.y = 4; }
        }
        for (const o of fumi) {
          const u = o.userData, p = (t * 0.22 + u.fase) % 1;
          o.position.set(u.s[0] + Math.sin(p * 4 + u.fase * 9) * 0.15 + p * 0.6, u.s[1] + p * 2.4, u.s[2] - p * 0.3);
          o.scale.setScalar(0.5 + p * 2.2); o.material.opacity = 0.55 * (1 - p) * Math.min(1, p * 6);
        }
      };
    },
  },
};
