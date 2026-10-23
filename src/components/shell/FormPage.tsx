"use client";

import type { ReactNode } from "react";
import { Badge, Breadcrumbs, ControlPanel, type Crumb } from "@/components/ui";
import styles from "./FormPage.module.css";

type FormPageProps = {
  breadcrumbs: Crumb[];
  actions?: ReactNode;
  dirty?: boolean;
  header: ReactNode;
  notice?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
};

// Pantalla de formulario: migas y acciones arriba, encabezado con estados, hoja e historial al costado.
export function FormPage({ breadcrumbs, actions, dirty = false, header, notice, aside, children }: FormPageProps) {
  return (
    <div className={styles.page}>
      <ControlPanel
        start={
          <>
            <Breadcrumbs items={breadcrumbs} />
            {actions}
          </>
        }
        end={dirty ? <Badge tone="warning">Cambios sin guardar</Badge> : undefined}
      />
      <div className={styles.layout}>
        <div className={styles.main}>
          {header}
          {notice}
          {children}
        </div>
        {aside && <aside className={styles.aside}>{aside}</aside>}
      </div>
    </div>
  );
}

export function Notice({ tone = "info", children, action }: { tone?: "info" | "warning"; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`${styles.notice} ${tone === "warning" ? styles.noticeWarning : ""}`} role="status">
      <span>{children}</span>
      {action}
    </div>
  );
}
