import { describe, expect, it } from "vitest";
import es from "../messages/es.json";
import en from "../messages/en.json";

type Tree = { [key: string]: Tree | string };

function keyPaths(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : keyPaths(value, path);
  });
}

describe("mensajes i18n", () => {
  const esKeys = keyPaths(es as Tree).sort();
  const enKeys = keyPaths(en as Tree).sort();

  it("es y en tienen las mismas claves", () => {
    expect(enKeys.filter((key) => !esKeys.includes(key))).toEqual([]);
    expect(esKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  it("ninguna clave queda vacia", () => {
    const empty = (tree: Tree) => keyPaths(tree).filter((path) => {
      const value = path.split(".").reduce<Tree | string>((node, key) => (node as Tree)[key], tree);
      return typeof value === "string" && value.trim() === "";
    });
    expect(empty(es as Tree)).toEqual([]);
    expect(empty(en as Tree)).toEqual([]);
  });
});
