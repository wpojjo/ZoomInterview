import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import ProgressBarProvider from "@/components/ProgressBarProvider";

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
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <ProgressBarProvider />
        <Header />
        {children}
      </body>
    </html>
  );
}
