import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "⚡ Ship Electrical Design Helper",
  description: "선박 전기 기본설계 도구 — Load Balance, 단선결선도, 전압강하, 케이블 사이징",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
