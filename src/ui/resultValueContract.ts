export function resultValueFingerprint(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `string:${value}`;
  if (typeof value === "number") return `number:${value}`;
  if (typeof value === "boolean") return `boolean:${value}`;
  return `json:${JSON.stringify(value)}`;
}
