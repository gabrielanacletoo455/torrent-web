import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useTorrents, useTorrentSocket } from '../lib/torrents';
import { speed } from '../lib/format';
import { LogoMark, DownIcon, UpIcon } from '../components/Icons';

function RootLayout() {
  const { connected } = useTorrentSocket();
  const { data: torrents = [] } = useTorrents();

  const down = torrents.reduce((a, t) => a + t.downloadSpeed, 0);
  const up = torrents.reduce((a, t) => a + t.uploadSpeed, 0);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="mark">
            <LogoMark />
          </span>
          <h1>torrent&#8202;web</h1>
        </div>

        <div className="readout">
          <span className="metric">
            <DownIcon /> <b>{speed(down)}</b>
          </span>
          <span className="metric">
            <UpIcon /> <b>{speed(up)}</b>
          </span>
          <span className="conn">
            <span className={`dot${connected ? ' online' : ''}`} />
            {connected ? 'online' : 'offline'}
          </span>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </>
  );
}

export const rootRoute = createRootRoute({ component: RootLayout });
