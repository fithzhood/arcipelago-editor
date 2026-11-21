// Misura un livello col bordo: lo risolve (ricerca in ampiezza su tutte le partite) e dice che tipo
// di puzzle è. Non usa node: lo usano l'editor del telefono (per dire subito se un livello si
// risolve e quanto è ricco di scelte) e strumenti/analizza.mjs.
// Misure: mosse minime e soluzione; glifi usati e riuso (quante volte si ripassa sugli stessi);
// posizioni e vicoli ciechi; configurazioni delle lastre e bivi (configurazioni da cui si vince
// ancora e da cui un glifo porta ad almeno due configurazioni diverse); contro che cosa si fermano
// le lastre; urti a vuoto sulla soluzione.
import { caricaLivello, Gioco } from './logica.js';

const copia = (o) => JSON.parse(JSON.stringify(o));
const DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]], FRECCE = { '1,0': '→', '-1,0': '←', '0,1': '↓', '0,-1': '↑' };
const SEGNO_T = { '1,0': '→', '-1,0': '←', '0,1': '↓', '0,-1': '↑', '1,1': '↘', '-1,1': '↙', '1,-1': '↗', '-1,-1': '↖' };

function disegno(def, liv) {
  const colori = [...new Set(def.lastre.map((l) => l.colore))];
  const lastra = new Map(def.lastre.flatMap((l) => l.celle.map(([x, y]) => [x + ',' + y, 'ABCD'[colori.indexOf(l.colore)]])));
  const glifo = new Map(def.glifi.map((g) => [g.x + ',' + g.y, g.tipo === 'T' ? SEGNO_T[g.d.join(',')] + (g.n || '∞') : g.tipo === 'R' ? 'R' + g.giro : 'M' + g.asse]));
  const sag = new Set((def.sagoma || []).map(([x, y]) => x + ',' + y));
  const righe = [];
  for (let y = 0; y < liv.H; y++) {
    let r = '';
    for (let x = 0; x < liv.W; x++) {
      const k = x + ',' + y, c = def.mappa[y][x];
      let s = c === '.' ? ' .' : ' ' + c;
      if (lastra.has(k)) s = ' ' + lastra.get(k);
      if (sag.has(k)) s = s[1] === '.' ? ' ░' : s[1] + '░';
      if (def.coniglio[0] === x && def.coniglio[1] === y) s = ' C';
      if (def.meta && def.meta[0] === x && def.meta[1] === y) s = ' ★';
      r += (glifo.has(k) ? glifo.get(k).padStart(3) : s.padStart(3));
    }
    righe.push(r);
  }
  return righe.join('\n');
}

export function misura(def, { max = 200000 } = {}) {
  const liv = caricaLivello(def), g = new Gioco(liv);
  const chiave = (st) => st.personaggi[0].x + ',' + st.personaggi[0].y + '|' + config(st);
  const config = (st) => st.lastre.flatMap((l) => l.celle.map((c) => c.id + ':' + c.x + ',' + c.y)).sort().join(';');
  const nodi = [{ st: copia(liv.iniziale), da: -1, ev: null, mossa: '', figli: [] }], indice = new Map([[chiave(liv.iniziale), 0]]), arrivi = [];
  for (let i = 0; i < nodi.length && nodi.length < max; i++) {
    const n = nodi[i];
    if (n.vinto) continue;
    for (const d of DIR) {
      g.stato = copia(n.st); g.storia = [];
      const ev = g.muovi(...d);
      if (!ev.length || ev[0].tipo === 'urto' || g.stato.caduto) continue;
      const k = chiave(g.stato);
      let j = indice.get(k);
      if (j === undefined) {
        j = nodi.length; indice.set(k, j);
        nodi.push({ st: g.stato, da: i, ev, mossa: FRECCE[d.join(',')], figli: [], vinto: !!g.stato.vinto });
        if (g.stato.vinto) arrivi.push(j);
      }
      n.figli.push(j);
    }
  }
  if (!arrivi.length) return { irrisolvibile: true, disegno: disegno(def, liv) };
  const via = []; for (let j = arrivi[0]; nodi[j].da >= 0; j = nodi[j].da) via.unshift(j);
  const padri = nodi.map(() => []); nodi.forEach((n, i) => n.figli.forEach((f) => padri[f].push(i)));
  const buone = new Set(arrivi), coda = [...arrivi];
  while (coda.length) for (const q of padri[coda.pop()]) if (!buone.has(q)) { buone.add(q); coda.push(q); }
  const cfg = nodi.map((n) => config(n.st)), dopo = new Map(), cfgBuone = new Set();
  nodi.forEach((n, i) => { if (buone.has(i)) cfgBuone.add(cfg[i]); for (const f of n.figli) if (cfg[f] !== cfg[i]) { if (!dopo.has(cfg[i])) dopo.set(cfg[i], new Set()); dopo.get(cfg[i]).add(cfg[f]); } });
  let bivi = 0; for (const [c, q] of dopo) if (cfgBuone.has(c) && q.size >= 2) bivi++;
  // la soluzione, passo per passo: glifi usati, fermate, lastre mosse, passi a piedi fra un glifo e l'altro
  const usi = new Map(), fermate = { bordo: 0, pilastro: 0, isola: 0, lastra: 0, 'n passi': 0 }, mosse = new Set(), aPiedi = [];
  let piedi = 0, urti = 0;
  for (const j of via) {
    const ev = nodi[j].ev, gl = ev.find((e) => e.tipo === 'glifo'), tr = ev.find((e) => e.tipo === 'trasla');
    if (!gl) { piedi++; continue; }
    if (ev.some((e) => e.tipo.endsWith('-urto'))) urti++; // un glifo che sulla strada buona non fa niente
    aPiedi.push(piedi); piedi = 0;
    const k = gl.x + ',' + gl.y; usi.set(k, (usi.get(k) || 0) + 1);
    if (tr) {
      mosse.add(tr.lastra);
      const prima = nodi[nodi[j].da].st, l = prima.lastre.find((q) => q.id === tr.lastra), G = liv.glifi.get(k);
      if (G.n) { fermate['n passi']++; continue; }
      // fino in fondo: che cosa c'è oltre la posizione d'arrivo
      const fin = nodi[j].st.lastre.find((q) => q.id === tr.lastra) || l;
      const oltre = fin.celle.map((c) => [c.x + tr.d[0], c.y + tr.d[1]]);
      const cosa = oltre.map(([x, y]) => (x < 0 || y < 0 || x >= liv.W || y >= liv.H ? 'bordo'
        : def.mappa[y][x] === 'p' || def.mappa[y][x] === 'o' ? 'pilastro' : '#tb'.includes(def.mappa[y][x]) ? 'isola'
        : nodi[j].st.lastre.some((q) => q.id !== tr.lastra && q.celle.some((c) => c.x === x && c.y === y)) ? 'lastra' : null)).filter(Boolean);
      fermate[cosa[0] || 'bordo']++;
    }
  }
  return {
    disegno: disegno(def, liv), mosse: via.length, soluzione: via.map((j) => nodi[j].mossa).join(''),
    glifiUsati: [...usi.values()].reduce((a, b) => a + b, 0), glifiDiversi: usi.size, glifiTotali: liv.glifi.size,
    usatiPiuVolte: [...usi.values()].filter((v) => v > 1).length, lastreTotali: liv.iniziale.lastre.length, lastreMosse: mosse.size,
    posizioni: nodi.length, vicoli: Math.round(((nodi.length - buone.size) / nodi.length) * 100),
    configurazioni: new Set(cfg).size, bivi, fermate, aPiediFraGlifi: aPiedi.slice(1), urtiSullaSoluzione: urti,
    riuso: +([...usi.values()].reduce((a, b) => a + b, 0) / Math.max(1, usi.size)).toFixed(1),
  };
}


