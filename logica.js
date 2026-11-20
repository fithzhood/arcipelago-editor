// Regole di Arcipelago, senza grafica. Il mondo è una griglia: x verso destra, y verso il basso.
// Ogni mossa restituisce una lista di eventi che la scena trasforma in animazioni.

const K = (x, y) => x + ',' + y;
const copia = (o) => JSON.parse(JSON.stringify(o));
// Arrotondamento verso il perno sui mezzi esatti: se no l'arco "si allunga" e urta caselle che non tocca.
const arrot = (v) => Math.sign(v) * Math.round(Math.abs(v) - 1e-9);

/**
 * Il mondo che si richiude (l'overworld è un piccolo pianeta): `av` riporta una casella dentro la
 * mappa, `dw` dà la distanza più corta fra due coordinate. Nei quadri col bordo non cambiano niente.
 */
function geometria(liv) {
  const { W, H } = liv, m = (v, n) => ((v % n) + n) % n;
  liv.av = liv.toroide ? (x, y) => [m(x, W), m(y, H)] : (x, y) => [x, y];
  liv.dw = liv.toroide ? (d, n) => m(d + n / 2, n) - n / 2 : (d) => d;
}

/**
 * Mappa: '.' cielo, '#' isola, 'b' cespuglio su isola, 't' albero su isola,
 * 'o' scoglio volante con cespuglio, 'p' pilastro (muro), 'f' fuoco sospeso.
 * Facoltativi: `toroide` (il bordo si richiude), `tratti` (rettangoli { nome, x, y, w, h }: le parti
 * del mondo che si scoprono arrivando e che il reset rimette a posto), `posti` delle scenografie,
 * `sigilli` (pietre { x, y, livello, facoltativo }: ci si sale ed entra nel sottolivello `livello`;
 * finché non lo risolvi non ci passi), `meta` ([x, y] nei sottolivelli: arrivarci lo risolve),
 * `sagoma` ([[x, y], ...] nei sottolivelli: la zona tratteggiata da riempire con una lastra).
 */
export function caricaLivello(def) {
  const H = def.mappa.length, W = def.mappa[0].length;
  const liv = { W, H, celle: [], terra: new Set(), solidi: new Set(), fuoco: new Set(), glifi: new Map(),
    toroide: !!def.toroide, tratti: def.tratti || [], posti: def.posti || {}, zona: def.zona,
    sigilli: new Map((def.sigilli || []).map((s) => [K(s.x, s.y), s])), meta: def.meta || null, titolo: def.titolo || null,
    // la zona tratteggiata (come in Opera): si vince quando una lastra la riempie esattamente
    sagoma: def.sagoma?.length ? new Set(def.sagoma.map(([x, y]) => K(x, y))) : null };
  geometria(liv);
  liv.trattoDi = (x, y) => liv.tratti.find((t) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h)?.nome ?? null;
  def.mappa.forEach((riga, y) => [...riga].forEach((c, x) => {
    liv.celle.push({ x, y, c });
    if ('#bt'.includes(c)) liv.solidi.add(K(x, y));
    if (c === '#') liv.terra.add(K(x, y));
    if ('op'.includes(c)) liv.solidi.add(K(x, y));
    if (c === 'f') liv.fuoco.add(K(x, y));
  }));
  for (const g of def.glifi) liv.glifi.set(K(g.x, g.y), g);
  let id = 0;
  liv.iniziale = {
    // i personaggi: il coniglio e, nei livelli in due, il gatto. Si comandano a turno (`attivo`).
    personaggi: [['coniglio', def.coniglio], ['gatto', def.gatto]].filter(([, p]) => p)
      .map(([chi, [x, y]]) => ({ chi, x, y, verso: [0, 1], caduto: false })),
    attivo: 0,
    // una lastra è un elenco di caselle, oppure { colore, celle }: il colore distingue le lastre
    // e dice quali si impastano insieme (senza colore valgono tutte lo stesso grigio)
    lastre: def.lastre.map((l, i) => {
      const celle = Array.isArray(l) ? l : l.celle;
      return { id: i, colore: (!Array.isArray(l) && l.colore) || null, celle: celle.map(([x, y]) => ({ id: id++, x, y })) };
    }),
    caduto: false,
    ingressi: {}, // per tratto: dov'erano i personaggi quando ci sono entrati (il reset li rimette lì)
  };
  liv.iniziale.prossima = def.lastre.length; // id della prossima lastra nata da una divisione
  liv.iniziale.personaggi.forEach((p) => { p.tratto = liv.trattoDi(p.x, p.y); });
  // lastre dello stesso colore già a contatto nel disegno del livello partono fuse
  ricomponi(liv.iniziale, liv);
  return liv;
}

