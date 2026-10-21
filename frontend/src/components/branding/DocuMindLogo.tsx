
type DocuMindLogoProps = {
  size?: number;
  showText?: boolean;
  className?: string;
};

export default function DocuMindLogo({
  size = 48,
  showText = true,
  className = "",
}: DocuMindLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo container with glow and depth */}
      <div
        className="relative flex shrink-0 items-center justify-center rounded-2xl border border-violet-400/30 bg-slate-950 shadow-[0_8px_28px_rgba(124,58,237,0.35)]"
        style={{
          width: size,
          height: size,
        }}
      >
        {/* Soft background glow */}
        <div className="pointer-events-none absolute inset-1 rounded-xl bg-gradient-to-br from-violet-600/25 to-cyan-400/10 blur-md" />

        {/* Scalable vector logo */}
        <svg
          viewBox="0 0 80 80"
          width={size * 0.78}
          height={size * 0.78}
          className="relative z-10"
          role="img"
          aria-label="DocuMind AI logo"
        >
          <defs>
            <linearGradient
              id="documind-logo-gradient"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0%" stopColor="#C084FC" />
              <stop offset="55%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
          </defs>

          {/* The main D symbol */}
          <path
            d="M16 12H38C57 12 68 24 68 40S57 68 38 68H16V12ZM31 26V54H38C47 54 53 48 53 40S47 26 38 26H31Z"
            fill="url(#documind-logo-gradient)"
            fillRule="evenodd"
          />

          {/* AI-inspired glowing node */}
          <circle
            cx="63"
            cy="15"
            r="5"
            fill="#67E8F9"
          />

          {/* Small orbital accent */}
          <path
            d="M59 8L65 4"
            stroke="#A78BFA"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Optional brand name */}
      {showText && (
        <div className="min-w-0">
          <h1 className="bg-gradient-to-r from-white via-violet-100 to-cyan-200 bg-clip-text text-xl font-bold tracking-tight text-transparent">
            DocuMind AI
          </h1>

          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
            Intelligent Document Assistant
          </p>
        </div>
      )}
    </div>
  );
}
