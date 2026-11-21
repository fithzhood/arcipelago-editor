// Ossatura comune agli stili 3D: scena, telecamera, nuvole, e ogni fotogramma copia le pose
// dell'animatore sugli oggetti. Ogni stile fornisce solo "come è fatto" ogni pezzo.
import * as THREE from 'three';
import { casuale } from '../forme.js';

export class Base3D {
  constructor(renderer, gioco, anim, cfg) {
    Object.assign(this, { r: renderer, gioco, anim, cfg });
    const liv = gioco.liv;
    this.scene = new THREE.Scene();
    const cam = cfg.camera || {};
    this.cam = { alto: cam.alto ?? 10.5, dietro: cam.dietro ?? 7.4 };
    this.camera = new THREE.PerspectiveCamera(cam.fov ?? 30, 1, 0.5, 220);
    this.centro = new THREE.Vector3(liv.W / 2 - 0.5, 0, liv.H / 2 - 0.5);
    this.scene.background = cfg.cielo instanceof THREE.Texture ? cfg.cielo : new THREE.Color(cfg.cielo);
    if (cfg.nebbia) this.scene.fog = new THREE.Fog(cfg.coloreNebbia ?? cfg.cielo, cfg.nebbia[0], cfg.nebbia[1]);
    // se lo stile restituisce il sole, la sua ombra segue la telecamera (su un mondo grande la
    // finestra d'ombra di 28 caselle non può stare ferma al centro)
    this.sole = cfg.luci(this.scene, this.centro) || null;
    if (this.sole) this.soleScarto = this.sole.position.clone().sub(this.sole.target.position);

    // tutto ciò che non si muove va in un gruppo che alla fine si fonde in poche mesh (una per materiale)
    const statici = new THREE.Group(); this.scene.add(statici);
    const out = cfg.isole(statici, liv) || {};
    this.fiamme = out.fiamme || [];
    this.fiamme.forEach((f) => { f.userData.mobile = true; });

    this.celle = new Map();
    for (const a of anim.celle.values()) { const o = cfg.lastra(a); this.celle.set(a.id, o); this.scene.add(o); }
    this.glifi = anim.glifi.map((q) => { const o = cfg.glifo(q.g); this.scene.add(o); return o; });
    this.figure = anim.pers.map((p) => { const o = cfg.figura(p.chi); this.scene.add(o); return o; });
    // con due personaggi, un segno sotto quello che si comanda
    this.segno = anim.pers.length > 1 && cfg.segno ? cfg.segno() : null;
    if (this.segno) this.scene.add(this.segno);
    // le pietre dei sigilli e la meta: si accendono e si spengono, quindi non vanno fra gli statici
    this.pietre = cfg.pietra ? anim.pietre.map((p) => { const o = cfg.pietra(p); this.scene.add(o); return o; }) : [];
    // le zone tratteggiate dei sottolivelli, una per una (ognuna diventa verde quando è riempita)
    this.sagome = cfg.sagoma ? liv.sagome.map((z) => cfg.sagoma([...z].map((k) => k.split(',').map(Number)))) : [];
    for (const o of this.sagome) this.scene.add(o);

    // nuvole sull'inesplorato e nuvole profonde
    const rnd = casuale(23);
    this.profonde = [];
    if (cfg.nuvola) {
      // nel mondo che si richiude non c'è un fuori da coprire
      if (!liv.toroide) for (let x = -7; x <= liv.W + 6; x += 1.6) for (let z = -7; z <= liv.H + 6; z += 1.4) {
        const fuori = Math.max(-1.6 - x, x - liv.W - 0.6, -1.6 - z, z - liv.H - 0.6);
        if (fuori < 0 || rnd() > 0.85) continue;
        // le scenografie fuori griglia (casa del coniglio, rovine) restano scoperte
        if (out.radure?.some(([rx, rz, r]) => Math.hypot(x - rx, z - rz) < r)) continue;
        const n = cfg.nuvola(rnd, Math.min(1.4, 0.6 + fuori * 0.15 + rnd() * 0.3));
        const giu = z > liv.H ? 1.2 : 0;
        n.position.set(x + (rnd() - 0.5) * 0.6, -0.9 - giu + rnd() * 0.45 + Math.min(fuori, 3) * 0.12, z + (rnd() - 0.5) * 0.6);
        statici.add(n);
      }
      for (let i = 0; i < 8; i++) {
        const n = cfg.nuvola(rnd, 1.3 + rnd() * 1.1, true);
        n.position.set(this.centro.x + (rnd() - 0.5) * 46, -11 - rnd() * 6, this.centro.z + (rnd() - 0.5) * 36);
        fondi(n); this.profonde.push(n); this.scene.add(n);
      }
    }
    fondi(statici, LATO_PEZZO);
    // ogni pezzo fermo sa dov'è il suo centro: nel mondo che si richiude si sposta nella copia più vicina
    this.statici = statici;
    for (const o of statici.children) {
      if (o.geometry && !o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.userData.centro = o.geometry ? o.geometry.boundingSphere.center.clone() : o.position.clone();
      o.userData.base = o.position.clone();
    }
    this.coperte = this.creaCoperte(liv);
    this.schegge = [];
    this.post = cfg.post ? cfg.post(renderer, this) : null;
    this.ultimaPosa = -1;
    this.creaSipario(cfg.chiuso);
  }

  /**
   * Il sipario di nuvole fra l'overworld e un sottolivello. Le nuvole sono disegnate, non modellate:
   * ognuna è un mucchio di sbuffi sfumati che si sovrappongono, con un'ombra sotto, su un piano
   * attaccato alla telecamera. Tre strati (dietro più grandi e più scuri, davanti più chiari) arrivano
   * dai due lati a velocità diverse, sfumando mentre entrano; un fondale pieno chiude l'ultimo
   * spiraglio. `chiudiSipario` e `apriSipario` restituiscono una promessa che si compie a fine corsa.
   * (Con palle 3D tutte uguali sembravano palline bianche, non nuvole.)
   */
  creaSipario(chiuso = false) {
    const sp = { k: chiuso ? 1 : 0, verso: 0, fatto: null, nuvole: [] };
    this.sipario = sp;
    if (!this.cfg.coperta) return;
    const tinta = this.cfg.coperta().mat.color.clone(), rnd = casuale(47);
    const trame = [0, 1, 2, 3].map((v) => texNuvola(casuale(101 + v * 17)));
    const piano = new THREE.PlaneGeometry(1, 1);
    // strato: [colonne, righe, larghezza rispetto a mezzo schermo, scurezza, profondità in più]
    const STRATI = [[5, 4, 1.25, 0.86, 0.5], [6, 5, 1.0, 0.94, 0.25], [6, 4, 0.8, 1.0, 0]];
    STRATI.forEach(([NX, NY, larga, scuro, dz], s) => {
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const u = -1 + (2 * (i + 0.5)) / NX + (rnd() - 0.5) * 0.18, v = -1.05 + (2.1 * (j + 0.5)) / NY + (rnd() - 0.5) * 0.2;
        const mat = new THREE.MeshBasicMaterial({ map: trame[(i + j * 3 + s) % 4], color: tinta.clone().multiplyScalar(scuro), transparent: true, depthWrite: false, fog: false });
        const m = new THREE.Mesh(piano, mat);
        m.frustumCulled = false; m.renderOrder = 10 + s;
        this.camera.add(m);
        sp.nuvole.push({ m, u, v, s, dz: dz + rnd() * 0.08, larga: larga * (0.85 + rnd() * 0.4), giro: (rnd() - 0.5) * 0.25, fase: rnd() * 6,
          // le più esterne e quelle di dietro partono prima: il sipario si chiude dai lati verso il centro
          ritardo: (1 - Math.abs(u)) * 0.22 + (2 - s) * 0.06 + rnd() * 0.06 });
      }
    });
    sp.fondale = new THREE.Mesh(piano, new THREE.MeshBasicMaterial({ color: tinta.clone().multiplyScalar(0.93), transparent: true, depthWrite: false, fog: false }));
    sp.fondale.frustumCulled = false; sp.fondale.renderOrder = 9;
    this.camera.add(sp.fondale);
    this.scene.add(this.camera);
    this.muoviSipario(0);
  }
  chiudiSipario() { return this.corsaSipario(1); }
  apriSipario() { return this.corsaSipario(-1); }
  corsaSipario(verso) {
    const sp = this.sipario;
    sp.fatto?.(); // una corsa interrotta si considera finita
    sp.verso = verso;
    return new Promise((ok) => { sp.fatto = ok; });
  }
  muoviSipario(dt) {
    const sp = this.sipario;
    if (sp.verso) {
      sp.k = Math.min(1, Math.max(0, sp.k + sp.verso * dt / (sp.verso > 0 ? 0.85 : 1.0)));
      if (sp.k === (sp.verso > 0 ? 1 : 0)) { sp.verso = 0; const f = sp.fatto; sp.fatto = null; f?.(); }
    }
    if (!sp.fondale) return;
    const vede = sp.k > 0;
    sp.fondale.visible = vede;
    for (const n of sp.nuvole) n.m.visible = vede;
    if (!vede) return;
    // misure dello schermo a distanza d dalla telecamera
    const d = 3, hh = d * Math.tan((this.camera.fov * Math.PI) / 360), hw = hh * this.camera.aspect;
    const e = (t) => 1 - Math.pow(1 - t, 3), t0 = performance.now() / 1000;
    for (const n of sp.nuvole) {
      const t = e(Math.min(1, Math.max(0, (sp.k - n.ritardo) / 0.62))), lato = n.u < 0 ? -1 : 1;
      const x = n.u * hw * 1.02, fuori = lato * hw * (1.7 + n.larga * 0.6);
      const w = hw * n.larga * (0.75 + 0.25 * t), h = w * 0.62;
      // un respiro lento, così il sipario chiuso non sembra un'immagine ferma
      const resp = 1 + Math.sin(t0 * 0.9 + n.fase) * 0.025;
      n.m.position.set(fuori + (x - fuori) * t, n.v * hh + Math.sin(t0 * 0.6 + n.fase) * hh * 0.015, -d - n.dz);
      n.m.scale.set(w * resp, h * resp, 1); n.m.rotation.z = n.giro * (1 - t * 0.5);
      n.m.material.opacity = Math.min(1, t * 1.6);
    }
    // il fondale pieno arriva per ultimo, quando le nuvole hanno già quasi chiuso
    sp.fondale.position.set(0, 0, -d - 0.9);
    sp.fondale.scale.set(hw * 3, hh * 3, 1);
    sp.fondale.material.opacity = Math.min(1, Math.max(0, (sp.k - 0.75) / 0.22));
  }

