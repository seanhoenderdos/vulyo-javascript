import type { CSSProperties } from "react";

export type VulyoAuthVariables = {
  colorBackground?: string;
  colorCard?: string;
  colorText?: string;
  colorMuted?: string;
  colorPrimary?: string;
  colorPrimaryText?: string;
  colorBorder?: string;
  colorDanger?: string;
  colorFocus?: string;
  controlHeight?: string | number;
  fontFamily?: string;
  radius?: string | number;
  shadow?: string;
};

export type VulyoAuthElement =
  | "root"
  | "card"
  | "body"
  | "brand"
  | "brandMark"
  | "developmentBadge"
  | "header"
  | "title"
  | "subtitle"
  | "form"
  | "field"
  | "label"
  | "input"
  | "passwordToggle"
  | "button"
  | "socialButton"
  | "alert"
  | "footer"
  | "securityFooter"
  | "link"
  | "legal";

export type VulyoAppearance = {
  variables?: VulyoAuthVariables;
  elements?: Partial<Record<VulyoAuthElement, CSSProperties>>;
};

type VulyoCssProperties = CSSProperties & Record<`--${string}`, string | number | undefined>;

const defaultAuthVariables = {
  colorBackground: "#ffffff",
  colorCard: "#ffffff",
  colorText: "#0f172a",
  colorMuted: "#64748b",
  colorPrimary: "#16756f",
  colorPrimaryText: "#ffffff",
  colorBorder: "#d6dde6",
  colorDanger: "#b42318",
  colorFocus: "#16756f",
  controlHeight: 34,
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
  radius: 6,
  shadow: "0 18px 48px rgba(15, 23, 42, 0.12)",
} satisfies Required<VulyoAuthVariables>;

export function resolveAuthVariables(appearance?: VulyoAppearance) {
  return { ...defaultAuthVariables, ...appearance?.variables };
}

export function toAuthCssVariables(variables: ReturnType<typeof resolveAuthVariables>): VulyoCssProperties {
  return {
    "--vulyo-card-background": variables.colorCard,
    "--vulyo-border-color": variables.colorBorder,
    "--vulyo-danger-color": variables.colorDanger,
    "--vulyo-focus-color": variables.colorFocus,
    "--vulyo-control-height": typeof variables.controlHeight === "number" ? `${variables.controlHeight}px` : variables.controlHeight,
    "--vulyo-primary-button-text": variables.colorPrimaryText,
    "--vulyo-primary-color": variables.colorPrimary,
    "--vulyo-radius": typeof variables.radius === "number" ? `${variables.radius}px` : variables.radius,
    "--vulyo-shadow": variables.shadow,
    "--vulyo-muted-color": variables.colorMuted,
    "--vulyo-text-color": variables.colorText,
  };
}
