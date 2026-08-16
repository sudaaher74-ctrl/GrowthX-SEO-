/**
 * The illustration behind the story panel.
 *
 * Drawn here rather than sourced as an asset: it needs no licence, scales
 * without artefacts, inherits the panel's palette, and weighs nothing.
 *
 * The motif is the product's actual subject — a client's site at the centre of
 * an orbit, with AI assistants around it and citation links running inward.
 * Some links land on the centre, some land on a competitor node instead, which
 * is the gap the product exists to find.
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
          <stop offset="0%" stopColor="#e9d5ff" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#a855f7" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="auth-planet" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.5" />
        </radialGradient>
        <radialGradient id="auth-planet-sm" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#065f46" stopOpacity="0.45" />
        </radialGradient>
        <linearGradient id="auth-link" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Star field. Fixed positions rather than random so the layout is stable. */}
      <g fill="#ffffff">
        {[
          [58, 96, 1.6, 0.5], [132, 58, 1.1, 0.35], [214, 132, 1.4, 0.4],
          [96, 208, 1.2, 0.3], [268, 62, 1.7, 0.45], [332, 176, 1.1, 0.3],
          [46, 320, 1.5, 0.4], [188, 288, 1, 0.28], [382, 96, 1.3, 0.35],
          [432, 232, 1.5, 0.4], [84, 452, 1.2, 0.3], [318, 372, 1.1, 0.3],
          [462, 388, 1.4, 0.35], [148, 604, 1.3, 0.3], [396, 556, 1.2, 0.28],
          [58, 688, 1.5, 0.35], [286, 700, 1.1, 0.25], [486, 640, 1.3, 0.3],
          [522, 118, 1.2, 0.3], [246, 486, 1, 0.22],
        ].map(([cx, cy, r, o], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} opacity={o} />
        ))}
      </g>

      {/* Orbits around the client's site. */}
      <g stroke="#c4b5fd" fill="none">
        <ellipse cx="300" cy="404" rx="196" ry="196" opacity="0.14" />
        <ellipse cx="300" cy="404" rx="140" ry="140" opacity="0.2" strokeDasharray="3 7" />
        <ellipse cx="300" cy="404" rx="252" ry="252" opacity="0.08" />
      </g>

      {/* Citation links. Solid ones reach the centre; the dashed one is a
          prompt answered by a competitor instead. */}
      <g strokeWidth="1.4" fill="none">
        <path d="M300 404 L300 208" stroke="url(#auth-link)" opacity="0.85" />
        <path d="M300 404 L440 404" stroke="url(#auth-link)" opacity="0.7" />
        <path d="M300 404 L201 503" stroke="url(#auth-link)" opacity="0.6" />
        <path d="M300 404 L160 404" stroke="#f0abfc" opacity="0.25" strokeDasharray="4 6" />
      </g>

      {/* The client's site: the node everything is measured against. */}
      <circle cx="300" cy="404" r="86" fill="url(#auth-core)" />
      <circle cx="300" cy="404" r="27" fill="#faf5ff" opacity="0.95" />
      <circle cx="300" cy="404" r="40" stroke="#e9d5ff" strokeWidth="1.2" opacity="0.5" fill="none" />

      {/* AI assistants citing it. */}
      <g>
        <circle cx="300" cy="208" r="13" fill="#f5f3ff" opacity="0.9" />
        <circle cx="300" cy="208" r="22" stroke="#c4b5fd" strokeWidth="1" opacity="0.35" fill="none" />

        <circle cx="440" cy="404" r="11" fill="#f5f3ff" opacity="0.8" />
        <circle cx="440" cy="404" r="19" stroke="#c4b5fd" strokeWidth="1" opacity="0.3" fill="none" />

        <circle cx="201" cy="503" r="10" fill="#f5f3ff" opacity="0.7" />
        <circle cx="201" cy="503" r="17" stroke="#c4b5fd" strokeWidth="1" opacity="0.25" fill="none" />

        {/* The competitor winning that one prompt. */}
        <circle cx="160" cy="404" r="9" fill="#f0abfc" opacity="0.5" />
        <circle cx="160" cy="404" r="16" stroke="#f0abfc" strokeWidth="1" opacity="0.25" fill="none" />
      </g>

      {/* Planets, for depth and a horizon at the base. */}
      <g>
        <circle cx="88" cy="150" r="62" fill="url(#auth-planet)" />
        <ellipse
          cx="88"
          cy="150"
          rx="96"
          ry="26"
          stroke="#c4b5fd"
          strokeWidth="1.4"
          opacity="0.3"
          fill="none"
          transform="rotate(-22 88 150)"
        />
        <circle cx="486" cy="690" r="42" fill="url(#auth-planet-sm)" />
        <circle cx="486" cy="690" r="42" stroke="#6ee7b7" strokeWidth="1" opacity="0.25" fill="none" />
      </g>
    </svg>
  );
}
