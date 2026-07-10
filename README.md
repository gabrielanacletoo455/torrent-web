# torrent-web

Gerenciador de downloads de torrent com UI web. Monorepo:

- **`packages/server`** — Node + [WebTorrent](https://webtorrent.io) (cliente BitTorrent puro JS) + Express + WebSocket (progresso ao vivo).
- **`packages/web`** — Vite + React + TypeScript + [TanStack Query](https://tanstack.com/query) + [TanStack Router](https://tanstack.com/router).

## Rodar em desenvolvimento

```bash
cd /Users/anacleto/Documents/torrent-web
npm install          # instala os dois pacotes (workspaces)
npm run dev          # sobe server (:3000) e Vite (:5173) juntos
```

Abra **http://localhost:5173**. O Vite faz proxy de `/api`, `/downloads` e `/ws` pro backend.

## Rodar em produção

```bash
npm run build        # gera packages/web/dist
npm start            # server serve o dist + API em http://localhost:3000
```

## Scripts (raiz)

| Script          | O que faz                                              |
| --------------- | ------------------------------------------------------ |
| `npm run dev`   | server + web em paralelo (`concurrently`)              |
| `npm run build` | build de produção do frontend                          |
| `npm start`     | só o server (serve `dist` se existir)                  |

Porta do backend: `PORT=4000 npm start`.

## Funciona

- Adicionar torrent por **magnet** ou upload de **`.torrent`**.
- Lista com **progresso ao vivo** (%, ↓/↑, peers, ETA) — o WebSocket alimenta o cache do TanStack Query, sem polling.
- **Pausar / retomar / remover** cada torrent.
- Arquivos vão para `./downloads/` (raiz), servidos em `/downloads/…`.

## Arquitetura do frontend

- `lib/api.ts` — chamadas REST.
- `lib/torrents.ts` — `useTorrents` (query), `useTorrentSocket` (WS → `queryClient.setQueryData`), mutations.
- `routes/` — TanStack Router (root layout + index). Pronto pra adicionar a página de arquivos baixados.

## Próximos passos

- Página de arquivos baixados (nova rota).
- Persistir torrents entre reinícios (hoje o estado é só em memória).
- Limite de velocidade e seleção de arquivos dentro do torrent.
# torrent-web
