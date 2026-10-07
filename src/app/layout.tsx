import type { Metadata, Viewport } from "next";
import { Jua } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

/** GitHub Pages 같은 하위 경로 배포용 접두사 (로컬은 "") */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// 앱에 번들하는 폰트 1종 (빌드 때 내려받아 같이 배포된다. 외부 요청 없음)
const jua = Jua({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-jua" });

export const metadata: Metadata = {
  title: "도트 젤리 소팅",
  description: "같은 젤리끼리 한 병에! 내가 꾸민 도트 젤리로 하는 소팅 퍼즐",
  manifest: `${BASE}/manifest.webmanifest`,
  applicationName: "도트 젤리 소팅",
  appleWebApp: { capable: true, title: "젤리 소팅", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: `${BASE}/icons/icon-192.png`, sizes: "192x192", type: "image/png" }],
    apple: [{ url: `${BASE}/icons/apple-touch-icon.png`, sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff4f8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // 저장된 모드에 따라 data-theme(마크 모드 = blocks)을 붙이므로 서버 HTML과 달라도 경고하지 않게 한다
    <html lang="ko" className={jua.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
