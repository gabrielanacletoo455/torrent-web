import express from 'express';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import WebTorrent from 'webtorrent';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const FFMPEG = ffmpegPath;
const FFPROBE = ffprobeStatic.path;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');
const DOWNLOAD_DIR = path.join(REPO_ROOT, 'downloads');
const WEB_DIST = path.join(REPO_ROOT, 'packages', 'web', 'dist');
const STATE_FILE = path.join(__dirname, 'state.json');
const PORT = process.env.PORT || 3000;

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

const client = new WebTorrent();
client.on('error', (err) => console.error('[webtorrent]', err.message));

// Rede de segurança: nunca deixar uma rejeição/erro solto derrubar o processo.
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err?.message || err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err?.message || err));

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());
app.use('/downloads', express.static(DOWNLOAD_DIR));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * Torrents "inativos" foram removidos do cliente WebTorrent mas continuam
 * rastreados aqui, para poder re-adicionar (o WebTorrent verifica o disco e
 * continua de onde parou). Cobre dois casos:
 *   - PAUSADO   (done:false) — download interrompido
 *   - CONCLUÍDO SEM SEED (done:true) — terminou e o usuário desligou o seed
 * "start" re-adiciona; "stop" remove mantendo os arquivos no disco.
 */
const inactive = new Map(); // infoHash -> { infoHash, name, magnetURI, length, downloaded, done }

function serializeActive(t) {
  return {
    infoHash: t.infoHash,
    name: t.name || 'Obtendo metadados…',
    magnetURI: t.magnetURI,
    progress: t.progress,
    downloaded: t.downloaded,
    uploaded: t.uploaded,
    length: t.length,
    downloadSpeed: t.downloadSpeed,
    uploadSpeed: t.uploadSpeed,
    numPeers: t.numPeers,
    timeRemaining: Number.isFinite(t.timeRemaining) ? t.timeRemaining : null,
    done: t.done,
    paused: false,
    seeding: t.done, // torrent concluído e ainda no cliente está semeando
    local: false,
    ready: t.ready,
    files: t.ready
      ? t.files.map((f) => ({ name: f.name, length: f.length, progress: f.progress, path: encodeURIComponent(f.path) }))
      : [],
  };
}

// Nome de exibição a partir do parâmetro dn= do magnet, quando os metadados
// ainda não carregaram (ex.: pausado logo após adicionar).
function magnetName(uri) {
  const m = /[?&]dn=([^&]+)/.exec(uri || '');
  return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
}

function serializeInactive(r) {
  return {
    infoHash: r.infoHash,
    name: r.name || magnetName(r.magnetURI) || (r.done ? 'Concluído' : 'Pausado'),
    magnetURI: r.magnetURI,
    progress: r.done ? 1 : r.length ? r.downloaded / r.length : 0,
    downloaded: r.done ? r.length : r.downloaded,
    uploaded: 0,
    length: r.length,
    downloadSpeed: 0,
    uploadSpeed: 0,
    numPeers: 0,
    timeRemaining: null,
    done: r.done,
    paused: !r.done, // inativo e incompleto = pausado
    seeding: false, // inativo nunca está semeando
    local: false,
    ready: true,
    files: [],
  };
}

function serializeLocal(e) {
  return {
    infoHash: e.id,
    name: e.name,
    magnetURI: null,
    progress: 1,
    downloaded: e.length,
    uploaded: 0,
    length: e.length,
    downloadSpeed: 0,
    uploadSpeed: 0,
    numPeers: 0,
    timeRemaining: null,
    done: true,
    paused: false,
    seeding: false,
    local: true, // veio da varredura do disco, não é um torrent rastreado
    ready: true,
    files: [],
  };
}

// Id estável e determinístico p/ um item de disco (não tem infoHash real).
function localId(name) {
  return 'local-' + createHash('sha1').update(name).digest('hex').slice(0, 16);
}

// Tamanho em disco (cache por mtime da pasta, senão recomputaria a cada broadcast).
const sizeCache = new Map();
function dirSize(dir) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    try {
      total += e.isDirectory() ? dirSize(full) : fs.statSync(full).size;
    } catch {
      /* ignora arquivo inacessível */
    }
  }
  return total;
}
function entrySize(full) {
  let st;
  try {
    st = fs.statSync(full);
  } catch {
    return 0;
  }
  if (st.isFile()) return st.size;
  const cached = sizeCache.get(full);
  if (cached && cached.mtimeMs === st.mtimeMs) return cached.size;
  const size = dirSize(full);
  sizeCache.set(full, { mtimeMs: st.mtimeMs, size });
  return size;
}

