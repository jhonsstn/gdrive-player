"use client";

import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "destructive";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-blue-500 px-6 py-2 text-white hover:not-disabled:bg-blue-600",
  secondary:
    "border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-50 hover:not-disabled:border-zinc-700 hover:not-disabled:bg-zinc-800",
  destructive:
    "border border-red-500/10 bg-transparent px-4 py-2 text-red-500 hover:bg-red-500/10",
};

export function Button({ variant = "secondary", className = "", children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
