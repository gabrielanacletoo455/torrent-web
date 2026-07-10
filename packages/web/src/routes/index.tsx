import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './root';
import { useTorrents } from '../lib/torrents';
import { AddForm } from '../components/AddForm';
import { TorrentCard } from '../components/TorrentCard';
import { LogoMark } from '../components/Icons';

function TorrentsPage() {
  const { data: torrents = [], isLoading } = useTorrents();

  return (
    <>
      <AddForm />
      <section className="list">
        {isLoading ? (
          <div className="empty">
            <p>Carregando…</p>
          </div>
        ) : torrents.length === 0 ? (
          <div className="empty">
            <span className="glyph">
              <LogoMark size={40} />
            </span>
            <p>Nenhum torrent na fila. Cole um link magnet acima para começar o download.</p>
          </div>
        ) : (
          torrents.map((t) => <TorrentCard key={t.infoHash} t={t} />)
        )}
      </section>
    </>
  );
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: TorrentsPage,
});
