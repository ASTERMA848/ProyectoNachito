# Marca: Calce

Fecha: 2026-11-13. Rama `feat/interfaz-azul`. Esta web es de **uso interno** de tu agencia: no se vende ni se publica en tiendas. Igual conviene nombre y marca propios — por si algún día cambia eso, y para que nada de lo que ve el equipo adentro recuerde al original. Ángulo de origen (`replica/fixes.md`): *"una sola cosa, bien hecha"*, frente a un ERP que intenta serlo todo.

## El nombre

### Cómo se llegó a Calce

Se generaron 20 candidatos cruzando los cinco estilos que pide el método (descriptivo, compuesto, inventado, metáfora, verbo) con el vocabulario de una casa de cambio y de la contabilidad argentina: *cambio, cotización, caja, arqueo, cuadrar, calzar, asiento, pizarra, mostrador, rueda*.

De los 20, se descartaron en la propia generación los que sonaban demasiado a sigla fintech genérica (`CuadreFX`, `ArqueoFX`) o a comando crudo (`Cierra`, `Asienta`), y se llegó a 5 finalistas. Una búsqueda web de cada uno (no es una búsqueda de marca, ver más abajo) sacó a tres de la lista por colisión real en una categoría cercana:

- **Pizarra**: ya es una app uruguaya que sigue cotizaciones de moneda minuto a minuto. Misma categoría, mismo idioma. Descartada.
- **Cuadra**: ya es una fintech chilena de software financiero (cobranza de facturas, conciliación bancaria, pagos a proveedores) — la misma categoría exacta que esta web. Descartada.
- **Vera**: nombre muy usado en fintech y cripto (billeteras, coaches financieros, una red cripto). Demasiado saturado. Descartada.

Quedaron 5 limpios en esa búsqueda, con estilos distintos:

| nombre | estilo | por qué |
| --- | --- | --- |
| **Calce** | verbo / término financiero | De "calzar": que las cuentas calcen. Es además el término real que usa el BCRA para el "calce de moneda extranjera" (que lo que entra y lo que sale coincidan). Corto, se dice una sola vez y se entiende. |
| Arqueo | descriptivo | El término contable exacto para el recuento de caja — el ritual diario que esta web reemplaza. Muy literal, algo genérico como marca. |
| Cuadratura | compuesto | De "cuadrar" los números. Vecino cercano de "Cuadra" (la fintech chilena) — más largo y distinto, pero conviene tenerlo presente. |
| Certero | inventado / adjetivo | "Que da en el blanco". No menciona plata ni cambio; más genérico que los otros cuatro. |
| Nítido | metáfora | Claro, sin ruido. Habla de la interfaz más que de que los números cierren. |

**Elegido: Calce.** Es el que más dice del ángulo ("una sola cosa, bien hecha: que los números siempre calcen") sin ser el nombre literal de una función, como si fuera *Arqueo*. Ya se aplicó en la interfaz (ver "Dónde quedó aplicado").

### Las verificaciones — qué se corrió y qué no

| control | Calce | dónde |
| --- | --- | --- |
| Búsqueda general en la web (colisión con otra app o empresa del rubro) | Corrida, sin resultados de un competidor con este nombre | búsqueda web, 2026-11-13 |
| Marca en Argentina (INPI) | **a correr** | https://portaltramites.inpi.gob.ar |
| Marca en EE.UU. (USPTO) | **a correr** | https://tmsearch.uspto.gov |
| Marca en la UE (EUIPO) | **a correr** | https://euipo.europa.eu/eSearch |
| Marca en Canadá | **a correr** | https://ised-isde.canada.ca/cipo/trademarks |
| Base global (WIPO) | **a correr** | https://www3.wipo.int/branddb/en/ |
| Dominio (.com, .com.ar) | **a correr** — no hay `whois` en este entorno; dos nombres de prueba resolvieron con código 200, lo que no prueba nada sobre si están libres | — |
| Tiendas de apps | no aplica: esta web no se publica en tiendas | — |
| Redes y GitHub | **a correr** | — |

Esto es un filtro, no una autorización legal. Si algún día esta web deja de ser de uso interno, un estudio de marcas tiene que hacer la búsqueda en serio antes de gastar un peso en el nombre — en especial el INPI argentino, que es el que de verdad importa acá.

## Paleta

No hace falta una paleta nueva: `replica-design` ya reemplazó el violeta de marca de Odoo (`#704b66`) y su verde azulado de acción (`#007e85`) por un azul propio, a tu pedido, antes de este paso. Es una familia de color distinta a la del original, que es justo lo que pide este método.

Se confirmó el contraste con `contrast.py replica/design/tokens.json`: **94 pares, 0 fallas AA** (tema claro y oscuro).

Los dos colores de Odoo quedaron en `replica/brand.json` para que el barrido los detecte si alguna vez vuelven a aparecer.

## Brief de logo

No es un logo: es el encargo para quien lo vaya a dibujar (vos, un diseñador o una IA de imagen).

