/** A small palette-knife brush mark. Decorative: the wordmark carries the name. */
export function BrandMark({ className = "" }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <rect
        x="1.25"
        y="1.25"
        width="45.5"
        height="45.5"
        rx="14"
        fill="var(--color-canvas-lifted)"
        stroke="var(--color-sage)"
        strokeWidth="1.5"
      />
      <path
        d="M11.5 31.8c5.7-9.6 12.6-15.1 25.2-17.4-3.8 7.2-9.1 13-16.4 16.2-3.2 1.4-6.2 1.9-8.8 1.2Z"
        fill="var(--color-ochre)"
        opacity="0.92"
      />
      <path
        d="M14.4 34.2c8.1-3.4 14.2-8.8 20.1-16.4"
        fill="none"
        stroke="var(--color-parchment)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.74"
      />
      <circle cx="33.4" cy="14.9" r="2.6" fill="var(--color-teal)" />
      <circle cx="15.6" cy="17.6" r="1.5" fill="var(--color-sand)" opacity="0.8" />
    </svg>
  );
}
