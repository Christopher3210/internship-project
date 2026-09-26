import type { Metadata } from "next";
import { AppThemeProvider } from "@/components/AppThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internship Admin",
  description: "Internship administration dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="zh-CN"><body><AppThemeProvider>{children}</AppThemeProvider></body></html>;
}