/**
 * Divisione e fusione, a mossa finita. Prima la divisione: una lastra le cui caselle non si toccano
 * più per un lato (il fuoco ne ha bruciata una nel mezzo) diventa più lastre dello stesso colore.
 * Poi la fusione: lastre dello stesso colore con un lato in comune diventano una (lo spigolo non
 * basta). Tiene l'id più basso. Cambia lo stato e restituisce gli eventi.
 */
export function ricomponi(st, liv = null) {
  const ev = [], av = liv?.av || ((x, y) => [x, y]), KA = (x, y) => K(...av(x, y));
  // divisione: pezzi connessi per lato
  for (const l of [...st.lastre]) {
    const pezzi = connessi(l.celle, KA);
    if (pezzi.length < 2) continue;
    pezzi.sort((a, b) => Math.min(...a.map((c) => c.id)) - Math.min(...b.map((c) => c.id)));
    l.celle = pezzi[0];
    const nuove = pezzi.slice(1).map((celle) => ({ id: st.prossima++, colore: l.colore, celle }));
    st.lastre.push(...nuove);
    ev.push({ tipo: 'divide', da: l.id, pezzi: [l, ...nuove].map((q) => ({ lastra: q.id, celle: q.celle.map((c) => c.id) })) });
  }
  // fusione: unione per gruppi, così tre lastre che si toccano a catena diventano una sola
  const dove = new Map();
  for (const l of st.lastre) for (const c of l.celle) dove.set(K(c.x, c.y), l);
  const capo = new Map(st.lastre.map((l) => [l.id, l.id]));
  const trova = (i) => { while (capo.get(i) !== i) i = capo.get(i); return i; };
  const contatti = [];
  for (const l of st.lastre) for (const c of l.celle) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const v = dove.get(KA(c.x + dx, c.y + dy));
    if (!v || v === l || tinta(v) !== tinta(l)) continue;
    contatti.push([l.id, v.id, c, [dx, dy]]);
    const a = trova(l.id), b = trova(v.id);
    if (a !== b) capo.set(Math.max(a, b), Math.min(a, b));
  }
  const gruppi = new Map();
  for (const l of st.lastre) { const r = trova(l.id); if (!gruppi.has(r)) gruppi.set(r, []); gruppi.get(r).push(l); }
  for (const [r, membri] of gruppi) {
    if (membri.length < 2) continue;
    const tieni = membri.find((l) => l.id === r);
    // per l'animazione: ogni lastra si spinge verso le altre, lungo i lati in comune
    const spinte = membri.map((l) => {
      let sx = 0, sy = 0;
      for (const [a, b, , [dx, dy]] of contatti) { if (a === l.id) { sx += dx; sy += dy; } else if (b === l.id) { sx -= dx; sy -= dy; } }
      const n = Math.hypot(sx, sy) || 1;
      return { lastra: l.id, celle: l.celle.map((c) => c.id), verso: [sx / n, sy / n] };
    });
    for (const l of membri) if (l !== tieni) tieni.celle.push(...l.celle);
    st.lastre = st.lastre.filter((l) => l === tieni || !membri.includes(l));
    ev.push({ tipo: 'fonde', lastra: tieni.id, membri: spinte });
  }
  return ev;
}
const tinta = (l) => l.colore || 'grigio';
function connessi(celle, KA) {
  const resto = new Map(celle.map((c) => [K(c.x, c.y), c])), pezzi = [];
  while (resto.size) {
    const [k0, c0] = resto.entries().next().value, pezzo = [c0], coda = [c0];
    resto.delete(k0);
    while (coda.length) {
      const c = coda.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = KA(c.x + dx, c.y + dy), v = resto.get(k);
        if (v) { resto.delete(k); pezzo.push(v); coda.push(v); }
      }
    }
    pezzi.push(pezzo);
  }
  return pezzi;
}

