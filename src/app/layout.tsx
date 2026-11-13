import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "@liquefy-ui/react/styles.css";
import "./globals.css";
import "../styles/responsive.css";
import "../styles/themes.css";
import "../styles/ui-tokens.css";
import "../styles/ui-base.css";
import MainLayout from "@/components/MainLayout";
import { LiquefyProvider } from "@liquefy-ui/react";
import FeedbackProvider from "@/components/FeedbackProvider";

export const metadata: Metadata = {
  title: "Calce | Agencia de cambio",
  description: "Calce registra tus operaciones de cambio, tus cuentas y tu caja, sin vueltas.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light">
      <body>
        <LiquefyProvider theme="dark">
          <FeedbackProvider><MainLayout>{children}</MainLayout></FeedbackProvider>
        </LiquefyProvider>
      </body>
    </html>
  );
}
