// L'editor dei livelli da telefono (arcipelago-editor.html). Non fa parte del gioco: è uno strumento
// di Luca per disegnare livelli e metterli nella banca condivisa col PC (banca-remota.js).
//   - Livelli: l'elenco della banca, dal più recente; "Nuovo livello" in tre misure.
//   - Editor: un dito dipinge, due dita spostano e ingrandiscono. Le schede in basso scelgono il
//     tipo (terreno, lastre, glifi, segni, altro) e ogni tavolozza comincia con la croce che
//     cancella quel tipo. Sotto la mappa: se si risolve, in quante mosse, quanti bivi.
//   - Prova: il livello nel gioco vero (prova-livello.js).
//   - Salva: nella banca col nome scritto in alto; cambiando nome si salva un livello nuovo e
//     l'altro resta. Le modifiche non salvate restano sul telefono come bozza.
//   - Collegamento col PC: un canale cifrato come quello di Spola (canale-cifrato.js), aperto da un
//     link con #k=<codice> che apre il PC. I livelli stanno sul telefono e, salvando, partono anche
//     verso il PC; quelli che manda il PC arrivano aprendo l'elenco.
import { CATALOGO, LATO, COLONNE } from './livelli/catalogo.js';
import { daTiled } from './livelli/tiled.js';
import { caricaLivello } from './logica.js';
import { STRATI, gidDi, applica, gruppo, oggetti, prop, mettiProp, completa, togliSigillo, sottolivelloVuoto } from './editor-regole.js';
import { misura, esplora, provaSigilli } from './misura.js';
import { bancaLocale, bancaCanale } from './banca-remota.js';

const VERSIONE = new URL(import.meta.url).searchParams.get('v') || 'dev';
const $ = (s) => document.querySelector(s);
const copia = (o) => JSON.parse(JSON.stringify(o));
const leggi = (k, d = null) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const scrivi = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* pieno o vietato */ } };
const nomeFile = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'livello';
const sviluppo = ['127.0.0.1', 'localhost'].includes(location.hostname);

let banca = null, elenco = [];
// il livello aperto: nome del file nella banca (null se nuovo), sha per GitHub, mappa, com'era salvato
let corrente = null;
let strumento = { tipo: 'tessera', strato: 'terreno', gid: gidDi((t) => t.c === '#') };
let scheda = 'terreno', spenti = false, storia = [], scelto = null;
const img = new Image(); img.src = 'livelli/arcipelago.png?v=' + VERSIONE;

// ---------------------------------------------------------------- schermate
function mostra(id) { for (const s of document.querySelectorAll('body > section')) s.hidden = s.id !== id; }
function avvisa(testo, ms = 3200) {
  const a = $('#avviso'); a.textContent = testo; a.hidden = !testo;
  clearTimeout(avvisa.t); if (testo && ms) avvisa.t = setTimeout(() => { a.hidden = true; }, ms);
}