export class Gioco {
  constructor(liv, { risolti = [] } = {}) {
    this.liv = liv; this.stato = copia(liv.iniziale); this.storia = [];
    // i tratti scoperti restano scoperti anche annullando: le nuvole non tornano
    this.esplorati = new Set(this.stato.personaggi.map((p) => p.tratto).filter(Boolean));
    // i sottolivelli risolti, per nome: come i tratti scoperti, gli annulla non li toccano
    this.risolti = new Set(risolti);
  }

  /** Il sigillo ancora chiuso in quella casella, o null. */
  sigilloIn(x, y) {
    const s = this.liv.sigilli.get(K(...this.liv.av(x, y)));
    return s && !this.risolti.has(s.livello) ? s : null;
  }

  /** Il sigillo già risolto su cui sta chi si comanda (da lì lo si può rigiocare), o null. */
  sigilloSotto() {
    const st = this.stato, c = st.personaggi[st.attivo];
    if (!c || c.caduto) return null;
    const s = this.liv.sigilli.get(K(c.x, c.y));
    return s && this.risolti.has(s.livello) ? s : null;
  }

  /**
   * Il sottolivello del sigillo è risolto: chi l'ha aperto si ritrova sulla pietra, ormai spenta.
   * È una mossa (si annulla), ma il sigillo resta risolto.
   */
  risolvi(nome) {
    const s = [...this.liv.sigilli.values()].find((q) => q.livello === nome);
    if (!s) return [];
    this.risolti.add(nome);
    const st = this.stato, c = st.personaggi[st.attivo];
    this.storia.push(copia(st));
    const vx = Math.sign(this.liv.dw(s.x - c.x, this.liv.W)), vy = Math.sign(this.liv.dw(s.y - c.y, this.liv.H));
    if (vx || vy) c.verso = [vx, vy];
    c.x = s.x; c.y = s.y;
    return [{ tipo: 'risolto', sigillo: s }, ...this.arrivi()];
  }

  lastraIn(x, y, st = this.stato) {
    [x, y] = this.liv.av(x, y);
    for (const l of st.lastre) for (const c of l.celle) if (c.x === x && c.y === y) return { lastra: l, cella: c };
    return null;
  }
  occupata(x, y, ignora) {
    const { W, H, solidi, toroide } = this.liv;
    if (!toroide && (x < 0 || y < 0 || x >= W || y >= H)) return true;
    [x, y] = this.liv.av(x, y);
    if (solidi.has(K(x, y))) return true;
    const t = this.lastraIn(x, y);
    return !!(t && t.lastra.id !== ignora);
  }
  calpestabile(x, y) {
    [x, y] = this.liv.av(x, y);
    return this.liv.terra.has(K(x, y)) || !!this.lastraIn(x, y);
  }
  /** Indice del personaggio in quella casella, o -1. */
  chiIn(x, y) { [x, y] = this.liv.av(x, y); return this.stato.personaggi.findIndex((p) => !p.caduto && p.x === x && p.y === y); }
  /** I personaggi che stanno su una lastra: viaggiano con lei. */
  passeggeri(lastra) {
    const qui = new Set(lastra.celle.map((c) => K(c.x, c.y)));
    return this.stato.personaggi.flatMap((p, i) => (!p.caduto && qui.has(K(p.x, p.y)) ? [i] : []));
  }
  cadono(chi) {
    if (!chi.length) return [];
    for (const i of chi) this.stato.personaggi[i].caduto = true;
    this.stato.caduto = true;
    return chi.map((i) => ({ tipo: 'cade', chi: i }));
  }

