"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Button, Dialog, Toast, ToastRegion, type ToastTone } from "@/components/ui";

type ConfirmOptions = { title?: string; confirmLabel?: string; danger?: boolean };
type ToastItem = { id: number; tone: ToastTone; title: string; text?: string };
type ConfirmRequest = Required<ConfirmOptions> & { message: string; resolve: (accepted: boolean) => void };

type UiFeedback = {
  notify: (title: string, tone?: ToastTone, text?: string) => void;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
};

const UiFeedbackContext = createContext<UiFeedback | null>(null);
const AUTO_CLOSE_MS = 5000;

// Avisos y confirmaciones de la interfaz nueva. Los errores quedan fijos hasta cerrarlos.
export function UiFeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const counter = useRef(0);
  const pathname = usePathname();

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const notify = useCallback<UiFeedback["notify"]>(
    (title, tone = "info", text) => {
      const id = ++counter.current;
      setToasts((current) => [...current, { id, tone, title, text }]);
      if (tone !== "danger") window.setTimeout(() => dismiss(id), AUTO_CLOSE_MS);
    },
    [dismiss],
  );

  const confirm = useCallback<UiFeedback["confirm"]>(
    (message, options = {}) =>
      new Promise<boolean>((resolve) =>
        setRequest({
          message,
          resolve,
          title: options.title ?? "Confirmar",
          confirmLabel: options.confirmLabel ?? "Confirmar",
          danger: options.danger ?? false,
        }),
      ),
    [],
  );

  const answer = (accepted: boolean) => {
    request?.resolve(accepted);
    setRequest(null);
  };

  // Cambiar de pantalla cancela una confirmación pendiente; nunca la acepta.
  useEffect(() => {
    setRequest((pending) => {
      pending?.resolve(false);
      return null;
    });
  }, [pathname]);

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <UiFeedbackContext.Provider value={value}>
      {children}
      <ToastRegion>
        {toasts.map((toast) => (
          <Toast key={toast.id} tone={toast.tone} title={toast.title} onClose={() => dismiss(toast.id)}>
            {toast.text}
          </Toast>
        ))}
      </ToastRegion>
      <Dialog
        open={request !== null}
        onClose={() => answer(false)}
        title={request?.title ?? ""}
        size="sm"
        footer={
          <>
            <Button variant={request?.danger ? "danger" : "primary"} onClick={() => answer(true)}>
              {request?.confirmLabel}
            </Button>
            <Button onClick={() => answer(false)}>Cancelar</Button>
          </>
        }
      >
        <p>{request?.message}</p>
      </Dialog>
    </UiFeedbackContext.Provider>
  );
}

export function useUiFeedback() {
  const context = useContext(UiFeedbackContext);
  if (!context) throw new Error("useUiFeedback se usa dentro de UiFeedbackProvider");
  return context;
}
