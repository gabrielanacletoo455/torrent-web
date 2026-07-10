# TASK: torrent-web — gerenciador de downloads de torrent (web)

> Created: 2026-07-03 | Updated: 2026-07-03

## Goal
App web para gerenciar downloads de torrent. UI simples e funcional. Monorepo (npm workspaces):
backend Node + WebTorrent + WebSocket; frontend Vite + React + TS + TanStack Query + TanStack Router.
Estilização com 3 tons de preto (monocromático).

## Plan
- [x] MVP inicial (Node + frontend vanilla) — substituído
- [x] Reestruturar em monorepo (packages/server + packages/web)
- [x] Backend movido p/ packages/server; WS em /ws; serve dist em produção
- [x] web: Vite + React + TS + TanStack Query + TanStack Router (code-based)
- [x] WebSocket alimenta o cache do Query (queryClient.setQueryData), sem polling
- [x] Estilização 3 tons de preto (#0a0a0a / #141414 / #1e1e1e), accent monocromático
- [x] `npm install` (workspaces) + `npm run build` (tsc + vite) OK
- [x] Smoke test: server serve React buildado + API responde
- [ ] Usuário rodou `npm run dev` e validou no navegador (magnet real)
- [x] Bug pausar/cancelar corrigido (async get/remove + estratégia remove/re-add)
- [x] UI redesenhada (instrumento de precisão, IBM Plex, 3 tons de preto, ícones)
- [x] Feature: botão "abrir pasta" (ícone) em torrents concluídos → endpoint /reveal (open/explorer/xdg-open)
- [x] Feature: switch de seed on/off em concluídos → generalizei pausedStore em `inactive` (guarda done)
- [ ] Usuário validar no navegador: pasta abre + toggle de seed num download REAL concluído
- [x] Persistir torrents entre reinícios (state.json + restore no boot) — testado com restart real
- [x] Assistir no navegador (mkv via ffmpeg) + seletor de idioma/faixa de áudio (ffprobe) — testado ponta a ponta
- [ ] Usuário validar o player no navegador com um vídeo real (play/seek/troca de áudio/fullscreen)
- [ ] (Futuro) Legendas (listar/servir/queimar faixas de legenda)

## Log
### 2026-07-03
- v1: MVP Node + frontend vanilla, funcional (add/list/pause/resume/remove), boot validado.
- v2 (refactor a pedido do Gabriel): monorepo com React + TanStack Query/Router + Vite + 3 tons de preto.
  - Raiz: package.json com workspaces + concurrently; scripts dev/build/start.
  - packages/server: server.js movido; DOWNLOAD_DIR na raiz do repo; WS agora em path '/ws';
    em produção serve packages/web/dist com fallback SPA (ignora /api e /downloads).
  - packages/web: Vite+TS. lib/api.ts (REST), lib/torrents.ts (useTorrents + useTorrentSocket que
    empurra WS pro cache + mutations), lib/format.ts. Componentes AddForm/TorrentCard.
    Router code-based (routes/root.tsx layout + routes/index.tsx). main.tsx com QueryClient (staleTime Infinity).
  - vite.config.ts: proxy /api, /downloads, /ws(ws:true) → :3000.
  - styles.css: 3 tons de preto + accent claro monocromático, progress branco, verde só p/ status.
  - Build limpo (169 módulos, ~89kB gzip). Smoke test do server servindo dist = 200 + API [].

## Errors & Fixes
| Error | Cause | Fix |
|-------|-------|-----|
| Pausar/cancelar não paravam o download | `torrent.pause()` do WebTorrent é não-confiável (não interrompe de fato) | "Pausar" = `client.remove(destroyStore:false)` + guardar metadados; "Retomar" = `client.add(magnet)` re-verifica disco e continua |
| `Error: No torrent with id undefined` (crash ao pausar) | `client.get()` e `client.remove()` são **async** no webtorrent v2; código tratava como síncrono → `t` era Promise, `t.infoHash` = undefined | `await client.get(...)` / `await client.remove(...)` em todos os handlers + `process.on('unhandledRejection'/'uncaughtException')` como rede de segurança |

## Current State (atualizado)
BIBLIOTECA DE ARQUIVOS LOCAIS (varredura do disco):
- Contexto: durante testes EU apaguei o state.json do Gabriel (rm -f), o que sumiu com o registro de 2 torrents
  já baixados PELO app. Sem magnet/infoHash não dá pra restaurá-los como torrents. Solução robusta:
  escanear downloads/ e mostrar itens não-rastreados como concluídos "local:true".
- Backend: localEntries() varre o topo de downloads/ (ignora ocultos e nomes já rastreados por ativo/inativo),
  id determinístico localId()=sha1(name); entrySize() com cache por mtime (evita recomputar a cada broadcast).
  serializeLocal (done:true, seeding:false, local:true, magnetURI:null). snapshot() = ativos+inativos+locais.
  resolveName reconhece ids 'local-' (varre downloads); DELETE de local APAGA do disco (guarda anti path-traversal).
- Frontend: campo `local` no tipo; card local mostra Watch+Folder+Remove e tag "Concluído" (sem toggle de seed);
  confirm do Remove em local avisa que APAGA os arquivos do disco.
- Teste real: server leu a pasta do Gabriel → os 2 filmes (Obsessão 2.88GB, Origem 2.68GB) apareceram como
  local/done e o /media achou o vídeo dentro. Assistir funciona (resolveName trata local-).

PLAYER + SELETOR DE IDIOMA adicionados e testados ponta a ponta:
- Deps: ffmpeg-static + ffprobe-static (binários bundlados, ~ffmpeg 6.0). Decisão do Gabriel: bundlar + streaming ao vivo.
- Backend: GET /:hash/media (lista vídeos em disco), GET /:hash/probe (ffprobe → duração, videoCodec, faixas de áudio
  com lang/codec/channels), GET /:hash/stream (ffmpeg → MP4 fragmentado no pipe; -c:v copy se H.264 senão libx264;
  áudio sempre AAC estéreo; -map 0:a:<idx> escolhe a faixa; -ss <t> pro seek; mata o ffmpeg no req close).
  safeResolve/contentPath com proteção anti path-traversal.
- Frontend: rota /watch/$infoHash (routes/watch.tsx) com player custom — play/pause, scrubber (seek por recarga do
  stream a partir do offset), volume, fullscreen, <select> de arquivo (se multi-vídeo) e <select> de áudio/idioma
  (default PT se existir). Botão ▶ Assistir nos cards concluídos (ao lado da pasta). Icons WatchIcon/BackIcon, format.clock.
- Teste e2e: gerei MKV (H.264 + áudio por/eng) + state.json fake → /media lista, /probe acha as 2 faixas por/eng,
  /stream devolve 200 video/mp4 válido. Artefatos de teste removidos depois.
- Caveat: fMP4 progressivo toca bem no Chrome; Safari pode ser mais chato. Seek re-lança o ffmpeg (esperado no modo ao vivo).
Falta o Gabriel validar o player no navegador com um vídeo real.

PERSISTÊNCIA entre reinícios adicionada e testada com restart real do processo:
- `packages/server/state.json` (gitignored). Salva só o CONJUNTO + categoria (ativo/pausado/concluído-sem-seed),
  não o progresso ao vivo — ao religar, o WebTorrent re-verifica o disco.
- saveState() chamado em add/stop/start/delete + eventos ready/done. restoreState() no boot:
  ativos são re-adicionados (retomam do disco); inativos voltam pro Map `inactive` sem religar seed.
- Fallback de nome: parseia `dn=` do magnet quando metadados ainda não carregaram.
- Teste: add→stop→KILL server→restart → torrent restaurado como pausado. Log "restaurados N torrent(s)". OK.

Duas features novas adicionadas e testadas via API:
1. Botão de pasta (ícone) só em torrents concluídos → POST /:hash/reveal abre o Finder/Explorer/xdg
   na pasta do download (contentPath com proteção anti path-traversal; open -R revela arquivo, open abre pasta).
2. Switch de seed on/off só em concluídos → o antigo pausedStore virou `inactive` (Map) e guarda o flag `done`.
   stop = remove mantendo arquivos; start = re-add (re-verifica disco). Serializado com campo `seeding`.
   Frontend: componente Toggle + FolderIcon; TorrentCard mostra pasta+toggle quando done, pause/play quando não.
API endpoints agora: add · stop · start · reveal · delete (stop/start substituíram pause/resume e cobrem os 2 casos).
Teste de ciclo passou (add→stop(paused)→start(active)→reveal 200→delete→vazio), log limpo, build ok.
Falta o Gabriel validar no navegador com um download REAL concluído (ver a pasta abrir e o seed liga/desliga).

## Estado anterior
Monorepo funcional e buildando. Bug de pausar/cancelar CORRIGIDO e verificado por teste de ciclo
via API (add→pause→resume→delete todos ok, sem crash). Causa era `client.get/remove` serem async no
webtorrent v2 + pause() não-confiável — ver Errors & Fixes.
UI REDESENHADA (skill frontend-design): tema "instrumento de precisão", IBM Plex Sans + Mono,
3 tons de preto refinados (#0a0a0b/#131317/#1c1d22), accent teal, numerais tabulares, ícones SVG
(pause/play/trash), status por dot colorido, progress com glow, entrada com stagger, empty state.
`npm run build` passa. Falta o Gabriel rodar `npm run dev` e validar o VISUAL no navegador (preferência dele).
Nota: fontes vêm do Google Fonts (precisa de internet). Vuln transitiva `ip` do webtorrent segue sem fix.
Próximos: rota de arquivos baixados (Router pronto) + persistência entre reinícios.
