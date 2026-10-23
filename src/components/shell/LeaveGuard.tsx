"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUiFeedback } from "./UiFeedback";

type LeaveGuard = {
  setGuard: (message: string | null) => void;
  // Navega dentro de la app; si hay cambios sin guardar, primero pide confirmación.
  navigate: (href: string) => Promise<void>;
};

const LeaveGuardContext = createContext<LeaveGuard | null>(null);

export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { confirm } = useUiFeedback();
  const message = useRef<string | null>(null);

  const setGuard = useCallback((next: string | null) => {
    message.current = next;
  }, []);

  const navigate = useCallback(
    async (href: string) => {
      if (message.current) {
        const leave = await confirm(message.current, { title: "Cambios sin guardar", confirmLabel: "Salir sin guardar", danger: true });
        if (!leave) return;
        message.current = null;
      }
      router.push(href);
    },
    [confirm, router],
  );

  const value = useMemo(() => ({ setGuard, navigate }), [setGuard, navigate]);
  return <LeaveGuardContext.Provider value={value}>{children}</LeaveGuardContext.Provider>;
}

export function useLeaveGuardContext() {
  const context = useContext(LeaveGuardContext);
  if (!context) throw new Error("useLeaveGuardContext se usa dentro de LeaveGuardProvider");
  return context;
}

const DEFAULT_MESSAGE = "Hay cambios sin guardar. Si salís de esta pantalla, se pierden.";

// Mientras active sea true: avisa al cerrar la pestaña y al seguir un enlace interno.
export function useLeaveGuard(active: boolean, message = DEFAULT_MESSAGE) {
  const { setGuard, navigate } = useLeaveGuardContext();

  useEffect(() => {
    setGuard(active ? message : null);
    return () => setGuard(null);
  }, [active, message, setGuard]);

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    // En captura, antes de que Next.js maneje el clic del enlace.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      void navigate(`${url.pathname}${url.search}`);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active, navigate]);
}
