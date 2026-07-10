export interface TorrentFile {
  name: string;
  length: number;
  progress: number;
  path: string;
}

export interface Torrent {
  infoHash: string;
  name: string;
  magnetURI: string;
  progress: number;
  downloaded: number;
  uploaded: number;
  length: number;
  downloadSpeed: number;
  uploadSpeed: number;
  numPeers: number;
  timeRemaining: number | null;
  done: boolean;
  paused: boolean;
  seeding: boolean;
  local: boolean;
  ready: boolean;
  files: TorrentFile[];
}

export interface WsMessage {
  type: 'torrents';
  data: Torrent[];
}

export interface MediaFile {
  name: string;
  relPath: string;
  size: number;
}

export interface AudioTrack {
  index: number;
  lang: string | null;
  title: string | null;
  codec: string | null;
  channels: number | null;
}

export interface ProbeResult {
  duration: number | null;
  videoCodec: string | null;
  audio: AudioTrack[];
}
