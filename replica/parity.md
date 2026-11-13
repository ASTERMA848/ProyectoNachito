# Paridad con el original

Fecha: 2026-11-13 (tercera medición, después de las dos funciones convenientes). Rama `feat/interfaz-azul`. Fuente: `replica/features.csv`, calculado con `parity.py`.

## Veredicto: se puede publicar

| | primera medición | segunda | ahora |
| --- | --- | --- | --- |
| Puntaje de funciones | 70,3 | 78,0 | **80,2 / 100** |
| Imprescindibles | 34 de 42 | 42 de 42 | **42 de 42** |
| Puntaje de diseño | sin medir | sin medir | sin medir: no hay capturas del original (ver más abajo) |
| Errores abiertos | 1 S3 | ninguno | **ninguno** |

Las tres condiciones del método están cubiertas: todos los imprescindibles, 80 puntos o más de funciones (80,2) y ningún error S1 ni S2 abierto. **El clon pasa a "shippable."** Para llegar a "mejor que el original" falta `/replica-entrepreneur`: decidir en qué conviene superar a Odoo, no solo igualarlo.

## Qué se construyó en esta tanda

| conveniente | cómo quedó |
| --- | --- |
| Filtros por defecto al abrir una vista | Auditoría abre en "Últimos 7 días"; se ve como una faceta común y se puede quitar sin que vuelva. Un enlace con su propia búsqueda (por ejemplo, desde la ficha de un usuario) no recibe el filtro por defecto |
| Paginador entre registros dentro del formulario | "2 / 16" con anterior y siguiente en operaciones, contactos, cuentas y usuarios. Recorre el mismo orden que se veía en la lista al abrir el registro (se guarda por pestaña del navegador); respeta el aviso de cambios sin guardar |

## Por área, de la más floja a la más completa

| área | puntaje | funciones |
| --- | --- | --- |
| actividades | 0 | 1 |
| historial | 33,3 | 5 |
| auditoría | 60 | 2 |
| kanban | 66,7 | 6 |
| lista | 69,2 | 13 |
| navegación | 73,7 | 9 |
| búsqueda | 73,7 | 8 |
| acceso | 75 | 2 |
| campos | 85,7 | 5 |
| ajustes | 90 | 4 |
| formulario | 95,8 | 9 |
| panel de control, tablero, cuentas, general y móvil | 100 | 13 |

## Lo que falta, en orden de construcción

### Convenientes

Bloquear el borrado de registros auditados, favoritos de búsqueda, filtros por período con flechas, separador decimal con punto o coma, notas internas y adjuntos, columnas opcionales, atajos de teclado con superposición al mantener Alt, exportar eligiendo campos (y en XLSX).

### Opcionales

Paleta de comandos (Ctrl+K), actividades programadas y su contador, buscador de ajustes, editor de filtros con reglas, cinta de archivado o cancelado, filtro y mensajes fijados en el historial, arrastrar tarjetas, creación rápida en kanban, plegar columnas, edición en línea y masiva, plegar todos los grupos, importar desde archivo, ofrecer archivar cuando no se puede eliminar, enlace para compartir una vista y llave de acceso.

## Diseño de pantallas

No se puede medir todavía. El recon se hizo solo con fuentes públicas, sin entrar a tu Odoo, y no se guardaron capturas de referencia en `replica/screens/`.

Lo que sí quedó listo: las capturas del clon de las 14 pantallas del recon, en escritorio (1440×900) y teléfono (390×844), en `replica/clone-screens/` (`S01.png` … `S17.png` y `-mobile.png`). Se regeneran con:

```bash
npx playwright test -c playwright.screens.config.ts
```

Para medir el diseño hacen falta capturas del original con el mismo tamaño y estado, guardadas como `replica/screens/S07.png`. Salen de tu propia cuenta de Odoo o de páginas públicas, y solo se usan para comparar. Después:

```bash
python ~/.claude/skills/replica-diff/imgdiff.py replica/screens/S07.png replica/clone-screens/S07.png --out replica/diffs/S07.png
```

El puntaje de diseño compara la estructura (dónde está cada cosa), no los colores: el azul no cuenta en contra.

## Comportamiento por flujo