  /** La copia di (x, z) più vicina alla telecamera, nel mondo che si richiude. Altrove (x, z). */
  vicino(x, z) {
    const L = this.gioco.liv;
    if (!L.toroide) return [x, z];
    const m = this.anim.mira;
    return [x + L.W * Math.round((m.x - x) / L.W), z + L.H * Math.round((m.z - z) / L.H)];
  }

  /**
   * Le nuvole sopra i tratti non ancora scoperti: un mucchio di sbuffi per tratto, tutti in una mesh
   * sola (instanced). Quando il tratto si scopre gli sbuffi si allargano, salgono e spariscono.
   */
  creaCoperte(liv) {
    if (!liv.tratti.length || !this.cfg.coperta) return [];
    const { geo, mat } = this.cfg.coperta(), rnd = casuale(31), m4 = new THREE.Matrix4();
    return liv.tratti.filter((t) => !this.anim.scoperti.has(t.nome)).map((t) => {
      const sbuffi = [];
      // rientrati dal bordo, soprattutto a nord: la telecamera guarda verso nord e una nuvola alta
      // copre anche le caselle dietro di sé, cioè il tratto vicino già scoperto
      for (let x = t.x + 0.1; x <= t.x + t.w - 1.1; x += 1.2) for (let z = t.y + 0.9; z <= t.y + t.h - 0.8; z += 1.05) {
        const r = 0.8 + rnd() * 0.45;
        sbuffi.push({ x: x + (rnd() - 0.5) * 0.4, y: 1.0 + rnd() * 0.5, z: z + (rnd() - 0.5) * 0.3, r });
      }
      const im = new THREE.InstancedMesh(geo, mat, sbuffi.length);
      const cx = t.x + t.w / 2 - 0.5, cz = t.y + t.h / 2 - 0.5;
      sbuffi.forEach((b, i) => { m4.makeScale(b.r, b.r * 0.6, b.r).setPosition(b.x - cx, b.y, b.z - cz); im.setMatrixAt(i, m4); });
      im.castShadow = true; im.userData = { centro: [cx, cz] };
      this.scene.add(im);
      return { nome: t.nome, im, sbuffi, cx, cz, aperta: -1 };
    });
  }
  apriCoperte(dt) {
    const m4 = new THREE.Matrix4();
    for (const c of this.coperte) {
      if (c.aperta < 0 && this.anim.scoperti.has(c.nome)) c.aperta = 0;
      const [x, z] = this.vicino(c.cx, c.cz); c.im.position.set(x, 0, z);
      if (c.aperta < 0 || c.aperta > 1) continue;
      c.aperta += dt / 1.6;
      const k = Math.min(1, c.aperta), q = k * k;
      c.sbuffi.forEach((b, i) => {
        const dx = b.x - c.cx, dz = b.z - c.cz, d = Math.hypot(dx, dz) || 1, s = b.r * (1 - k * 0.85);
        m4.makeScale(s, s * 0.6, s).setPosition(dx + (dx / d) * q * 7, b.y + q * 3, dz + (dz / d) * q * 7);
        c.im.setMatrixAt(i, m4);
      });
      c.im.instanceMatrix.needsUpdate = true;
      if (k >= 1) { c.im.visible = false; c.aperta = 2; this.r.shadowMap.needsUpdate = true; }
    }
  }