// ---------------------------------------------------------------- la banca
async function scegliBanca() {
  const codice = leggi('arc-editor-codice');
  if (codice) { try { banca = await bancaCanale(codice); return; } catch (err) { avvisa(err.message); } }
  banca = sviluppo ? bancaLocale() : null;
}
/** Il link che apre il PC porta il codice nel segno #k=: si salva e si toglie dall'indirizzo. */
async function codiceDalLink() {
  const k = new URLSearchParams(location.hash.slice(1)).get('k');
  if (!k) return;
  history.replaceState(null, '', location.pathname + location.search);
  const { codiceValido } = await import('./canale-cifrato.js');
  if (!codiceValido(k)) return avvisa('Il link di collegamento non è valido.');
  scrivi('arc-editor-codice', k);
  avvisa('Collegato al PC.');
}
async function apriElenco() {
  mostra('livelli');
  const st = $('#stato-banca'), ul = $('#elenco');
  if (!banca) { st.textContent = 'Per salvare i livelli e mandarli al PC serve il collegamento.'; ul.innerHTML = ''; $('#vai-chiave').hidden = false; return; }
  $('#vai-chiave').hidden = true;
  st.textContent = 'Arrivo dei livelli dal PC in corso…';
  try { elenco = await banca.elenco(); } catch (err) { st.textContent = err.message; return; }
  elenco.sort((a, b) => b.aggiornato.localeCompare(a.aggiornato));
  const bozze = leggi('arc-editor-bozze', {});
  st.textContent = elenco.avviso || (elenco.length ? '' : 'Ancora nessun livello: comincia con Nuovo livello, o chiedi al PC di mandarti quelli del gioco.');
  ul.innerHTML = '';
  // prima le bozze dei livelli nuovi mai salvati
  for (const [k, b] of Object.entries(bozze)) if (k.startsWith('nuovo:')) ul.appendChild(voce(prop(b.mappa, 'titolo') || 'Livello senza nome', 'bozza non salvata', () => apriEditor({ nome: null, sha: null, mappa: b.mappa, salvata: null, chiaveBozza: k })));
  for (const l of elenco) {
    const quando = l.aggiornato ? new Date(l.aggiornato).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const nota = [l.mondo ? 'overworld' : '', bozze[l.nome] ? 'modifiche non salvate' : '', l.daMandare ? 'da mandare al PC' : '', quando].filter(Boolean).join(' · ');
    ul.appendChild(voce(l.titolo, nota, () => apriDallaBanca(l)));
  }
}
function voce(titolo, nota, fa) {
  const li = document.createElement('li'), b = document.createElement('button');
  b.innerHTML = `<span class="t"></span><span class="n"></span>`;
  b.querySelector('.t').textContent = titolo; b.querySelector('.n').textContent = nota;
  b.onclick = fa; li.appendChild(b); return li;
}
async function apriDallaBanca(l) {
  avvisa('Apertura in corso…', 0);
  try {
    const { mappa, sha } = await banca.leggi(l.nome);
    const bozza = leggi('arc-editor-bozze', {})[l.nome];
    avvisa('');
    apriEditor({ nome: l.nome, sha, mappa: bozza?.mappa || mappa, salvata: mappa, chiaveBozza: l.nome });
  } catch (err) { avvisa(err.message); }
}

// ---------------------------------------------------------------- l'editor
const tela = $('#mappa'), ctx = tela.getContext('2d');
let vista = { x: 0, y: 0, s: 1 }, pr = 1;
const S = (n) => corrente.mappa.layers.find((l) => l.type === 'tilelayer' && l.name === n).data;
const mondo = () => !!prop(corrente.mappa, 'toroide');

function apriEditor(c) {
  corrente = { ...c, mappa: completa(copia(c.mappa)) };
  // per un livello nuovo, com'era quando l'hai aperto (vuoto, o com'era la bozza)
  corrente.firma0 = c.salvata ? null : c.chiaveBozza ? '' : firma(corrente.mappa);
  storia = []; scelto = null;
  $('#titolo').value = prop(corrente.mappa, 'titolo') || '';
  mostra('editor');
  costruisciSchede(); misuraTela(); inquadra(); disegna(); aggiornaStato(); calcolaPresto();
}
// l'impronta di una mappa per sapere se è cambiata: strati di tessere, oggetti, proprietà (senza
// badare a uno strato di oggetti vuoto, che c'è o non c'è a seconda di chi ha scritto il file)
const firma = (m) => JSON.stringify([m.width, m.height, m.layers.filter((l) => l.type === 'tilelayer').map((l) => [l.name, l.data]),
  m.layers.filter((l) => l.type === 'objectgroup' && l.objects.length).map((l) => [l.name, l.objects.map((o) => [o.name, o.x, o.y, o.width, o.height, o.properties])]),
  (m.properties || []).filter((p) => p.name !== 'titolo').map((p) => [p.name, p.value]).sort()]);
