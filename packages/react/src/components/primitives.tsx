import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes } from "react";

const spacing = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

type VulyoStackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: keyof typeof spacing | number;
  maxWidth?: CSSProperties["maxWidth"];
};

export function VulyoStack({ gap = "md", maxWidth, style, ...props }: VulyoStackProps) {
  return <div style={{ display: "grid", gap: typeof gap === "number" ? gap : spacing[gap], maxWidth, ...style }} {...props} />;
}

export function VulyoInline({ style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div style={{ alignItems: "center", display: "inline-flex", gap: spacing.sm, minWidth: 0, ...style }} {...props} />;
}

export function VulyoCard({ style, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <article
      style={{
        background: "var(--vulyo-card-background, #ffffff)",
        border: "1px solid var(--vulyo-border-color, #d6dde6)",
        borderRadius: "var(--vulyo-radius, 8px)",
        boxShadow: "var(--vulyo-shadow, 0 16px 42px rgba(15, 23, 42, 0.1))",
        color: "var(--vulyo-text-color, #0f172a)",
        padding: "var(--vulyo-card-padding, 24px)",
        ...style,
      }}
      {...props}
    />
  );
}

export function VulyoField({ style, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label style={{ color: "var(--vulyo-text-color, #0f172a)", display: "grid", fontSize: 13, fontWeight: 620, gap: spacing.xs, ...style }} {...props} />;
}

type VulyoInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function VulyoInput({ invalid = false, style, ...props }: VulyoInputProps) {
  return (
    <input
      style={{
        background: "var(--vulyo-input-background, #ffffff)",
        border: `1px solid ${invalid ? "var(--vulyo-danger-color, #b42318)" : "var(--vulyo-border-color, #cbd5e1)"}`,
        borderRadius: "var(--vulyo-radius, 8px)",
        boxSizing: "border-box",
        color: "var(--vulyo-text-color, #0f172a)",
        font: "inherit",
        minHeight: "var(--vulyo-control-height, 34px)",
        outlineColor: "var(--vulyo-focus-color, #16756f)",
        outlineOffset: 2,
        padding: "0.42rem 0.68rem",
        width: "100%",
        ...style,
      }}
      {...props}
    />
  );
}

type VulyoButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

function getButtonStyle(variant: NonNullable<VulyoButtonProps["variant"]>): CSSProperties {
  if (variant === "danger") {
    return {
      background: "var(--vulyo-danger-color, #b42318)",
      border: "1px solid var(--vulyo-danger-color, #b42318)",
      color: "#ffffff",
    };
  }
  if (variant === "ghost") {
    return {
      background: "transparent",
      border: "1px solid transparent",
      color: "var(--vulyo-primary-color, #16756f)",
    };
  }

  if (variant === "secondary") {
    return {
      background: "var(--vulyo-secondary-button-background, #f8fafc)",
      border: "1px solid var(--vulyo-border-color, #cbd5e1)",
      color: "var(--vulyo-text-color, #0f172a)",
    };
  }

  return {
    background: "var(--vulyo-primary-color, #16756f)",
    border: "1px solid var(--vulyo-primary-color, #16756f)",
    color: "var(--vulyo-primary-button-text, #ffffff)",
  };
}

export function VulyoButton({ fullWidth = false, style, variant = "primary", ...props }: VulyoButtonProps) {
  return (
    <button
      style={{
        alignItems: "center",
        appearance: "none",
        borderRadius: "var(--vulyo-radius, 8px)",
        boxSizing: "border-box",
        cursor: props.disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        font: "inherit",
        fontSize: 13,
        fontWeight: 620,
        gap: "0.5rem",
        justifyContent: "center",
        minHeight: "var(--vulyo-control-height, 34px)",
        opacity: props.disabled ? 0.68 : 1,
        padding: "0.42rem 0.85rem",
        transition: "background 160ms ease, border-color 160ms ease, color 160ms ease, opacity 160ms ease",
        width: fullWidth ? "100%" : undefined,
        ...getButtonStyle(variant),
        ...style,
      }}
      {...props}
    />
  );
}
