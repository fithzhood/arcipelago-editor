// Provare un livello dall'editor del telefono: lo stesso motore e lo stesso pittore del gioco, su
// una tela a tutto schermo. Si muove scorrendo il dito (o con le frecce); Annulla, Ricomincia,
// Chiudi. Nei sottolivelli dice quando è risolto e in quante mosse; nell'overworld, salendo su un
// sigillo, dice quale sottolivello si aprirebbe (qui non ci si entra).
import * as THREE from 'three';
import { caricaLivello, Gioco } from './logica.js';
import { Animatore } from './animatore.js';
import { STILI } from './stili.js';

export async function apriProva(def, box, { suChiudi } = {}) {
  box.innerHTML = `<div class="prova-scena"></div>
    <div class="prova-avviso" hidden></div>
    <div class="prova-comandi"><button data-a="annulla">Annulla</button><button data-a="ricomincia">Ricomincia</button><button data-a="chiudi">Torna all'editor</button></div>`;
  box.hidden = false;
  const scena = box.querySelector('.prova-scena'), avviso = box.querySelector('.prova-avviso');
  const dici = (t) => { avviso.textContent = t; avviso.hidden = !t; };
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  scena.appendChild(renderer.domElement);
  const gioco = new Gioco(caricaLivello(def));
  let mosse = 0, attesa = null;
  const anim = new Animatore(gioco, {
    suCaduta: () => dici('Il coniglio è caduto. Annulla per tornare indietro.'),
    suFine: () => { if (attesa) { const a = attesa; attesa = null; esegui(a); } },
    suEntra: (s) => { anim.interrompi(); dici(`Qui si entra nel sigillo «${s.livello}»${s.facoltativo ? ' (facoltativo)' : ''}.`); },
    suVince: () => { anim.trattieni = false; dici(`Risolto in ${mosse} mosse.`); },
  });
  const mod = await STILI[0].carica();
  const pittore = mod.crea(renderer, gioco, anim, { zona: def.zona || 'iniziale' });
  const misura = () => { const w = scena.clientWidth, h = scena.clientHeight; renderer.setSize(w, h); pittore.dimensioni(w, h); };
  misura();
  // sul telefono in verticale un sottolivello largo non ci sta: si parte più lontani (poi le due dita)
  // (misurato: a zoom z si vedono circa 15·a·z caselle di larghezza, con a = larghezza/altezza);
  // e la telecamera resta al centro del quadro invece di seguire il coniglio, che stava sempre a sinistra
  if (!gioco.liv.toroide) {
    const L = gioco.liv, a = scena.clientWidth / Math.max(1, scena.clientHeight), cx = L.W / 2 - 0.5, cz = L.H / 2 - 0.5;
    anim.zoom = Math.min(2.4, Math.max(1.45, (L.W + 1.5) / (15 * a)));
    anim.miraPer = () => ({ x: cx, z: cz }); anim.sincronizza(true);
  }
  let prima = performance.now();
  renderer.setAnimationLoop((ora) => { const dt = Math.min(0.05, (ora - prima) / 1000); prima = ora; anim.aggiorna(dt); pittore.rendi(dt); });

  function esegui(m) {
    if (anim.occupato) { attesa = m; return; }
    const ev = gioco.muovi(...m);
    if (ev.length && ev[0].tipo !== 'urto' && ev[0].tipo !== 'entra') { mosse++; if (!gioco.stato.vinto) dici(''); }
    anim.riproduci(ev);
  }
  const annulla = () => { attesa = null; anim.interrompi(); if (gioco.annulla()) mosse = Math.max(0, mosse - 1); anim.sincronizza(); dici(gioco.stato.caduto ? 'Il coniglio è caduto. Annulla per tornare indietro.' : ''); };
  const ricomincia = () => { attesa = null; anim.interrompi(); gioco.ricomincia(); mosse = 0; anim.sincronizza(); dici(''); };
  // un dito che scorre = un passo; due dita = zoom
  const dita = new Map(); let inizio = null, pizzico = null;
  const distanza = () => { const [a, b] = [...dita.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  scena.style.touchAction = 'none';
  scena.addEventListener('pointerdown', (e) => {
    dita.set(e.pointerId, [e.clientX, e.clientY]);
    if (dita.size === 1) inizio = [e.clientX, e.clientY];
    if (dita.size === 2) { inizio = null; pizzico = { d: distanza(), zoom: anim.zoom }; }
  });
  scena.addEventListener('pointermove', (e) => {
    if (!dita.has(e.pointerId)) return;
    dita.set(e.pointerId, [e.clientX, e.clientY]);
    if (pizzico && dita.size === 2) anim.zoom = Math.min(2.2, Math.max(0.6, pizzico.zoom * (pizzico.d / Math.max(10, distanza()))));
  });
  const fine = (e) => {
    dita.delete(e.pointerId); if (dita.size < 2) pizzico = null;
    if (!inizio || e.type !== 'pointerup') { if (!dita.size) inizio = null; return; }
    const dx = e.clientX - inizio[0], dy = e.clientY - inizio[1]; inizio = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    esegui(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
  };
  scena.addEventListener('pointerup', fine); scena.addEventListener('pointercancel', fine);
  const DIR = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  const tasti = (e) => { if (DIR[e.key]) { e.preventDefault(); esegui(DIR[e.key]); } else if (e.key === 'z') annulla(); else if (e.key === 'r') ricomincia(); else if (e.key === 'Escape') chiudi(); };
  addEventListener('keydown', tasti);
  addEventListener('resize', misura);
  function chiudi() {
    renderer.setAnimationLoop(null);
    removeEventListener('keydown', tasti); removeEventListener('resize', misura);
    pittore.dispose(); renderer.dispose(); renderer.domElement.remove();
    box.hidden = true; box.innerHTML = '';
    suChiudi?.();
  }
  box.querySelector('.prova-comandi').onclick = (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'annulla') annulla(); else if (a === 'ricomincia') ricomincia(); else if (a === 'chiudi') chiudi();
  };
  return { chiudi, gioco };
}
