import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Torrent, WsMessage } from '../types';

export const torrentsKey = ['torrents'] as const;

/** Query base — busca inicial via REST; o WebSocket mantém o cache atualizado. */
export function useTorrents() {
  return useQuery({ queryKey: torrentsKey, queryFn: api.list });
}

/**
 * Abre o WebSocket e empurra cada atualização direto no cache do Query.
 * Assim a lista fica reativa sem polling. Reconecta sozinho se cair.
 */
export function useTorrentSocket(): { connected: boolean } {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;

    function connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws`);

      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        const msg: WsMessage = JSON.parse(ev.data);
        if (msg.type === 'torrents') {
          qc.setQueryData<Torrent[]>(torrentsKey, msg.data);
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 2000);
      };
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, [qc]);

  return { connected };
}

export function useAddTorrent() {
  return useMutation({
    mutationFn: (input: { magnet?: string; file?: File }) =>
      input.file ? api.addFile(input.file) : api.addMagnet(input.magnet!.trim()),
    // Não precisa invalidar: o WebSocket já empurra o novo estado.
  });
}

export function useTorrentAction() {
  return useMutation({
    mutationFn: ({ infoHash, action }: { infoHash: string; action: 'start' | 'stop' | 'reveal' | 'remove' }) =>
      api[action](infoHash),
  });
}