// Itens no disco que NÃO correspondem a nenhum torrent rastreado (ativo/inativo).
function localEntries() {
  const tracked = new Set(
    [...client.torrents.map((t) => t.name), ...[...inactive.values()].map((r) => r.name)].filter(Boolean),
  );
  let dirents;
  try {
    dirents = fs.readdirSync(DOWNLOAD_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of dirents) {
    if (e.name.startsWith('.')) continue; // .DS_Store, etc.
    if (tracked.has(e.name)) continue; // já aparece como torrent
    out.push({ id: localId(e.name), name: e.name, length: entrySize(path.join(DOWNLOAD_DIR, e.name)) });
  }
  return out;
}

function snapshot() {
  return [
    ...client.torrents.map(serializeActive),
    ...[...inactive.values()].map(serializeInactive),
    ...localEntries().map(serializeLocal),
  ];
}

function attach(torrent) {
  // 'ready' completa os metadados (nome/tamanho/magnetURI); 'done' muda p/ seed.
  torrent.on('ready', () => {
    saveState();
    broadcast();
  });
  torrent.on('done', () => {
    saveState();
    broadcast();
  });
  torrent.on('error', (err) => console.error('[torrent]', err.message));
}

// --- Persistência (state.json) ----------------------------------------
// Salvamos só o CONJUNTO de torrents + categoria, não o progresso ao vivo:
// ao religar, o WebTorrent re-verifica o disco e recalcula o progresso.

function persistedRecords() {
  const active = client.torrents.map((t) => ({
    infoHash: t.infoHash,
    magnetURI: t.magnetURI,
    name: t.name,
    length: t.length,
    downloaded: t.downloaded,
    done: t.done,
    active: true,
  }));
  const inact = [...inactive.values()].map((r) => ({ ...r, active: false }));
  return [...active, ...inact];
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(persistedRecords(), null, 2));
  } catch (err) {
    console.error('[state] falha ao salvar:', err.message);
  }
}

function restoreState() {
  if (!fs.existsSync(STATE_FILE)) return;
  let records;
  try {
    records = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (err) {
    console.error('[state] falha ao ler:', err.message);
    return;
  }
  let restored = 0;
  for (const r of records) {
    const id = r.magnetURI || r.infoHash;
    if (!id) continue;
    if (r.active) {
      // Estava no cliente (baixando ou semeando) → re-adiciona e retoma do disco.
      try {
        const t = client.add(id, { path: DOWNLOAD_DIR }, () => broadcast());
        attach(t);
        restored++;
      } catch (err) {
        console.error('[state] falha ao restaurar', r.name, '-', err.message);
      }
    } else {
      // Estava inativo (pausado ou concluído-sem-seed) → recoloca sem religar.
      inactive.set(r.infoHash, {
        infoHash: r.infoHash,
        name: r.name,
        magnetURI: r.magnetURI,
        length: r.length,
        downloaded: r.downloaded,
        done: r.done,
      });
      restored++;
    }
  }
  if (restored) console.log(`  [server] restaurados ${restored} torrent(s) de state.json`);
}

// Caminho do conteúdo baixado, sempre contido em DOWNLOAD_DIR (anti path traversal).
function contentPath(name) {
  const target = path.resolve(DOWNLOAD_DIR, name || '');
  if (!target.startsWith(path.resolve(DOWNLOAD_DIR))) return DOWNLOAD_DIR;
  return fs.existsSync(target) ? target : DOWNLOAD_DIR;
}

// Abre a pasta / revela o arquivo no gerenciador de arquivos do SO.
function revealInFileManager(target) {
  const isDir = fs.existsSync(target) && fs.statSync(target).isDirectory();
  if (process.platform === 'darwin') {
    execFile('open', isDir ? [target] : ['-R', target], () => {});
  } else if (process.platform === 'win32') {
    execFile('explorer', isDir ? [target] : [`/select,${target}`], () => {});
  } else {
    execFile('xdg-open', [isDir ? target : path.dirname(target)], () => {});
  }
}

// --- Mídia (assistir + faixas de áudio) -------------------------------

const VIDEO_EXT = new Set([
  '.mkv', '.mp4', '.avi', '.mov', '.webm', '.m4v', '.flv', '.wmv', '.mpg', '.mpeg', '.ts', '.m2ts',
]);

// Nome do torrent, esteja ele ativo (no cliente) ou inativo (pausado/concluído).
async function resolveName(hash) {
  try {
    const t = await client.get(hash);
    if (t) return t.name;
  } catch {
    /* hash inválido — segue pros outros stores */
  }
  if (inactive.has(hash)) return inactive.get(hash).name;
  if (hash.startsWith('local-')) {
    try {
      for (const e of fs.readdirSync(DOWNLOAD_DIR)) if (localId(e) === hash) return e;
    } catch {
      /* pasta inacessível */
    }
  }
  return null;
}

// Resolve um caminho relativo garantindo que fica dentro de DOWNLOAD_DIR.
function safeResolve(relPath) {
  const p = path.resolve(DOWNLOAD_DIR, relPath || '');
  if (!p.startsWith(path.resolve(DOWNLOAD_DIR))) return null;
  return fs.existsSync(p) ? p : null;
}

function walkVideos(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkVideos(full, out);
    else if (VIDEO_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push({ name: entry.name, relPath: path.relative(DOWNLOAD_DIR, full), size: fs.statSync(full).size });
    }
  }
  return out;
}

