import Edu from "./edu";
import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./refinement.css";
import "./introduction.css";
import "./features.css";
import "./introduction-enhanced.css";

const shareTitle = "첫 라이브의 자신감 | 셀러브릭스 에듀";
const shareDescription = "처음 시작하는 셀러를 위한 라이브 커머스 교육. 준비부터 실전까지, 나의 속도로 배우고 성장하세요.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3040").split(",")[0].trim();
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https";

  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: shareTitle,
    description: shareDescription,
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: "셀러브릭스 에듀",
      title: shareTitle,
      description: shareDescription,
      images: [{ url: "/images/share-card.jpg", width: 1200, height: 630, alt: "첫 라이브의 자신감, 여기서 시작하세요. 셀러브릭스 에듀", type: "image/jpeg" }],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: shareDescription,
      images: ["/images/share-card.jpg"],
    },
    other: {
      "codex-preview": "development",
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
  };
}

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
