// Gli animali in plastilina. Tutti guardano verso +Z (come il coniglio), stanno su y = 0 e sono
// alla scala della griglia (una casella = 1). Le misure dichiarate servono a confrontarli:
//   coniglio  alto 0,85 con le orecchie, lungo 0,55
//   volpe     alta 0,62 alle orecchie, lunga 0,65 + coda 0,45
//   gatto     alto 0,60 alle orecchie, lungo 0,55 + coda alzata
// Volpe e gatto portano lo stesso medaglione color glifo sul petto: vengono dall'epoca dei maghi.
// userData: coda (gruppo da far ondeggiare), zampe ([gruppi] con il perno all'anca, per camminare),
// salto (quanto saltella mentre cammina: il coniglio 1, un quadrupede meno).
//
// Cose imparate guardandoli da vicino (20/11/2026):
// - niente coni: in plastilina la punta di un cono si apre in righe a raggiera. Orecchie e musi
//   sono profili torniti (LatheGeometry) o sfere allungate, con la punta arrotondata;
// - niente pezzi che attraversano il corpo e spuntano di lato (le strisce a bastoncino, il collare
//   ad anello): ciò che sta sul corpo ne segue la superficie; e i disegni del manto (le strisce del
//   gatto) si dipingono nella trama, perché anche un arco appoggiato sopra sporge;
// - sugli animali le impronte di polpastrello vanno più piccole e più lievi che sul paesaggio,
//   se no su un fianco grande quanto un pollice sembrano bersagli.
import * as THREE from 'three';

const NERO = '#1e1a22', MEDAGLIONE = '#46c2c8';

/** Plastilina per gli animali: impronte più fitte e più lievi. */
const pelle = (K, c) => K.A(c, { bump: 0.22, scala: 3.4 });

/** Sfera allungata: la forma base di quasi tutto. */
function ovo(K, r, col, [x, y, z], [sx, sy, sz] = [1, 1, 1], bit = 0.02, seme = 0) {
  const m = K.mesh(K.bitorzola(K.palla(r, 22), bit, 7, seme), pelle(K, col), x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

/** Profilo tornito con la punta arrotondata, schiacciato davanti-dietro: un orecchio. */
function orecchio(K, col, interno, h, w, seme) {
  const g = new THREE.Group();
  const p = (k) => [[0, 0], [w * k, 0], [w * 0.95 * k, h * 0.3], [w * 0.62 * k, h * 0.68], [w * 0.25 * k, h * 0.93], [0, h]].map(([x, y]) => new THREE.Vector2(x, y));
  const fuori = K.mesh(K.bitorzola(new THREE.LatheGeometry(p(1), 16), 0.006, 12, seme), pelle(K, col)); fuori.scale.z = 0.42; g.add(fuori);
  const dentro = K.mesh(new THREE.LatheGeometry(p(0.55).map((v) => new THREE.Vector2(v.x, v.y * 0.85)), 12), pelle(K, interno), 0, h * 0.06, w * 0.16);
  dentro.scale.z = 0.3; g.add(dentro);
  return g;
}

/**
 * Gamba in due pezzi, perché un quadrupede non calcia come un compasso: coscia col perno all'anca,
 * stinco e zampa col perno al ginocchio. Restituisce l'anca; il ginocchio sta in userData.
 */
function gamba(K, x, z, manto, zampa, seme) {
  const anca = new THREE.Group(); anca.position.set(x, 0.2, z);
  anca.add(K.mesh(K.bitorzola(new THREE.CapsuleGeometry(0.048, 0.06, 4, 12), 0.006, 9, seme), pelle(K, manto), 0, -0.045, 0));
  const ginocchio = new THREE.Group(); ginocchio.position.y = -0.1; anca.add(ginocchio);
  ginocchio.add(K.mesh(K.bitorzola(new THREE.CapsuleGeometry(0.041, 0.05, 4, 12), 0.005, 9, seme + 2), pelle(K, manto), 0, -0.03, 0));
  ginocchio.add(ovo(K, 0.05, zampa, [0, -0.066, 0.012], [1, 0.68, 1.25], 0.008, seme + 1));
  anca.userData.ginocchio = ginocchio;
  return anca;
}

/** Medaglione sul petto: un dischetto color glifo con una perla chiara, appoggiato e inclinato verso l'alto. */
function medaglione(K, y, z) {
  const g = new THREE.Group(); g.position.set(0, y, z); g.rotation.x = 1.15;
  g.add(K.mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.016, 20), pelle(K, MEDAGLIONE)));
  g.add(K.mesh(K.palla(0.017, 12), pelle(K, '#d8fbfc'), 0, 0.012, 0));
  return g;
}