function listMedia(name) {
  const target = contentPath(name);
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    return VIDEO_EXT.has(path.extname(target).toLowerCase())
      ? [{ name: path.basename(target), relPath: path.relative(DOWNLOAD_DIR, target), size: stat.size }]
      : [];
  }
  return walkVideos(target, []);
}

// --- API ---------------------------------------------------------------

app.get('/api/torrents', (_req, res) => res.json(snapshot()));

// Lista os arquivos de vídeo em disco de um torrent (pra escolher o que assistir).
app.get('/api/torrents/:infoHash/media', async (req, res) => {
  const name = await resolveName(req.params.infoHash);
  if (!name) return res.status(404).json({ error: 'Torrent não encontrado.' });
  res.json(listMedia(name));
});

// ffprobe: duração, codec de vídeo e faixas de áudio (idiomas) do arquivo.
app.get('/api/torrents/:infoHash/probe', (req, res) => {
  const file = safeResolve(req.query.file);
  if (!file) return res.status(404).json({ error: 'Arquivo não encontrado.' });

  execFile(
    FFPROBE,
    ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', file],
    { maxBuffer: 10 * 1024 * 1024 },
    (err, stdout) => {
      if (err) return res.status(500).json({ error: 'Falha ao analisar o arquivo.' });
      let info;
      try {
        info = JSON.parse(stdout);
      } catch {
        return res.status(500).json({ error: 'Saída do ffprobe inválida.' });
      }
      const streams = info.streams || [];
      const video = streams.find((s) => s.codec_type === 'video');
      const audio = streams
        .filter((s) => s.codec_type === 'audio')
        .map((s, i) => ({
          index: i, // índice relativo entre as faixas de áudio (0:a:i)
          lang: s.tags?.language || null,
          title: s.tags?.title || null,
          codec: s.codec_name || null,
          channels: s.channels || null,
        }));
      res.json({
        duration: info.format?.duration ? Number(info.format.duration) : null,
        videoCodec: video?.codec_name || null,
        audio,
      });
    },
  );
});

// Streaming: ffmpeg converte na hora pra MP4 fragmentado e envia direto pro player.
// Copia o vídeo se já for H.264 (rápido); senão recodifica. Áudio sempre vira AAC estéreo.
app.get('/api/torrents/:infoHash/stream', (req, res) => {
  const file = safeResolve(req.query.file);
  if (!file) return res.status(404).json({ error: 'Arquivo não encontrado.' });

  const audioIdx = /^\d+$/.test(String(req.query.audio)) ? String(req.query.audio) : '0';
  const t = Math.max(0, Number.parseFloat(req.query.t) || 0);
  const copyVideo = req.query.vcopy === '1';

  const args = [];
  if (t > 0) args.push('-ss', String(t));
  args.push('-i', file);
  args.push('-map', '0:v:0', '-map', `0:a:${audioIdx}`);
  if (copyVideo) args.push('-c:v', 'copy');
  else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23');
  args.push('-c:a', 'aac', '-ac', '2', '-b:a', '192k');
  args.push('-movflags', 'frag_keyframe+empty_moov+default_base_moof');
  args.push('-f', 'mp4', 'pipe:1');

  res.setHeader('Content-Type', 'video/mp4');
  const ff = spawn(FFMPEG, args);
  ff.stdout.pipe(res);
  ff.stderr.on('data', () => {}); // silencia o log verboso do ffmpeg
  ff.on('error', (err) => {
    console.error('[ffmpeg]', err.message);
    if (!res.headersSent) res.status(500).end();
  });
  // Se o cliente fecha (troca de faixa, seek, sai da página), mata o ffmpeg.
  req.on('close', () => ff.kill('SIGKILL'));
});