  /** Copia le pose dell'animatore sugli oggetti. Con `pose` (es. 12) lo fa a scatti, come il passo uno. */
  copiaPose() {
    const A = this.anim;
    if (this.gioco.liv.toroide) {
      for (const o of this.statici.children) {
        const u = o.userData, cx = u.centro.x + u.base.x, cz = u.centro.z + u.base.z, [x, z] = this.vicino(cx, cz);
        o.position.set(u.base.x + x - cx, u.base.y, u.base.z + z - cz);
      }
    }
    if (this.cfg.bolle) this.ultimaPosa = Math.floor(A.tempo * this.cfg.bolle);
    for (const [id, o] of this.celle) {
      const a = A.celle.get(id);
      o.visible = a.vis;
      const [x, z] = this.vicino(a.x, a.z);
      o.position.set(x, a.y, z); o.rotation.set(a.rx, a.ry, a.rz); o.scale.setScalar(a.s);
      this.cfg.lastraPosa?.(o, a);
    }
    if (this.cfg.blocco) this.blocchi();
    A.pers.forEach((c, i) => {
      const k = this.figure[i];
      const [x, z] = this.vicino(c.x, c.z);
      k.visible = c.vis; k.position.set(x, c.y, z); k.rotation.set(0, c.ry, c.rz);
      this.cfg.figuraPosa?.(k, c, A, i);
      k.position.y += c.salto;
    });
    if (this.segno) { const c = A.con, [x, z] = this.vicino(c.x, c.z); this.segno.visible = c.vis; this.segno.position.set(x, 0.012 + Math.max(0, c.y) * 0.2, z); }
    A.pietre.forEach((p, i) => {
      const o = this.pietre[i];
      if (!o) return;
      const [x, z] = this.vicino(p.x, p.y); o.position.set(x, 0, z);
      this.cfg.pietraPosa?.(o, p, A.tempo);
    });
    this.sagome.forEach((o, i) => this.cfg.sagomaPosa?.(o, A.sagome[i].luce, A.tempo));
    A.glifi.forEach((q, i) => {
      const o = this.glifi[i], u = o.userData;
      const [gx, gz] = this.vicino(q.g.x, q.g.y);
      o.position.set(gx, 0.015 + q.alt, gz);
      o.scale.setScalar(1 + q.imp * 0.35 - (1 - q.cop) * 0.08);
      if (u.piano) u.piano.material.opacity = q.g.fantasma ? (this.cfg.glifiOpachi ? 0.92 : 0.6) : this.cfg.glifiOpachi ? 1 : 0.62 + 0.38 * q.cop;
      if (u.ombra) { u.ombra.position.y = -0.55 - q.alt; u.ombra.material.opacity = (1 - q.cop) * 0.2; }
      if (u.alone) u.alone.material.opacity = 0.35 + 0.65 * q.cop + q.imp;
      if (u.luce) u.luce.intensity = 0.6 + 1.2 * q.cop + q.imp * 3;
    });
    // schegge: un oggetto per ciascuna, riusati
    while (this.schegge.length < A.schegge.length) { const s = this.cfg.scheggia('lastra'); this.scene.add(s); this.schegge.push(s); }
    this.schegge.forEach((m, i) => {
      const s = A.schegge[i];
      m.visible = !!s;
      if (!s) return;
      if (m.userData.tipo !== s.tipo) { m.material = this.cfg.scheggia(s.tipo).material; m.userData.tipo = s.tipo; }
      const [sx, sz] = this.vicino(s.x, s.z);
      m.position.set(sx, s.y, sz); m.rotation.set(s.giro, s.giro * 0.7, 0); m.scale.setScalar(Math.max(0.01, s.vita / 0.7));
    });
    return true;
  }

