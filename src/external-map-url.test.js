import { describe, expect, it } from "vitest";
import { externalMapUrl } from "./external-map-url.js";

const stops = [
  { title: "出発地", geo: { lat: 35.681236, lng: 139.767125 } },
  { title: "経由地1", geo: { lat: 35.710063, lng: 139.8107 } },
  { title: "経由地2", geo: { lat: 35.658581, lng: 139.745433 } },
  { title: "目的地", geo: { lat: 35.714765, lng: 139.796655 } }
];

describe("externalMapUrl", () => {
  it("keeps one selected place as a map search", () => {
    expect(externalMapUrl("google", [stops[0]])).toBe(
      "https://www.google.com/maps/search/?api=1&query=35.681236,139.767125"
    );
    expect(externalMapUrl("apple", [stops[0]])).toBe(
      "https://maps.apple.com/?ll=35.681236,139.767125&q=%E5%87%BA%E7%99%BA%E5%9C%B0"
    );
  });

  it("uses the selected order as a Google Maps route", () => {
    const url = new URL(externalMapUrl("google", stops));

    expect(url.pathname).toBe("/maps/dir/");
    expect(url.searchParams.get("origin")).toBe("35.681236,139.767125");
    expect(url.searchParams.get("waypoints")).toBe("35.710063,139.810700|35.658581,139.745433");
    expect(url.searchParams.get("destination")).toBe("35.714765,139.796655");
  });

  it("uses the selected order as an Apple Maps multistop route", () => {
    const url = new URL(externalMapUrl("apple", stops));

    expect(url.pathname).toBe("/directions");
    expect(url.searchParams.get("source")).toBe("35.681236,139.767125");
    expect(url.searchParams.getAll("waypoint")).toEqual([
      "35.710063,139.810700",
      "35.658581,139.745433"
    ]);
    expect(url.searchParams.get("destination")).toBe("35.714765,139.796655");
  });
});
