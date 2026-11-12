import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// El service worker es JavaScript plano fuera del bundle. Estas pruebas leen
// su texto y fijan los contratos que no deben romperse.
const source = readFileSync("public/sw.js", "utf8");

describe("public/sw.js", () => {
  it("conserva las alertas push", () => {
    expect(source).toContain('addEventListener("push"');
    expect(source).toContain('addEventListener("notificationclick"');
    expect(source).toContain("showNotification");
  });

  it("nunca intercepta /api/", () => {
    expect(source).toContain('url.pathname.startsWith("/api/")) return;');
    expect(source).not.toMatch(/STATIC_PREFIXES\s*=\s*\[[^\]]*\/api\//);
  });

  it("solo cachea peticiones GET y respuestas correctas no opacas", () => {
    expect(source).toContain('request.method !== "GET"');
    expect(source).toContain('response.status === 200 && (response.type === "basic" || response.type === "cors")');
    expect(source).not.toContain("response.ok");
  });

  it("acepta la precarga solo de ventanas del mismo origen y con tope", () => {
    expect(source).toContain('data.type !== "precache"');
    expect(source).toContain("new URL(source.url).origin !== self.location.origin");
    expect(source).toContain("MAX_PRECACHE_URLS");
    expect(source).toContain("if (isCacheable(url)) urls.push(url.href);");
  });

  it("no cachea en desarrollo", () => {
    expect(source).toContain('searchParams.has("dev")');
  });
});
