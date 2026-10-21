
"use client";

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from "motion/react";
import type { ReactNode } from "react";

// Available button appearances
type GlowButtonVariant =
  | "primary"
  | "secondary"
  | "danger";

// Use Motion's own button props to avoid conflicts
// between React drag events and Motion gestures.
type GlowButtonProps = Omit<
  HTMLMotionProps<"button">,
  "children"
> & {
  children: ReactNode;
  variant?: GlowButtonVariant;
  fullWidth?: boolean;
  loading?: boolean;
};

// Visual styles for each button variant
const variantStyles: Record<
  GlowButtonVariant,
  string
> = {
  primary:
    "border-violet-400/40 bg-gradient-to-br from-violet-500 via-violet-600 to-indigo-700 text-white shadow-[0_5px_0_#3b1b79,0_12px_28px_rgba(124,58,237,0.35)]",

  secondary:
    "border-slate-600/70 bg-gradient-to-br from-slate-700 to-slate-900 text-slate-100 shadow-[0_5px_0_#0b1223,0_12px_24px_rgba(0,0,0,0.25)]",

  danger:
    "border-red-400/40 bg-gradient-to-br from-red-500 to-rose-800 text-white shadow-[0_5px_0_#7f1d1d,0_12px_24px_rgba(225,29,72,0.2)]",
};

export default function GlowButton({
  children,
  variant = "primary",
  fullWidth = false,
  loading = false,
  disabled = false,
  className = "",
  type = "button",
  whileHover,
  whileTap,
  transition,
  ...props
}: GlowButtonProps) {
  // Respect the user's reduced-motion preference
  const reducedMotion = useReducedMotion();

  // Prevent clicks while loading or disabled
  const isDisabled = disabled || loading;

  return (
    <motion.button
      {...props}
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      whileHover={
        isDisabled || reducedMotion
          ? undefined
          : (whileHover ?? {
              y: -2,
              scale: 1.015,
            })
      }
      whileTap={
        isDisabled || reducedMotion
          ? undefined
          : (whileTap ?? {
              y: 3,
              scale: 0.985,
            })
      }
      transition={
        transition ?? {
          type: "spring",
          stiffness: 350,
          damping: 22,
        }
      }
      className={[
        "relative inline-flex min-h-11 items-center justify-center gap-2",
        "overflow-hidden rounded-xl border px-5 py-3",
        "text-sm font-semibold tracking-wide",
        "transition-[filter,opacity] duration-200",
        "hover:brightness-110",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-violet-400 focus-visible:ring-offset-2",
        "focus-visible:ring-offset-slate-950",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantStyles[variant],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {/* Thin reflection along the upper edge */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 top-0 h-px bg-white/40"
      />

      {/* Loading indicator */}
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}

      {/* Button label and optional icon */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
}
