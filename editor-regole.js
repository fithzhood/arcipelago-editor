// Le regole dell'editor dei livelli, senza interfaccia: le usano l'editor del PC (editor.js) e
// quello del telefono (editor-telefono.js), così le due dipingono esattamente allo stesso modo.
// Una mappa è il JSON di Tiled (strati di tessere `terreno`, `lastre`, `glifi`, `segni`; strati di
// oggetti `tratti` e `sigilli`; proprietà della mappa).
import { CATALOGO, LATO } from './livelli/catalogo.js';

export const STRATI = ['terreno', 'lastre', 'glifi', 'segni'];
export const UNICI = new Set(['coniglio', 'gatto', 'casa', 'arco', 'meta']); // segni che stanno in un posto solo
export const gidDi = (pred) => CATALOGO.findIndex(pred) + 1;
export const nomeSegno = (gid) => CATALOGO[gid - 1]?.segno;
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
export const ISOLA = () => gidDi((t) => t.c === '#');

export const strato = (m, nome) => m.layers.find((l) => l.type === 'tilelayer' && l.name === nome).data;
export function gruppo(m, nome) {
  let g = m.layers.find((l) => l.type === 'objectgroup' && l.name === nome);
  if (!g) { g = { id: m.nextlayerid++, name: nome, type: 'objectgroup', draworder: 'topdown', objects: [], opacity: 1, visible: true, x: 0, y: 0 }; m.layers.push(g); }
  return g.objects;
}
/** Gli oggetti di uno strato senza crearlo se manca (per guardare: guardare non deve cambiare la mappa). */
export const oggetti = (m, nome) => m.layers.find((l) => l.type === 'objectgroup' && l.name === nome)?.objects || [];
export const prop = (m, nome) => m.properties?.find((p) => p.name === nome)?.value;
export function mettiProp(m, nome, value) {
  m.properties ??= [];
  const type = typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'int' : 'string';
  const p = m.properties.find((q) => q.name === nome);
  if (value === undefined) m.properties = m.properties.filter((q) => q.name !== nome);
  else if (p) Object.assign(p, { value, type }); else m.properties.push({ name: nome, type, value });
}
/** Mette gli strati che mancano (una mappa scritta a mano in Tiled può non averli tutti). */
export function completa(m) {
  for (const s of STRATI) if (!m.layers.some((l) => l.name === s)) {
    m.layers.push({ id: m.nextlayerid++, name: s, type: 'tilelayer', width: m.width, height: m.height, x: 0, y: 0, opacity: 1, visible: true, data: Array(m.width * m.height).fill(0) });
  }
  return m;
}
export const sigilloIn = (m, x, y) => oggetti(m, 'sigilli').find((o) => Math.floor(o.x / LATO) === x && Math.floor(o.y / LATO) === y);
export function togliSigillo(m, o) { const g = gruppo(m, 'sigilli'); g.splice(g.indexOf(o), 1); }

/**
 * Uno strumento su una casella. `T`: { tipo: 'tessera', strato, gid } (gid 0 = la croce, cancella
 * quel tipo), { tipo: 'gomma' }, { tipo: 'togli-lastra' }, { tipo: 'sigillo' }.
 * Restituisce { avviso?, scelto? (il sigillo toccato o creato), tolto? (il sigillo tolto) }.
 */
export function applica(m, T, x, y) {
  const W = m.width, H = m.height, i = y * W + x, S = (n) => strato(m, n), mondo = !!prop(m, 'toroide');
  if (T.tipo === 'gomma') {
    for (const s of ['segni', 'glifi', 'lastre']) if (S(s)[i]) { S(s)[i] = 0; return {}; }
    const sig = sigilloIn(m, x, y);
    if (sig) { togliSigillo(m, sig); return { tolto: sig }; }
    S('terreno')[i] = 0;
    return {};
  }
  if (T.tipo === 'togli-lastra') {
    // tutta la lastra: le caselle dello stesso colore che si toccano per un lato (nel gioco sono una
    // lastra sola, per la regola della fusione); i glifi restano dove sono
    const d = S('lastre'), g = d[i];
    if (!g) return {};
    const coda = [[x, y]]; d[i] = 0;
    while (coda.length) {
      const [cx, cy] = coda.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let nx = cx + dx, ny = cy + dy;
        if (mondo) { nx = (nx + W) % W; ny = (ny + H) % H; } // il mondo si richiude
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (d[ny * W + nx] === g) { d[ny * W + nx] = 0; coda.push([nx, ny]); }
      }
    }
    return {};
  }
  if (T.tipo === 'sigillo') {
    const sig = sigilloIn(m, x, y);
    if (sig) return { scelto: sig };
    if (S('terreno')[i] !== ISOLA()) return { avviso: "Un sigillo va su una casella d'isola libera (niente alberi o cespugli)." };
    const zona = prop(m, 'zona') || 'iniziale', nomi = new Set(gruppo(m, 'sigilli').map((o) => o.name));
    let n = 1; while (nomi.has(`${zona}-${n}`)) n++;
    const o = { id: m.nextobjectid++, name: `${zona}-${n}`, x: x * LATO, y: y * LATO, width: LATO, height: LATO, rotation: 0, type: '', visible: true, opacity: 1,
      properties: [{ name: 'facoltativo', type: 'bool', value: false }] };
    gruppo(m, 'sigilli').push(o);
    return { scelto: o };
  }
  const s = T.strato;
  if (s === 'terreno') {
    S('terreno')[i] = T.gid; if (T.gid) S('lastre')[i] = 0;
    if (T.gid && T.gid !== ISOLA()) { const sig = sigilloIn(m, x, y); if (sig) { togliSigillo(m, sig); return { tolto: sig }; } }
  } else if (s === 'lastre') { if (T.gid && S('terreno')[i]) return { avviso: 'Le lastre stanno solo sul cielo.' }; S('lastre')[i] = T.gid; }
  else if (s === 'glifi') S('glifi')[i] = T.gid;
  else if (s === 'segni') {
    if (T.gid && UNICI.has(nomeSegno(T.gid))) { const d = S('segni'); for (let j = 0; j < d.length; j++) if (d[j] === T.gid) d[j] = 0; }
    S('segni')[i] = T.gid;
  }
  return {};
}

