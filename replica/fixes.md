# Lo que los usuarios de Odoo odian, lo que piden y lo que queda sin resolver

Fuente: `replica/reviews.csv` (32 reseñas reales, 3 fuentes: Software Advice, Hacker News, TrustRadius — ver `replica/feedback.md` para el ranking completo con citas). **Muestra chica**: menos de 30 reseñas calificadas apoyan una dirección, no una estadística cerrada. Software Advice tiene 1.336 reseñas en total; esta tanda leyó las primeras 25 por orden de "Número de recomendaciones" más 7 de TrustRadius y 6 de Hacker News. G2 y Capterra devolvieron error 403 (bloqueo de robots) y Reddit está bloqueado en este entorno: no se incluyen.

**Nota de alcance:** esta web es de uso interno de tu agencia, no un producto que se vende. Las quejas sobre precio por app, planes y ventas no aplican tal cual; se usan para decidir qué *no* construir (no metas ese modelo) y qué diferenciar en el día a día de quien opera y audita.

## 1. Lo que odian (quejas sobre lo que el producto hace)

| # | queja | reseñas | fuentes | cita |
| --- | --- | --- | --- | --- |
| 1 | Precio por app/usuario que crece solo, sin que lo pidas | 10 | 2 | "Every time I think 'that sounds great,' I find out we need another App." ([Software Advice](https://www.softwareadvice.com/crm/odoo-profile/reviews/)) |
| 2 | La implementación necesita saber programar o pagar un consultor | 9 | 3 | "Initial implementation is clunky and seems to require a 3rd party just for setup." ([TrustRadius](https://www.trustradius.com/products/odoo/reviews)) |
| 3 | Soporte lento o inexistente; la ayuda real está tercerizada y se cobra aparte | 8 | 2 | "Customer service is nonexistent. You will need a 3rd party to assist you." ([TrustRadius](https://www.trustradius.com/products/odoo/reviews)) |
| 4 | Lento con bases grandes; pantallas que cargan todo antes de dejarte filtrar | 9 | 2 | "Searching large databases is also slow. They load the entire page first, before allowing me to filter anything." ([Software Advice](https://www.softwareadvice.com/crm/odoo-profile/reviews/)) |
| 5 | Cambios de precio o cobro sin aviso | 4 | 2 | "they claimed that their website charged the wrong amount because our company operates in different countries and therefore they would be doubling the price" ([TrustRadius](https://www.trustradius.com/products/odoo/reviews)) |
| 6 | Documentación pobre o vieja | 5 | 3 | "I've hardly seen such a half ass job of documenting the new version." ([Hacker News](https://news.ycombinator.com/item?id=9530864)) |
| 7 | Personalizar pega contra una pared sin un desarrollador | 6 | 2 | "Odoo essentially blocks you from changing the core coding." ([Software Advice](https://www.softwareadvice.com/crm/odoo-profile/reviews/)) |
| 8 | Datos que no cierran: stock no descontado, saltos en la numeración, contactos duplicados | 4 | 2 | "it sometimes happens that the same system separates certain products and makes jumps in the correlatives of the guide numbers" ([TrustRadius](https://www.trustradius.com/products/odoo/reviews)) |
| 9 *(delgado)* | Curva de aprendizaje empinada, demasiados módulos y menús | 4 | 1 | "Odoo has so many modules, menus and configuration options that the first experience can feel more complicated than expected." ([Software Advice](https://www.softwareadvice.com/crm/odoo-profile/reviews/)) |
| 10 *(delgado)* | Cada app se ve distinta, los botones se mueven | 2 | 2 | "Each application looks somewhat different. The buttons move around, and even after using the software for 2 years, I still occasionally press the wrong corner." ([Software Advice](https://www.softwareadvice.com/crm/odoo-profile/reviews/)) |
| 11 *(delgado)* | "Open source" hasta que necesitás algo de Enterprise | 1 | 1 | "Odoo, for example, is 'open source' until you need 'enterprise' things." ([Hacker News](https://news.ycombinator.com/item?id=50421318)) |

## 2. Lo que piden (funciones pedidas por su nombre)

| # | pedido | reseñas | fuentes | cita |
| --- | --- | --- | --- | --- |
| 1 | Integraciones (WhatsApp, Gmail, marketplace de módulos) que no fallan | 6 | 2 | "The Email to CRM pipeline often has issues pulling from our shared gmail inbox." ([TrustRadius](https://www.trustradius.com/products/odoo/reviews)) |
| 2 *(delgado)* | Multimoneda y multipaís sin prueba y error | 2 | 2 | "It took me three hours of trial-and-error to set up multiple currencies using shipping tax rates." ([Software Advice](https://www.softwareadvice.com/crm/odoo-profile/reviews/)) |
| 3 *(delgado)* | Reportes propios sin pelearse con la herramienta | 1 | 1 | "the tools used for creating your own custom reports are completely frustrating" ([Software Advice](https://www.softwareadvice.com/crm/odoo-profile/reviews/)) |

## 3. Lo que queda sin resolver (trabajos enteros que Odoo ignora)

- **No está pensado para una sola cosa.** La queja más citada en Hacker News, en palabras de alguien construyendo una alternativa: "each of their apps feels like a cookie cutter CRUD implementation rather than something designed by people who understand the problems really well" ([Hacker News](https://news.ycombinator.com/item?id=50455515)). Odoo vende generalidad; una agencia de cambio necesita una pantalla de operaciones que entienda qué es una cotización, un cobro parcial y una reversa — no un CRM genérico con campos renombrados.
- **Confianza en los números sin pagar una auditoría externa.** Varias quejas (saltos de numeración, stock no descontado, contactos duplicados, "no honran su propio contrato") son, en el fondo, falta de confianza en que el sistema registra la realidad. Nadie pide "un dashboard más lindo"; piden que el número de la pantalla sea el número real.
- **Arrancar sin consultor.** Las quejas de implementación, soporte y documentación (22 de 32 reseñas tocan alguno de los tres) describen una curva de entrada que necesita plata adicional para cruzarse. Una herramienta interna, hecha a medida de un solo flujo, no debería necesitar eso.

## Plan de arreglos (los 5 a 8 más baratos de más evidencia)

| # | qué construir o verificar | tamaño | skill | evidencia |
| --- | --- | --- | --- | --- |
| 1 | **Aviso de contacto duplicado**: al crear o editar un contacto, si el documento/CUIT o el email ya existen en otro activo, avisar antes de guardar (no bloquear: la agencia puede tener motivos). | S | `/replica-build` | Tema 8, "duplicate customer profiles" ([TrustRadius](https://www.trustradius.com/products/odoo/reviews)) |
| 2 | **Prueba de concurrencia en la numeración de operaciones**: dos ventas creadas al mismo tiempo no pueden compartir número ni dejar un hueco. El candado ya existe (`pg_advisory_xact_lock` en `nextOperationNumber`); falta la prueba que lo demuestre. | S | `/replica-test` | Tema 8, "jumps in the correlatives of the guide numbers" ([TrustRadius](https://www.trustradius.com/products/odoo/reviews)) |
| 3 | **Recorrido de primeros pasos** para un usuario u operador nuevo: una lista corta ("cargá tu primera operación", "revisá una cuenta corriente") sin depender del manual largo ni de que alguien lo explique en persona. | M | `/replica-build` | Temas 2, 3 y 6 — implementación, soporte y documentación (22 de 32 reseñas) |
| 4 | **Historial inline junto al importe o la cotización**, no solo en la pestaña de historial: quién cambió este número y cuándo, visible sin un clic extra. | S | `/replica-build` | Tema 5, cambios de cobro sin aviso ([TrustRadius](https://www.trustradius.com/products/odoo/reviews)) |
| 5 | **Verificar el rendimiento de las listas con una base grande** (miles de operaciones): que filtrar no cargue todo antes de dejar escribir en el buscador. El contrato de listas ya pagina en el servidor; falta medirlo a escala real. | M | `/replica-test` | Tema 4, "load the entire page first, before allowing me to filter anything" ([Software Advice](https://www.softwareadvice.com/crm/odoo-profile/reviews/)) |
| 6 | **Terminar de llevar la consola SQL y el manual al mismo sistema de diseño** que ya tienen las demás pantallas, para que ninguna se sienta "la de otra app". | M | `/replica-build` | Tema 10, apps que se ven distintas entre sí ([Software Advice](https://www.softwareadvice.com/crm/odoo-profile/reviews/)) |
| 7 | **Ayuda en el campo de cotización multimoneda** (ejemplo corto + unidades, al lado del campo, no en un manual aparte). | S | `/replica-build` | Pedido 2, multimoneda sin prueba y error ([Software Advice](https://www.softwareadvice.com/crm/odoo-profile/reviews/)) |

Las filas 1, 3, 4, 6 y 7 ya están sumadas a `replica/features.csv` con `original` en `no` (Odoo no las resuelve bien o no aplica porque no es un producto de uso interno). Las filas 2 y 5 son pruebas, no pantallas, y quedan anotadas en `replica/PENDIENTES.md`.

## El ángulo

```
Para quien tiene que operar y auditar una agencia de cambio todos los días,
sin un ERP genérico de "una pantalla para cada cosa del mundo" ni un
consultor que explique por qué el número no cierra,
esta web hace una sola cosa — registrar, cobrar y auditar operaciones de
cambio — y hace que esos números siempre cierren, sin depender de un
tercero para entenderla.

Evidencia: "tries to be everything and do everything" (tema "El original
intenta ser todo"), 1 fuente; "cookie cutter CRUD implementation... not
designed by people who understand the problems" (Hacker News, quien
construye su propia alternativa); 22 de 32 reseñas tocan implementación,
soporte o documentación como la barrera para empezar.
```

Dos alternativas consideradas:

- *Para quien no quiere pagar por app:* apunta al tema de precio (10 reseñas, el más citado), pero no aplica: esta web no se vende por módulo ni por usuario, así que el contraste no se siente en el uso diario.
- *Para quien no confía en los números de su ERP:* apunta al tema de datos (8 reseñas), más angosto que el elegido pero con buena evidencia (saltos de numeración, stock no descontado). Queda como el segundo mensaje, no el principal, porque el primero (una sola cosa, bien hecha) ya lo incluye: los números cierran *porque* el sistema no intenta ser todo.

Se recomienda el ángulo principal. Define el nombre y la voz de `/replica-brand`: algo que diga "una sola cosa, bien hecha" antes que "una suite" o "una plataforma".