// ---- l'overworld (e qualunque mappa coi tratti): a quali tratti si arriva, e i sigilli

/** `risolti`: i sottolivelli da considerare risolti (predefinito: tutti). */
export function esplora(liv, { max = 400000, risolti = null } = {}) {
  const g = new Gioco(liv, { risolti: risolti ?? [...liv.sigilli.values()].map((s) => s.livello) }), mosse = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const due = liv.iniziale.personaggi.length > 1;
  const chiave = (st) => st.attivo + '|' + st.personaggi.map((p) => p.x + ',' + p.y).join(';') + '|' +
    st.lastre.flatMap((l) => l.celle.map((c) => (l.colore || '') + c.x + ',' + c.y)).sort().join(';');
  const visti = new Map([[chiave(liv.iniziale), null]]), coda = [{ st: copia(liv.iniziale), via: '' }];
  const arrivi = new Map(), giriInfiniti = new Set();
  for (const p of liv.iniziale.personaggi) if (p.tratto) arrivi.set(p.tratto, '');
  let i = 0;
  while (i < coda.length && visti.size < max) {
    const { st, via } = coda[i++];
    for (const m of due ? [...mosse, 'cambia'] : mosse) {
      g.stato = copia(st); g.storia = [];
      const ev = m === 'cambia' ? g.cambia() : g.muovi(...m);
      if (!ev.length || ev[0].tipo === 'urto' || ev[0].tipo === 'entra' || g.stato.caduto) continue;
      for (const e of ev) if (e.tipo === 'trasla' && liv.toroide && e.passi >= (e.d[0] ? liv.W : liv.H) - 1) giriInfiniti.add(`lastra ${e.lastra} verso ${e.d}`);
      const k = chiave(g.stato);
      if (visti.has(k)) continue;
      visti.set(k, null);
      const passo = via + (m === 'cambia' ? '⇄' : FRECCE[m.join(',')]);
      for (const p of g.stato.personaggi) { const t = liv.trattoDi(p.x, p.y); if (t && !arrivi.has(t)) arrivi.set(t, passo); }
      if (g.stato.vinto) { if (!arrivi.has('meta')) arrivi.set('meta', passo); continue; } // arrivati: da qui non si va avanti
      coda.push({ st: g.stato, via: passo });
    }
  }
  const attesi = [...new Set(liv.tratti.map((t) => t.nome))];
  if (!liv.mondo && (liv.meta || liv.sagoma)) attesi.push('meta');
  return { stati: visti.size, completa: i >= coda.length, arrivi, giriInfiniti, mancanti: attesi.filter((n) => !arrivi.has(n)) };
}

/**
 * Per ogni sigillo: che cosa resta irraggiungibile se solo quello resta chiuso. Un obbligatorio deve
 * lasciare fuori qualcosa; un facoltativo niente.
 */
export function provaSigilli(liv) {
  const tutti = [...liv.sigilli.values()];
  return tutti.map((s) => {
    const r = esplora(liv, { risolti: tutti.filter((q) => q !== s).map((q) => q.livello) });
    return { sigillo: s, fuori: r.mancanti };
  });
}

