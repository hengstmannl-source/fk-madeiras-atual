import { describe, expect, it } from "vitest";
import superjson from "superjson";

describe("SuperJSON input hardening", () => {
  it("does not pollute Object.prototype from a JSON __proto__ property", () => {
    const payload = JSON.parse(
      '{"json":{"__proto__":{"polluted":"yes"}}}',
    ) as Parameters<typeof superjson.deserialize>[0];

    const result = superjson.deserialize(payload);

    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
    expect(Object.hasOwn(result, "__proto__")).toBe(false);
  });
});