app.post('/api/torrents', upload.single('torrentFile'), (req, res) => {
  const source = req.file ? req.file.buffer : req.body?.magnet?.trim();
  if (!source || (typeof source === 'string' && source.length === 0)) {
    return res.status(400).json({ error: 'Informe um link magnet ou envie um arquivo .torrent.' });
  }
  try {
    const torrent = client.add(source, { path: DOWNLOAD_DIR }, () => broadcast());
    attach(torrent);
    saveState();
    res.status(202).json({ ok: true, infoHash: torrent.infoHash });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// STOP: pausar (se baixando) ou parar de semear (se concluído). Mantém os arquivos.
// client.get() e client.remove() são ASYNC no webtorrent v2 — sempre await.
app.post('/api/torrents/:infoHash/stop', async (req, res) => {
  try {
    const t = await client.get(req.params.infoHash);
    if (!t) return res.status(404).json({ error: 'Torrent não encontrado.' });
    inactive.set(t.infoHash, {
      infoHash: t.infoHash,
      name: t.name,
      magnetURI: t.magnetURI,
      length: t.length,
      downloaded: t.downloaded,
      done: t.done,
    });
    await client.remove(t.infoHash, { destroyStore: false });
    saveState();
    broadcast();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// START: retomar download ou religar seed. Re-adiciona e o WebTorrent verifica o disco.
app.post('/api/torrents/:infoHash/start', (req, res) => {
  const rec = inactive.get(req.params.infoHash);
  if (!rec) return res.status(404).json({ error: 'Torrent inativo não encontrado.' });
  inactive.delete(rec.infoHash);
  try {
    const torrent = client.add(rec.magnetURI, { path: DOWNLOAD_DIR }, () => broadcast());
    attach(torrent);
    saveState();
    broadcast();
    res.json({ ok: true });
  } catch (err) {
    inactive.set(rec.infoHash, rec); // devolve pro estado inativo se falhar
    broadcast();
    res.status(400).json({ error: err.message });
  }
});

// REVEAL: abre a pasta do download no gerenciador de arquivos do SO.
app.post('/api/torrents/:infoHash/reveal', async (req, res) => {
  const hash = req.params.infoHash;
  let name;
  const t = await client.get(hash);
  if (t) name = t.name;
  else if (inactive.has(hash)) name = inactive.get(hash).name;
  else return res.status(404).json({ error: 'Torrent não encontrado.' });

  try {
    revealInFileManager(contentPath(name));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/torrents/:infoHash', async (req, res) => {
  const hash = req.params.infoHash;
  const deleteFiles = req.query.files === 'true';

  if (inactive.has(hash)) {
    inactive.delete(hash);
    saveState();
    broadcast();
    return res.json({ ok: true });
  }

  // Item local (só disco): "remover" = apagar os arquivos, com guarda anti path-traversal.
  if (hash.startsWith('local-')) {
    const name = await resolveName(hash);
    if (!name) return res.status(404).json({ error: 'Item não encontrado.' });
    const target = path.resolve(DOWNLOAD_DIR, name);
    const root = path.resolve(DOWNLOAD_DIR);
    if (target === root || !target.startsWith(root + path.sep) || !fs.existsSync(target)) {
      return res.status(400).json({ error: 'Caminho inválido.' });
    }
    try {
      fs.rmSync(target, { recursive: true, force: true });
      sizeCache.delete(target);
      broadcast();
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  try {
    const t = await client.get(hash);
    if (!t) return res.status(404).json({ error: 'Torrent não encontrado.' });
    await client.remove(hash, { destroyStore: deleteFiles });
    saveState();
    broadcast();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Frontend em produção (Vite build) --------------------------------

if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/downloads')) return next();
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
}

// --- WebSocket: progresso ao vivo -------------------------------------

function broadcast() {
  const payload = JSON.stringify({ type: 'torrents', data: snapshot() });
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'torrents', data: snapshot() }));
});

setInterval(broadcast, 1000);

server.listen(PORT, () => {
  console.log(`\n  [server] API+WS em http://localhost:${PORT}`);
  console.log(`  [server] downloads em: ${DOWNLOAD_DIR}`);
  restoreState();
  console.log('');
});
