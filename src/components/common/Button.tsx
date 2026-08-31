"use client";

import clsx from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:opacity-90 active:opacity-80 disabled:opacity-50",
  outline:
    "bg-transparent text-foreground border border-border hover:bg-muted disabled:opacity-50",
  ghost:
    "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50",
};

const SIZE: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-4 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "outline", size = "md", fullWidth, className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-studio font-medium transition-base active:scale-[0.97] disabled:active:scale-100 disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
