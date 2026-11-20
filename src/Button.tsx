import type { ButtonHTMLAttributes } from "react";

// The app's one button component. Variants name intent (primary for the one
// action that matters most on a screen), not color.
const VARIANTS = {
  primary: "bg-primary text-primary-ink active:brightness-90",
  secondary: "bg-ink/8 text-ink active:bg-ink/15",
  ghost: "text-ink-muted active:bg-ink/10",
} as const;

const SIZES = {
  sm: "h-9 px-3 text-sm rounded-md",
  md: "h-11 px-4 text-base rounded-lg",
  xl: "h-16 px-8 text-xl rounded-xl",
  icon: "h-11 w-11 rounded-lg",
} as const;

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS; size?: keyof typeof SIZES }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 font-bold select-none transition disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
