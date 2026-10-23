"use client";

import { useId, type ReactNode } from "react";
import { ArrowRight, FileText, Pin } from "lucide-react";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { TextArea } from "./Input";
import { iconSize } from "./tokens.generated";
import styles from "./HistoryPanel.module.css";

export type HistoryEntry =
  | { id: string; kind: "note"; author: string; at: string; body: string; pinned?: boolean }
  | { id: string; kind: "change"; author: string; at: string; changes: { field: string; from: string; to: string }[] }
  | { id: string; kind: "attachment"; author: string; at: string; fileName: string; href: string; size: string };

export type HistoryGroup = { label: string; entries: HistoryEntry[] };

type HistoryPanelProps = { toolbar?: ReactNode; composer?: ReactNode; groups: HistoryGroup[]; emptyText?: string };

export function HistoryPanel({ toolbar, composer, groups, emptyText = "Todavía no hay movimientos en este registro." }: HistoryPanelProps) {
  return (
    <section className={styles.panel} aria-label="Historial">
      {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
      {composer}
      {groups.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            <h3 className={styles.date}>
              <span>{group.label}</span>
            </h3>
            <ol className={styles.entries}>
              {group.entries.map((entry) => (
                <li key={entry.id} className={styles.entry}>
                  <Avatar name={entry.author} size="lg" />
                  <div className={styles.entryBody}>
                    <p className={styles.meta}>
                      <span className={styles.author}>{entry.author}</span>
                      <span className={styles.time}>{entry.at}</span>
                      {entry.kind === "note" && entry.pinned && (
                        <span className={styles.pinned}>
                          <Pin size={iconSize.xs} /> Fijada
                        </span>
                      )}
                    </p>
                    <EntryContent entry={entry} />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))
      )}
    </section>
  );
}

function EntryContent({ entry }: { entry: HistoryEntry }) {
  if (entry.kind === "note") return <p className={styles.body}>{entry.body}</p>;
  if (entry.kind === "attachment") {
    return (
      <a className={styles.file} href={entry.href}>
        <FileText size={iconSize.sm} />
        <span>{entry.fileName}</span>
        <span className={styles.size}>{entry.size}</span>
      </a>
    );
  }
  return (
    <ul className={styles.changes}>
      {entry.changes.map((change) => (
        <li key={change.field}>
          <span className={styles.old}>{change.from}</span>
          <ArrowRight size={iconSize.xs} className={styles.arrow} />
          <span className="ui-sr-only"> cambió a </span>
          <span className={styles.new}>{change.to}</span>
          <span className={styles.field}> ({change.field})</span>
        </li>
      ))}
    </ul>
  );
}

type ComposerProps = { value: string; onChange: (value: string) => void; onSubmit: () => void; submitLabel?: string };

export function HistoryComposer({ value, onChange, onSubmit, submitLabel = "Registrar nota" }: ComposerProps) {
  const id = useId();
  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) onSubmit();
      }}
    >
      <label htmlFor={id} className="ui-sr-only">Nota interna</label>
      <TextArea
        id={id}
        variant="boxed"
        rows={2}
        value={value}
        placeholder="Escribí una nota para el equipo..."
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && value.trim()) onSubmit();
        }}
      />
      <Button type="submit" variant="primary" size="sm" disabled={!value.trim()}>
        {submitLabel}
      </Button>
    </form>
  );
}
