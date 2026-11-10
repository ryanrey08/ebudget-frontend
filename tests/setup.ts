/**
 * Minimal browser shims for running the mock API in Node: the mock session
 * lives in `document.cookie`.
 */
const jar = new Map<string, string>();

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(value: string) {
      const [pair, ...attrs] = value.split(";").map((p) => p.trim());
      const [name, ...rest] = pair.split("=");
      if (attrs.some((a) => a.toLowerCase() === "max-age=0")) jar.delete(name);
      else jar.set(name, rest.join("="));
    },
  },
});
