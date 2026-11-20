// Lo stile del gioco. Il 20/11/2026 Luca ha scelto la plastilina e abbandonato gli altri: i loro
// pittori, con l'ossatura 2D, le trame e le foto dei confronti, stanno in _archivio-stili/.
// Un pittore è un modulo con crea(...) che restituisce { dimensioni(w, h), rendi(dt), dispose() }.
export const STILI = [
  { id: 'plastilina', nome: 'Plastilina', tipo: '3d', carica: () => import('./pittori/plastilina.js') },
];
