# Texturas de los astros

Fotografías reales usadas para dibujar los cuerpos en la rueda
(`natal-chart.js`, opción `realPlanets`) y en las infografías.

- Sol, Luna, Mercurio, Venus, Marte, Júpiter, Saturno, Urano, Neptuno,
  Plutón — ya estaban en el proyecto (`assets/planets/`), 600×600.
- **Tierra** — añadida el 6/ago/2026. NASA *Blue Marble* (Visible Earth,
  imagen 57723, `globe_west_2048.jpg`). Las imágenes de la NASA son de
  **dominio público**; se agradece la atribución y aquí queda constancia.

Las de esta carpeta son copias a 256×256 optimizadas para la web (4,7 MB →
0,9 MB en total). Los originales a 600×600 siguen en `../../../assets/planets/`,
que es lo que consume el pipeline de Python.

Vienen con **fondo transparente**, no negro: `drawTexturedBody` las pinta tal
cual, sin recorte circular.

## No las edites a mano

Se generan con:

```
venv311/bin/python scripts/preparar_texturas_web.py
```

Ese script parte SIEMPRE del original, así que es repetible. Los ajustes de
color (Tierra más saturada, Luna más luminosa) y el recorte de los anillos de
Saturno viven ahí, en `AJUSTES` y `RECORTE_ANILLOS`. Al terminar imprime qué
fracción del cuadro ocupa el cuerpo de cada uno — esos números son los que
`natal-chart.js` necesita en `TEX_BOX` para dibujarlos al tamaño pedido.

Si cambias cualquier PNG de aquí, sube `_texVer` en `natal-chart.js`: sin eso
Cloudflare sigue sirviendo la versión vieja durante cuatro horas.
