// I glifi come disegni senza parole: frecce a gradini (una, due, tre punte; con la barra = fino in fondo),
// archi che dicono quanto si gira, un asse con due punte che si guardano.
import * as THREE from 'three';

export function coloreGlifo(g, pal, famiglia = false) {
  if (g.fantasma && !famiglia) return pal.fantasma;
  if (g.tipo === 'T') return g.d[0] && g.d[1] ? pal.D : pal.T;
  return pal[g.tipo];
}
// mescola due colori #rrggbb: k = 0 tutto a, 1 tutto b
const mescola = (a, b, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');

export function texGlifo(g, pal, k = 1) {
  // k > 1 ingrossa i tratti: serve quando il glifo verrà ridotto a pochi pixel
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d');
  const col = coloreGlifo(g, pal);
  x.translate(S / 2, S / 2);
  x.scale(S / 128, S / 128);
  x.lineCap = 'round'; x.lineJoin = 'round';

  // disco
  const pieno = pal.pieno && !g.fantasma; // disco del colore della famiglia, segno bianco, orlo d'inchiostro
  // Spento (si accende col talismano): disco pieno e opaco ma color pietra, appena tinto della sua
  // famiglia, segno inciso scuro, orlo d'inchiostro tratteggiato. Prima era quasi trasparente e
  // tutti i giudici lo trovavano troppo tenue: deve leggersi "c'è, ma non va ancora".
  const spento = pal.pieno && g.fantasma;
  const pietra = spento ? mescola(coloreGlifo(g, pal, true), '#c4c7ca', 0.7) : null;
  x.beginPath(); x.arc(0, 0, 56, 0, Math.PI * 2);
  x.fillStyle = pieno ? col : spento ? pietra : pal.fondo + (g.fantasma ? '40' : 'e6'); x.fill();
  x.lineWidth = (pieno || spento ? 7 : 5) * k; x.strokeStyle = pieno || spento ? pal.bordo : col;
  if (g.fantasma) x.setLineDash(spento ? [14, 9] : [8, 7]);
  x.stroke(); x.setLineDash([]);

  const segno = pieno ? '#ffffff' : spento ? '#4a4248' : col; // spento: segno inciso scuro sulla pietra chiara
  x.strokeStyle = segno; x.fillStyle = segno; x.lineWidth = 9 * k; x.k = k;
  if (g.tipo === 'T') freccia(x, g);
  else if (g.tipo === 'R') arco(x, g.giro);
  else if (g.tipo === 'M') asse(x, g.asse);

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function punta(x, cx, cy, ang, l = 16) {
  l *= x.k || 1;
  x.save(); x.translate(cx, cy); x.rotate(ang);
  x.beginPath(); x.moveTo(l * 0.55, 0); x.lineTo(-l * 0.5, -l * 0.7); x.lineTo(-l * 0.5, l * 0.7); x.closePath(); x.fill();
  x.restore();
}

function freccia(x, g) {
  x.save();
  x.rotate(Math.atan2(g.d[1], g.d[0]));
  if (g.d[0] && g.d[1]) x.scale(0.92, 0.92);
  if (g.n === 0) {
    // fino in fondo: freccia lunga che sbatte contro una barra
    x.beginPath(); x.moveTo(-36, 0); x.lineTo(18, 0); x.stroke();
    punta(x, 22, 0, 0, 22);
    x.lineWidth = 8 * (x.k || 1); x.beginPath(); x.moveTo(38, -24); x.lineTo(38, 24); x.stroke();
  } else {
    // n punte una dietro l'altra
    const passo = 22, w = (g.n - 1) * passo;
    for (let i = 0; i < g.n; i++) {
      const cx = -w / 2 + i * passo + 4;
      x.beginPath(); x.moveTo(cx - 12, -20); x.lineTo(cx + 8, 0); x.lineTo(cx - 12, 20); x.stroke();
    }
  }
  x.restore();
}

function arco(x, giro) {
  const r = 30, amp = (Math.abs(giro) * Math.PI) / 180, s = Math.sign(giro);
  const a0 = giro === 180 ? Math.PI : -Math.PI / 2 - (s * amp) / 2;
  const a1 = a0 + s * amp;
  x.beginPath(); x.arc(0, 0, r, a0, a1 - s * 0.32, s < 0); x.stroke();
  punta(x, Math.cos(a1) * r, Math.sin(a1) * r, a1 + (s * Math.PI) / 2, 22);
  x.beginPath(); x.arc(0, 0, 7, 0, Math.PI * 2); x.fill(); // il perno
}

function asse(x, a) {
  x.save();
  x.rotate({ '|': 0, '-': Math.PI / 2, '/': Math.PI / 4, '\\': -Math.PI / 4 }[a]);
  x.lineWidth = 5 * (x.k || 1); x.setLineDash([9, 7]);
  x.beginPath(); x.moveTo(0, -44); x.lineTo(0, 44); x.stroke(); x.setLineDash([]);
  punta(x, -20, 0, 0, 24); punta(x, 20, 0, Math.PI, 24);
  x.restore();
}
