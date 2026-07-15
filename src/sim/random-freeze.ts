import type { RandomTraceSnapshot } from "./contracts/random";

export function freezeRandomTraceSnapshot(trace: RandomTraceSnapshot): RandomTraceSnapshot {
  trace.streams.forEach((stream) => {
    stream.decisions.forEach((entry) => {
      if (entry.parameters.kind === "pick") Object.freeze(entry.parameters.candidates);
      if (entry.parameters.kind === "weighted") {
        entry.parameters.candidates.forEach(Object.freeze);
        Object.freeze(entry.parameters.candidates);
      }
      Object.freeze(entry.parameters);
      Object.freeze(entry.candidates);
      Object.freeze(entry);
    });
    Object.freeze(stream.decisions);
    Object.freeze(stream);
  });
  Object.freeze(trace.streams);
  return Object.freeze(trace);
}
