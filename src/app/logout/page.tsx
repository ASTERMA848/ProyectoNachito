"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import styles from "./logout.module.css";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (e) {
        console.error("Logout request failed:", e);
      } finally {
        router.replace("/login");
        router.refresh();
      }
    };
    performLogout();
  }, [router]);

  return (
    <main className={`ui-app ${styles.page}`} aria-busy="true">
      <Spinner label="Cerrando sesión" size="lg" />
      <p>Cerrando sesión...</p>
    </main>
  );
}
