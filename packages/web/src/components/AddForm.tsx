import { useRef, useState } from 'react';
import { useAddTorrent } from '../lib/torrents';
import { MagnetIcon } from './Icons';

export function AddForm() {
  const [magnet, setMagnet] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const add = useAddTorrent();

  function reset() {
    setMagnet('');
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const file = fileRef.current?.files?.[0];
    if (!file && !magnet.trim()) {
      setError('Cole um magnet ou escolha um arquivo .torrent.');
      return;
    }
    add.mutate(
      { magnet: magnet.trim() || undefined, file },
      { onSuccess: reset, onError: (err) => setError((err as Error).message) },
    );
  }

  return (
    <form className="add-card" onSubmit={submit}>
      <div className="input-wrap">
        <span className="prefix">
          <MagnetIcon />
        </span>
        <input
          type="text"
          className="magnet-input"
          placeholder="magnet:?xt=urn:btih:…"
          value={magnet}
          onChange={(e) => setMagnet(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="add-actions">
        <label className="btn file-btn">
          <input
            ref={fileRef}
            type="file"
            accept=".torrent"
            hidden
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
          />
          <span>{fileName || 'arquivo .torrent'}</span>
        </label>
        <button type="submit" className="btn primary" disabled={add.isPending}>
          {add.isPending ? 'Adicionando…' : 'Adicionar torrent'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </form>
  );
}
