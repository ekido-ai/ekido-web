"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "./cx";

import { buttonStyles, type Variant } from "./button-styles";

export { buttonStyles };

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return <button type="button" {...props} className={cx(buttonStyles(variant, size), className)} />;
}

/**
 * Destructive action that needs a second press within `windowMs` (plan.md: "the Kill
 * button is obvious, and asks for a quick second press to prevent accidents").
 * No browser confirm() dialog.
 */
export function ConfirmButton({
  children,
  confirmLabel = "Press again to confirm",
  onConfirm,
  windowMs = 3000,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & {
  confirmLabel?: React.ReactNode;
  onConfirm: () => void;
  windowMs?: number;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <Button
      {...props}
      variant={armed ? "dangerSolid" : "danger"}
      aria-live="polite"
      onClick={() => {
        if (timer.current) clearTimeout(timer.current);
        if (armed) {
          setArmed(false);
          onConfirm();
          return;
        }
        setArmed(true);
        timer.current = setTimeout(() => setArmed(false), windowMs);
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
