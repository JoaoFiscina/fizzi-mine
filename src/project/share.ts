// Link para compartilhar: o projeto inteiro vai comprimido dentro do link (#p=...).
// Nada é enviado para servidor nenhum: quem abre o link descomprime no próprio navegador.

import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** JSON do projeto → código curto para o link. */
export function encodeProject(projectJson: string): string {
  const compact = JSON.stringify(JSON.parse(projectJson));
  return toBase64Url(deflateSync(strToU8(compact), { level: 9 }));
}

/** Código do link → JSON do projeto (ou undefined se estiver corrompido). */
export function decodeProject(code: string): string | undefined {
  try {
    return strFromU8(inflateSync(fromBase64Url(code)));
  } catch {
    return undefined;
  }
}

export function shareUrl(code: string): string {
  return `${location.origin}${location.pathname}#p=${code}`;
}

/** Lê o projeto do link atual, se houver (#p=...). */
export function projectFromHash(): string | undefined {
  const m = location.hash.match(/^#p=([A-Za-z0-9_-]+)$/);
  return m ? decodeProject(m[1]) : undefined;
}
