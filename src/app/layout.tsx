import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "@liquefy-ui/react/styles.css";
import "./globals.css";
import MainLayout from "@/components/MainLayout";
import { LiquefyProvider } from "@liquefy-ui/react";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agencia de Cambio | Admin",
  description: "Sistema integral de gestión de operaciones cambiarias",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`dark ${manrope.variable} ${jetbrainsMono.variable}`}>
      <body className={manrope.className}>
        <LiquefyProvider theme="dark">
          <MainLayout>{children}</MainLayout>
        </LiquefyProvider>
      </body>
    </html>
  );
}
