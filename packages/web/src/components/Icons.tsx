interface IconProps {
  size?: number;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function LogoMark({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={2}>
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function MagnetIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 3v7a6 6 0 0 0 12 0V3" />
      <line x1="6" y1="3" x2="10" y2="3" />
      <line x1="14" y1="3" x2="18" y2="3" />
    </svg>
  );
}

export function PauseIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="7" y="5" width="3.5" height="14" rx="1" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
    </svg>
  );
}

export function PlayIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M7 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 7 5.5Z" />
    </svg>
  );
}

export function TrashIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M6 6v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function FolderIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 5h5l2 2.5h9a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function WatchIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5v7l6-3.5-6-3.5Z" />
    </svg>
  );
}

export function BackIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function DownIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 4v14" />
      <path d="m6 12 6 6 6-6" />
    </svg>
  );
}

export function UpIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 20V6" />
      <path d="m6 12 6-6 6 6" />
    </svg>
  );
}