- **Idea en una frase:** dos piezas que encajan exactamente — como dos extremos de una cuenta que calzan — sin ningún truco de letra ni de forma que recuerde a la "O" de Odoo.
- **Tipo de marca:** isotipo + wordmark (el ícono de flecha doble que ya usa el login, `ArrowLeftRight` de Lucide, o una forma propia de dos mitades que encastran) junto a la palabra "Calce" en Manrope semibold, la tipografía que ya usa toda la interfaz.
- **Tiene que funcionar** a 16px (favicon) y como ícono de app de 1024×1024.
- **Entregables:** SVG del isotipo, ícono de app 1024×1024 sin transparencia (para iOS, aunque esta web no vaya a una tienda, sirve para el acceso directo del escritorio), set de favicon, imagen social 1200×630.
- **No se puede parecer al de Odoo:** nada de violeta, nada de forma de píldora redondeada ni de doble "O" estilizada. El favicon actual (`src/app/favicon.ico`) es el genérico de la plantilla de Next.js — un círculo negro con un triángulo blanco — y hay que reemplazarlo igual, no porque se parezca a Odoo sino porque no es de nadie.

## Voz

Tres palabras, con lo que cada una no significa:

- **Directa** — no fría. Dice lo que pasó y qué sigue, sin relleno, pero con el "vos" de todos los días.
- **Precisa** — no técnica. Nombra el número, la moneda, la cuenta; nunca dice "ocurrió un error" sin decir cuál.
- **Tranquila** — no seca. Ante un error explica qué hacer, no solo que algo salió mal.

Cinco pares de hace / no hace:

| hace | no hace |
| --- | --- |
| "No se pudo guardar. Probá de nuevo en un momento." | "Ha ocurrido un error inesperado." |
| "Los saldos de cuentas y cajas quedaron actualizados." | "La operación se completó correctamente." |
| "Revisá los datos marcados." | "Formulario inválido." |
| "Tu rol puede consultar las operaciones pero no modificarlas." | "No tenés permisos." |
| "Tenés cambios sin guardar." | "¿Estás seguro de que querés salir?" |

### Las 10 cadenas más vistas

Ya están en esta voz desde que se migró cada pantalla (son del código, no se inventaron ahora). Se revisaron una por una contra los pares de arriba:

| dónde | texto | veredicto |
| --- | --- | --- |
| Marca del login | "Calce" + "Agencia de cambio" | nuevo — aplicado en esta tanda |
| Título de la pestaña | "Calce \| Agencia de cambio" | nuevo — aplicado en esta tanda |
| Guardar una venta | "Venta registrada" / "Cambios guardados" — "Los saldos de cuentas y cajas quedaron actualizados." | ya en voz |
| Error al guardar | "No se pudo guardar" — "Probá de nuevo en un momento." | ya en voz |
| Validación de formulario | "Revisá los datos marcados" | ya en voz |
| Eliminar una operación | "{número} eliminada" — "Los saldos quedaron ajustados." | ya en voz |
| Sin conexión | "No hay conexión con el servidor" | ya en voz |
| Rol de solo lectura | "Tu rol puede consultar las operaciones pero no modificarlas." | ya en voz |
| Cambios sin guardar | "Cambios sin guardar" / "Salir sin guardar" | ya en voz |
| Estado vacío de una lista | "Ningún contacto coincide con la búsqueda" + botón "Quitar filtros" | ya en voz |

No se reescribió ninguna por obligación: todas ya nombran el número o la consecuencia, como pide la voz. Las dos que cambiaron son las que mencionaban "Agencia de Cambio" como si fuera el nombre del producto.

## Dónde quedó aplicado

- `src/app/layout.tsx`: título de la pestaña y descripción.
- `src/app/login/page.tsx` y `login.module.css`: la marca del login ahora dice "Calce" con "Agencia de cambio" como texto más chico debajo (en vez de que "Agencia de Cambio" fuera el nombre).
- El resto de la interfaz (la barra superior, una vez con la sesión iniciada) no mostraba ningún nombre — igual que en Odoo, que tampoco repite su marca ahí — así que no hizo falta tocar nada más.
- `src/app/favicon.ico` sigue siendo el genérico de la plantilla: lo reemplaza el brief de logo de arriba, cuando haya un ícono propio.

## El barrido

```
python replica-brand/sweep.py . --config replica/brand.json
```

Resultado: **limpio.** Nada del nombre, el dominio o los colores de Odoo en el repositorio (ni en código, ni en nombres de archivo). `replica/brand.json` queda con esa lista para correrlo de nuevo en cualquier momento.

## Siguiente paso

El método sigue con `/replica-launch` (landing, precio, ficha de tienda). No aplica tal cual: esta web no se lanza ni se vende. Lo que sí queda pendiente, cuando haya ganas:

- Encargar el logo con el brief de arriba y reemplazar el favicon genérico.
- Si alguna vez deja de ser de uso interno, correr en serio los controles de marca marcados "a correr" — empezando por el INPI argentino.
