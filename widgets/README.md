# Widgets de EcoPulse

Los widgets leen `https://ecopulse-eta-two.vercel.app/api/widget`, un resumen JSON
que se actualiza cada 5 minutos:

- El sismo más fuerte de las últimas 24 h.
- Si pasas `?lat=..&lon=..`, el sismo M ≥ 4 más cercano (hasta 1000 km).
- Los ciclones activos.
- Las nuevas erupciones.
- Las alertas GDACS naranja o roja.

## iPhone (Scriptable)

1. Abre **Scriptable** y pulsa **+**.
2. Pega el contenido de [`scriptable/EcoPulse.js`](scriptable/EcoPulse.js) y nombra el script `EcoPulse`.
3. Pulsa ▶ para probarlo. Debe mostrar la vista previa mediana.
4. En la pantalla de inicio, mantén pulsado, pulsa **+**, elige **Scriptable** y el tamaño pequeño o mediano.
5. Mantén pulsado el widget, pulsa **Editar widget** y en **Script** elige `EcoPulse`.
6. Opcional: en **Parameter** escribe `cerca` para ver el sismo más cercano a tu ubicación.
7. Al tocar el widget se abre EcoPulse en ese evento.

## Android (KWGT)

1. Instala **KWGT** y añade un widget de KWGT a la pantalla de inicio.
2. En el editor crea una variable global de texto `datos` con la fórmula
   `$wg("https://ecopulse-eta-two.vercel.app/api/widget", json, ".quakes.strongest.place")$`.
3. Añade textos con fórmulas similares:
   - `.quakes.strongest.mag`
   - `.quakes.count24h`
   - `.cyclones[0].name`
4. Usa `.quakes.strongest.color` como color del círculo de magnitud.
5. En **Touch**, acción **Open link**, con la fórmula `$wg(".../api/widget", json, ".quakes.strongest.url")$`.