export function coniglio(K) {
  const g = new THREE.Group(), bianco = '#f6f0e8', rosa = '#f2a3ae';
  const corpo = K.mesh(K.bitorzola(K.palla(0.23), 0.04, 6), bianco, 0, 0.22, 0); corpo.scale.set(1, 0.92, 1.12); g.add(corpo);
  g.add(K.mesh(K.bitorzola(K.palla(0.17), 0.03, 7), bianco, 0, 0.45, 0.15));
  for (const s of [-1, 1]) {
    const o = new THREE.Group(); o.position.set(0.07 * s, 0.57, 0.1); o.rotation.set(-0.25, 0, 0.16 * s);
    o.add(K.mesh(K.bitorzola(new THREE.CapsuleGeometry(0.052, 0.24, 6, 12), 0.025, 8, s), bianco, 0, 0.16, 0));
    const dentro = K.mesh(new THREE.CapsuleGeometry(0.025, 0.17, 4, 8), rosa, 0, 0.16, 0.035); dentro.scale.z = 0.5; o.add(dentro);
    g.add(o);
    g.add(K.mesh(K.palla(0.032, 12), NERO, 0.075 * s, 0.48, 0.3));
  }
  g.add(K.mesh(K.palla(0.028, 10), rosa, 0, 0.43, 0.32));
  g.add(K.mesh(K.bitorzola(K.palla(0.085, 14), 0.03, 9), '#ffffff', 0, 0.24, -0.26));
  g.userData.salto = 1;
  return g;
}

/** Volpe: muso lungo, orecchie grandi nere in punta, calzini neri, coda folta a pennacchio con la punta bianca. */
export function volpe(K) {
  const g = new THREE.Group(), arancio = '#e2763a', crema = '#fbefe0', scuro = '#3a2a2c';
  g.add(ovo(K, 0.2, arancio, [0, 0.29, -0.03], [0.82, 0.78, 1.4], 0.03, 1));
  g.add(ovo(K, 0.12, crema, [0, 0.27, 0.15], [0.82, 1, 0.75], 0.015, 2));
  const zampe = [[0.08, 0.15, 3], [-0.08, 0.15, 4], [0.085, -0.2, 5], [-0.085, -0.2, 6]].map(([x, z, s]) => gamba(K, x, z, arancio, scuro, s));
  zampe.forEach((z) => g.add(z));
  g.add(medaglione(K, 0.31, 0.235));
  // testa
  const testa = new THREE.Group(); testa.position.set(0, 0.46, 0.25); g.add(testa);
  testa.add(ovo(K, 0.14, arancio, [0, 0, 0], [1.08, 0.9, 1], 0.02, 7));
  testa.add(ovo(K, 0.075, arancio, [0, -0.035, 0.13], [0.72, 0.62, 1.55], 0.008, 8));         // muso
  testa.add(ovo(K, 0.06, crema, [0, -0.068, 0.11], [0.75, 0.42, 1.35], 0.006, 9));           // sotto il muso
  for (const s of [-1, 1]) testa.add(ovo(K, 0.065, crema, [0.072 * s, -0.05, 0.05], [0.8, 0.62, 0.9], 0.006, 10 + s)); // guance, dentro la testa
  testa.add(K.mesh(K.palla(0.027, 12), NERO, 0, -0.03, 0.245));
  for (const s of [-1, 1]) {
    const occhio = K.mesh(K.palla(0.024, 10), NERO, 0.062 * s, 0.028, 0.11); occhio.scale.set(1.35, 0.8, 0.6); testa.add(occhio);
    const o = orecchio(K, arancio, crema, 0.17, 0.065, 12 + s); o.position.set(0.078 * s, 0.075, -0.02); o.rotation.set(-0.12, 0, -0.3 * s); testa.add(o);
    const punta = ovo(K, 0.03, scuro, [0, 0.142, 0], [0.75, 1.1, 0.42], 0.004, 14 + s); o.add(punta);
  }
  // coda a pennacchio: un profilo tornito che si gonfia e poi si chiude, con la punta bianca
  const coda = new THREE.Group(); coda.position.set(0, 0.32, -0.28); g.add(coda);
  const prof = (pts) => pts.map(([r, y]) => new THREE.Vector2(r, y));
  const pennacchio = K.mesh(K.bitorzola(new THREE.LatheGeometry(prof([[0, 0], [0.05, 0.02], [0.095, 0.1], [0.115, 0.2], [0.105, 0.29], [0.08, 0.34], [0, 0.36]]), 18), 0.015, 6, 16), pelle(K, arancio));
  const punta = K.mesh(K.bitorzola(new THREE.LatheGeometry(prof([[0, 0.27], [0.09, 0.29], [0.085, 0.37], [0.05, 0.43], [0, 0.45]]), 18), 0.01, 7, 17), pelle(K, crema));
  for (const m of [pennacchio, punta]) { m.rotation.x = -Math.PI / 2 + 0.45; m.scale.x = 0.9; coda.add(m); }
  Object.assign(g.userData, { coda, zampe, testa, salto: 0 });
  return g;
}