  /** Passa all'altro personaggio. Non è una mossa: non entra nella storia degli annulla. */
  cambia() {
    const st = this.stato, n = st.personaggi.length;
    if (n < 2 || st.caduto) return [];
    st.attivo = (st.attivo + 1) % n;
    return [{ tipo: 'cambia', chi: st.attivo }];
  }

  /** Un passo del personaggio attivo. Restituisce gli eventi da animare. */
  muovi(dx, dy) {
    const st = this.stato, i = st.attivo, c = st.personaggi[i];
    if (st.caduto || st.vinto) return [];
    c.verso = [dx, dy];
    const [nx, ny] = this.liv.av(c.x + dx, c.y + dy);
    // l'altro personaggio fa da ostacolo
    if (!this.calpestabile(nx, ny) || this.chiIn(nx, ny) >= 0) return [{ tipo: 'urto', chi: i, d: [dx, dy] }];
    // un sigillo chiuso non si attraversa: salirci vuol dire entrare nel suo sottolivello. Qui non è
    // una mossa: il personaggio resta dov'era, e la pagina apre il sottolivello.
    const sig = this.sigilloIn(nx, ny);
    if (sig) return [{ tipo: 'entra', chi: i, sigillo: sig, da: [c.x, c.y], a: [nx, ny] }];
    this.storia.push(copia(st));
    const ev = [{ tipo: 'cammina', chi: i, da: [c.x, c.y], a: [nx, ny] }];
    c.x = nx; c.y = ny;
    const sotto = this.lastraIn(nx, ny);
    const g = this.liv.glifi.get(K(nx, ny));
    if (sotto && g && !g.fantasma) {
      const mossa = this.attiva(g, sotto.lastra, nx, ny);
      ev.push({ tipo: 'glifo', x: nx, y: ny }, ...mossa);
      // a mossa finita (dopo l'eventuale fuoco) le lastre si dividono e si fondono
      if (!mossa[0]?.tipo.endsWith('-urto')) ev.push(...ricomponi(st, this.liv));
    }
    ev.push(...this.arrivi());
    // nei sottolivelli: chi si comanda arriva alla meta (a piedi o portato da una lastra)
    const m = this.liv.meta, io = st.personaggi[i];
    if (m && !io.caduto && io.x === m[0] && io.y === m[1]) { st.vinto = true; ev.push({ tipo: 'vince', chi: i }); }
    else if (this.sagomaPiena()) { st.vinto = true; ev.push({ tipo: 'vince', chi: i, sagoma: true }); }
    return ev;
  }

  /** Una lastra occupa esattamente la zona tratteggiata (né più né meno caselle). */
  sagomaPiena(st = this.stato) {
    const z = this.liv.sagoma;
    return !!z && st.lastre.some((l) => l.celle.length === z.size && l.celle.every((c) => z.has(K(c.x, c.y))));
  }

  /** Chi entra in un tratto: ci si ricorda da dove (per il reset) e, la prima volta, lo si scopre. */
  arrivi() {
    const st = this.stato, ev = [];
    for (const p of st.personaggi) {
      if (p.caduto) continue;
      const t = this.liv.trattoDi(p.x, p.y);
      if (!t || t === p.tratto) continue;
      p.tratto = t;
      st.ingressi[t] = st.personaggi.map((q) => ({ x: q.x, y: q.y, verso: q.verso }));
      if (!this.esplorati.has(t)) { this.esplorati.add(t); ev.push({ tipo: 'scopre', tratto: t }); }
    }
    return ev;
  }

  attiva(g, lastra, px, py) {
    let ev;
    if (g.tipo === 'T') ev = this.trasla(lastra, g.d, g.n);
    else if (g.tipo === 'R') ev = this.ruota(lastra, px, py, g.giro);
    else if (g.tipo === 'M') ev = this.specchia(lastra, px, py, g.asse);
    else return [];
    if (ev[0].tipo.endsWith('-urto')) return ev;
    return ev.concat(this.brucia(lastra));
  }

