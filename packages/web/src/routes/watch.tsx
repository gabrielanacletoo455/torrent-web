import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from './root';
import { api } from '../lib/api';
import { clock, bytes } from '../lib/format';
import { BackIcon, PlayIcon, PauseIcon } from '../components/Icons';
import type { AudioTrack } from '../types';

const LANGS: Record<string, string> = {
  por: 'Português', pob: 'Português (BR)', pt: 'Português',
  eng: 'Inglês', en: 'Inglês',
  spa: 'Espanhol', es: 'Espanhol',
  jpn: 'Japonês', ja: 'Japonês',
  fra: 'Francês', fre: 'Francês', ger: 'Alemão', deu: 'Alemão',
  ita: 'Italiano', kor: 'Coreano', chi: 'Chinês', zho: 'Chinês', rus: 'Russo',
};

function trackLabel(a: AudioTrack, i: number): string {
  const lang = a.lang ? LANGS[a.lang.toLowerCase()] || a.lang.toUpperCase() : `Faixa ${i + 1}`;
  const extra = [a.codec?.toUpperCase(), a.channels ? `${a.channels}ch` : null].filter(Boolean).join(' ');
  return extra ? `${lang} · ${extra}` : lang;
}

function WatchPage() {
  const { infoHash } = watchRoute.useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<string | null>(null);
  const [audio, setAudio] = useState(0);
  const [offset, setOffset] = useState(0); // ponto de início do stream atual (base do seek)
  const [display, setDisplay] = useState(0); // tempo exibido = offset + video.currentTime
  const [scrub, setScrub] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);

  const media = useQuery({ queryKey: ['media', infoHash], queryFn: () => api.media(infoHash) });
  const probe = useQuery({
    queryKey: ['probe', infoHash, file],
    queryFn: () => api.probe(infoHash, file!),
    enabled: !!file,
  });

  // Auto-seleciona o primeiro arquivo de vídeo.
  useEffect(() => {
    if (media.data && media.data.length && !file) setFile(media.data[0].relPath);
  }, [media.data, file]);

  // Ao carregar o probe: escolhe faixa PT se houver, senão a primeira; reinicia do zero.
  useEffect(() => {
    if (!probe.data) return;
    const pt = probe.data.audio.findIndex((a) => a.lang && /^(por|pob|pt)/i.test(a.lang));
    setAudio(pt >= 0 ? pt : 0);
    setOffset(0);
  }, [probe.data]);

  const vcopy = probe.data?.videoCodec === 'h264';
  const duration = probe.data?.duration ?? 0;

  // (Re)carrega o stream sempre que arquivo / faixa / ponto de seek mudam.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !file || !probe.data) return;
    v.src = api.streamUrl(infoHash, { file, audio, t: offset, vcopy });
    setDisplay(offset);
    v.load();
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infoHash, file, probe.data, audio, offset]);

  function seekTo(sec: number) {
    setOffset(Math.max(0, Math.min(sec, duration || sec)));
  }

  function changeAudio(idx: number) {
    setOffset(display); // mantém a posição ao trocar o idioma
    setAudio(idx);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  const files = media.data ?? [];
  const audioTracks = probe.data?.audio ?? [];
  const sliderVal = scrub ?? display;

  const title = useMemo(
    () => files.find((f) => f.relPath === file)?.name ?? '',
    [files, file],
  );

  return (
    <div className="watch">
      <div className="watch-top">
        <Link to="/" className="back-link">
          <BackIcon /> voltar
        </Link>
        {title && <span className="watch-title">{title}</span>}
      </div>

      {media.isLoading ? (
        <div className="empty"><p>Carregando…</p></div>
      ) : files.length === 0 ? (
        <div className="empty"><p>Nenhum arquivo de vídeo encontrado neste torrent.</p></div>
      ) : (
        <>
          <div className="player" ref={containerRef}>
            <video
              ref={videoRef}
              onTimeUpdate={(e) => setDisplay(offset + e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onClick={togglePlay}
              playsInline
            />

            <div className="controls">
              <button className="ctrl-btn" onClick={togglePlay} title={playing ? 'Pausar' : 'Tocar'}>
                {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
              </button>

              <span className="time">{clock(sliderVal)}</span>

              <input
                type="range"
                className="scrubber"
                min={0}
                max={duration || 0}
                step={1}
                value={sliderVal}
                disabled={!duration}
                onChange={(e) => setScrub(Number(e.target.value))}
                onPointerUp={() => {
                  if (scrub != null) { seekTo(scrub); setScrub(null); }
                }}
                onKeyUp={() => {
                  if (scrub != null) { seekTo(scrub); setScrub(null); }
                }}
              />

              <span className="time">{clock(duration)}</span>

              <input
                type="range"
                className="volume"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setVolume(val);
                  if (videoRef.current) videoRef.current.volume = val;
                }}
                title="Volume"
              />

              <button className="ctrl-btn" onClick={toggleFullscreen} title="Tela cheia">
                ⛶
              </button>
            </div>
          </div>

          <div className="watch-bar">
            {files.length > 1 && (
              <label className="field">
                <span>Arquivo</span>
                <select value={file ?? ''} onChange={(e) => { setFile(e.target.value); }}>
                  {files.map((f) => (
                    <option key={f.relPath} value={f.relPath}>
                      {f.name} ({bytes(f.size)})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              <span>Áudio / idioma</span>
              <select
                value={audio}
                disabled={probe.isLoading || audioTracks.length === 0}
                onChange={(e) => changeAudio(Number(e.target.value))}
              >
                {probe.isLoading && <option>Analisando…</option>}
                {audioTracks.map((a, i) => (
                  <option key={i} value={i}>
                    {trackLabel(a, i)}
                  </option>
                ))}
                {!probe.isLoading && audioTracks.length === 0 && <option>Sem faixas de áudio</option>}
              </select>
            </label>

            {!vcopy && probe.data && (
              <span className="hint">recodificando vídeo ({probe.data.videoCodec}) — pode pesar na CPU</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export const watchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/watch/$infoHash',
  component: WatchPage,
});
