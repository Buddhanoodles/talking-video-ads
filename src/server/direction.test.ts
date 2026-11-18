import { describe, expect, it } from "vitest";
import { emotionFor } from "./direction";
import { variationScript } from "@/shared/options";
import { combinations } from "./combinations";

describe("emotionFor", () => {
  it("maps directions to the closest emotion", () => {
    expect(emotionFor("Excited, like telling a friend")).toBe("happy");
    expect(emotionFor("calm and informative")).toBe("neutral");
    expect(emotionFor("frustrated with the old way")).toBe("angry");
    expect(emotionFor("")).toBe("auto");
  });
});

describe("batch variations", () => {
  it("joins hook and body", () => {
    expect(variationScript(" Stop. ", "Buy it. ")).toBe("Stop. Buy it.");
  });
  it("makes every hook, actor and language combination", () => {
    const all = combinations(
      ["h1", "h2"],
      ["a", "b", "c"],
      ["English", "French"],
    );
    expect(all).toHaveLength(12);
    expect(
      new Set(all.map((c) => `${c.hookIndex}${c.actorId}${c.language}`)).size,
    ).toBe(12);
  });
});