  /**
   * Lastre come blocco unico. Finché tutte le caselle di una lastra si muovono insieme (ferme,
   * traslate o ruotate in blocco) si mostra un solo pezzo col contorno dell'intera forma; quando
   * una casella fa da sé (sgretolamento della simmetria, fuoco) si torna alle caselle separate.
   * I blocchi si costruiscono una volta per forma e colore, e si riusano.
   */
  blocchi() {
    const A = this.anim, perLastra = new Map();
    for (const a of A.celle.values()) if (a.vis) { if (!perLastra.has(a.lastra)) perLastra.set(a.lastra, []); perLastra.get(a.lastra).push(a); }
    this.blocchiVivi ??= new Map(); this.formeBlocco ??= new Map();
    for (const [, b] of this.blocchiVivi) b.visible = false;
    for (const [L, celle] of perLastra) {
      celle.sort((p, q) => p.id - q.id);
      const c0 = celle[0], co = Math.cos(c0.ry), si = Math.sin(c0.ry);
      let rigida = true;
      const off = celle.map((a) => {
        const wx = A.dx(a.x - c0.x), wz = A.dz(a.z - c0.z), dx = wx * co - wz * si, dz = wx * si + wz * co;
        const rx = Math.round(dx), rz = Math.round(dz);
        if (Math.abs(dx - rx) > 0.03 || Math.abs(dz - rz) > 0.03 || Math.abs(a.y - c0.y) > 0.01 || Math.abs(a.s - 1) > 0.01 || Math.abs(a.rx) > 0.01 || Math.abs(a.rz) > 0.01 || Math.abs(a.ry - c0.ry) > 0.01) rigida = false;
        return [rx, rz];
      });
      if (!rigida) continue;
      const chiave = L + '|' + (c0.colore || '') + '|' + off.map((o) => o.join(',')).join(';');
      let b = this.formeBlocco.get(chiave);
      if (!b) { b = this.cfg.blocco(off, c0.colore); this.formeBlocco.set(chiave, b); this.scene.add(b); }
      this.blocchiVivi.set(chiave, b);
      const [bx, bz] = this.vicino(c0.x, c0.z);
      b.visible = true; b.position.set(bx, c0.y, bz); b.rotation.set(0, c0.ry, 0);
      for (const a of celle) this.celle.get(a.id).visible = false;
    }
  }

