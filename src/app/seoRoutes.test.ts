import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";

describe("robots", () => {
  it("permite el sitio, bloquea la API y declara el sitemap", () => {
    const result = robots();
    expect(result.rules).toEqual({ userAgent: "*", allow: "/", disallow: "/api/" });
    expect(result.sitemap).toBe("https://ecopulse.nsma.dev/sitemap.xml");
  });
});

describe("sitemap", () => {
  it("lista solo la portada con la URL canonica", () => {
    expect(sitemap()).toEqual([{ url: "https://ecopulse.nsma.dev/" }]);
  });
});
