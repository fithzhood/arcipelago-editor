// Legge una mappa di Tiled esportata in JSON (tiled.exe --export-map json mappa.tmx mappa.json) e la
// trasforma nella definizione di livello che vuole caricaLivello (logica.js). Il significato delle
// tessere sta in catalogo.js.
import { CATALOGO } from './catalogo.js';

export function daTiled(m) {
  const W = m.width, H = m.height, T = m.tilewidth, fg = m.tilesets[0].firstgid;
  const strato = (n) => m.layers.find((l) => l.name === n);
  // i bit alti dicono se la tessera è capovolta: qui non contano
  const tessera = (l, x, y) => { const g = (l?.data?.[y * W + x] ?? 0) & 0x1fffffff; return g ? CATALOGO[g - fg] : null; };
  const prop = Object.fromEntries((m.properties || []).map((p) => [p.name, p.value]));
  const def = { mappa: [], lastre: [], glifi: [], posti: {}, tratti: [], toroide: !!prop.toroide, mondo: !!(prop.mondo || prop.toroide), zona: prop.zona || 'iniziale', titolo: prop.titolo || null };
  const terreno = strato('terreno'), lastre = strato('lastre'), glifi = strato('glifi'), segni = strato('segni');
  for (let y = 0; y < H; y++) {
    let riga = '';
    for (let x = 0; x < W; x++) {
      riga += tessera(terreno, x, y)?.c || '.';
      const l = tessera(lastre, x, y);
      // una lastra per casella: quelle vicine dello stesso colore si fondono al caricamento
      if (l) def.lastre.push({ colore: l.colore, celle: [[x, y]] });
      const g = tessera(glifi, x, y);
      if (g) def.glifi.push({ x, y, ...g.glifo });
      const s = tessera(segni, x, y);
      if (s?.segno === 'coniglio') def.coniglio = [x, y];
      else if (s?.segno === 'gatto') def.gatto = [x, y];
      else if (s?.segno === 'meta') def.meta = [x, y];
      else if (s?.segno === 'sagoma') (def.sagoma ??= []).push([x, y]);
      else if (s) def.posti[s.segno] = [x, y];
    }
    def.mappa.push(riga);
  }
  for (const o of strato('tratti')?.objects || []) {
    def.tratti.push({ nome: o.name || 'tratto ' + o.id, x: Math.round(o.x / T), y: Math.round(o.y / T), w: Math.round(o.width / T), h: Math.round(o.height / T) });
  }
  for (const o of strato('sigilli')?.objects || []) {
    const pr = Object.fromEntries((o.properties || []).map((p) => [p.name, p.value]));
    def.sigilli ??= [];
    def.sigilli.push({ livello: o.name, x: Math.floor(o.x / T), y: Math.floor(o.y / T), facoltativo: !!pr.facoltativo });
  }
  if (!def.coniglio) throw new Error('la mappa non ha la partenza del coniglio (strato segni)');
  return def;
}