  dimensioni(w, h) {
    // in verticale si allarga il campo, così la larghezza inquadrata resta quella dello schermo orizzontale
    const fov0 = this.cfg.camera?.fov ?? 30, a = w / h, rif = 1.25;
    this.camera.fov = a >= rif ? fov0 : (2 * Math.atan(Math.tan((fov0 * Math.PI) / 360) * (rif / a)) * 180) / Math.PI;
    this.camera.aspect = a; this.camera.updateProjectionMatrix(); this.post?.size(w, h); this.w = w; this.h = h; }

  rendi(dt) {
    const A = this.anim, T = A.tempo;
    this.copiaPose();
    // le ombre si ricalcolano solo quando qualcosa si è mosso: quasi tutta la scena è ferma
    let firma = A.mira.x * 19 + A.mira.z * 23;
    A.pers.forEach((c, i) => { firma += (c.x * 7 + c.y * 13 + c.z * 17 + c.ry + c.salto + (c.vis ? 1 : 0)) * (i + 1); });
    if (this.sole) {
      // a passi di un texel dell'ombra, se no i bordi delle ombre sfarfallano mentre la telecamera scorre
      const sc = this.sole.shadow.camera, tx = (sc.right - sc.left) / this.sole.shadow.mapSize.x;
      const mx = Math.round(A.mira.x / tx) * tx, mz = Math.round(A.mira.z / tx) * tx;
      this.sole.target.position.set(mx, 0, mz); this.sole.position.set(mx, 0, mz).add(this.soleScarto);
      this.sole.target.updateMatrixWorld();
    }
    for (const a of A.celle.values()) firma += (a.x * 3 + a.y * 5 + a.z * 11 + a.ry + a.rx + a.s) * (a.vis ? 1 : -1) * (a.id + 1);
    this.r.shadowMap.autoUpdate = false;
    if (firma !== this.firma) { this.r.shadowMap.needsUpdate = true; this.firma = firma; }
    this.fiamme.forEach((f, i) => { const s = 1 + Math.sin(T * 13 + i * 2.1) * 0.18 + Math.sin(T * 23 + i) * 0.08; f.scale.y = s; });
    // le nuvole profonde girano attorno a dove si guarda (nel mondo che si richiude, ovunque si vada)
    const giro = (v, c, n) => c + ((((v - c) % n) + n * 1.5) % n) - n / 2;
    this.profonde.forEach((n, i) => {
      n.position.x += dt * (0.12 + (i % 3) * 0.05);
      const cx = this.gioco.liv.toroide ? A.mira.x : this.centro.x, cz = this.gioco.liv.toroide ? A.mira.z : this.centro.z;
      n.position.x = giro(n.position.x, cx, 52); n.position.z = giro(n.position.z, cz, 36);
    });
    this.cfg.segue?.forEach?.((o) => o.position.set(A.mira.x, o.position.y, A.mira.z));
    this.apriCoperte(dt);
    this.muoviSipario(dt);
    this.cfg.ogniFotogramma?.(this, dt);
    const z = A.zoom, sx = (Math.random() - 0.5) * A.scossa, sy = (Math.random() - 0.5) * A.scossa;
    this.camera.position.set(A.mira.x + sx, this.cam.alto * z + sy, A.mira.z + this.cam.dietro * z);
    this.camera.lookAt(A.mira.x + sx, 0, A.mira.z + 0.3);
    if (this.post) this.post.render(this.scene, this.camera); else this.r.render(this.scene, this.camera);
  }

