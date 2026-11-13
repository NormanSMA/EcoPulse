import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/live/sources", () => ({
  loadEventSources: vi.fn(async () => ({ quakes: [], cyclones: [], volcanoes: [], disasters: [] })),
}));

import { GET } from "./route";

const call = (query: string) => GET(new Request(`http://localhost/api/widget${query}`));

describe("GET /api/widget", () => {
  it.each([
    ["?lat=12.13&lon=-86.25", 200],
    ["", 200],
    ["?x=1", 400],
    ["?lat=12.1234&lon=-86.25", 400],
    ["?lat=1e1&lon=0", 400],
    ["?lat=12.13", 400],
    ["?lon=-86.25", 400],
    ["?lat=12.13&lat=12.14&lon=-86.25", 400],
  ])("%s -> %i", async (query, status) => {
    expect((await call(query)).status).toBe(status);
  });
});
