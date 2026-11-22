interface RingProps {
  /** 0..1 and beyond — values over 1 mean the target is exceeded */
  progress: number;
  size: number;
  stroke: number;
  color: string;
  /** rendered in the middle of the ring */
  children?: React.ReactNode;
  /** colour used once progress passes 1 */
  overColor?: string;
}

export function Ring({ progress, size, stroke, color, overColor = '#d64545', children }: RingProps) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const over = progress > 1;
  const shown = Math.min(Math.max(progress, 0), 1);
  const dash = circumference * shown;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-black/[0.07] dark:text-white/10"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? overColor : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 500ms ease, stroke 300ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