  dispose() {
    this.sipario?.fatto?.();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      const mm = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mm.forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    this.post?.dispose();
    this.cfg.dispose?.();
  }
}

/** Disegno di un glifo appoggiato su un piano: lo usano quasi tutti gli stili 3D. */
export function pianoGlifo(tex, lato = 0.8) {
  const o = new THREE.Group();
  const piano = new THREE.Mesh(new THREE.PlaneGeometry(lato, lato), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  piano.rotation.x = -Math.PI / 2; piano.renderOrder = 2; piano.userData.senzaBordo = true;
  o.add(piano); o.userData.piano = piano;
  return o;
}

/** Luce di base: emisfero + sole con ombre che coprono il quadro. */
export function luciBase(scene, centro, { cielo, terra, amb, sole, forza, dir = [-0.55, 1, 0.4], mappa = 2048 }) {
  scene.add(new THREE.HemisphereLight(cielo, terra, amb));
  const s = new THREE.DirectionalLight(sole, forza);
  s.position.set(centro.x + dir[0] * 20, dir[1] * 20, centro.z + dir[2] * 20);
  s.target.position.copy(centro);
  s.castShadow = true; s.shadow.mapSize.set(mappa, mappa);
  Object.assign(s.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  s.shadow.bias = -0.0004; s.shadow.normalBias = 0.02;
  scene.add(s, s.target);
  return s;
}

/**
 * Fonde le mesh ferme di un gruppo: una sola mesh per materiale (e per ombre/attributi uguali).
 * Da centinaia di chiamate di disegno a poche decine. Restano fuori le mesh con più materiali
 * e quelle segnate userData.mobile (o dentro un genitore mobile), che devono potersi animare.
 */
export const LATO_PEZZO = 12;
const TENUTI = ['position', 'normal', 'uv', 'color'];
export function fondi(radice, lato = 0) {
  radice.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(radice.matrixWorld).invert(), gruppi = new Map(), via = [], pos = new THREE.Vector3();
  radice.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.userData.mobile) return;
    for (let p = o.parent; p && p !== radice; p = p.parent) if (p.userData.mobile) return;
    const g = o.geometry, attr = TENUTI.filter((k) => g.attributes[k]);
    // con `lato` si fonde a pezzi di lato×lato caselle: così la telecamera scarta quelli fuori vista
    // (una mesh sola grande quanto il mondo si disegna sempre tutta)
    let pezzo = '';
    if (lato) { pos.setFromMatrixPosition(o.matrixWorld); pezzo = Math.floor(pos.x / lato) + ',' + Math.floor(pos.z / lato); }
    const chiave = pezzo + '|' + !!g.index + '|' + o.material.uuid + '|' + o.castShadow + o.receiveShadow + '|' + attr.join(',');
    if (!gruppi.has(chiave)) gruppi.set(chiave, { m: o.material, cs: o.castShadow, rs: o.receiveShadow, attr, pezzi: [] });
    gruppi.get(chiave).pezzi.push({ g, mat: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) }); via.push(o);
  });
  // togliere uno per uno (removeFromParent) cerca ogni volta nella lista dei figli: con 15 000 pezzi
  // erano quasi un secondo. Si filtra ogni genitore una volta sola.
  const tolti = new Set(via), genitori = new Set(via.map((o) => o.parent));
  for (const p of genitori) { p.children = p.children.filter((c) => !tolti.has(c)); }
  for (const o of via) o.parent = null;
  for (const gr of gruppi.values()) {
    const mesh = new THREE.Mesh(unisci(gr.pezzi, gr.attr), gr.m); mesh.castShadow = gr.cs; mesh.receiveShadow = gr.rs;
    radice.add(mesh);
  }
}

