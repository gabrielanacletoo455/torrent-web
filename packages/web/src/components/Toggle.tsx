interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label className="toggle" title={checked ? 'Semeando — clique para parar' : 'Seed desligado — clique para religar'}>
      <span className="toggle-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className="knob" />
      </button>
    </label>
  );
}