/** Gatto: testa tonda e larga, occhi d'oro, orecchie corte, schiena tigrata, coda lunga alzata a punto di domanda. */
export function gatto(K) {
  const g = new THREE.Group(), manto = '#59627c', chiaro = '#d3d8e4', strisce = '#3c4459', rosa = '#e89aa8';
  // il corpo ha il manto dipinto: le strisce stanno nella pelle e non sporgono
  const geo = K.bitorzola(K.palla(0.19, 28).rotateX(Math.PI / 2), 0.03, 7, 11);
  const corpo = K.mesh(geo, K.argilla('#ffffff', { map: mantoTigrato(manto, strisce, chiaro), bump: 0.22, scala: 3.4 }), 0, 0.27, -0.03);
  corpo.scale.set(0.85, 0.85, 1.35); g.add(corpo);
  g.add(ovo(K, 0.115, chiaro, [0, 0.26, 0.14], [0.85, 1, 0.75], 0.015, 12));
  const zampe = [[0.075, 0.13, 13], [-0.075, 0.13, 14], [0.08, -0.19, 15], [-0.08, -0.19, 16]].map(([x, z, s]) => gamba(K, x, z, manto, chiaro, s));
  zampe.forEach((z) => g.add(z));
  g.add(medaglione(K, 0.29, 0.215));
  const testa = new THREE.Group(); testa.position.set(0, 0.45, 0.23); g.add(testa);
  testa.add(ovo(K, 0.15, manto, [0, 0, 0], [1.15, 0.92, 0.95], 0.02, 17));
  for (const s of [-1, 1]) {
    testa.add(ovo(K, 0.05, chiaro, [0.035 * s, -0.048, 0.115], [1, 0.85, 0.8], 0.006, 18 + s));
    const occhio = K.mesh(K.palla(0.036, 14), '#f2c84a', 0.064 * s, 0.022, 0.115); occhio.scale.z = 0.55; testa.add(occhio);
    const pupilla = K.mesh(K.palla(0.03, 10), NERO, 0.064 * s, 0.022, 0.132); pupilla.scale.set(0.28, 1, 0.4); testa.add(pupilla);
    const o = orecchio(K, manto, rosa, 0.12, 0.07, 20 + s); o.position.set(0.095 * s, 0.085, -0.015); o.rotation.set(-0.08, 0, -0.42 * s); testa.add(o);
    for (const k of [-1, 1]) {
      const b = K.mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.12, 5), '#eef0f6', 0.095 * s, -0.045 + k * 0.012, 0.12);
      b.rotation.set(0, -0.35 * s, Math.PI / 2 + k * 0.12 * s); testa.add(b);
    }
  }
  testa.add(K.mesh(K.palla(0.021, 10), pelle(K, rosa), 0, -0.022, 0.15));
  const coda = new THREE.Group(); coda.position.set(0, 0.28, -0.24); g.add(coda);
  const curva = new THREE.CatmullRomCurve3([[0, 0, 0], [0, 0.03, -0.12], [0, 0.18, -0.2], [0, 0.33, -0.16], [0.02, 0.38, -0.06]].map((p) => new THREE.Vector3(...p)));
  coda.add(K.mesh(K.bitorzola(new THREE.TubeGeometry(curva, 28, 0.032, 10), 0.006, 12, 22), pelle(K, manto)));
  coda.add(ovo(K, 0.034, strisce, [0.02, 0.38, -0.06], [1, 1, 1], 0.004, 23));
  Object.assign(g.userData, { coda, zampe, testa, salto: 0 });
  return g;
}

