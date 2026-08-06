# Licencia de los glifos de astros y signos

Los 22 glifos astrológicos de `svg/` y `png/` (Sol, Luna, los 8 planetas y los
12 signos) **no están dibujados a mano**: sus contornos se extrajeron de las
fuentes tipográficas **Noto Sans Symbols** y **Noto Sans Symbols 2**, de Google.

- Copyright 2017 Google Inc. Todos los derechos reservados.
- Licenciadas bajo la **SIL Open Font License, versión 1.1**
- Texto de la licencia: https://scripts.sil.org/OFL

La OFL permite usar, estudiar, modificar y redistribuir libremente estas formas,
incluso con fines comerciales. La única restricción relevante: no vender las
fuentes por sí solas. Nuestro uso — glifos incrustados en la interfaz y en los
productos gráficos — está plenamente permitido.

## Por qué se extrajeron en vez de dibujarse

Se intentó primero redibujarlos a mano en el estilo de trazo de la marca
(2026-08-05). Varios quedaron incorrectos: Plutón dibujaba otro símbolo, el Sol
no era el astrológico, y Virgo, Escorpio y Capricornio no coincidían con la forma
canónica. Los glifos zodiacales son **tipografía**, no iconografía: sus curvas
las diseñan tipógrafos y no se replican a ojo. Quien conoce astrología nota la
diferencia de inmediato — que fue exactamente lo que pasó.

## Cómo regenerarlos

```
venv311/bin/pip install fonttools
# descargar NotoSansSymbols-Regular.ttf y NotoSansSymbols2-Regular.ttf
# (github.com/googlefonts/noto-fonts, carpeta hinted/ttf/)
# extraer con fontTools: BoundsPen para medir, TransformPen para escalar
# a viewBox 24 con margen 2, invirtiendo el eje Y.
```

El Sol (U+2609) solo existe en Symbols **2**; los otros 21 están en Symbols.

## Nota de estilo

Son **formas rellenas**, no trazo — es como se ven en cualquier efeméride o
carta astral impresa, y a tamaño pequeño se leen mejor que una línea fina.
Por eso las reglas `.le-ic-sm` / `.le-ic-dense` de `css/icons.css` (que engrosan
el trazo) no les aplican: no tienen trazo que engrosar.
