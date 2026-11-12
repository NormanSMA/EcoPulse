import { describe, expect, it } from "vitest";
import { shellUrls } from "./registerSW";

const ORIGIN = "https://ecopulse.test";

function fakeDoc(scripts: string[], links: string[]): Pick<Document, "querySelectorAll"> {
  return {
    querySelectorAll: (selector: string) =>
      (selector.startsWith("script") ? scripts.map((src) => ({ src })) : links.map((href) => ({ href }))),
  } as unknown as Pick<Document, "querySelectorAll">;
}

describe("shellUrls", () => {
  it("filtra otros orígenes, rutas ajenas y duplicados", () => {
    const urls = shellUrls(
      fakeDoc(
        [`${ORIGIN}/_next/static/a.js`, `${ORIGIN}/_next/static/a.js`, "https://cdn.example.com/_next/static/b.js", `${ORIGIN}/other.js`],
        [`${ORIGIN}/_next/static/c.css`, `${ORIGIN}/styles.css`],
      ),
      ORIGIN,
    );
    expect(urls).toEqual([`${ORIGIN}/_next/static/a.js`, `${ORIGIN}/_next/static/c.css`]);
  });
});
