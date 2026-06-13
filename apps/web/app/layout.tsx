import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TRPCReactProvider } from "../trpc/client";

const instrument = localFont({
  variable: "--font-instrument",
  display: "swap",
  src: [
    { path: "./fonts/InstrumentSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/InstrumentSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/InstrumentSans-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/InstrumentSans-Bold.ttf", weight: "700", style: "normal" },
  ],
});

const bricolage = localFont({
  variable: "--font-bricolage",
  display: "swap",
  src: "./fonts/BricolageGrotesque.ttf",
});

export const metadata: Metadata = {
  title: "Autogate",
  description: "Automated release-safety instrument — dashboard",
};

const noFlashTheme = `(function(){try{var t=localStorage.getItem("ag-theme")||"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body className={`${instrument.variable} ${bricolage.variable}`}>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