// un livello nuovo è "da salvare" solo se ci hai disegnato o gli hai dato un nome
function sporco() {
  if (!corrente.salvata) return firma(corrente.mappa) !== corrente.firma0 || !!$('#titolo').value.trim();
  return firma(corrente.mappa) !== firma(corrente.salvata) || ($('#titolo').value.trim() !== (prop(corrente.salvata, 'titolo') || ''));
}
function aggiornaStato() {
  $('#salva').classList.toggle('sporco', sporco());
  // la bozza resta sul telefono finché non si salva
  const bozze = leggi('arc-editor-bozze', {});
  const k = corrente.chiaveBozza || (corrente.chiaveBozza = 'nuovo:' + Date.now());
  if (sporco()) { mettiProp(corrente.mappa, 'titolo', $('#titolo').value.trim() || undefined); bozze[k] = { mappa: corrente.mappa }; }
  else delete bozze[k];
  scrivi('arc-editor-bozze', bozze);
}
function ricorda() { storia.push(JSON.stringify(corrente.mappa)); if (storia.length > 150) storia.shift(); }
function annullaModifica() {
  if (!storia.length) return avvisa('Niente da annullare.');
  corrente.mappa = JSON.parse(storia.pop()); scelto = null; mostraSigillo(); disegna(); aggiornaStato(); calcolaPresto();
}

// le schede e le tavolozze
function bottoneTessera(strato, gid, titolo) {
  const b = document.createElement('button'); b.className = 'tess'; b.title = titolo;
  b.dataset.strato = strato; b.dataset.gid = gid;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#9cc4e4'; x.fillRect(0, 0, 64, 64);
  if (gid) { if (img.complete) x.drawImage(img, ((gid - 1) % COLONNE) * LATO, Math.floor((gid - 1) / COLONNE) * LATO, LATO, LATO, 0, 0, 64, 64); }
  else { x.strokeStyle = '#3a2c30'; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.moveTo(19, 19); x.lineTo(45, 45); x.moveTo(45, 19); x.lineTo(19, 45); x.stroke(); }
  b.appendChild(c);
  b.onclick = () => { strumento = { tipo: 'tessera', strato, gid }; segnaScelto(); };
  return b;
}
function bottoneAttrezzo(tipo, testo) {
  const b = document.createElement('button'); b.className = 'attr'; b.dataset.t = tipo; b.textContent = testo;
  b.onclick = () => { strumento = { tipo }; segnaScelto(); };
  return b;
}
function etichetta(t) { const s = document.createElement('span'); s.className = 'etich'; s.textContent = t; return s; }
function costruisciSchede() {
  for (const b of document.querySelectorAll('#schede button')) b.classList.toggle('scelta', b.dataset.s === scheda);
  const box = $('#tavolozza'); box.innerHTML = '';
  const metti = (...el) => el.forEach((e) => box.appendChild(e));
  if (scheda === 'glifi') {
    const sp = document.createElement('button'); sp.className = 'attr' + (spenti ? ' scelta' : ''); sp.textContent = spenti ? 'Spenti' : 'Accesi';
    sp.title = 'Glifi accesi o spenti (si accendono col talismano)';
    sp.onclick = () => { spenti = !spenti; costruisciSchede(); };
    metti(bottoneTessera('glifi', 0, 'Cancella il glifo'), sp);
    const g = (pred) => CATALOGO.findIndex((t) => t.strato === 'glifi' && !!t.glifo.fantasma === spenti && pred(t.glifo)) + 1;
    const fila = (nome, gids) => { metti(etichetta(nome)); for (const gid of gids) metti(bottoneTessera('glifi', gid, CATALOGO[gid - 1].nome)); };
    const DR = [[0, -1], [1, 0], [0, 1], [-1, 0]], OB = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
    for (const [fam, dirs] of [['dritte', DR], ['oblique', OB]]) for (const [n, nome] of [[1, '1 passo'], [2, '2 passi'], [3, '3 passi'], [0, 'in fondo']]) {
      fila(`${fam} ${nome}`, dirs.map((d) => g((q) => q.tipo === 'T' && q.n === n && q.d[0] === d[0] && q.d[1] === d[1])));
    }
    fila('gira', [90, -90, 180].map((giro) => g((q) => q.tipo === 'R' && q.giro === giro)));
    fila('specchia', ['|', '-', '\\', '/'].map((asse) => g((q) => q.tipo === 'M' && q.asse === asse)));
  } else if (scheda === 'altro') {
    metti(bottoneAttrezzo('gomma', 'Gomma'), bottoneAttrezzo('togli-lastra', 'Togli lastra'));
    if (mondo()) metti(bottoneAttrezzo('sigillo', 'Sigillo'));
  } else {
    const croce = { terreno: 'Cancella il terreno (torna cielo)', lastre: 'Cancella la lastra da questa casella', segni: 'Cancella il segno' }[scheda];
    metti(bottoneTessera(scheda, 0, croce));
    CATALOGO.forEach((t, i) => { if (t.strato === scheda) metti(bottoneTessera(scheda, i + 1, t.nome)); });
  }
  segnaScelto();
}
function segnaScelto() {
  for (const b of document.querySelectorAll('#tavolozza .tess')) b.classList.toggle('scelta', strumento.tipo === 'tessera' && b.dataset.strato === strumento.strato && +b.dataset.gid === strumento.gid);
  for (const b of document.querySelectorAll('#tavolozza .attr[data-t]')) b.classList.toggle('scelta', strumento.tipo === b.dataset.t);
}

