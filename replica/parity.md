# Paridad con el original

Fecha: 2026-11-13. Rama `feat/interfaz-azul`. Fuente: `replica/features.csv`, calculado con `parity.py` (imprescindible pesa 3, conveniente 2 y opcional 1; "a medias" cuenta la mitad; las filas `skip` no cuentan).

## Veredicto: todavía no se puede publicar

| | |
| --- | --- |
| Puntaje de funciones | **70,3 / 100** (77 funciones contadas) |
| Imprescindibles | **34 de 42** hechas, 7 a medias y 1 sin hacer |
| Puntaje de diseño | **sin medir**: no hay capturas del original para comparar (ver más abajo) |
| Errores abiertos | ninguno S1 ni S2; 1 S3 (BUG-004, búsqueda con tildes) |

Para pasar a "se puede publicar" faltan las 8 imprescindibles y llegar a 80 puntos de funciones. Sin errores S1 ni S2 abiertos, eso ya se cumple.

Corrección en esta revisión: la barra de progreso por columna del kanban ya estaba hecha (barra por estado de cobro con el total de la columna) y figuraba como faltante. El puntaje subió de 69,8 a 70,3.

## Por área, de la más floja a la más completa

| área | puntaje | funciones |
| --- | --- | --- |
| actividades | 0 | 1 |
| historial | 16,7 | 5 |
| búsqueda | 47,4 | 8 |
| cuentas | 50 | 1 |
| móvil | 50 | 1 |
| campos | 53,6 | 5 |
| auditoría | 60 | 2 |
| navegación | 65,8 | 9 |
| kanban | 66,7 | 6 |
| lista | 69,2 | 13 |
| acceso | 75 | 2 |
| formulario | 87,5 | 9 |
| ajustes | 90 | 4 |
| panel de control | 100 | 4 |
| tablero | 100 | 3 |
| general | 100 | 4 |

## Lo que falta, en orden de construcción

### Imprescindibles (bloquean la publicación)

1. **Selector de contacto con autocompletar y crear** (falta). Hoy se elige de una lista desplegable; con muchos contactos no escala y no se puede crear uno sin salir del formulario.
2. **Agrupar por varios campos** (a medias). Hoy un solo nivel.
3. **Buscador con sugerencias por campo** (a medias). Hoy el texto busca en todos los campos a la vez; falta elegir "Buscar cliente: …", "Buscar número: …".
4. **Campos de importe con símbolo** (a medias). Se ve el código de moneda; falta el campo con símbolo integrado.
5. **Cuentas agrupadas por contacto con subtotales por moneda** (a medias). Hoy se agrupa por moneda o por situación.
6. **Historial en todos los registros** (a medias). Está en operaciones y contactos; faltan cuentas, cajas, usuarios y monedas.
7. **Kanban por defecto en el teléfono** (a medias). Contactos sí; operaciones abre en lista.
8. **Menú de usuario con perfil** (a medias). Hoy "Mi perfil" lleva a Configuración.

### Convenientes

Bloquear el borrado de registros auditados, favoritos de búsqueda, filtros por defecto al abrir una vista, filtros por período con flechas, separador decimal con punto o coma, paginador entre registros dentro del formulario, notas internas y adjuntos, columnas opcionales, atajos de teclado y exportar eligiendo campos (y en XLSX).

### Opcionales

