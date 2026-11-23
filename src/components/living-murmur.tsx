"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Murmur as a living surface.
 *
 * Nothing in here is random at render time: a literal seed drives every
 * coordinate, so server and client produce identical markup. The sense of life
 * comes from motion only — breathing opacity, paths drawing themselves, and a
 * small mote field that slows down for reduced motion and stops when hidden.
 *
 * The whole thing sits behind the interface, ignores pointer events, and never
 * touches the text layer's contrast.
 */

const SEED = 20261122;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

interface Mote {
  x: number;
  y: number;
  radius: number;
  speed: number;
  phase: number;
  colour: string;
}

const MOTE_COLOURS = ["#a18d5a", "#d8c9a3", "#8f6f2c", "#79b2a3"];

export function LivingMurmur(): React.ReactElement {
  const uid = useId().replace(/:/g, "");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [awakened, setAwakened] = useState(false);

  const geometry = useMemo(() => {
    const rand = mulberry32(SEED);
    const spray = Array.from({ length: 130 }, () => ({
      x: Math.round(rand() * 1440),
      y: Math.round(rand() * 900),
      r: Number((rand() * 2.4 + 0.5).toFixed(1)),
      opacity: Number((rand() * 0.28 + 0.06).toFixed(2)),
      delay: Number((rand() * 6).toFixed(2)),
    }));
    const arches = [170, 560, 950, 1320].map((x, index) => ({
      x,
      top: 250 + Math.round(rand() * 90),
      height: 380 + Math.round(rand() * 90),
      width: 150 + Math.round(rand() * 30),
      delay: Number((index * 0.7 + rand()).toFixed(2)),
    }));
    const motes: Mote[] = Array.from({ length: 130 }, () => ({
      x: rand(),
      y: rand(),
      radius: rand() * 1.7 + 0.5,
      speed: rand() * 0.000035 + 0.000012,
      phase: rand() * Math.PI * 2,
      colour: MOTE_COLOURS[Math.floor(rand() * MOTE_COLOURS.length)] ?? "#a18d5a",
    }));
    return { spray, arches, motes };
  }, []);

  useEffect(() => {
    let resting: ReturnType<typeof setTimeout> | undefined;
    function awaken(): void {
      setAwakened(false);
      requestAnimationFrame(() => setAwakened(true));
      if (resting !== undefined) clearTimeout(resting);
      resting = setTimeout(() => setAwakened(false), 1800);
    }
    window.addEventListener("murmur:awaken", awaken);
    return () => {
      window.removeEventListener("murmur:awaken", awaken);
      if (resting !== undefined) clearTimeout(resting);
    };
  }, []);

  useEffect(() => {
    const found = canvasRef.current;
    if (found === null) return;
    const context = found.getContext("2d", { alpha: true });
    if (context === null) return;
    // Explicit non-null aliases: TypeScript cannot keep the narrowing inside
    // the hoisted draw/loop functions below.
    const canvas: HTMLCanvasElement = found;
    const ctx: CanvasRenderingContext2D = context;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = 0;
    let height = 0;

    function resize(): void {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const motes = geometry.motes.map((mote) => ({ ...mote }));

    function draw(time: number): void {
      ctx.clearRect(0, 0, width, height);
      for (const mote of motes) {
        const y = reduced ? mote.y : (mote.y - time * mote.speed + 1) % 1;
        const drift = Math.sin(time * 0.00035 + mote.phase) * 9;
        const px = Math.round(mote.x * width + drift);
        const py = Math.round(y * height);
        ctx.globalAlpha = 0.12 + (Math.sin(time * 0.0006 + mote.phase) + 1) * 0.1;
        ctx.fillStyle = mote.colour;
        ctx.beginPath();
        ctx.arc(px, py, mote.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    let frame = 0;
    let last = 0;
    let running = false;
    function loop(time: number): void {
      if (!running) return;
      if (time - last >= 32) {
        draw(time);
        last = time;
      }
      frame = requestAnimationFrame(loop);
    }
    function start(): void {
      if (running || reduced) return;
      running = true;
      frame = requestAnimationFrame(loop);
    }
    function stop(): void {
      running = false;
      cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting === true) start();
      else stop();
    });
    observer.observe(canvas);
    function onVisibility(): void {
      if (document.hidden) stop();
      else start();
    }
    document.addEventListener("visibilitychange", onVisibility);
    draw(0);

    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [geometry.motes]);

  return (
    <div
      aria-hidden="true"
      className={`living-murmur pointer-events-none fixed inset-0 z-0 overflow-hidden${awakened ? " is-awake" : ""}`}
    >
      {/* The generated mural establishes the painted ground; later layers stay light and legible. */}
      <div className="living-hero-art absolute inset-0" />

      {/* Traced brush stroke, vectorised from a hand-wobbled mask with potrace. */}
      <div className="living-scrawl absolute -left-24 top-[7%] h-[42vh] w-[135vw] bg-no-repeat" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Living Murmur artwork</title>
        <defs>
          <radialGradient id={`${uid}-eclipse`}>
            <stop offset="0%" stopColor="#a18d5a" stopOpacity="0.28" />
            <stop offset="58%" stopColor="#2d5a50" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#232419" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2d5a50" stopOpacity="0.3" />
            <stop offset="55%" stopColor="#5e512c" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#8f6f2c" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id={`${uid}-door`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#8f6f2c" stopOpacity="0.32" />
            <stop offset="60%" stopColor="#d8c9a3" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#79b2a3" stopOpacity="0.04" />
          </linearGradient>
          <filter
            id={`${uid}-grain`}
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="2"
              seed={SEED % 100}
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>

        {/* Paper grain. Static turbulence: animating baseFrequency repaints everything. */}
        <rect
          width="1440"
          height="900"
          filter={`url(#${uid}-grain)`}
          opacity="0.055"
          style={{ mixBlendMode: "soft-light" }}
        />

        {/* Stained-glass arches, drawn once on mount. */}
        <g stroke="#8f6f2c" strokeWidth="1.6" fill={`url(#${uid}-glass)`}>
          {geometry.arches.map((arch) => {
            const left = arch.x - arch.width / 2;
            const right = arch.x + arch.width / 2;
            const spring = arch.top + arch.width / 2;
            const path = `M ${left} ${arch.top + arch.height} L ${left} ${spring} A ${arch.width / 2} ${arch.width / 2} 0 0 1 ${right} ${spring} L ${right} ${arch.top + arch.height} Z`;
            return (
              <g key={arch.x} className="living-arch" style={{ animationDelay: `${arch.delay}s` }}>
                <path d={path} />
                <path
                  d={`M ${arch.x} ${arch.top} L ${arch.x} ${arch.top + arch.height} M ${left} ${spring} L ${right} ${spring}`}
                  fill="none"
                  stroke="#a18d5a"
                  strokeWidth="0.7"
                  opacity="0.6"
                />
                <circle
                  cx={arch.x}
                  cy={spring}
                  r={arch.width / 5}
                  fill="none"
                  stroke="#79b2a3"
                  strokeWidth="0.8"
                  opacity="0.5"
                />
              </g>
            );
          })}
        </g>

        {/* The luminous doorway: the one warm shape that seems to breathe. */}
        <g className="living-doorway">
          <rect x="662" y="330" width="116" height="420" rx="58" fill={`url(#${uid}-door)`} />
          <path
            d="M 662 388 A 58 58 0 0 1 778 388"
            fill="none"
            stroke="#d8c9a3"
            strokeWidth="1.4"
            opacity="0.7"
          />
        </g>

        {/* Eclipse disc and its slowly turning dotted ring. */}
        <circle className="living-glow" cx="1180" cy="170" r="230" fill={`url(#${uid}-eclipse)`} />
        <circle
          className="living-ring"
          cx="1180"
          cy="170"
          r="126"
          fill="none"
          stroke="#a18d5a"
          strokeWidth="1.2"
          strokeDasharray="3 9"
        />
        <circle cx="1180" cy="170" r="96" fill="#232419" opacity="0.55" />

        {/* Gold filigree and botanical vines climbing both edges. */}
        <g className="living-filigree" fill="none" stroke={`url(#${uid}-glass)`} strokeWidth="1.4">
          <path d="M -10 880 C 120 720, 40 570, 150 430 S 130 230, 250 90" />
          <path d="M 1450 900 C 1330 760, 1400 610, 1290 470 S 1320 260, 1200 120" />
          <path d="M 300 860 C 420 740, 360 620, 460 520 S 520 340, 620 250" opacity="0.55" />
        </g>
        <g className="living-leaves" fill="#5f654d" opacity="0.4">
          <ellipse cx="86" cy="742" rx="24" ry="8" transform="rotate(-32 86 742)" />
          <ellipse cx="120" cy="612" rx="20" ry="7" transform="rotate(28 120 612)" />
          <ellipse cx="78" cy="486" rx="26" ry="8" transform="rotate(-38 78 486)" />
          <ellipse cx="152" cy="338" rx="18" ry="6" transform="rotate(24 152 338)" />
          <ellipse cx="1362" cy="768" rx="24" ry="8" transform="rotate(34 1362 768)" />
          <ellipse cx="1320" cy="626" rx="20" ry="7" transform="rotate(-26 1320 626)" />
          <ellipse cx="1360" cy="494" rx="26" ry="8" transform="rotate(40 1360 494)" />
          <ellipse cx="1288" cy="350" rx="18" ry="6" transform="rotate(-22 1288 350)" />
        </g>

        <g fill="#d8c9a3">
          {geometry.spray.map((dot) => (
            <circle
              key={`${dot.x}-${dot.y}`}
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
              opacity={dot.opacity}
              style={{ animationDelay: `${dot.delay}s` }}
              className="living-spray"
            />
          ))}
        </g>

        <g className="living-drips" stroke="#8f6f2c" strokeWidth="3" strokeLinecap="round">
          <path className="living-drip" d="M256 120 v70" />
          <path className="living-drip living-drip-b" d="M694 118 v52" />
          <path className="living-drip living-drip-c" d="M1052 122 v84" />
        </g>
      </svg>

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-70" />

      {/* A scrim keeps every panel readable over the artwork. */}
      <div className="living-scrim absolute inset-0" />
    </div>
  );
}
