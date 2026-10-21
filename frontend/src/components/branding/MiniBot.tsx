
"use client";

import { motion } from "motion/react";
import { useId } from "react";

type MiniBotProps = {
  size?: number;
  animated?: boolean;
  className?: string;
};

export default function MiniBot({
  size = 110,
  animated = true,
  className = "",
}: MiniBotProps) {
  // Unique IDs prevent SVG gradient conflicts when
  // multiple robots appear on the same page.
  const id = useId().replace(/:/g, "");

  const headGradient = `head-${id}`;
  const faceGradient = `face-${id}`;
  const bodyGradient = `body-${id}`;
  const eyeGlow = `eyes-${id}`;

  return (
    <motion.div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size * 1.15,
        perspective: 700,
      }}
      animate={
        animated
          ? {
              y: [0, -7, 0],
              rotateZ: [0, 1.5, 0, -1.5, 0],
            }
          : undefined
      }
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      whileHover={{
        scale: 1.07,
        rotateY: 8,
        rotateX: -5,
      }}
      role="img"
      aria-label="DocuMind AI robot assistant"
    >
      {/* Glow behind the robot */}
      <div
        className="pointer-events-none absolute inset-3 rounded-full bg-violet-600/30 blur-2xl"
        aria-hidden="true"
      />

      <svg
        viewBox="0 0 120 135"
        width={size}
        height={size * 1.15}
        className="relative z-10 drop-shadow-[0_12px_18px_rgba(124,58,237,0.45)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={headGradient}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0%" stopColor="#DDD6FE" />
            <stop offset="40%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#312E81" />
          </linearGradient>

          <linearGradient
            id={faceGradient}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#252052" />
            <stop offset="100%" stopColor="#080B1D" />
          </linearGradient>

          <linearGradient
            id={bodyGradient}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#4C1D95" />
          </linearGradient>

          <filter id={eyeGlow}>
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Antenna */}
        <path
          d="M60 26V14"
          stroke="#A78BFA"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle
          cx="60"
          cy="11"
          r="7"
          fill="#67E8F9"
        />

        {/* Ears */}
        <rect
          x="7"
          y="54"
          width="17"
          height="25"
          rx="8"
          fill="#6D28D9"
        />
        <rect
          x="96"
          y="54"
          width="17"
          height="25"
          rx="8"
          fill="#6D28D9"
        />

        {/* Metallic head */}
        <rect
          x="14"
          y="26"
          width="92"
          height="76"
          rx="30"
          fill={`url(#${headGradient})`}
          stroke="#C4B5FD"
          strokeWidth="2"
        />

        {/* Face screen */}
        <rect
          x="23"
          y="39"
          width="74"
          height="47"
          rx="18"
          fill={`url(#${faceGradient})`}
        />

        {/* Eye glow */}
        <g filter={`url(#${eyeGlow})`} opacity="0.75">
          <ellipse
            cx="44"
            cy="62"
            rx="10"
            ry="13"
            fill="#22D3EE"
          />
          <ellipse
            cx="76"
            cy="62"
            rx="10"
            ry="13"
            fill="#22D3EE"
          />
        </g>

        {/* Eyes */}
        <ellipse
          cx="44"
          cy="62"
          rx="7"
          ry="10"
          fill="#67E8F9"
        />
        <ellipse
          cx="76"
          cy="62"
          rx="7"
          ry="10"
          fill="#67E8F9"
        />

        {/* Friendly smile */}
        <path
          d="M51 77Q60 84 69 77"
          stroke="#67E8F9"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />

        {/* Lower body */}
        <rect
          x="30"
          y="99"
          width="60"
          height="26"
          rx="13"
          fill={`url(#${bodyGradient})`}
          stroke="#A78BFA"
          strokeWidth="1.5"
        />

        {/* Chest light */}
        <circle
          cx="60"
          cy="112"
          r="7"
          fill="#22D3EE"
        />
        <circle
          cx="60"
          cy="112"
          r="3"
          fill="#ECFEFF"
        />
      </svg>
    </motion.div>
  );
}
