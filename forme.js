// Aiuti comuni a tutti gli stili: caso deterministico, contorno delle isole, vicini.

export function casuale(seme) {
  let s = seme >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const K = (x, y) => x + ',' + y;
export const eIsola = (liv, x, y) => { const c = liv.celle[y * liv.W + x]; return !!c && x >= 0 && x < liv.W && y >= 0 && y < liv.H && '#bt'.includes(c.c); };

/**
 * Il contorno di ogni isola come poligono chiuso (angoli delle caselle, in coordinate di griglia:
 * la casella x,y occupa [x-0.5, x+0.5] × [y-0.5, y+0.5]). Senso orario visto dall'alto.
 */
export function contorniIsole(liv) {
  const lati = new Map(); // inizio -> fine
  for (const { x, y } of liv.celle) {
    if (!eIsola(liv, x, y)) continue;
    const a = x - 0.5, b = x + 0.5, c = y - 0.5, d = y + 0.5;
    if (!eIsola(liv, x, y - 1)) lati.set(K(a, c), [b, c]);
    if (!eIsola(liv, x + 1, y)) lati.set(K(b, c), [b, d]);
    if (!eIsola(liv, x, y + 1)) lati.set(K(b, d), [a, d]);
    if (!eIsola(liv, x - 1, y)) lati.set(K(a, d), [a, c]);
  }
  const poligoni = [];
  while (lati.size) {
    const [k0] = lati.keys();
    const pol = [k0.split(',').map(Number)];
    let k = k0;
    while (lati.has(k)) {
      const fine = lati.get(k); lati.delete(k);
      k = K(fine[0], fine[1]);
      if (k === k0) break;
      pol.push(fine);
    }
    // via i punti in mezzo ai lati dritti
    const pulito = pol.filter((p, i) => {
      const a = pol[(i - 1 + pol.length) % pol.length], b = pol[(i + 1) % pol.length];
      return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
    });
    poligoni.push(pulito);
  }
  return poligoni;
}

/**
 * Il contorno di un insieme di caselle (per esempio una lastra) come forme con i loro buchi:
 * [{ esterno: [[x, z], ...], buchi: [[[x, z], ...], ...] }]. Una ciambella ha un buco.
 */
export function contornoCelle(celle) {
  const piene = new Set(celle.map(([x, z]) => K(x, z)));
  const c = (x, z) => piene.has(K(x, z));
  const lati = new Map();
  const aggiungi = (a, b) => { const k = K(a[0], a[1]); if (!lati.has(k)) lati.set(k, []); lati.get(k).push(b); };
  for (const [x, z] of celle) {
    const a = x - 0.5, b = x + 0.5, s = z - 0.5, d = z + 0.5;
    if (!c(x, z - 1)) aggiungi([a, s], [b, s]);
    if (!c(x + 1, z)) aggiungi([b, s], [b, d]);
    if (!c(x, z + 1)) aggiungi([b, d], [a, d]);
    if (!c(x - 1, z)) aggiungi([a, d], [a, s]);
  }
  const anelli = [];
  for (;;) {
    const k0 = [...lati.keys()].find((k) => lati.get(k).length);
    if (k0 === undefined) break;
    const anello = [k0.split(',').map(Number)];
    let k = k0;
    for (let giri = 0; giri < 10000; giri++) {
      const fine = lati.get(k).pop();
      k = K(fine[0], fine[1]);
      if (k === k0) break;
      anello.push(fine);
    }
    anelli.push(anello);
  }
  // area col segno: i contorni esterni girano in un verso, i buchi nell'altro
  const area = (p) => p.reduce((s, [x, z], i) => { const [x2, z2] = p[(i + 1) % p.length]; return s + x * z2 - x2 * z; }, 0) / 2;
  const dentro = ([px, pz], p) => {
    let ok = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, zi] = p[i], [xj, zj] = p[j];
      if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) ok = !ok;
    }
    return ok;
  };
  const forme = anelli.filter((p) => area(p) > 0).map((esterno) => ({ esterno, buchi: [] }));
  for (const buco of anelli.filter((p) => area(p) < 0)) {
    const m = [(buco[0][0] + buco[1][0]) / 2 + 0.01, (buco[0][1] + buco[1][1]) / 2 + 0.01];
    (forme.find((f) => dentro(m, f.esterno)) || forme[0])?.buchi.push(buco);
  }
  return forme;
}

/** Celle di decoro (cespugli, alberi, scogli, pilastri, fuoco) con la loro posizione. */
export function decori(liv) {
  return liv.celle.filter((c) => 'btopf'.includes(c.c));
}
