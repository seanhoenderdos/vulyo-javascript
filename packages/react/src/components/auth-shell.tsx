import { ShieldCheck } from "lucide-react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export function VulyoAuthBrand({ applicationName, logoAltText, logoUrl, markStyle, style }: {
  applicationName: string;
  logoAltText?: string | undefined;
  logoUrl?: string | null | undefined;
  markStyle?: CSSProperties | undefined;
  style?: CSSProperties | undefined;
}) {
  return <div style={{ alignItems: "center", display: "flex", gap: 8, justifyContent: "center", minWidth: 0, ...style }}>
    <span
      aria-hidden={logoUrl ? undefined : "true"}
      style={{
        alignItems: "center",
        background: logoUrl ? "transparent" : "var(--vulyo-text-color, #0f172a)",
        borderRadius: 999,
        color: "var(--vulyo-card-background, #ffffff)",
        display: "inline-flex",
        flex: "0 0 auto",
        fontSize: 12,
        fontWeight: 760,
        height: 26,
        justifyContent: "center",
        width: 26,
        ...markStyle,
      }}
    >
      {logoUrl
        ? <img alt={logoAltText ?? `${applicationName} logo`} src={logoUrl} style={{ display: "block", height: "100%", objectFit: "contain", width: "100%" }} />
        : applicationName.charAt(0).toUpperCase()}
    </span>
    <span style={{ color: "var(--vulyo-text-color, #0f172a)", fontSize: 22, fontWeight: 720, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {applicationName}
    </span>
  </div>;
}

export function VulyoDevelopmentBadge({ children = "Development", style }: { children?: ReactNode; style?: CSSProperties | undefined }) {
  return <span style={{
    alignSelf: "center",
    background: "rgba(15, 23, 42, 0.035)",
    border: "1px solid var(--vulyo-border-color, #d6dde6)",
    borderRadius: 999,
    color: "var(--vulyo-muted-color, #64748b)",
    display: "inline-flex",
    fontSize: 10.5,
    fontWeight: 650,
    justifySelf: "center",
    lineHeight: 1,
    padding: "4px 8px",
    ...style,
  }}>{children}</span>;
}

export function VulyoAuthHeader({ subtitle, subtitleStyle, title, titleStyle, style }: {
  subtitle: ReactNode;
  subtitleStyle?: CSSProperties | undefined;
  title: ReactNode;
  titleStyle?: CSSProperties | undefined;
  style?: CSSProperties | undefined;
}) {
  return <header style={{ display: "grid", gap: 7, justifyItems: "center", textAlign: "center", ...style }}>
    <h2 style={{ color: "var(--vulyo-text-color, #0f172a)", fontSize: 17, fontWeight: 700, lineHeight: 1.25, margin: 0, ...titleStyle }}>{title}</h2>
    <p style={{ color: "var(--vulyo-muted-color, #64748b)", fontSize: 13, lineHeight: 1.45, margin: 0, ...subtitleStyle }}>{subtitle}</p>
  </header>;
}

export function VulyoAuthStatus({ children, kind = "info", style, ...props }: HTMLAttributes<HTMLParagraphElement> & { kind?: "error" | "info" | "success" }) {
  return <p
    aria-live={kind === "error" ? "assertive" : "polite"}
    role={kind === "error" ? "alert" : "status"}
    style={{
      color: kind === "error" ? "var(--vulyo-danger-color, #b42318)" : kind === "success" ? "var(--vulyo-primary-color, #16756f)" : "var(--vulyo-muted-color, #64748b)",
      fontSize: 13,
      margin: 0,
      ...style,
    }}
    {...props}
  >{children}</p>;
}

export function VulyoTrustFooter({ children = "Secured by Vulyo", style, ...props }: HTMLAttributes<HTMLElement>) {
  return <footer
    style={{
      alignItems: "center",
      color: "var(--vulyo-muted-color, #64748b)",
      display: "flex",
      fontSize: 12,
      gap: 6,
      justifyContent: "center",
      ...style,
    }}
    {...props}
  ><ShieldCheck aria-hidden="true" size={15} />{children}</footer>;
}
