import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 면접 코치",
  description: "AI 기반 면접 연습 서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
