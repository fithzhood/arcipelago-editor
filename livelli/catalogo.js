// Il catalogo delle tessere di Tiled: l'ordine qui è l'ordine delle tessere nel tileset
// (livelli/arcipelago.png e .tsx). Lo usano il generatore del tileset (strumenti/tileset.html)
// e il caricatore delle mappe (tiled.js). Aggiungere tessere SOLO in fondo: spostarle cambia il
// significato delle mappe già disegnate.
//
// Strati della mappa in Tiled:
//   terreno  isole, cespugli, alberi, scogli, pilastri, fuoco (vuoto = cielo)
//   lastre   una tessera per casella, il colore dice la lastra (caselle vicine dello stesso colore
//            sono una lastra sola, come vuole la regola della fusione)
//   glifi    i glifi, spenti compresi
//   segni    partenza del coniglio e del gatto, posti delle scenografie
//   tratti   (strato di oggetti) rettangoli con un nome: le parti del mondo che si scoprono
//            arrivando e che il reset rimette a posto
//   sigilli  (strato di oggetti) un rettangolo di una casella per sigillo; il nome è il file del
//            sottolivello (livelli/sottolivelli/<nome>.json), la proprietà bool `facoltativo` dice
//            se si può lasciare indietro

export const LATO = 64; // pixel di una tessera nel tileset

const DIREZIONI = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
export const COLORI_LASTRE = { grigio: '#c2ccd8', sabbia: '#ddb59a', rosa: '#e6c9d6', salvia: '#cfd8b8' };

export const CATALOGO = [];
const metti = (t) => CATALOGO.push(t);
// terreno
metti({ strato: 'terreno', c: '#', nome: 'isola' });
metti({ strato: 'terreno', c: 'b', nome: 'cespuglio' });
metti({ strato: 'terreno', c: 't', nome: 'albero' });
metti({ strato: 'terreno', c: 'o', nome: 'scoglio' });
metti({ strato: 'terreno', c: 'p', nome: 'pilastro' });
metti({ strato: 'terreno', c: 'f', nome: 'fuoco' });
// lastre
for (const [nome, colore] of Object.entries(COLORI_LASTRE)) metti({ strato: 'lastre', nome: 'lastra ' + nome, colore });
// glifi accesi e spenti
for (const fantasma of [false, true]) {
  const s = fantasma ? ' spento' : '';
  for (const d of DIREZIONI) for (const n of [0, 1, 2, 3]) metti({ strato: 'glifi', nome: `T ${d.join(',')} ${n || 'fondo'}${s}`, glifo: { tipo: 'T', d, n, ...(fantasma && { fantasma }) } });
  for (const giro of [90, -90, 180]) metti({ strato: 'glifi', nome: `R ${giro}${s}`, glifo: { tipo: 'R', giro, ...(fantasma && { fantasma }) } });
  for (const asse of ['|', '-', '\\', '/']) metti({ strato: 'glifi', nome: `M ${asse}${s}`, glifo: { tipo: 'M', asse, ...(fantasma && { fantasma }) } });
}
// segni
for (const nome of ['coniglio', 'gatto', 'casa', 'arco']) metti({ strato: 'segni', nome, segno: nome });
// la meta (l'uscita) di un sottolivello: la pietra gemella del sigillo, accesa quando ogni zona tratteggiata è riempita
metti({ strato: 'segni', nome: 'meta', segno: 'meta' });
// una casella della zona tratteggiata (come in Opera): una lastra deve riempirla tutta, esattamente
metti({ strato: 'segni', nome: 'sagoma', segno: 'sagoma' });

export const COLONNE = 10;