// la vista
function misuraTela() {
  const r = tela.getBoundingClientRect(); pr = Math.min(devicePixelRatio, 2);
  tela.width = Math.max(1, Math.round(r.width * pr)); tela.height = Math.max(1, Math.round(r.height * pr));
}
function inquadra() {
  const W = corrente.mappa.width * LATO, H = corrente.mappa.height * LATO;
  // sottolivelli: tutto in vista; overworld: abbastanza grande da toccare le caselle
  const s = mondo() ? Math.max(tela.width / (16 * LATO), Math.min(tela.width / W, tela.height / H)) : Math.min(tela.width / W, tela.height / H) * 0.96;
  vista = { s, x: (tela.width - W * s) / 2, y: (tela.height - H * s) / 2 };
}
function cellaDa(cx, cy) {
  const r = tela.getBoundingClientRect();
  const x = Math.floor(((cx - r.left) * pr - vista.x) / (LATO * vista.s)), y = Math.floor(((cy - r.top) * pr - vista.y) / (LATO * vista.s));
  return x >= 0 && y >= 0 && x < corrente.mappa.width && y < corrente.mappa.height ? [x, y] : null;
}
function disegna() {
  if (!corrente) return;
  const m = corrente.mappa, W = m.width, H = m.height, c = ctx, v = vista;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#1d1b24'; c.fillRect(0, 0, tela.width, tela.height);
  c.setTransform(v.s, 0, 0, v.s, v.x, v.y);
  c.fillStyle = mondo() ? '#9cc4e4' : '#8f86c2'; c.fillRect(0, 0, W * LATO, H * LATO);
  if (img.complete) for (const s of STRATI) {
    const d = S(s);
    for (let i = 0; i < d.length; i++) {
      const g = d[i] & 0x1fffffff; if (!g) continue;
      c.drawImage(img, ((g - 1) % COLONNE) * LATO, Math.floor((g - 1) / COLONNE) * LATO, LATO, LATO, (i % W) * LATO, Math.floor(i / W) * LATO, LATO, LATO);
    }
  }
  if (LATO * v.s >= 9) {
    c.strokeStyle = 'rgba(20,16,40,0.2)'; c.lineWidth = 1 / v.s; c.beginPath();
    for (let x = 0; x <= W; x++) { c.moveTo(x * LATO, 0); c.lineTo(x * LATO, H * LATO); }
    for (let y = 0; y <= H; y++) { c.moveTo(0, y * LATO); c.lineTo(W * LATO, y * LATO); }
    c.stroke();
  }
  c.font = `${14 / v.s}px system-ui`;
  for (const o of oggetti(m, 'sigilli')) {
    const sc = o === scelto;
    c.beginPath(); c.arc(o.x + LATO / 2, o.y + LATO / 2, LATO * 0.36, 0, Math.PI * 2);
    c.fillStyle = 'rgba(169,157,139,0.95)'; c.fill(); c.lineWidth = (sc ? 6 : 3.5) / v.s * 1.3; c.strokeStyle = sc ? '#fff3a0' : '#f2c040'; c.stroke();
    c.fillStyle = '#fff6e6'; c.strokeStyle = 'rgba(30,14,60,0.9)'; c.lineWidth = 3 / v.s;
    c.strokeText(o.name, o.x, o.y - 4 / v.s); c.fillText(o.name, o.x, o.y - 4 / v.s);
  }
  c.lineWidth = 2 / v.s; c.strokeStyle = '#f2c040'; c.strokeRect(0, 0, W * LATO, H * LATO);
}

