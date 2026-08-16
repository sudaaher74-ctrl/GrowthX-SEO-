/**
 * The illustration behind the story panel.
 *
 * Drawn here rather than sourced as an asset: it needs no licence, scales
 * without artefacts, and weighs nothing.
 *
 * Monochrome by design — white at varying opacity on black, so it reads as a
 * technical drawing rather than decoration. The motif is the product's actual
 * subject: a client's site at the centre of an orbit, with AI assistants around
 * it and citation links running inward. Solid links land on the centre; the
 * dashed one lands on a competitor instead, which is the gap the product finds.
 */
export function AuthIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 820"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="auth-core" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="auth-planet" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
        </radialGradient>
        <radialGradient id="auth-planet-sm" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.03" />
        </radialGradient>
        <linearGradient id="auth-link" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      {/* Star field. Fixed positions rather than random so the layout is stable. */}
      <g fill="#ffffff">
        {[
          [58, 96, 1.6, 0.45], [132, 58, 1.1, 0.3], [214, 132, 1.4, 0.35],
          [96, 208, 1.2, 0.26], [268, 62, 1.7, 0.4], [332, 176, 1.1, 0.26],
          [46, 320, 1.5, 0.35], [188, 288, 1, 0.24], [382, 96, 1.3, 0.3],
          [432, 232, 1.5, 0.35], [84, 452, 1.2, 0.26], [318, 372, 1.1, 0.26],
          [462, 388, 1.4, 0.3], [148, 604, 1.3, 0.26], [396, 556, 1.2, 0.24],
          [58, 688, 1.5, 0.3], [286, 700, 1.1, 0.22], [486, 640, 1.3, 0.26],
          [522, 118, 1.2, 0.26], [246, 486, 1, 0.2],
        ].map(([cx, cy, r, o], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} opacity={o} />
        ))}
      </g>

      {/* Orbits around the client's site. */}
      <g stroke="#ffffff" fill="none">
        <ellipse cx="300" cy="404" rx="196" ry="196" opacity="0.12" />
        <ellipse cx="300" cy="404" rx="140" ry="140" opacity="0.18" strokeDasharray="3 7" />
        <ellipse cx="300" cy="404" rx="252" ry="252" opacity="0.07" />
      </g>

      {/* Citation links. */}
      <g strokeWidth="1.4" fill="none">
        <path d="M300 404 L300 208" stroke="url(#auth-link)" opacity="0.9" />
        <path d="M300 404 L440 404" stroke="url(#auth-link)" opacity="0.75" />
        <path d="M300 404 L201 503" stroke="url(#auth-link)" opacity="0.6" />
        {/* The prompt a competitor wins. */}
        <path d="M300 404 L160 404" stroke="#ffffff" opacity="0.18" strokeDasharray="4 6" />
      </g>

      {/* The client's site: the node everything is measured against. */}
      <circle cx="300" cy="404" r="86" fill="url(#auth-core)" />
      <circle cx="300" cy="404" r="27" fill="#ffffff" opacity="0.92" />
      <circle cx="300" cy="404" r="40" stroke="#ffffff" strokeWidth="1.2" opacity="0.4" fill="none" />

      {/* AI assistants citing it. */}
      <g>
        <circle cx="300" cy="208" r="13" fill="#ffffff" opacity="0.8" />
        <circle cx="300" cy="208" r="22" stroke="#ffffff" strokeWidth="1" opacity="0.28" fill="none" />

        <circle cx="440" cy="404" r="11" fill="#ffffff" opacity="0.68" />
        <circle cx="440" cy="404" r="19" stroke="#ffffff" strokeWidth="1" opacity="0.24" fill="none" />

        <circle cx="201" cy="503" r="10" fill="#ffffff" opacity="0.58" />
        <circle cx="201" cy="503" r="17" stroke="#ffffff" strokeWidth="1" opacity="0.2" fill="none" />

        {/* The competitor: outlined rather than filled, so it reads as "not us". */}
        <circle cx="160" cy="404" r="9" stroke="#ffffff" strokeWidth="1.2" opacity="0.35" fill="none" />
        <circle cx="160" cy="404" r="16" stroke="#ffffff" strokeWidth="1" opacity="0.15" fill="none" />
      </g>

      {/* Planets, for depth and a horizon at the base. */}
      <g>
        <circle cx="88" cy="150" r="62" fill="url(#auth-planet)" />
        <ellipse
          cx="88"
          cy="150"
          rx="96"
          ry="26"
          stroke="#ffffff"
          strokeWidth="1.4"
          opacity="0.22"
          fill="none"
          transform="rotate(-22 88 150)"
        />
        <circle cx="486" cy="690" r="42" fill="url(#auth-planet-sm)" />
        <circle cx="486" cy="690" r="42" stroke="#ffffff" strokeWidth="1" opacity="0.18" fill="none" />
      </g>
    </svg>
  );
}
