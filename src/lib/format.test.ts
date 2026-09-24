import { describe, expect, it } from "vitest";
import { relativeTime, depthClass, compass, formatCoords, distanceKm, formatReportPeriod, saffirSimpson } from "./format";

describe("format", () => {
  const now = Date.parse("2026-09-23T12:00:00Z");
  it("tiempo relativo en minutos, horas y días", () => {
    expect(relativeTime(now - 5 * 60_000, "en", now)).toBe("5 min. ago");
    expect(relativeTime(now - 3 * 3_600_000, "en", now)).toBe("3 hr. ago");
    expect(relativeTime(now - 2 * 86_400_000, "en", now)).toBe("2 days ago");
  });
  it("clasifica la profundidad del foco", () => {
    expect(depthClass(10)).toBe("shallow");
    expect(depthClass(150)).toBe("intermediate");
    expect(depthClass(600)).toBe("deep");
  });
  it("rumbos y coordenadas", () => {
    expect(compass(225, "es")).toBe("SO");
    expect(compass(359, "en")).toBe("N");
    expect(formatCoords(-86.25, 12.13)).toBe("12.13° N, 86.25° W");
  });
  it("distancia Managua–San José ≈ 330 km", () => {
    const d = distanceKm([-86.25, 12.13], [-84.08, 9.93]);
    expect(d).toBeGreaterThan(320);
    expect(d).toBeLessThan(345);
  });
});

describe("formatReportPeriod", () => {
  // Intl usa espacios finos alrededor del guion del rango.
  const period = (p: string, locale: string) => formatReportPeriod(p, locale).replace(/[  ]/g, " ");
  it("traduce y compacta el periodo del reporte semanal", () => {
    expect(period("10 September-16 September 2026", "es")).toMatch(/^10[–-]16 sept?\.? 2026$/);
    expect(period("10 September-16 September 2026", "en")).toBe("Sep 10 – 16, 2026");
  });

  it("admite periodos que cruzan de mes o de año", () => {
    expect(period("27 August-2 September 2026", "en")).toBe("Aug 27 – Sep 2, 2026");
    expect(period("29 December 2025-4 January 2026", "en")).toBe("Dec 29, 2025 – Jan 4, 2026");
  });

  it("deja intacto un formato desconocido", () => {
    expect(formatReportPeriod("Week 38", "es")).toBe("Week 38");
  });
});

describe("saffirSimpson", () => {
  it("clasifica por viento sostenido en km/h", () => {
    expect(saffirSimpson(100)).toBeNull();
    expect(saffirSimpson(119)).toBe(1);
    expect(saffirSimpson(180)).toBe(3);
    expect(saffirSimpson(287)).toBe(5);
  });
});
