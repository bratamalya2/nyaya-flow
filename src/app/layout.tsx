import type { Metadata } from "next";
import { Domine, Inter } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Domine({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

// Applies the saved theme before first paint so dark and reader modes do not flash light.
const themeScript = `try{var t=localStorage.getItem("nyayaflow-theme");if(t==="dark"||t==="reader"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export const metadata: Metadata = {
  title: { default: "NyayaFlow", template: "%s · NyayaFlow" },
  description: "Secure matter, hearing, task, and document workflows for Indian litigation teams.",
  icons: { icon: "/favicon.png", apple: "/favicon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
