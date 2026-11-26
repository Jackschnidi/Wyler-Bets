import type { CSSProperties } from "react";

export const card: CSSProperties = {
  padding: "20px",
  borderRadius: "12px",
  background: "#1e293b",
  textAlign: "left",
};

export const input: CSSProperties = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#f8fafc",
};

export const primaryButton: CSSProperties = {
  padding: "10px 18px",
  borderRadius: "8px",
  border: "none",
  background: "#4ade80",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
};

export const dangerButton: CSSProperties = {
  padding: "10px 18px",
  borderRadius: "8px",
  border: "1px solid #f87171",
  background: "transparent",
  color: "#f87171",
  fontWeight: 700,
  cursor: "pointer",
};

export const ghostButton: CSSProperties = {
  padding: "8px 14px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "transparent",
  color: "#cbd5e1",
  cursor: "pointer",
};
