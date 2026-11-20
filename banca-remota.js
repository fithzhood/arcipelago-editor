// La banca dei livelli vista dal telefono: il repo privato fithzhood/arcipelago-banca, letto e
// scritto con l'API di GitHub e una chiave (fine-grained token) valida solo per quel repo, che Luca
// incolla una volta nell'app. Ogni livello è livelli/<nome>.json (JSON di Tiled).
// Sul server di sviluppo del PC c'è anche una banca locale (livelli/_banca-locale/), solo per
// collaudare l'app senza chiave.
const REPO = 'fithzhood/arcipelago-banca';
const API = `https://api.github.com/repos/${REPO}`;

// base64 <-> testo UTF-8 (i titoli hanno accenti e apostrofi)
const aBase64 = (testo) => {
  const b = new TextEncoder().encode(testo); let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const daBase64 = (c) => new TextDecoder().decode(Uint8Array.from(atob(c.replace(/\s/g, '')), (ch) => ch.charCodeAt(0)));
const prop = (m, n) => m.properties?.find((p) => p.name === n)?.value;
const riassunto = (nome, m, sha) => ({ nome, sha, titolo: prop(m, 'titolo') || nome, aggiornato: prop(m, 'aggiornato') || '', origine: prop(m, 'origine') || '', mondo: !!prop(m, 'toroide') });

export function bancaGitHub(chiave) {
  const h = { Authorization: 'Bearer ' + chiave, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const chiedi = async (url, opz = {}) => {
    let r;
    try { r = await fetch(url, { ...opz, headers: { ...h, ...(opz.headers || {}) }, cache: 'no-store' }); }
    catch { throw new Error('Connessione non disponibile.'); }
    if (r.status === 401) throw new Error('La chiave non è valida o è scaduta.');
    if (r.status === 403) throw new Error('La chiave non ha il permesso di leggere e scrivere i contenuti della banca.');
    return r;
  };
  // i titoli si leggono dentro i file: si tengono in memoria per sha, così si scarica solo ciò che è cambiato
  const CACHE = 'arc-editor-titoli';
  const cache = () => { try { return JSON.parse(localStorage.getItem(CACHE) || '{}'); } catch { return {}; } };
  return {
    tipo: 'github',
    async prova() {
      const r = await chiedi(API);
      if (r.status === 404) throw new Error('La chiave non vede la banca: va creata per il repo arcipelago-banca.');
      if (!r.ok) throw new Error('GitHub risponde ' + r.status + '.');
      return true;
    },
    async elenco() {
      const r = await chiedi(API + '/contents/livelli');
      if (r.status === 404) return [];
      if (!r.ok) throw new Error('GitHub risponde ' + r.status + '.');
      const file = (await r.json()).filter((f) => f.name.endsWith('.json'));
      const c = cache(), nuova = {};
      const out = await Promise.all(file.map(async (f) => {
        const nome = f.name.slice(0, -5);
        if (c[f.sha]) { nuova[f.sha] = c[f.sha]; return { ...c[f.sha], nome, sha: f.sha }; }
        const { mappa } = await this.leggi(nome);
        const q = riassunto(nome, mappa, f.sha); nuova[f.sha] = q;
        return q;
      }));
      try { localStorage.setItem(CACHE, JSON.stringify(nuova)); } catch { /* niente */ }
      return out;
    },
    async leggi(nome) {
      const r = await chiedi(`${API}/contents/livelli/${encodeURIComponent(nome)}.json`);
      if (!r.ok) throw new Error(`Il livello ${nome} non si legge (GitHub risponde ${r.status}).`);
      const j = await r.json();
      // oltre 1 MB l'API non manda il contenuto: si chiede il file grezzo
      const testo = j.content ? daBase64(j.content) : await (await chiedi(j.git_url, { headers: { Accept: 'application/vnd.github.raw+json' } })).text();
      return { mappa: JSON.parse(testo), sha: j.sha };
    },
    async scrivi(nome, mappa, sha) {
      const corpo = { message: `Livello «${prop(mappa, 'titolo') || nome}» dal telefono`, content: aBase64(JSON.stringify(mappa)) };
      if (sha) corpo.sha = sha;
      const r = await chiedi(`${API}/contents/livelli/${encodeURIComponent(nome)}.json`, { method: 'PUT', body: JSON.stringify(corpo) });
      if (r.status === 409 || r.status === 422) throw new Error('Il livello è stato cambiato da un\'altra parte nel frattempo: ricarica l\'elenco e riprova.');
      if (!r.ok) throw new Error('Salvataggio non riuscito: GitHub risponde ' + r.status + '.');
      return (await r.json()).content.sha;
    },
  };
}

/** Solo sul server di sviluppo: la stessa banca in una cartella del PC, per collaudare senza chiave. */
export function bancaLocale() {
  const DIR = 'livelli/_banca-locale/';
  return {
    tipo: 'locale',
    async prova() { return true; },
    async elenco() {
      const r = await fetch(DIR + '?t=' + Date.now());
      if (!r.ok) return [];
      const nomi = [...(await r.text()).matchAll(/href="([^"]+)\.json"/g)].map((m) => decodeURIComponent(m[1]));
      return Promise.all(nomi.map(async (nome) => riassunto(nome, (await this.leggi(nome)).mappa, null)));
    },
    async leggi(nome) {
      const r = await fetch(DIR + encodeURIComponent(nome) + '.json?t=' + Date.now());
      if (!r.ok) throw new Error('Il livello ' + nome + ' non si legge.');
      return { mappa: await r.json(), sha: null };
    },
    async scrivi(nome, mappa) {
      const r = await fetch('/salva?f=' + encodeURIComponent(DIR + nome + '.json'), { method: 'POST', body: JSON.stringify(mappa) });
      if (!r.ok) throw new Error('Salvataggio non riuscito.');
      return null;
    },
  };
}
