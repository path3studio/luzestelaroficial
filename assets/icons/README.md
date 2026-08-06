# Almacén de iconografía — Luz Estelar

Fuente única de iconos de marca. **Regla: no emojis en assets de marca** (varían por
plataforma y rompen la paleta dorada). Todo icono nuevo se añade aquí, no inline.

## Estilo

- Trazo fino dorado `#d4a849`, `stroke-width: 1.75`, extremos redondeados, sin relleno.
- ViewBox 24×24 (mismo lenguaje que `website/js/icons.js`, estilo Lucide/MIT).
- Coherente con el logo (estrella de 12 puntas) y el panel de casas (`.hp-em` en `mi-dia.html`).

## Estructura

- `svg/` — fuente editable (color dorado fijo, listo para rasterizar).
- `png/` — rasterizados a 256×256 con `rsvg-convert -w 256 -h 256 svg/X.svg -o png/X_256.png`.
  El pipeline Python (PIL) consume estos PNG; **regenerar el PNG al editar un SVG**.

## Qué icono usar

| Icono | Uso |
|---|---|
| `amor` | biorritmo Amor, compatibilidad |
| `trabajo` | biorritmo Trabajo, carrera |
| `salud` | biorritmo Salud, bienestar |
| `energia` | biorritmo Energía, vitalidad |
| `luna` | fases lunares, tránsitos nocturnos |
| `sol` | signo solar, día |
| `estrella` | destacados, favoritos, rating |
| `casa` | casas astrológicas, inicio |
| `destello` | magia/brillo genérico (equivalente a `sparkles` de la web) |
| `luna-nueva` … `luna-menguante` | las 8 fases lunares (ciclo: nueva → creciente → cuarto-creciente → gibosa-creciente → llena → gibosa-menguante → cuarto-menguante → menguante). Parte iluminada en relleno dorado; geometría validada contra la fracción/lado real de iluminación |

## Notas

- **Glifos zodiacales (♈♉…) y planetarios (☉☽…) sí están permitidos** — son
  tipografía, no emoji — pero en HTML renderizado con Chrome añade `︎`
  (selector de variación) tras el glifo o Chrome puede dibujarlo como emoji de color.
- **Copy social (descripciones/captions de YouTube, TikTok, IG) queda fuera de la
  regla**: ahí solo existe texto plano, no se puede inyectar SVG; emojis con moderación.

## Consumidores

- `scripts/asset_generator.py` → `generate_biorhythm_charts()` (carga `png/*_256.png`).
- `scripts/infographic_generator.py` → `_moon_icon_svg()` inyecta `svg/luna-*.svg`
  inline en las plantillas (`{{MOON_ICON_SVG}}` en `infographic_feed_template.html`
  y `infographic_story_template.html`).
- La web usa su propio registro inline (`website/js/icons.js` + `css/icons.css`) con los
  mismos trazados; si añades un icono aquí, considera añadirlo también allí.

## Astros y signos (2026-08-05, contornos de fuente)

Los 22 glifos astrológicos —`sol-astro`, `luna-astro`, `mercurio`, `venus`, `marte`,
`jupiter`, `saturno`, `urano`, `neptuno`, `pluton` y los 12 signos (`aries`…`piscis`)—
se extrajeron de las fuentes Noto Sans Symbols (SIL OFL). Ver `GLIFOS-LICENCIA.md`.

**Son contornos rellenos**, a diferencia del resto del almacén (trazo dorado). Es
deliberado: los signos zodiacales son tipografía y quien sabe de astrología reconoce la
forma exacta. En el registro `js/icons.js` sus paths llevan `fill="currentColor"
stroke="none"` para anular los atributos de trazo del envoltorio compartido.

`sol` (sol con rayos) y `luna` siguen existiendo como iconos genéricos de interfaz; para
cartas y ruedas se usan `sol-astro` (☉ círculo con punto) y `luna-astro` (☽ creciente).
