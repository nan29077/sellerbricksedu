import Edu from "./edu";
import type { Metadata } from "next";
import "./globals.css";
import "./refinement.css";
import "./introduction.css";

export const metadata: Metadata = {
  title: "셀러브릭스 에듀 | 라이브 커머스 셀러 아카데미",
  description: "첫 방송부터 성장까지, 라이브 커머스 셀러를 위한 체계적인 동영상 교육",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased"><Edu />{children}</body>
    </html>
  );
}
