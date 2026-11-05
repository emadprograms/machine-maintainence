import { useEffect, useState } from 'react';

export function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-right">
      <p className="text-2xl font-bold text-main tabular-nums tracking-tight">
        {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-sm text-dim font-medium">
        {time.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
    </div>
  );
}

export function MouseGlow() {
  const [pos, setPos] = useState({ x: -200, y: -200 });

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handle);
    return () => window.removeEventListener('mousemove', handle);
  }, []);

  return (
    <div
      className="fixed pointer-events-none z-[9999] transition-all duration-300 ease-out"
      style={{
        left: pos.x - 300,
        top: pos.y - 300,
        width: 600,
        height: 600,
        background: 'radial-gradient(circle, rgba(37,99,235,0.04) 0%, transparent 70%)',
        borderRadius: '50%',
      }}
    />
  );
}

export function AnimatedMesh() {
  return (
    <div className="animated-mesh">
      <div className="orb" />
      <div className="orb" />
      <div className="orb" />
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${10 + (i * 8) % 80}%`,
            top: `${5 + (i * 13) % 85}%`,
            animationDelay: `${i * 0.5}s`,
            animationDuration: `${4 + (i % 3) * 2}s`,
          }}
        />
      ))}
    </div>
  );
}

export function Skeleton({ className = '', count = 1 }: { className?: string; count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`shimmer rounded-xl bg-card border border-subtle ${className}`}
        />
      ))}
    </>
  );
}
