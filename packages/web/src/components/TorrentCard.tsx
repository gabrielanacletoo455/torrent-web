import { useNavigate } from '@tanstack/react-router';
import { useTorrentAction } from '../lib/torrents';
import { bytes, speed, eta } from '../lib/format';
import { PauseIcon, PlayIcon, TrashIcon, FolderIcon, WatchIcon, DownIcon, UpIcon } from './Icons';
import { Toggle } from './Toggle';
import type { Torrent } from '../types';

function statusOf(t: Torrent): 'done' | 'paused' | 'active' {
  if (t.done) return 'done';
  if (t.paused) return 'paused';
  return 'active';
}

const label = { done: 'Concluído', paused: 'Pausado', active: 'Baixando' };

export function TorrentCard({ t }: { t: Torrent }) {
  const action = useTorrentAction();
  const navigate = useNavigate();
  const status = statusOf(t);
  const pct = (t.progress * 100).toFixed(1);
  const busy = action.isPending;

  function run(a: 'start' | 'stop' | 'reveal' | 'remove') {
    if (a === 'remove') {
      const msg = t.local
        ? 'Apagar os arquivos do disco? Isto não pode ser desfeito.'
        : 'Remover este torrent? (os arquivos baixados são mantidos)';
      if (!confirm(msg)) return;
    }
    action.mutate({ infoHash: t.infoHash, action: a });
  }

  return (
    <div className="torrent">
      <div className="torrent-head">
        <div className="title-wrap">
          <span className={`status-dot ${status}`} />
          <span className="torrent-name">{t.name}</span>
        </div>

        <div className="actions">
          {t.done ? (
            <>
              <button
                className="icon-btn"
                title="Assistir"
                onClick={() => navigate({ to: '/watch/$infoHash', params: { infoHash: t.infoHash } })}
                disabled={busy}
              >
                <WatchIcon />
              </button>
              <button className="icon-btn" title="Abrir pasta" onClick={() => run('reveal')} disabled={busy}>
                <FolderIcon />
              </button>
            </>
          ) : t.paused ? (
            <button className="icon-btn" title="Retomar" onClick={() => run('start')} disabled={busy}>
              <PlayIcon />
            </button>
          ) : (
            <button className="icon-btn" title="Pausar" onClick={() => run('stop')} disabled={busy}>
              <PauseIcon />
            </button>
          )}
          <button className="icon-btn danger" title="Remover" onClick={() => run('remove')} disabled={busy}>
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className="progress-row">
        <div className="progress-track">
          <div className={`progress-fill ${status}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="pct">{pct}%</span>
      </div>

      <div className="stats">
        <span className="cell">
          <b>{bytes(t.downloaded)}</b> / {bytes(t.length)}
        </span>
        <span className="sep" />
        <span className="cell">
          <DownIcon size={13} /> <b>{speed(t.downloadSpeed)}</b>
        </span>
        <span className="cell">
          <UpIcon size={13} /> <b>{speed(t.uploadSpeed)}</b>
        </span>
        <span className="sep" />
        <span className="cell">
          <b>{t.numPeers}</b> peers
        </span>
        {!t.done && (
          <>
            <span className="sep" />
            <span className="cell">
              ETA <b>{eta(t.timeRemaining)}</b>
            </span>
          </>
        )}

        {t.done && !t.local ? (
          <Toggle
            label="seed"
            checked={t.seeding}
            disabled={busy}
            onChange={(next) => run(next ? 'start' : 'stop')}
          />
        ) : (
          <span className={`tag ${status}`}>{label[status]}</span>
        )}
      </div>
    </div>
  );
}
