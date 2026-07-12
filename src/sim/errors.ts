export type UniverseInputErrorCode =
  | "INVALID_INPUT"
  | "INVALID_SEED"
  | "INVALID_TEMPLATE"
  | "UNSUPPORTED_RULESET"
  | "INVALID_INTERVENTION"
  | "DUPLICATE_INTERVENTION_ID"
  | "INVALID_TARGET";

export class UniverseInputError extends Error {
  readonly code: UniverseInputErrorCode;
  readonly path: string;

  constructor(code: UniverseInputErrorCode, path: string, message: string) {
    super(message);
    this.name = "UniverseInputError";
    this.code = code;
    this.path = path;
  }
}