Clics del original: estimados en el recon a partir de la documentación pública. Clics del clon: contados en la interfaz nueva.

| flujo | original | clon | diferencia | ¿arreglar o dejar? |
| --- | --- | --- | --- | --- |
| F01 crear una operación y completarla | 5 clics más datos, y el estado se cambia con un botón | 4 clics más datos. El estado de la venta sale solo de lo cobrado y pagado, y un cliente o proveedor nuevo se crea desde el mismo campo | Un clic menos, no se puede olvidar de cambiar el estado y no hace falta salir a Contactos | Dejar |
| F02 buscar, filtrar y agrupar | 4 clics, con sugerencias por campo | 3 o 4 clics, con sugerencias por campo, dos niveles de agrupación y búsqueda sin tildes | Igual, y no hace falta escribir las tildes | Dejar |
| F03 favoritos | Guarda búsquedas con nombre, predeterminadas y compartidas | No existe; la búsqueda vive en la URL (sobrevive a recargar y a volver atrás) | No se recuerda entre visitas | Arreglar (conveniente) |
| F04 contacto y su cuenta | 3 clics: ficha, botón de cuenta, movimientos | 3 clics: ficha, pestaña Saldos, saldo de la moneda (abre el estado de cuenta, con su historial) | Igual | Dejar |
| F05 movimiento desde el tablero | 2 clics | 2 clics (Movimiento, Registrar), con aviso y saldo actualizado | Igual. Además, el traspaso entre monedas calcula el importe con la cotización | Dejar |
| F06 historial y notas | Notas, menciones, adjuntos y filtros en el historial | Historial de cambios en operaciones, contactos, cuentas, cajas, usuarios y monedas; sin notas ni adjuntos | Tu web anterior tampoco tenía notas: no es una pérdida, es una función nueva por hacer | Arreglar (conveniente) |
| F07 acciones masivas y exportación | n + 3 clics, eligiendo campos y formato | n + 2 clics, CSV con columnas fijas | Más rápido y menos configurable; las celdas que parecen fórmulas salen como texto | Arreglar a futuro (conveniente) |
| F08 configurar | 3 clics | 2 o 3 clics, con Guardar y Descartar visibles solo si hay cambios | Igual | Dejar |
| F09 usuarios | 4 clics, Archivar y Cambiar contraseña desde Acciones | 4 clics, Pausar y Reactivar desde Acciones, contraseña en la ficha | Igual. Además, un administrador no puede quitarse su propio rol | Dejar |
| F10 navegar y volver | 3 o 4 clics; Ctrl+K y Alt+B | 3 o 4 clics desde Inicio o el menú de aplicaciones; sin atajos | Sin atajos de teclado | Arreglar a futuro (opcionales) |
| F11 líneas de una venta | 2 + n clics | 2 + n clics, con totales que se recalculan y errores por línea | Igual | Dejar |
| F12 iniciar y cerrar sesión | 1 + 2 clics | 1 + 2 clics; después de entrar vuelve a la pantalla pedida | Mejor que el original en la vuelta | Dejar |

Errores en pantalla: los dos marcan el campo con problema y muestran un aviso. El clon además explica por qué no se puede, por ejemplo con el cierre contable o con las operaciones de tesorería.

Lo que el original recuerda y el clon no: la vista elegida (lista o kanban) y los filtros entre una visita y otra. El clon los guarda en la dirección de la página, así que se conservan al volver atrás o al compartir el enlace, pero no al entrar de nuevo desde el menú.

## Lo que conviene construir después

1. **Notas internas en cada ficha**: es lo que más pesa en el área de historial.
2. **Bloquear el borrado de registros auditados**: hoy un administrador puede eliminar una operación; el original solo deja cancelar o archivar.
3. **Favoritos de búsqueda**: guardar la búsqueda actual con nombre, predeterminada o compartida.
4. **Adjuntos en el registro**: hoy no están en ninguna pantalla.
5. **Columnas opcionales**: cada usuario elige qué columnas ve en una lista.

Ninguna de estas bloquea publicar. El siguiente paso del método es `/replica-entrepreneur`, para decidir en qué conviene ser mejor que el original, y después `/replica-brand` antes de publicar.
