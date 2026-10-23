"use client";

import { Fragment, useId, type ReactNode } from "react";
import { ChevronDown, Filter, Layers, Search, Star, X } from "lucide-react";
import { cx } from "./cx";
import { iconSize } from "./tokens.generated";
import styles from "./SearchBar.module.css";

export type FacetKind = "filter" | "group" | "favorite" | "field";
export type Facet = { id: string; kind: FacetKind; label?: string; values: string[] };

const FACET_ICON = { filter: Filter, group: Layers, favorite: Star, field: Search };
const FACET_NAME = { filter: "filtro", group: "agrupación", favorite: "favorito", field: "búsqueda" };

type SearchBarProps = {
  facets: Facet[];
  query: string;
  onQueryChange: (query: string) => void;
  onRemoveFacet: (id: string) => void;
  onSubmit?: () => void;
  panel?: ReactNode;
  panelOpen?: boolean;
  onTogglePanel?: () => void;
  label?: string;
  placeholder?: string;
};

export function SearchBar({
  facets,
  query,
  onQueryChange,
  onRemoveFacet,
  onSubmit,
  panel,
  panelOpen = false,
  onTogglePanel,
  label = "Buscar",
  placeholder = "Buscar...",
}: SearchBarProps) {
  const inputId = useId();
  const panelId = useId();

  return (
    <div className={styles.root}>
      <div className={styles.box}>
        {/* Las facetas y el campo pasan de línea si no entran; el botón del panel queda fijo a la derecha. */}
        <div className={styles.content}>
          <Search size={iconSize.sm} className={styles.searchIcon} />
          {facets.length > 0 && (
            <ul className={styles.facets} aria-label="Filtros aplicados">
              {facets.map((facet) => (
                <FacetChip key={facet.id} facet={facet} onRemove={() => onRemoveFacet(facet.id)} />
              ))}
            </ul>
          )}
          <label htmlFor={inputId} className="ui-sr-only">{label}</label>
          <input
            id={inputId}
            type="search"
            className={styles.input}
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSubmit?.();
              // Con el campo vacío, Retroceso quita la última faceta.
              if (event.key === "Backspace" && !query && facets.length > 0) onRemoveFacet(facets[facets.length - 1].id);
            }}
          />
        </div>
        {onTogglePanel && (
          <button
            type="button"
            className={cx(styles.toggle, panelOpen && styles.toggleOpen)}
            aria-label="Opciones de búsqueda"
            aria-expanded={panelOpen}
            aria-controls={panelId}
            onClick={onTogglePanel}
          >
            <ChevronDown size={iconSize.sm} />
          </button>
        )}
      </div>
      {panelOpen && panel && (
        <div id={panelId} className={styles.panel}>
          {panel}
        </div>
      )}
    </div>
  );
}

function FacetChip({ facet, onRemove }: { facet: Facet; onRemove: () => void }) {
  const Icon = FACET_ICON[facet.kind];
  const text = `${facet.label ? `${facet.label}: ` : ""}${facet.values.join(" o ")}`;
  return (
    <li className={styles.facet}>
      <span className={cx(styles.facetIcon, styles[facet.kind])} aria-hidden="true">
        <Icon size={iconSize.xs} />
      </span>
      <span className={styles.facetLabel}>
        <span className="ui-sr-only">{FACET_NAME[facet.kind]}: </span>
        {facet.label && <span className={styles.facetField}>{facet.label}: </span>}
        {facet.values.map((value, index) => (
          <Fragment key={value}>
            {index > 0 && <em className={styles.or}> o </em>}
            {value}
          </Fragment>
        ))}
      </span>
      <button type="button" className={styles.facetRemove} aria-label={`Quitar ${FACET_NAME[facet.kind]} ${text}`} onClick={onRemove}>
        <X size={iconSize.xs} />
      </button>
    </li>
  );
}