Paleta de comandos (Ctrl+K), actividades programadas y su contador, buscador de ajustes, editor de filtros con reglas, cinta de archivado o cancelado, filtro y mensajes fijados en el historial, arrastrar tarjetas, creación rápida en kanban (el componente ya la soporta, ninguna pantalla la usa), plegar columnas, edición en línea y masiva, plegar todos los grupos, importar desde archivo, ofrecer archivar cuando no se puede eliminar, enlace para compartir una vista y llave de acceso.

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
| F01 crear una operación y completarla | 5 clics más datos, y el estado se cambia con un botón | 4 clics más datos. El estado de la venta sale solo de lo cobrado y pagado | Un clic menos y no se puede olvidar de cambiar el estado | Dejar |
| F02 buscar, filtrar y agrupar | 4 clics, con sugerencias por campo | 3 clics (Enter, filtro, agrupar), búsqueda en todos los campos | Más rápido pero menos preciso; un solo nivel de agrupación | Arreglar (imprescindibles 2 y 3) |
| F03 favoritos | Guarda búsquedas con nombre, predeterminadas y compartidas | No existe; la búsqueda vive en la URL (sobrevive a recargar y a volver atrás) | No se recuerda entre visitas | Arreglar (conveniente) |
| F04 contacto y su cuenta | 3 clics: ficha, botón de cuenta, movimientos | Ficha y botón "Operaciones" en 2 clics. La pestaña Saldos muestra los saldos, pero sus filas no abren el estado de cuenta | Para ver los movimientos hay que ir a Cuentas corrientes y buscar al contacto | Arreglar: que cada saldo abra su estado de cuenta (cambio chico) |
| F05 movimiento desde el tablero | 2 clics | 2 clics (Movimiento, Registrar), con aviso y saldo actualizado | Igual. Además, el traspaso entre monedas calcula el importe con la cotización | Dejar |
| F06 historial y notas | Notas, menciones, adjuntos y filtros en el historial | Historial de cambios en operaciones y contactos; sin notas ni adjuntos | Tu web anterior tampoco tenía notas: no es una pérdida, es una función nueva por hacer | Arreglar (conveniente) |
| F07 acciones masivas y exportación | n + 3 clics, eligiendo campos y formato | n + 2 clics, CSV con columnas fijas | Más rápido y menos configurable; las celdas que parecen fórmulas salen como texto | Arreglar a futuro (conveniente) |
| F08 configurar | 3 clics | 2 o 3 clics, con Guardar y Descartar visibles solo si hay cambios | Igual | Dejar |
| F09 usuarios | 4 clics, Archivar y Cambiar contraseña desde Acciones | 4 clics, Pausar y Reactivar desde Acciones, contraseña en la ficha | Igual. Además, un administrador no puede quitarse su propio rol | Dejar |
| F10 navegar y volver | 3 o 4 clics; Ctrl+K y Alt+B | 3 o 4 clics desde Inicio o el menú de aplicaciones; sin atajos | Sin atajos de teclado | Arreglar a futuro (opcionales) |
| F11 líneas de una venta | 2 + n clics | 2 + n clics, con totales que se recalculan y errores por línea | Igual | Dejar |
| F12 iniciar y cerrar sesión | 1 + 2 clics | 1 + 2 clics; después de entrar vuelve a la pantalla pedida | Mejor que el original en la vuelta | Dejar |

Errores en pantalla: los dos marcan el campo con problema y muestran un aviso. El clon además explica por qué no se puede, por ejemplo con el cierre contable o con las operaciones de tesorería.

Lo que el original recuerda y el clon no: la vista elegida (lista o kanban) y los filtros entre una visita y otra. El clon los guarda en la dirección de la página, así que se conservan al volver atrás o al compartir el enlace, pero no al entrar de nuevo desde el menú.

## Las cinco cosas que conviene construir ahora

1. **Selector de contacto con autocompletar y "Crear …"** en ventas y operaciones (imprescindible 1). Es la que más se nota en el trabajo diario.
2. **Buscador con sugerencias por campo** (imprescindible 3), y de paso la búsqueda sin tildes (BUG-004), que toca las mismas consultas.
3. **Agrupar por varios campos** (imprescindible 2), por ejemplo estado y después cliente.
4. **Historial en cuentas, cajas, usuarios y monedas** (imprescindible 6). La auditoría ya registra esos cambios: falta mostrarlos en cada ficha.
5. **Cuentas agrupadas por contacto con subtotales por moneda**, y que los saldos de la ficha del contacto abran su estado de cuenta (imprescindible 5 y la diferencia de F04).

Con esas cinco, más las tres imprescindibles chicas (importe con símbolo, kanban en el teléfono y menú de perfil), el clon queda en condiciones de publicarse. El siguiente paso es `/replica-build` para esos huecos. `/replica-entrepreneur` (qué mejorar respecto del original) conviene después, cuando la paridad esté cubierta.