/** Una mappa di Tiled in JSON, vuota (solo cielo), con i quattro strati di tessere. */
export function mappaVuota(W, H, proprieta = {}) {
  const strato = (id, name) => ({ id, name, type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: Array(W * H).fill(0) });
  return {
    type: 'map', version: '1.10', tiledversion: '1.12.2', orientation: 'orthogonal', renderorder: 'right-down', infinite: false, compressionlevel: -1,
    width: W, height: H, tilewidth: LATO, tileheight: LATO, nextlayerid: 7, nextobjectid: 1,
    tilesets: [{ firstgid: 1, source: 'arcipelago.tsx' }],
    layers: [strato(1, 'terreno'), strato(2, 'lastre'), strato(3, 'glifi'), strato(4, 'segni'),
      { id: 5, name: 'tratti', type: 'objectgroup', draworder: 'topdown', objects: [], opacity: 1, visible: true, x: 0, y: 0 },
      { id: 6, name: 'sigilli', type: 'objectgroup', draworder: 'topdown', objects: [], opacity: 1, visible: true, x: 0, y: 0 }],
    properties: Object.entries(proprieta).map(([name, value]) => ({ name, type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'int' : 'string', value })),
  };
}

/** Il sottolivello vuoto che nasce con un sigillo nuovo: due isole, il coniglio a sinistra e la meta a destra. */
export function sottolivelloVuoto(zona, titolo, W = 11, H = 7) {
  const m = mappaVuota(W, H, { titolo, zona, tipo: 'meta', amano: true });
  const L = (n) => m.layers.find((l) => l.name === n).data, isola = ISOLA(), cy = Math.floor(H / 2);
  // un'isola di tre colonne per lato, con una riga di cielo sopra e sotto
  for (let y = 1; y <= H - 2; y++) for (const x of [0, 1, 2, W - 3, W - 2, W - 1]) L('terreno')[y * W + x] = isola;
  L('segni')[cy * W + 1] = gidDi((t) => t.segno === 'coniglio');
  L('segni')[cy * W + W - 2] = gidDi((t) => t.segno === 'meta');
  return m;
}

/** Il testo .tmx di una mappa JSON (lo stesso formato che scrivono gli script in strumenti/). */
export function tmxDa(m, tileset) {
  const tipo = (v) => (typeof v === 'boolean' ? ' type="bool"' : typeof v === 'number' ? ' type="int"' : '');
  const prop = (pp, rientro) => (pp?.length ? `${rientro}<properties>\n${pp.map((p) => `${rientro} <property name="${esc(p.name)}"${tipo(p.value)} value="${esc(p.value)}"/>`).join('\n')}\n${rientro}</properties>\n` : '');
  const W = m.width;
  const righe = [];
  righe.push('<?xml version="1.0" encoding="UTF-8"?>');
  righe.push(`<map version="1.10" tiledversion="1.12.2" orientation="orthogonal" renderorder="right-down" width="${m.width}" height="${m.height}" tilewidth="${LATO}" tileheight="${LATO}" infinite="0" nextlayerid="${m.nextlayerid}" nextobjectid="${m.nextobjectid}">`);
  righe.push(prop(m.properties, ' ').trimEnd());
  righe.push(` <tileset firstgid="1" source="${esc(tileset)}"/>`);
  for (const l of m.layers) {
    if (l.type === 'tilelayer') {
      const csv = [];
      for (let y = 0; y < m.height; y++) csv.push(l.data.slice(y * W, y * W + W).join(','));
      righe.push(` <layer id="${l.id}" name="${esc(l.name)}" width="${m.width}" height="${m.height}">\n  <data encoding="csv">\n${csv.join(',\n')}\n</data>\n </layer>`);
    } else if (l.type === 'objectgroup') {
      const oo = l.objects.map((o) => {
        const pp = prop(o.properties, '   ');
        return `  <object id="${o.id}" name="${esc(o.name)}" x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}"${pp ? '>\n' + pp + '  </object>' : '/>'}`;
      });
      righe.push(` <objectgroup id="${l.id}" name="${esc(l.name)}">${oo.length ? '\n' + oo.join('\n') + '\n ' : ''}</objectgroup>`);
    }
  }
  righe.push('</map>', '');
  return righe.filter((r) => r !== '').join('\n') + '\n';
}

