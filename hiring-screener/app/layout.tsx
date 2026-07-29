import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hiring Screener & ATS — Yellow.ai",
  description: "Candidate screening for Yellow.ai's Forward Deployed hiring track",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-950 antialiased">
        <div className="flex items-center gap-3 px-6 pt-5">
          <Image src="/yellow-ai-logo.webp" alt="Yellow.ai" width={106} height={28} priority />
          <span className="border-l border-stone-300 pl-3 text-sm font-medium text-stone-500">
            Hiring Screener &amp; ATS
          </span>
        </div>
        {children}
      </body>
    </html>
  );
}
