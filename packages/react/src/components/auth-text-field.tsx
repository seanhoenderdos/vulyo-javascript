"use client";

import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { VulyoField, VulyoInput } from "./primitives.js";

type AuthTextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "style" | "value"> & {
  endAdornment?: ReactNode | undefined;
  error?: string | undefined;
  errorId: string;
  fieldStyle?: CSSProperties | undefined;
  helpText?: string | undefined;
  helpTextId?: string | undefined;
  inputStyle?: CSSProperties | undefined;
  label: string;
  labelStyle?: CSSProperties | undefined;
  onValueChange: (value: string) => void;
  value: string;
};

export function AuthTextField({
  endAdornment,
  error,
  errorId,
  fieldStyle,
  helpText,
  helpTextId,
  inputStyle,
  label,
  labelStyle,
  onValueChange,
  value,
  ...inputProps
}: AuthTextFieldProps) {
  const describedBy = error ? errorId : helpText ? helpTextId : inputProps["aria-describedby"];

  const input = (
    <VulyoInput
      {...inputProps}
      aria-describedby={describedBy}
      aria-invalid={Boolean(error)}
      invalid={Boolean(error)}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      style={{ paddingRight: endAdornment ? 44 : undefined, ...inputStyle }}
      value={value}
    />
  );

  return (
    <VulyoField htmlFor={inputProps.id} style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {endAdornment ? (
        <span style={{ display: "block", position: "relative" }}>
          {input}
          <span style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)" }}>{endAdornment}</span>
        </span>
      ) : (
        input
      )}
      {error ? (
        <span id={errorId} style={{ color: "var(--vulyo-danger-color, #b42318)", fontSize: 12, fontWeight: 520, lineHeight: 1.4 }}>
          {error}
        </span>
      ) : helpText ? (
        <span id={helpTextId} style={{ color: "var(--vulyo-muted-color, #64748b)", fontSize: 12, fontWeight: 500, lineHeight: 1.4 }}>
          {helpText}
        </span>
      ) : null}
    </VulyoField>
  );
}
