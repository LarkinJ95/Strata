import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Sora } from "next/font/google";
import { Toaster } from "sonner";
import { SessionBridge } from "@/components/session-bridge";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const display = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "STRATA — Asbestos Compliance",
  description: "Permanent asbestos records for every building.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "STRATA", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon-64.png", type: "image/png", sizes: "64x64" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b857f",
  width: "device-width",
  initialScale: 1,
  // Field Mode is used one-handed on a phone; let inspectors pinch a photograph
  // or a small code without the page locking zoom.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} ${mono.variable} font-sans bg-paper bg-aurora`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=new URLSearchParams(location.search);var t=p.get("access")||localStorage.getItem("strata_session");if(t){localStorage.setItem("strata_session",t);}function hasCookie(){try{return document.cookie.split("; ").some(function(c){return c.indexOf("strata_client=")===0;});}catch(e){return false;}}document.addEventListener("click",function(e){if(hasCookie())return;var a=e.target&&e.target.closest&&e.target.closest("a");if(!a)return;var tok=localStorage.getItem("strata_session");if(!tok)return;var href=a.getAttribute("href");if(!href||href.indexOf("access=")!==-1||href.indexOf("://")!==-1||href.charAt(0)==="#"||href.indexOf("mailto:")===0)return;e.preventDefault();e.stopPropagation();location.assign(href+(href.indexOf("?")>=0?"&":"?")+"access="+encodeURIComponent(tok));},true);}catch(e){}})();`,
          }}
        />
        <SessionBridge />
        <PwaRegister />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
