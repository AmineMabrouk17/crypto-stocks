import { describe, expect, it } from "vitest";
import { parseFearGreedIndex } from "./fearGreed";

// Captured from api.alternative.me/fng/?limit=1 (Aug 2026).
const FNG_FIXTURE = {
  name: "Fear and Greed Index",
  data: [
    {
      value: "27",
      value_classification: "Fear",
      timestamp: "1785888000",
      time_until_update: "15580",
    },
  ],
  metadata: {
    error: null,
  },
};

describe("parseFearGreedIndex", () => {
  it("parses the value, classification and timestamp from a real response", () => {
    const index = parseFearGreedIndex(FNG_FIXTURE);

    expect(index.value).toBe(27);
    expect(index.classification).toBe("Fear");
    expect(index.timestamp).toBe(1785888000);
    expect(index.timeUntilUpdate).toBe(15580);
  });

  it("throws when the response carries no data", () => {
    expect(() => parseFearGreedIndex({ name: "Fear and Greed Index", data: [] })).toThrow(
      "missing data",
    );
  });

  it("throws when the value is missing", () => {
    expect(() => parseFearGreedIndex({ data: [{ value_classification: "Fear" }] })).toThrow(
      "missing value",
    );
  });
});
