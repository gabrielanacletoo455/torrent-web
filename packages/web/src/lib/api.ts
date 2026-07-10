import type { Torrent, MediaFile, ProbeResult } from '../types';

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  return res.json();
}

export const api = {
  list: (): Promise<Torrent[]> => fetch('/api/torrents').then(handle),

  addMagnet: (magnet: string) =>
    fetch('/api/torrents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ magnet }),
    }).then(handle),

  addFile: (file: File) => {
    const fd = new FormData();
    fd.append('torrentFile', file);
    return fetch('/api/torrents', { method: 'POST', body: fd }).then(handle);
  },

  // stop = pausar download OU parar seed (mantém arquivos); start = retomar/religar seed
  stop: (infoHash: string) =>
    fetch(`/api/torrents/${infoHash}/stop`, { method: 'POST' }).then(handle),

  start: (infoHash: string) =>
    fetch(`/api/torrents/${infoHash}/start`, { method: 'POST' }).then(handle),

  reveal: (infoHash: string) =>
    fetch(`/api/torrents/${infoHash}/reveal`, { method: 'POST' }).then(handle),

  remove: (infoHash: string) =>
    fetch(`/api/torrents/${infoHash}`, { method: 'DELETE' }).then(handle),

  // --- mídia ---
  media: (infoHash: string): Promise<MediaFile[]> =>
    fetch(`/api/torrents/${infoHash}/media`).then(handle),

  probe: (infoHash: string, relPath: string): Promise<ProbeResult> =>
    fetch(`/api/torrents/${infoHash}/probe?file=${encodeURIComponent(relPath)}`).then(handle),

  streamUrl: (
    infoHash: string,
    opts: { file: string; audio: number; t: number; vcopy: boolean },
  ): string => {
    const q = new URLSearchParams({
      file: opts.file,
      audio: String(opts.audio),
      t: String(opts.t),
      vcopy: opts.vcopy ? '1' : '0',
    });
    return `/api/torrents/${infoHash}/stream?${q.toString()}`;
  },
};