  trasla(lastra, [dx, dy], n) {
    // nel mondo che si richiude una riga senza ostacoli farebbe un giro infinito: ci si ferma prima
    // di tornare al punto di partenza (il verificatore dei livelli lo segnala come errore di disegno)
    const { W, H, toroide } = this.liv;
    const giro = toroide ? (dx && dy ? Math.min(W, H) : dx ? W : H) - 1 : Infinity;
    const max = n === 0 ? giro : n;
    let passi = 0;
    while (passi < max) {
      const ok = lastra.celle.every((c) => {
        const x0 = c.x + dx * passi, y0 = c.y + dy * passi;
        if (this.occupata(x0 + dx, y0 + dy, lastra.id)) return false;
        // In diagonale non si passa fra due spigoli se anche un solo lato è occupato.
        if (dx && dy && (this.occupata(x0 + dx, y0, lastra.id) || this.occupata(x0, y0 + dy, lastra.id))) return false;
        return true;
      });
      if (!ok) break;
      passi++;
    }
    const passeggeri = this.passeggeri(lastra);
    if (passi === 0) return [{ tipo: 'trasla-urto', lastra: lastra.id, d: [dx, dy], passeggeri }];
    const av = this.liv.av;
    for (const c of lastra.celle) [c.x, c.y] = av(c.x + dx * passi, c.y + dy * passi);
    for (const i of passeggeri) { const p = this.stato.personaggi[i]; [p.x, p.y] = av(p.x + dx * passi, p.y + dy * passi); }
    return [{ tipo: 'trasla', lastra: lastra.id, d: [dx, dy], passi, passeggeri }];
  }

