# Verificación de links y stock — Makeup Studio

Última revisión: **6 de septiembre de 2026**

## Qué se verificó realmente

Leí en vivo las páginas de producto de **Asian Shop** y **NewSeoul** para los dos
productos de labios. Las otras 11 tiendas y los 10 productos restantes **no** se
revisaron en esta pasada.

### Rom&nd · Juicy Lasting Tint

| Tienda | Precio | Tonos en catálogo | Agotados el 6-sep |
|---|---|---|---|
| Asian Shop | S/ 50 | 06, 10, 11, 12, 13, 17, 18, 22, 23, 24 | 06, 11, 12, 13, 17, 22, 23, 24 (**8 de 10**) |
| NewSeoul | S/ 60 | 06, 11, 12, 13, 17, 18, 23, 24, 27 | ninguno marcado |

### Peripera · Ink Velvet

| Tienda | Precio | Tonos en catálogo |
|---|---|---|
| NewSeoul | S/ 55 | 01, 02, 03, 08, 15, 17, 18, 20, 22, 23 |

## Los tres hallazgos que importan

**1. El meta de disponibilidad de la página miente.**
Asian Shop publica `product:availability: instock` en la cabecera mientras 8 de
sus 10 tonos están agotados. Cualquier verificador automático que lea ese meta
va a dar falsos positivos. Hay que leer el selector de variantes, no la cabecera.

**2. Tres tonos de la paleta no se venden en Perú.**
`#09 Litchi Coral` y `#25 Bare Grape` (Rom&nd) y `#24 Milky Nude` (Peripera) no
aparecen en el catálogo de ninguna de las dos tiendas. Se sacaron.

**3. Había un número de tono equivocado.**
`#01 Pomelo Skin` venía de la numeración propia de YesStyle. En la caja real y
en las tiendas peruanas ese tono es **#22 Pomelo Skin**, de la Bare Juicy Series.
Como además está agotado en Asian Shop y no lo trae NewSeoul, se reemplazó por
`#10 Nudy Peanut`, que sí está disponible.

## Por qué el stock NO está en el código

El stock cambia cada semana y ninguna tienda peruana expone API ni feed. Un
`enStock: true` escrito hoy es mentira en diez días, y una promesa falsa de
disponibilidad hace más daño que no decir nada: el usuario hace clic, no
encuentra el producto y no vuelve.

Lo que sí se hizo, que es estable y sí vale la pena mantener:
- **Curar la paleta a tonos que las tiendas tienen en catálogo.** El catálogo de
  una tienda cambia mucho más lento que su inventario.
- **No afirmar disponibilidad en la interfaz.** La tarjeta dice "Disponibilidad y
  precio los confirma la tienda".
- **Avisar que los tonos se agotan** en la ficha del tono elegido.

## Rutina de reverificación (mensual, ~20 minutos)

1. Abrir la página de cada producto con ficha directa y confirmar que **carga**
   y que sigue siendo ese producto (no una categoría ni un 404).
2. En los dos productos de labios, abrir el selector de tonos y anotar cuáles
   están agotados. Si un tono de la paleta lleva **dos revisiones seguidas
   agotado en todas las tiendas**, sacarlo y poner otro de la misma línea.
3. Actualizar `CATALOGO_REVISADO` en el HTML con la fecha nueva.
4. Actualizar la tabla de arriba.

Ojo: `curl` no sirve para esto — las tiendas responden 403 a peticiones
automatizadas. Hay que abrirlas en un navegador normal.

## Pendiente de revisar

Las 11 tiendas restantes y los links directos de TIRTIR (5 tiendas), Laneige,
COSRX, Beauty of Joseon, Rom&nd Better Than Cheek y Clio Prism Air Highlighter.
Ninguno de esos se comprobó en esta pasada.


---

# Segunda pasada — 12 de septiembre de 2026

## Fichas nuevas encontradas

| Producto | Tienda | Estado |
|---|---|---|
| COSRX Advanced Snail 96 Mucin | Asian Shop | ✅ **Verificado en vivo**: S/ 90, "Hay existencias", botón Añadir al carrito activo |
| Laneige Lip Sleeping Mask | Asian Shop | Página de producto confirmada; stock no leído en vivo |

Fichas peruanas: de 9 a **11**. Productos con al menos una: de 3 a **5** de 12.

## El hallazgo que importa: las tiendas peruanas casi no venden color

Busqué los seis productos de maquillaje que faltaban (rubor Peripera, Better Than
Cheek, Better Than Palette, Clio Sharp Liner, iluminador Prism Air, cejas) y
**ninguno tiene página de producto en tienda peruana**.

La causa se ve en el menú de Asian Shop, la tienda más grande del rubro en Perú.
Su categoría Make Up tiene exactamente esto:

    Ojos → Sombras, Cejas
    Labios → Tintes / Gloss
    Rostro → Correctores
    Accesorios

No hay rubor, ni paletas, ni delineadores, ni iluminadores. Las tiendas K-beauty
locales son de skincare con algo de labial; el maquillaje de color no lo traen.

Esto tiene una consecuencia de posicionamiento: la promesa "productos que sí se
consiguen en Perú" se sostiene para labios, base y skincare, pero **no** para
rubor, paleta, delineador ni iluminador. Para esos, la app solo puede mandar a
YesStyle o Stylevana, que son importación con espera.

Tres caminos posibles, en orden de esfuerzo:

1. **Aceptar marcas asiáticas no coreanas para color.** Asian Shop sí vende
   Cathy Doll (Tailandia) y Flower Knows (China) en cejas y rostro. Rompe la
   pureza "K-beauty" pero cumple lo de conseguirse en Lima.
2. **Marcar en la interfaz qué productos son de importación**, para que nadie se
   sienta engañado al llegar a una tienda que cobra envío internacional.
3. **Reducir el catálogo de color** a lo que sí existe acá y quitar del render
   lo que no se puede comprar.

## Lo que sigue sin ficha peruana (7 de 12)

Beauty of Joseon Glow Serum (Asian Shop trae otros BoJ pero no este),
Peripera Pure Blushed Sunshine Cheek, Rom&nd Better Than Cheek,
Rom&nd Better Than Palette, Clio Sharp Liner, Clio Prism Air Highlighter, cejas.
