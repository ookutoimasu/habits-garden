import React from 'react';

interface CompletionParticlesProps {
  active: boolean;
}

const PARTICLE_VECTORS = [
  { id: 1, cx: 145, cy: 165, dx: -22, dy: -38, r: 2.6, delay: '0ms' },
  { id: 2, cx: 160, cy: 150, dx: 4, dy: -46, r: 3.0, delay: '45ms' },
  { id: 3, cx: 176, cy: 162, dx: 26, dy: -34, r: 2.5, delay: '90ms' },
  { id: 4, cx: 132, cy: 185, dx: -30, dy: -24, r: 2.2, delay: '70ms' },
  { id: 5, cx: 188, cy: 182, dx: 28, dy: -26, r: 2.4, delay: '110ms' },
  { id: 6, cx: 152, cy: 195, dx: -12, dy: -40, r: 2.8, delay: '30ms' },
  { id: 7, cx: 168, cy: 192, dx: 15, dy: -42, r: 2.5, delay: '80ms' },
  { id: 8, cx: 140, cy: 142, dx: -18, dy: -28, r: 2.0, delay: '120ms' },
  { id: 9, cx: 180, cy: 140, dx: 20, dy: -30, r: 2.1, delay: '60ms' },
  { id: 10, cx: 160, cy: 175, dx: 0, dy: -52, r: 3.1, delay: '15ms' },
];

/**
 * Краткий эффект золотых частиц вокруг кроны при первом выполнении дневной нормы.
 * Учитывает настройку уменьшения движения (prefers-reduced-motion).
 */
export const CompletionParticles: React.FC<CompletionParticlesProps> = ({ active }) => {
  if (!active) {
    return null;
  }

  return (
    <g
      aria-label="Эффект выполнения за день"
      data-testid="completion-particles"
      className="pointer-events-none"
    >
      <style>
        {`
          @keyframes hgParticleRise {
            0% {
              opacity: 0;
              transform: translate(0px, 6px) scale(0.6);
            }
            25% {
              opacity: 0.95;
              transform: translate(calc(var(--dx) * 0.35), calc(var(--dy) * 0.35)) scale(1.08);
            }
            100% {
              opacity: 0;
              transform: translate(var(--dx), var(--dy)) scale(0.4);
            }
          }
          .hg-gold-particle {
            animation: hgParticleRise 1350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes hgParticleRise {
              0%, 30% {
                opacity: 0.9;
                transform: translate(0px, -8px) scale(1);
              }
              100% {
                opacity: 0;
                transform: translate(0px, -8px) scale(1);
              }
            }
            .hg-gold-particle {
              animation-duration: 700ms !important;
            }
          }
        `}
      </style>
      {PARTICLE_VECTORS.map((p) => (
        <circle
          key={p.id}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill="#D4AF37"
          stroke="#F5E6A8"
          strokeWidth="0.8"
          className="hg-gold-particle"
          style={
            {
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              animationDelay: p.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </g>
  );
};
