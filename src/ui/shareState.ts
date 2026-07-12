import { decodeShareParams, generateUniverse, UniverseInputError, type DecodedShareCode } from "../sim";

export function readInitialShare(search?: string): DecodedShareCode | undefined {
  const query = search ?? (typeof window === "undefined" ? undefined : window.location.search);
  if (query === undefined) return undefined;
  const decoded = decodeShareParams(query);
  if (!decoded || decoded.interventions.length === 0) return decoded;
  try {
    generateUniverse(decoded);
    return decoded;
  } catch (error) {
    const message = error instanceof UniverseInputError ? error.message : "干预分享数据无法应用。";
    return {
      ...decoded,
      interventions: [],
      warnings: [...decoded.warnings, `${message} 已回退到基础宇宙。`],
    };
  }
}
