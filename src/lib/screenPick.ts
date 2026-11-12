// Seleccion por teclado compartida por el mapa 2D y el globo 3D: elige el
// candidato cuya geometria (ya proyectada a pantalla) queda mas cerca del centro.

export type Pixel = [x: number, y: number];

/** Distancia en pixeles de un punto a un segmento (a === b da punto-punto). */
export function pixelToSegment(p: Pixel, a: Pixel, b: Pixel): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
}

/**
 * line: puntos proyectados en orden. Un punto solo es un marcador; varios
 * forman una polilinea. Un vertice undefined (fuera de pantalla) anula los
 * segmentos que lo tocan.
 */
export interface PickCandidate<T> {
  item: T;
  line: readonly (Pixel | undefined)[];
}

/** Devuelve el candidato mas cercano a center dentro de maxDistancePx (empate: el ultimo). */
export function nearestCandidate<T>(center: Pixel, candidates: readonly PickCandidate<T>[], maxDistancePx: number): T | null {
  let best: T | null = null;
  let nearest = maxDistancePx;
  for (const { item, line } of candidates) {
    for (let i = 0; i < line.length; i++) {
      const start = line[i];
      const end = line[i + 1] ?? start;
      if (!start || !end) continue;
      const distance = pixelToSegment(center, start, end);
      if (distance <= nearest) {
        nearest = distance;
        best = item;
      }
    }
  }
  return best;
}