  /** Primo angolo (radianti, col segno del giro) a cui l'arco urta qualcosa, o null. */
  arco(lastra, px, py, gradi) {
    const s = Math.sign(gradi);
    for (let a = 15; a <= Math.abs(gradi); a += 15) {
      const r = (s * a * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
      for (const c of lastra.celle) {
        const dx = this.liv.dw(c.x - px, this.liv.W), dy = this.liv.dw(c.y - py, this.liv.H);
        if (this.occupata(px + arrot(dx * co - dy * si), py + arrot(dx * si + dy * co), lastra.id)) return r;
      }
    }
    return null;
  }

  ruota(lastra, px, py, giro) {
    // giro: 90 orario, -90 antiorario, 180 mezzo giro (prova prima in senso orario, poi l'altro).
    const tentativi = giro === 180 ? [180, -180] : [giro];
    const passeggeri = this.passeggeri(lastra);
    let primoUrto = null;
    for (const gradi of tentativi) {
      const urto = this.arco(lastra, px, py, gradi);
      if (urto !== null) { if (primoUrto === null) primoUrto = urto; continue; }
      const { av, dw, W, H } = this.liv;
      const gira = (c) => {
        const dx = dw(c.x - px, W), dy = dw(c.y - py, H);
        if (gradi === 90) [c.x, c.y] = av(px - dy, py + dx);
        else if (gradi === -90) [c.x, c.y] = av(px + dy, py - dx);
        else [c.x, c.y] = av(px - dx, py - dy);
      };
      lastra.celle.forEach(gira);
      // i passeggeri girano con la lastra, e con loro la direzione in cui guardano
      const r = (gradi * Math.PI) / 180;
      for (const i of passeggeri) {
        const co = this.stato.personaggi[i]; gira(co);
        const vx = co.verso[0], vy = co.verso[1];
        co.verso = [Math.round(vx * Math.cos(r) - vy * Math.sin(r)), Math.round(vx * Math.sin(r) + vy * Math.cos(r))];
      }
      return [{ tipo: 'ruota', lastra: lastra.id, perno: [px, py], angolo: r, passeggeri }];
    }
    return [{ tipo: 'ruota-urto', lastra: lastra.id, perno: [px, py], angolo: primoUrto, passeggeri }];
  }

  specchia(lastra, px, py, asse) {
    const { av, dw, W, H } = this.liv;
    const rifletti = (x, y) => {
      const dx = dw(x - px, W), dy = dw(y - py, H);
      if (asse === '|') return av(px - dx, py + dy);
      if (asse === '-') return av(px + dx, py - dy);
      if (asse === '\\') return av(px + dy, py + dx);
      return av(px - dy, py - dx); // '/'
    };
    const mappa = lastra.celle.map((c) => ({ id: c.id, da: [c.x, c.y], a: rifletti(c.x, c.y) }));
    const libero = mappa.every((m) => !this.occupata(m.a[0], m.a[1], lastra.id));
    if (!libero) return [{ tipo: 'specchia-urto', lastra: lastra.id, perno: [px, py] }];
    // chi sta sulla lastra fuori dall'asse cade: la sua casella si sgretola e va dall'altra parte
    const fuori = this.passeggeri(lastra).filter((i) => {
      const p = this.stato.personaggi[i], [ax, ay] = rifletti(p.x, p.y);
      return ax !== p.x || ay !== p.y;
    });
    mappa.forEach((m, i) => { lastra.celle[i].x = m.a[0]; lastra.celle[i].y = m.a[1]; });
    return [{ tipo: 'specchia', lastra: lastra.id, perno: [px, py], asse, mappa }, ...this.cadono(fuori)];
  }

  /** Il fuoco brucia le caselle di lastra che ci si posano sopra; chi ci sta sopra cade. */
  brucia(lastra) {
    const bruciate = lastra.celle.filter((c) => this.liv.fuoco.has(K(c.x, c.y)));
    if (!bruciate.length) return [];
    lastra.celle = lastra.celle.filter((c) => !bruciate.includes(c));
    const ev = [{ tipo: 'brucia', lastra: lastra.id, celle: bruciate.map((c) => c.id) }];
    const sopra = this.stato.personaggi.flatMap((p, i) => (!p.caduto && bruciate.some((c) => c.x === p.x && c.y === p.y) ? [i] : []));
    return ev.concat(this.cadono(sopra));
  }

  annulla() {
    if (!this.storia.length) return false;
    this.stato = this.storia.pop();
    return true;
  }
  /**
   * Reset. Nei quadri col bordo rimette tutto com'era. Nell'overworld rimette a posto solo il tratto
   * in cui si trova chi si comanda: le sue lastre tornano dove le aveva disegnate il livello e i
   * personaggi tornano dov'erano quando ci sono entrati. Anche il reset si annulla.
   */
  ricomincia() {
    const liv = this.liv, st = this.stato;
    if (!liv.tratti.length) { this.storia.push(copia(st)); this.stato = copia(liv.iniziale); return true; }
    const io = st.personaggi[st.attivo], t = io.tratto;
    if (!t) return false;
    this.storia.push(copia(st));
    // un tratto può essere fatto di più rettangoli con lo stesso nome (l'isola e l'area del suo passaggio)
    const rr = liv.tratti.filter((q) => q.nome === t);
    const dentro = (c) => rr.some((r) => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h);
    const sue = copia(liv.iniziale.lastre.filter((l) => dentro(l.celle[0])));
    const idCelle = new Set(sue.flatMap((l) => l.celle.map((c) => c.id))), idLastre = new Set(sue.map((l) => l.id));
    st.lastre = st.lastre.map((l) => ({ ...l, celle: l.celle.filter((c) => !idCelle.has(c.id)) })).filter((l) => l.celle.length);
    for (const l of st.lastre) if (idLastre.has(l.id)) l.id = st.prossima++;
    st.lastre.push(...sue);
    const da = st.ingressi[t] || liv.iniziale.personaggi;
    st.personaggi.forEach((p, i) => { if (da[i]) Object.assign(p, { x: da[i].x, y: da[i].y, verso: da[i].verso, caduto: false, tratto: liv.trattoDi(da[i].x, da[i].y) }); });
    st.caduto = false; st.vinto = false;
    ricomponi(st, liv);
    return true;
  }
}