// i gesti: un dito dipinge, due dita spostano e ingrandiscono. Se il secondo dito arriva subito
// dopo il primo, la pennellata appena cominciata si annulla (era l'inizio di un pizzico).
const dita = new Map(); let pennello = null, pizzico = null;
tela.addEventListener('pointerdown', (e) => {
  tela.setPointerCapture(e.pointerId);
  dita.set(e.pointerId, [e.clientX, e.clientY]);
  if (dita.size === 1) {
    const c = cellaDa(e.clientX, e.clientY); if (!c) return;
    ricorda(); pennello = { ultima: c.join(','), caselle: 1, t: performance.now() };
    tocca(c);
    if (strumento.tipo === 'sigillo') pennello = null;
  } else if (dita.size === 2) {
    if (pennello && pennello.caselle <= 2 && performance.now() - pennello.t < 400) annullaModifica();
    pennello = null;
    const [a, b] = [...dita.values()];
    pizzico = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, v: { ...vista } };
  }
});
tela.addEventListener('pointermove', (e) => {
  if (!dita.has(e.pointerId)) return;
  dita.set(e.pointerId, [e.clientX, e.clientY]);
  if (pizzico && dita.size === 2) {
    const [a, b] = [...dita.values()], r = tela.getBoundingClientRect();
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]), cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    const s = Math.min(3, Math.max(0.04, pizzico.v.s * d / Math.max(10, pizzico.d))), k = s / pizzico.v.s;
    const px = (pizzico.cx - r.left) * pr, py = (pizzico.cy - r.top) * pr;
    vista = { s, x: px - (px - pizzico.v.x) * k + (cx - pizzico.cx) * pr, y: py - (py - pizzico.v.y) * k + (cy - pizzico.cy) * pr };
    disegna(); return;
  }
  if (!pennello) return;
  const c = cellaDa(e.clientX, e.clientY);
  if (!c || c.join(',') === pennello.ultima) return;
  const [x0, y0] = pennello.ultima.split(',').map(Number), n = Math.max(Math.abs(c[0] - x0), Math.abs(c[1] - y0));
  for (let k = 1; k <= n; k++) tocca([Math.round(x0 + ((c[0] - x0) * k) / n), Math.round(y0 + ((c[1] - y0) * k) / n)], false);
  pennello.ultima = c.join(','); pennello.caselle += n; disegna();
});
const fineDito = (e) => {
  dita.delete(e.pointerId);
  if (dita.size < 2) pizzico = null;
  if (!dita.size && pennello) { pennello = null; aggiornaStato(); calcolaPresto(); }
};
tela.addEventListener('pointerup', fineDito); tela.addEventListener('pointercancel', fineDito);
tela.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = tela.getBoundingClientRect(), px = (e.clientX - r.left) * pr, py = (e.clientY - r.top) * pr;
  const s = Math.min(3, Math.max(0.04, vista.s * (e.deltaY > 0 ? 0.88 : 1 / 0.88))), k = s / vista.s;
  vista = { s, x: px - (px - vista.x) * k, y: py - (py - vista.y) * k }; disegna();
}, { passive: false });

function tocca([x, y], ridisegna = true) {
  const r = applica(corrente.mappa, strumento, x, y);
  if (r.avviso) avvisa(r.avviso);
  if (r.tolto && scelto === r.tolto) { scelto = null; mostraSigillo(); }
  if (r.scelto) { scelto = r.scelto; mostraSigillo(); }
  if (ridisegna) { disegna(); if (strumento.tipo === 'sigillo') { aggiornaStato(); calcolaPresto(); } }
}

