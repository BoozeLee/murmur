/**
 * The Murmur tag, drawn rather than typeset.
 *
 * A filter displaces the letterforms just enough to break the machine-perfect
 * edge, then a hand-drawn underline and three drips sit on top. It is decorative
 * in the sense that it stays out of the accessibility tree — the `<h1>` beside
 * it still carries the real name.
 */
export function MurmurTag({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 520 150"
      className={className}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="murmur-rough" x="-8%" y="-20%" width="116%" height="150%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.035"
            numOctaves="3"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="4.5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <linearGradient id="murmur-ink" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d8c9a3" />
          <stop offset="52%" stopColor="#a18d5a" />
          <stop offset="100%" stopColor="#5e512c" />
        </linearGradient>
      </defs>

      <g filter="url(#murmur-rough)">
        <text
          x="16"
          y="92"
          fill="url(#murmur-ink)"
          stroke="#232419"
          strokeWidth="1.5"
          paintOrder="stroke"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "104px",
            letterSpacing: "-0.06em",
          }}
        >
          murmur
        </text>
      </g>

      {/* One rough stroke under the word, drawn on first paint. */}
      <path
        className="tag-scrawl"
        d="M22 112 C 96 121, 168 104, 244 114 S 388 120, 496 106"
        fill="none"
        stroke="#8f6f2c"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        className="tag-scrawl tag-scrawl-second"
        d="M44 122 C 130 130, 210 116, 286 124 S 410 126, 470 118"
        fill="none"
        stroke="#2d5a50"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />

      <g className="tag-drips" fill="#8f6f2c">
        <circle className="tag-drip tag-drip-a" cx="104" cy="120" r="3.2" />
        <circle className="tag-drip tag-drip-b" cx="266" cy="122" r="2.6" />
        <circle className="tag-drip tag-drip-c" cx="404" cy="119" r="3" />
      </g>
    </svg>
  );
}
