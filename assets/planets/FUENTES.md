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

Vienen sobre fondo NEGRO, no transparente: al dibujarlas hay que recortarlas
en círculo o se ve el cuadro (lo hace `drawTexturedBody`).