/**
 * Il manto tigrato come trama della sfera del corpo. La sfera è girata con i poli sull'asse della
 * lunghezza (z): così ogni riga orizzontale della trama è un anello attorno al corpo, e la colonna
 * u = 0,75 è la schiena. Le strisce vanno da un fianco all'altro passando sulla schiena, più spesse
 * in alto e sfumate verso la pancia, che è più chiara.
 */
function mantoTigrato(manto, strisce, chiaro) {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = manto; g.fillRect(0, 0, W, H);
  // pancia chiara (u = 0,25), sfumata
  const pancia = g.createLinearGradient(0, 0, W, 0);
  pancia.addColorStop(0.05, manto + '00'); pancia.addColorStop(0.25, chiaro + 'cc'); pancia.addColorStop(0.45, manto + '00');
  g.fillStyle = pancia; g.fillRect(0, 0, W, H);
  g.filter = 'blur(1.6px)'; g.fillStyle = strisce;
  // v = 0 è la testa (in basso nella tela), v = 1 la coda
  [0.36, 0.48, 0.6, 0.72].forEach((v, k) => {
    const y0 = (1 - v) * H, su = [], giu = [];
    for (let i = 0; i <= 40; i++) {
      const u = 0.5 + (i / 40) * 0.5, t = 9 * Math.pow(Math.sin(Math.PI * (u - 0.5) / 0.5), 0.7), onda = Math.sin(u * 28 + k * 2) * 2.5;
      su.push([u * W, y0 - t / 2 + onda]); giu.push([u * W, y0 + t / 2 + onda]);
    }
    g.beginPath(); [...su, ...giu.reverse()].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/**
 * Andatura dei quadrupedi: trotto, cioè zampe a coppie diagonali (anteriore destra con posteriore
 * sinistra). La fase viene dalle caselle percorse, quindi tenendo premuto il passo continua senza
 * ripartire. Mentre una zampa va avanti il ginocchio si piega e la zampa si alza; il corpo sale e
 * scende due volte per falcata e beccheggia appena, la testa compensa, la coda segue il ritmo.
 * Le curve sono morbide: la direzione vista insegue quella vera invece di scattare.
 * Fermandosi tutto torna a riposo dolcemente (amp va a zero).
 */
export function animaZampe(o, c, inMoto, t) {
  const u = o.userData;
  const dt = Math.min(0.05, Math.max(0, t - (u.tPrec ?? t))); u.tPrec = t;
  if (!u.zampe) return;
  u.amp = (u.amp ?? 0) + ((inMoto ? 1 : 0) - (u.amp ?? 0)) * Math.min(1, dt * (inMoto ? 14 : 6));
  const a = u.amp, th = c.cammino * Math.PI; // mezza falcata per casella
  u.zampe.forEach((anca, i) => {
    const davanti = i < 2, ph = th + (i === 0 || i === 3 ? 0 : Math.PI);
    const avanza = Math.cos(ph); // > 0 mentre la zampa va avanti (in aria)
    anca.rotation.x = -Math.sin(ph) * 0.42 * a;
    anca.userData.ginocchio.rotation.x = (davanti ? 1 : -0.7) * Math.max(0, avanza) * 0.9 * a;
    anca.position.y = 0.2 + Math.max(0, avanza) * 0.025 * a;
  });
  const bob = (1 - Math.cos(2 * th)) / 2;
  o.position.y += bob * 0.022 * a;
  o.rotation.x = Math.sin(2 * th) * 0.035 * a;
  if (u.testa) {
    u.testa.rotation.x = -Math.sin(2 * th) * 0.05 * a;
    u.testa.rotation.y = Math.sin(t * 0.7) * 0.18 * (1 - a); // da fermo si guarda un po' intorno
  }
  if (u.coda) {
    u.coda.rotation.y = Math.sin(th) * 0.3 * a + Math.sin(t * 2.2) * 0.22 * (1 - a);
    u.coda.rotation.z = Math.sin(th + 0.6) * 0.08 * a;
  }
  // curve morbide: la direzione vista insegue quella del gioco
  const verso = o.rotation.y;
  if (u.yaw === undefined) u.yaw = verso;
  let d = verso - u.yaw; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  u.yaw += d * Math.min(1, dt * 16);
  o.rotation.y = u.yaw;
}
