import { afterEach, describe, expect, it } from "vitest";
import { earthquakePopup, disasterPopup, volcanoPopup, setPopupLocale } from "./popupHtml";

afterEach(() => setPopupLocale("es"));

describe("popupHtml", () => {
  it("escapa HTML de fuentes externas", () => {
    const html = earthquakePopup(
      { mag: 5.123, place: '<img src=x onerror="alert(1)">', time: 0, updated: 0 },
      10
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("Sismo M 5.1");
  });

  it("descarta URLs de reporte que no son http(s)", () => {
    const html = disasterPopup({
      name: "X",
      eventTypeLabel: "Inundación",
      country: "CU",
      alertLevel: "Red",
      fromDate: null,
      toDate: null,
      reportUrl: "javascript:alert(1)",
    });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("ep-popup__link");
  });

  it("traduce según el locale activo", () => {
    setPopupLocale("en");
    const html = volcanoPopup({ name: "Etna", country: "Italy", volcanoType: "Stratovolcano", lastEruptionYear: -1500, elevationM: 3357 });
    expect(html).toContain("1500 BCE");
    expect(html).toContain("Last eruption");
  });
});