// il sigillo scelto (overworld)
function mostraSigillo() {
  const box = $('#sigillo'); box.hidden = !scelto; if (!scelto) return;
  $('#sig-nome').value = scelto.name;
  $('#sig-facoltativo').checked = !!scelto.properties?.find((p) => p.name === 'facoltativo')?.value;
}
$('#sig-nome').addEventListener('change', (e) => {
  const v = nomeFile(e.target.value); if (!scelto || !v) return;
  if (oggetti(corrente.mappa, 'sigilli').some((o) => o !== scelto && o.name === v)) { avvisa(`C'è già un sigillo che apre ${v}.`); e.target.value = scelto.name; return; }
  ricorda(); scelto.name = v; e.target.value = v; disegna(); aggiornaStato(); calcolaPresto();
});
$('#sig-facoltativo').addEventListener('change', (e) => {
  if (!scelto) return; ricorda();
  const p = scelto.properties?.find((q) => q.name === 'facoltativo');
  if (p) p.value = e.target.checked; else (scelto.properties ??= []).push({ name: 'facoltativo', type: 'bool', value: e.target.checked });
  aggiornaStato(); calcolaPresto();
});
$('#sig-togli').onclick = () => { if (!scelto) return; ricorda(); togliSigillo(corrente.mappa, scelto); scelto = null; mostraSigillo(); disegna(); aggiornaStato(); calcolaPresto(); };
$('#sig-chiudi').onclick = () => { scelto = null; mostraSigillo(); disegna(); };

// ---------------------------------------------------------------- se si risolve
let tCalcolo = 0;
function calcolaPresto() { clearTimeout(tCalcolo); $('#misura').textContent = 'Controllo in corso…'; tCalcolo = setTimeout(calcola, 450); }
function calcola() {
  const out = $('#misura');
  let def;
  try { def = daTiled(corrente.mappa); } catch (err) { out.textContent = 'Manca la partenza del coniglio (Segni).'; out.className = 'male'; return; }
  try {
    if (mondo()) {
      const liv = caricaLivello(def), r = esplora(liv, { max: 120000 });
      const fuori = r.mancanti.filter((t) => t !== 'meta');
      const sig = provaSigilli(liv).filter(({ sigillo: s, fuori: f }) => (s.facoltativo ? f.length : !f.length));
      out.textContent = (fuori.length ? `Non si arriva a: ${fuori.join(', ')}.` : 'Si arriva a tutte le isole.') +
        (sig.length ? ` Sigilli da controllare: ${sig.map(({ sigillo: s }) => s.livello + (s.facoltativo ? ' (facoltativo ma sbarra la strada)' : ' (obbligatorio ma non sbarra niente)')).join(', ')}.` : '');
      out.className = fuori.length || sig.length ? 'male' : 'bene';
      return;
    }
    if (!def.meta && !def.sagoma) { out.textContent = 'Manca la meta o la zona tratteggiata (Segni).'; out.className = 'male'; return; }
    const r = misura(def, { max: 80000 });
    if (r.irrisolvibile) { out.textContent = 'Non si risolve.'; out.className = 'male'; return; }
    out.textContent = `Si risolve in ${r.mosse} mosse · ${r.bivi} bivi su ${r.configurazioni} posizioni delle lastre · ${r.vicoli}% vicoli ciechi`;
    out.className = 'bene';
  } catch (err) { out.textContent = 'Controllo non riuscito: ' + err.message; out.className = 'male'; }
}

