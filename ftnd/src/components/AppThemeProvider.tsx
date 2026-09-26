"use client";

import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import type { ReactNode } from "react";

const theme = createTheme({
  palette: { primary: { main: "#2563eb" }, background: { default: "#f8fafc" } },
  shape: { borderRadius: 10 },
  typography: { fontFamily: "Arial, 'Microsoft YaHei', sans-serif" },
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}><CssBaseline />{children}</ThemeProvider>;
}
