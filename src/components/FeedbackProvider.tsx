"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Portal from "@/components/Portal";
import styles from "./FeedbackProvider.module.css";

type Tone = "error" | "success" | "info";
type ConfirmOptions = { title?: string; confirmLabel?: string; danger?: boolean };
type Request = { message: string; options: ConfirmOptions; resolve: (value: boolean) => void };
type Notice = { id: number; message: string; tone: Tone };
type Feedback = {
  notify: (message: string, tone?: Tone) => void;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
};
const Context = createContext<Feedback | null>(null);

function FeedbackIcon({ tone }: { tone: Tone }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    {tone === "success" ? <path d="m8 12 3 3 5-6" /> : <><path d="M12 7v6" /><path d="M12 16v1" /></>}
  </svg>;
}

export default function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [request, setRequest] = useState<Request | null>(null);
  const pending = useRef<Request[]>([]);
  const active = useRef<Request | null>(null);
  const sequence = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const pathname = usePathname();

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setNotices(current => current.filter(notice => notice.id !== id));
  }, []);
  const notify = useCallback((message: string, tone: Tone = "error") => {
    const id = ++sequence.current;
    setNotices(current => [...current, { id, message, tone }]);
    // Los errores permanecen hasta que el operador los cierre.
    if (tone !== "error") timers.current.set(id, setTimeout(() => dismiss(id), 6000));
  }, [dismiss]);
  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => new Promise<boolean>(resolve => {
    const next = { message, options, resolve };
    if (active.current) pending.current.push(next);
    else {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      active.current = next;
      setRequest(next);
    }
  }), []);
  const finish = useCallback((accepted: boolean) => {
    const current = active.current;
    if (!current) return;
    active.current = null;
    dialog.current?.close();
    current.resolve(accepted);
    const next = pending.current.shift() || null;
    active.current = next;
    setRequest(next);
    if (!next && opener.current?.isConnected) opener.current.focus();
  }, []);

  useEffect(() => {
    if (request && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [request]);
  useEffect(() => {
    // Cambiar de página cancela las confirmaciones pendientes, nunca las acepta.
    const cancelAll = () => {
      active.current?.resolve(false);
      pending.current.forEach(item => item.resolve(false));
      active.current = null;
      pending.current = [];
      dialog.current?.close();
    };
    setRequest(null);
    return cancelAll;
  }, [pathname]);
  useEffect(() => {
    const scheduled = timers.current;
    return () => { scheduled.forEach(timer => clearTimeout(timer)); scheduled.clear(); };
  }, []);
  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return <Context.Provider value={value}>
    {children}
    <Portal>
      <section className={styles.notices} aria-label="Mensajes del sistema">
        {notices.map(notice => <div key={notice.id} className={`${styles.notice} ${styles[notice.tone]}`}>
          <span className={styles.icon}><FeedbackIcon tone={notice.tone} /></span>
          <div className={styles.noticeText} role={notice.tone === "error" ? "alert" : "status"}>
            <strong>{notice.tone === "error" ? "Revisá la acción" : notice.tone === "success" ? "Listo" : "Información"}</strong>
            <p>{notice.message}</p>
          </div>
          <button type="button" className={styles.close} aria-label="Cerrar mensaje" onClick={() => dismiss(notice.id)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>)}
      </section>
      <dialog ref={dialog} className={styles.dialog} role="alertdialog" aria-labelledby="confirmation-title" aria-describedby="confirmation-description"
        onCancel={event => { event.preventDefault(); finish(false); }}
        onClick={event => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) finish(false);
        }}>
        {request && <>
          <div className={`${styles.dialogIcon} ${request.options.danger ? styles.error : styles.info}`}>
            <FeedbackIcon tone={request.options.danger ? "error" : "info"} />
          </div>
          <h2 id="confirmation-title">{request.options.title || "Confirmar acción"}</h2>
          <p id="confirmation-description">{request.message}</p>
          <div className={styles.actions}>
            <button type="button" className="flowbite-btn" autoFocus onClick={() => finish(false)}>Cancelar</button>
            <button type="button" className={`flowbite-btn ${request.options.danger ? styles.dangerButton : "flowbite-btn-primary"}`} onClick={() => finish(true)}>
              {request.options.confirmLabel || "Confirmar"}
            </button>
          </div>
        </>}
      </dialog>
    </Portal>
  </Context.Provider>;
}

export function useFeedback() {
  const feedback = useContext(Context);
  if (!feedback) throw new Error("useFeedback requiere FeedbackProvider");
  return feedback;
}