// ---------------------------------------------------------------- salvare, provare, nuovo
async function salva() {
  if (!banca) return avvisa('Per salvare serve il collegamento col PC (in Livelli, Collegamento).');
  const titolo = $('#titolo').value.trim();
  if (!titolo) { $('#titolo').focus(); return avvisa('Scrivi il nome del livello in alto.'); }
  const nome = nomeFile(titolo);
  let sha = nome === corrente.nome ? corrente.sha : null;
  const esiste = elenco.find((l) => l.nome === nome);
  if (nome !== corrente.nome && esiste && !confirm(`Nella banca c'è già «${esiste.titolo}». Lo sostituisco con questo?`)) return;
  if (nome !== corrente.nome && esiste) sha = esiste.sha;
  const m = copia(corrente.mappa);
  mettiProp(m, 'titolo', titolo); mettiProp(m, 'aggiornato', new Date().toISOString());
  for (const n of ['soluzione', 'mosse', 'vicoli']) mettiProp(m, n, undefined);
  $('#salva').disabled = true; avvisa('Salvataggio in corso…', 0);
  try {
    const esito = await banca.scrivi(nome, m, sha), nuovoSha = typeof esito === 'string' ? esito : null;
    const bozze = leggi('arc-editor-bozze', {}); delete bozze[corrente.chiaveBozza]; scrivi('arc-editor-bozze', bozze);
    corrente = { ...corrente, nome, sha: nuovoSha, mappa: m, salvata: copia(m), chiaveBozza: nome };
    const i = elenco.findIndex((l) => l.nome === nome), q = { nome, sha: nuovoSha, titolo, aggiornato: prop(m, 'aggiornato'), origine: prop(m, 'origine') || '', mondo: mondo() };
    if (i >= 0) elenco[i] = q; else elenco.push(q);
    aggiornaStato();
    avvisa(esito?.mandato === false ? `«${titolo}» è salvato sul telefono. Al PC lo mando appena il canale risponde.` : `«${titolo}» è salvato e mandato al PC.`, 4500);
  } catch (err) { avvisa(err.message, 6000); }
  $('#salva').disabled = false;
}
async function prova() {
  let def;
  try { def = daTiled(corrente.mappa); } catch { return avvisa('Manca la partenza del coniglio (Segni).'); }
  const { apriProva } = await import('./prova-livello.js');
  try { await apriProva(def, $('#prova'), { suChiudi: () => { misuraTela(); disegna(); } }); }
  catch (err) { avvisa('La prova non parte: ' + err.message, 6000); $('#prova').hidden = true; }
}
function nuovo(W, H) {
  const m = sottolivelloVuoto('iniziale', '', W, H);
  mettiProp(m, 'amano', undefined); mettiProp(m, 'titolo', undefined);
  apriEditor({ nome: null, sha: null, mappa: m, salvata: null, chiaveBozza: null });
  $('#titolo').focus();
}

// ---------------------------------------------------------------- il collegamento col PC
function apriChiave() {
  mostra('chiave');
  $('#chiave-campo').value = '';
  $('#chiave-stato').textContent = leggi('arc-editor-codice') ? 'Questo telefono è collegato al PC.' : 'Questo telefono non è ancora collegato al PC.';
}
async function salvaChiave() {
  const k = $('#chiave-campo').value.trim();
  if (!k) return;
  const { codiceValido } = await import('./canale-cifrato.js');
  if (!codiceValido(k)) { $('#chiave-stato').textContent = 'Il codice non è giusto: sono 24 caratteri, a gruppi di quattro.'; return; }
  $('#chiave-stato').textContent = 'Prova del collegamento in corso…';
  try { await (await bancaCanale(k)).prova(); } catch (err) { $('#chiave-stato').textContent = err.message; return; }
  scrivi('arc-editor-codice', k); $('#chiave-campo').value = '';
  await scegliBanca(); apriElenco();
  avvisa('Collegato al PC.');
}

// ---------------------------------------------------------------- avvio
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'livelli') { if (corrente) aggiornaStato(); corrente = null; apriElenco(); }
  else if (a === 'nuovo') mostra('nuovo');
  else if (a.startsWith('misura-')) { const [W, H] = a.slice(7).split('x').map(Number); nuovo(W, H); }
  else if (a === 'chiave') apriChiave();
  else if (a === 'chiave-salva') salvaChiave();
  else if (a === 'chiave-togli') { try { localStorage.removeItem('arc-editor-codice'); } catch { /* niente */ } scegliBanca().then(() => { $('#chiave-stato').textContent = 'Il telefono non è più collegato al PC. I livelli salvati qui restano.'; }); }
  else if (a === 'aggiorna') apriElenco();
  else if (a === 'annulla') annullaModifica();
  else if (a === 'prova') prova();
  else if (a === 'salva') salva();
});
for (const b of document.querySelectorAll('#schede button')) b.onclick = () => { scheda = b.dataset.s; costruisciSchede(); };
$('#titolo').addEventListener('input', () => aggiornaStato());
addEventListener('resize', () => { if (corrente && !$('#editor').hidden) { misuraTela(); disegna(); } });
img.onload = () => { if (corrente) { costruisciSchede(); disegna(); } };
await codiceDalLink();
$('#versione').textContent = 'editor ' + VERSIONE + (sviluppo && !leggi('arc-editor-codice') ? ' · banca locale di prova' : '');
await scegliBanca();
apriElenco();
window.__editor = { get corrente() { return corrente; }, get vista() { return vista; }, applicaIn: (x, y) => { ricorda(); tocca([x, y]); aggiornaStato(); calcolaPresto(); }, scegli: (t) => { strumento = t; } };
