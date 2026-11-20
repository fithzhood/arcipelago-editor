// Il canale cifrato fra il telefono e il PC per la banca dei livelli: lo stesso sistema di Spola,
// con un codice suo. Gira identico nel browser (editor da telefono) e in node (strumenti/canale.mjs).
//   - Il codice: 15 byte casuali, scritti in base32 senza I L O U (24 caratteri). Da lì nascono sia il
//     nome del canale su ntfy.sh sia la chiave AES-GCM: chi ha il codice ha tutto, il server vede solo
//     byte cifrati e non sa nemmeno che sono livelli.
//   - Un livello viaggia compresso (gzip): un sottolivello sta in un messaggio normale; se il messaggio
//     supera i 3200 caratteri (l'overworld) va come allegato cifrato.
//   - Limiti di ntfy.sh: i messaggi restano 12 ore, gli allegati 3. La banca vera sta sul PC.
const SERVER = 'https://ntfy.sh';
const MAX_CORPO = 3200;
const enc = new TextEncoder(), dec = new TextDecoder();

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function b32enc(bytes) {
  let bit = 0, val = 0, out = '';
  for (const b of bytes) { val = (val << 8) | b; bit += 8; while (bit >= 5) { out += B32[(val >>> (bit - 5)) & 31]; bit -= 5; } }
  if (bit > 0) out += B32[(val << (5 - bit)) & 31];
  return out;
}
function b32dec(str) {
  const pul = String(str).toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  let bit = 0, val = 0; const out = [];
  for (const c of pul) { const i = B32.indexOf(c); if (i < 0) return null; val = (val << 5) | i; bit += 5; if (bit >= 8) { out.push((val >>> (bit - 8)) & 255); bit -= 8; } }
  return new Uint8Array(out);
}
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (s) => { const t = String(s).replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(t + '==='.slice((t.length + 3) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
const unisci = (a, b) => { const u = new Uint8Array(a.length + b.length); u.set(a); u.set(b, a.length); return u; };
const flusso = async (bytes, trasforma) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(trasforma)).arrayBuffer());
const comprimi = (bytes) => flusso(bytes, new CompressionStream('gzip'));
const decomprimi = (bytes) => flusso(bytes, new DecompressionStream('gzip'));

/** Un codice nuovo (24 caratteri leggibili, a gruppi di 4). */
export const nuovoCodice = () => b32enc(crypto.getRandomValues(new Uint8Array(15))).replace(/(.{4})/g, '$1 ').trim();
/** Il codice è valido? (15 byte una volta decodificato) */
export const codiceValido = (c) => b32dec(c)?.length === 15;

export async function apriCanale(codice, { da = 'telefono' } = {}) {
  const seme = b32dec(codice);
  if (!seme || seme.length !== 15) throw new Error('Il codice del collegamento non è valido.');
  const t = new Uint8Array(await crypto.subtle.digest('SHA-256', unisci(seme, enc.encode('arcipelago-banca/canale/v1'))));
  const k = await crypto.subtle.digest('SHA-256', unisci(seme, enc.encode('arcipelago-banca/chiave/v1')));
  const canale = 'arcbanca-' + b32enc(t.slice(0, 13)).toLowerCase();
  const chiave = await crypto.subtle.importKey('raw', k, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const sigilla = async (bytes) => { const iv = crypto.getRandomValues(new Uint8Array(12)); return unisci(iv, new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chiave, bytes))); };
  const apri = async (bytes) => new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, chiave, bytes.slice(12)));
  const prova = async (fn, tentativi = 3) => {
    for (let i = 0; ; i++) {
      try { return await fn(); } catch (err) { if (i + 1 >= tentativi) throw err; await new Promise((r) => setTimeout(r, 1200 * (i + 1))); }
    }
  };

  return {
    canale,
    /**
     * Manda un livello: { nome, titolo, aggiornato, origine?, mappa }. Prima si pubblica, con tre
     * tentativi; se non riesce, lancia l'errore (chi chiama lo tiene da mandare più tardi).
     */
    async mandaLivello(l) {
      const meta = { v: 1, tipo: 'livello', da, nome: l.nome, titolo: l.titolo, aggiornato: l.aggiornato, origine: l.origine || '' };
      const z = await comprimi(enc.encode(JSON.stringify(l.mappa)));
      const corpo = b64(await sigilla(enc.encode(JSON.stringify({ ...meta, z: b64(z) }))));
      await prova(async () => {
        let r;
        if (corpo.length <= MAX_CORPO) r = await fetch(`${SERVER}/${canale}`, { method: 'POST', body: corpo });
        else r = await fetch(`${SERVER}/${canale}`, { method: 'PUT', headers: { Filename: 'l.bin', 'X-Message': b64(await sigilla(enc.encode(JSON.stringify(meta)))) }, body: await sigilla(z) });
        if (!r.ok) throw new Error('Il canale non risponde (ntfy ' + r.status + ').');
      });
    },
    /**
     * I livelli arrivati nelle ultime 12 ore (o da `since`, un id o un tempo come "12h"), in ordine di
     * arrivo. Ognuno: { id, tempo, nome, titolo, aggiornato, origine, da, mappa } oppure, per un
     * allegato ormai scaduto, { ..., scaduto: true } senza mappa.
     */
    async leggi({ since = '12h' } = {}) {
      let r;
      try { r = await fetch(`${SERVER}/${canale}/json?poll=1&since=${encodeURIComponent(since)}`, { cache: 'no-store' }); }
      catch { throw new Error('Connessione non disponibile.'); }
      if (!r.ok) throw new Error('Il canale non risponde (ntfy ' + r.status + ').');
      const out = [];
      for (const riga of (await r.text()).split('\n')) {
        let m; try { m = JSON.parse(riga); } catch { continue; }
        if (m.event !== 'message' || !m.message) continue;
        let meta; try { meta = JSON.parse(dec.decode(await apri(unb64(m.message)))); } catch { continue; } // non è nostro
        if (meta.tipo !== 'livello') continue;
        const el = { id: m.id, tempo: m.time * 1000, nome: meta.nome, titolo: meta.titolo, aggiornato: meta.aggiornato, origine: meta.origine, da: meta.da };
        try {
          let z = meta.z ? unb64(meta.z) : null;
          if (!z && m.attachment?.url) {
            if (m.attachment.expires * 1000 < Date.now()) { out.push({ ...el, scaduto: true }); continue; }
            const a = await fetch(m.attachment.url);
            if (!a.ok) { out.push({ ...el, scaduto: true }); continue; }
            z = await apri(new Uint8Array(await a.arrayBuffer()));
          }
          if (!z) continue;
          el.mappa = JSON.parse(dec.decode(await decomprimi(z)));
          out.push(el);
        } catch { out.push({ ...el, scaduto: true }); }
      }
      return out;
    },
  };
}
