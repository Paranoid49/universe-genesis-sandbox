import type { TimeModuleSpec, UniverseConstitution } from "./contracts/constitution";
import { constitutionModule } from "./constitution-validation";

export function constitutionTimeLabel(constitution: UniverseConstitution, tick: number): string {
  if (!Number.isSafeInteger(tick) || tick < 0) throw new Error("宪法时间投影的逻辑时刻无效。");
  const time = constitutionModule<TimeModuleSpec>(constitution, "time").spec;
  if (time.mode === "cyclic") {
    const length = time.cycleLength ?? 1;
    return time.unitName + " " + ((tick % length) + 1) + "/" + length;
  }
  if (time.mode === "segmented") {
    const names = time.segmentNames ?? [];
    return (names[tick % Math.max(1, names.length)] ?? time.unitName) + "｜" + tick;
  }
  return time.unitName + " " + tick;
}
