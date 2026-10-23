"use client";

import { Fragment, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "./Checkbox";
import { cx } from "./cx";
import { iconSize } from "./tokens.generated";
import styles from "./DataTable.module.css";

export type Column<T> = {
  key: string;
  label: string;
  align?: "start" | "end" | "center";
  width?: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
};
export type SortState = { key: string; dir: "asc" | "desc" };
export type RowTone = "muted" | "danger" | "success" | "warning";
export type TableGroup<T> = {
  key: string;
  label: ReactNode;
  count: number;
  expanded: boolean;
  totals?: Record<string, ReactNode>;
  rows?: T[];
};

type DataTableProps<T> = {
  caption: string;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rowLabel?: (row: T) => string;
  rows?: T[];
  groups?: TableGroup<T>[];
  selectable?: boolean;
  selected?: ReadonlySet<string>;
  onSelectionChange?: (next: Set<string>) => void;
  sort?: SortState;
  onSortChange?: (next: SortState) => void;
  onRowOpen?: (row: T) => void;
  rowTone?: (row: T) => RowTone | undefined;
  totals?: Record<string, ReactNode>;
  onToggleGroup?: (key: string) => void;
  loading?: boolean;
  empty?: ReactNode;
};

const SKELETON_ROWS = 3;

export function DataTable<T>({
  caption,
  columns,
  rowKey,
  rowLabel,
  rows,
  groups,
  selectable = false,
  selected = new Set<string>(),
  onSelectionChange,
  sort,
  onSortChange,
  onRowOpen,
  rowTone,
  totals,
  onToggleGroup,
  loading = false,
  empty,
}: DataTableProps<T>) {
  const visibleRows = groups ? groups.flatMap((group) => (group.expanded ? group.rows ?? [] : [])) : rows ?? [];
  const visibleKeys = visibleRows.map(rowKey);
  const selectedCount = visibleKeys.filter((key) => selected.has(key)).length;
  const columnCount = columns.length + (selectable ? 1 : 0);
  const isEmpty = !loading && (groups ? groups.length === 0 : visibleRows.length === 0);

  const setSelection = (keys: string[], value: boolean) => {
    const next = new Set(selected);
    keys.forEach((key) => (value ? next.add(key) : next.delete(key)));
    onSelectionChange?.(next);
  };

  const alignClass = (column: Column<T>) => styles[column.align ?? "start"];

  const renderRow = (row: T) => {
    const key = rowKey(row);
    const isSelected = selected.has(key);
    const tone = rowTone?.(row);
    return (
      <tr
        key={key}
        className={cx(styles.row, isSelected && styles.selected, tone && styles[tone], onRowOpen && styles.clickable)}
        tabIndex={onRowOpen ? 0 : undefined}
        onClick={() => onRowOpen?.(row)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target === event.currentTarget) onRowOpen?.(row);
        }}
      >
        {selectable && (
          <td className={styles.checkCell} onClick={(event) => event.stopPropagation()}>
            <Checkbox
              aria-label={`Seleccionar ${rowLabel?.(row) ?? "fila"}`}
              checked={isSelected}
              onChange={(event) => setSelection([key], event.target.checked)}
            />
          </td>
        )}
        {columns.map((column) => (
          <td key={column.key} className={alignClass(column)}>
            {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "")}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div className={styles.wrap}>
      <table className={styles.table} aria-busy={loading || undefined}>
        <caption className="ui-sr-only">{caption}</caption>
        <thead className={styles.head}>
          <tr>
            {selectable && (
              <th scope="col" className={styles.checkCell}>
                <Checkbox
                  aria-label="Seleccionar todas las filas visibles"
                  checked={visibleKeys.length > 0 && selectedCount === visibleKeys.length}
                  indeterminate={selectedCount > 0 && selectedCount < visibleKeys.length}
                  disabled={visibleKeys.length === 0}
                  onChange={(event) => setSelection(visibleKeys, event.target.checked)}
                />
              </th>
            )}
            {columns.map((column) => {
              const sorted = sort?.key === column.key ? sort.dir : undefined;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={alignClass(column)}
                  style={column.width ? { width: column.width } : undefined}
                  aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={() => onSortChange({ key: column.key, dir: sorted === "asc" ? "desc" : "asc" })}
                    >
                      {column.label}
                      {sorted === "asc" && <ArrowUp size={iconSize.xs} className={styles.sortIcon} />}
                      {sorted === "desc" && <ArrowDown size={iconSize.xs} className={styles.sortIcon} />}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <tr key={`skeleton-${index}`} className={styles.row}>
                {Array.from({ length: columnCount }, (_, cell) => (
                  <td key={cell}>
                    <span className={styles.skeleton} />
                  </td>
                ))}
              </tr>
            ))}
          {!loading &&
            groups?.map((group) => (
              <Fragment key={group.key}>
                <tr className={styles.groupRow}>
                  {columns.map((column, index) =>
                    index === 0 ? (
                      <th key={column.key} scope="rowgroup" colSpan={selectable ? 2 : 1} className={styles.start}>
                        <button
                          type="button"
                          className={styles.groupToggle}
                          aria-expanded={group.expanded}
                          onClick={() => onToggleGroup?.(group.key)}
                        >
                          {group.expanded ? <ChevronDown size={iconSize.sm} /> : <ChevronRight size={iconSize.sm} />}
                          {group.label}
                          <span className={styles.count}>({group.count})</span>
                        </button>
                      </th>
                    ) : (
                      <td key={column.key} className={alignClass(column)}>{group.totals?.[column.key]}</td>
                    ),
                  )}
                </tr>
                {group.expanded && group.rows?.map(renderRow)}
              </Fragment>
            ))}
          {!loading && !groups && visibleRows.map(renderRow)}
          {isEmpty && (
            <tr>
              <td colSpan={columnCount} className={styles.emptyCell}>{empty}</td>
            </tr>
          )}
        </tbody>
        {totals && !loading && !isEmpty && (
          <tfoot className={styles.foot}>
            <tr>
              {selectable && <td className={styles.checkCell} />}
              {columns.map((column) => (
                <td key={column.key} className={alignClass(column)}>{totals[column.key]}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