/**
 * Unisce geometrie applicando a ciascuna la sua matrice, scrivendo direttamente negli array finali.
 * Clonare ogni geometria e passarla a mergeGeometries costava 3,7 s su un overworld da 1600 caselle.
 * Le geometrie sono già raggruppate: tutte con indice o tutte senza, con gli stessi attributi.
 */
// i valori di un attributo come array semplice (x y z x y z ...), anche se interlacciato o normalizzato
const crudo = (A) => {
  if (!A.isInterleavedBufferAttribute && !A.normalized && A.array.length === A.count * A.itemSize) return A.array;
  const out = new Float32Array(A.count * A.itemSize);
  for (let i = 0; i < A.count; i++) for (let c = 0; c < A.itemSize; c++) out[i * A.itemSize + c] = A.getComponent(i, c);
  return out;
};
function unisci(pezzi, attr) {
  let nv = 0, ni = 0;
  for (const { g } of pezzi) { nv += g.attributes.position.count; if (g.index) ni += g.index.count; }
  const out = new THREE.BufferGeometry(), arr = {};
  for (const k of attr) arr[k] = new Float32Array(nv * pezzi[0].g.attributes[k].itemSize);
  const indice = ni ? new (nv > 65535 ? Uint32Array : Uint16Array)(ni) : null;
  const nm = new THREE.Matrix3();
  let v0 = 0, i0 = 0;
  for (const { g, mat } of pezzi) {
    const n = g.attributes.position.count, e = mat.elements, P = crudo(g.attributes.position);
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], j = (v0 + i) * 3, w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
      arr.position[j] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
      arr.position[j + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
      arr.position[j + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    }
    if (arr.normal) {
      const N = crudo(g.attributes.normal), f = nm.getNormalMatrix(mat).elements;
      for (let i = 0; i < n; i++) {
        const x = N[i * 3], y = N[i * 3 + 1], z = N[i * 3 + 2], j = (v0 + i) * 3;
        const a = f[0] * x + f[3] * y + f[6] * z, b = f[1] * x + f[4] * y + f[7] * z, c = f[2] * x + f[5] * y + f[8] * z, l = Math.hypot(a, b, c) || 1;
        arr.normal[j] = a / l; arr.normal[j + 1] = b / l; arr.normal[j + 2] = c / l;
      }
    }
    for (const k of ['uv', 'color']) {
      if (!arr[k]) continue;
      const A = g.attributes[k];
      arr[k].set(crudo(A), v0 * A.itemSize);
    }
    if (indice) { const I = g.index.array; for (let i = 0; i < I.length; i++) indice[i0 + i] = I[i] + v0; i0 += I.length; }
    v0 += n;
  }
  for (const k of attr) out.setAttribute(k, new THREE.BufferAttribute(arr[k], pezzi[0].g.attributes[k].itemSize));
  if (indice) out.setIndex(new THREE.BufferAttribute(indice, 1));
  return out;
}

/**
 * Una nuvola soffice disegnata su tela: venti sbuffi sfumati che si sovrappongono dentro un'ellisse
 * schiacciata in basso, poi un'ombra sotto e una luce sopra. Bianca: il colore lo dà il materiale.
 */
function texNuvola(rnd) {
  const W = 256, H = 160, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd());
    const cx = W / 2 + Math.cos(a) * rr * W * 0.3, cy = H * 0.55 + Math.sin(a) * rr * H * 0.2 - (1 - rr) * H * 0.08;
    const r = (0.16 + rnd() * 0.14) * W * (1.1 - rr * 0.4);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.72, 'rgba(255,255,255,0.95)'); g.addColorStop(0.88, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  }
  // ombra sotto e luce sopra, solo dove c'è già nuvola
  x.globalCompositeOperation = 'source-atop';
  const om = x.createLinearGradient(0, H * 0.25, 0, H);
  om.addColorStop(0, 'rgba(255,255,255,0)'); om.addColorStop(0.55, 'rgba(150,150,185,0.22)'); om.addColorStop(1, 'rgba(120,115,165,0.5)');
  x.fillStyle = om; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
