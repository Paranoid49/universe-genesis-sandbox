import { useEffect, useMemo, useRef, useState } from "react";
import {
  advanceUniverseState,
  buildRuntimeCausalNetwork,
  configureUniverseClock,
  createInitialUniverseState,
  createRuntimeArchive,
  projectRuntimeEvents,
  restoreRuntimeArchive,
  runtimeDirectCauses,
  runtimeDirectEffects,
  runtimeObjectAtTick,
  type SimulationSpeed,
  type UniverseTemplateId,
} from "../sim";
import { browserRuntimeStorage, type RuntimeStorageAdapter } from "./runtimeStorage";
import { startRuntimeStepScheduler } from "./runtimeScheduler";

export const CONTINUOUS_STEP_BUDGET = 100;

export function useRuntimeUniverseModel({
  seed,
  templateId,
  storage = browserRuntimeStorage,
  active = true,
}: {
  seed: string;
  templateId: UniverseTemplateId;
  storage?: RuntimeStorageAdapter;
  active?: boolean;
}) {
  const [state, setState] = useState(() => createInitialUniverseState({ seed, templateId }));
  const [historyTick, setHistoryTick] = useState(0);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [causalNodeId, setCausalNodeId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const operationInProgress = useRef(false);
  const continuousStepCount = useRef(0);

  useEffect(() => {
    if (!active || state.clock.status !== "running") return undefined;
    const scheduler = startRuntimeStepScheduler(state.clock.speed, () => {
      if (continuousStepCount.current >= CONTINUOUS_STEP_BUDGET) {
        setState((current) => configureUniverseClock(current, { status: "paused" }));
        setStatus(`连续运行已达到单次 ${CONTINUOUS_STEP_BUDGET} 步计算预算，请确认后再次启动。`);
        return;
      }
      continuousStepCount.current += 1;
      advance();
    });
    return scheduler.stop;
  }, [active, state.clock.status, state.clock.speed]);

  const events = useMemo(() => projectRuntimeEvents(state), [state]);
  const causalNetwork = useMemo(() => buildRuntimeCausalNetwork(state), [state]);
  const causalNode = causalNodeId ? causalNetwork.nodes.find((entry) => entry.id === causalNodeId) : undefined;
  const directCauses = causalNode ? runtimeDirectCauses(causalNetwork, causalNode.id) : [];
  const directEffects = causalNode ? runtimeDirectEffects(causalNetwork, causalNode.id) : [];
  const objectId = Object.keys(state.objects)[0];
  const viewedObject = useMemo(() => runtimeObjectAtTick(state, objectId, historyTick), [historyTick, objectId, state]);

  function advance() {
    if (operationInProgress.current) return;
    setState((current) => {
      const order = (current.inputLog.at(-1)?.order ?? 0) + 1;
      const next = advanceUniverseState(current, [{
        id: `runtime-input:advance:${order}`,
        kind: "advance-time",
        order,
        payload: { ticks: 1 },
      }]);
      setHistoryTick((viewTick) => viewTick === current.clock.tick ? next.clock.tick : viewTick);
      return next;
    });
    setError(undefined);
  }

  function toggleRunning() {
    if (operationInProgress.current) return;
    if (state.clock.status === "paused") continuousStepCount.current = 0;
    setState((current) => configureUniverseClock(current, {
      status: current.clock.status === "running" ? "paused" : "running",
    }));
  }

  function pause() {
    setState((current) => current.clock.status === "paused"
      ? current
      : configureUniverseClock(current, { status: "paused" }));
  }

  function changeSpeed(speed: SimulationSpeed) {
    if (operationInProgress.current) return;
    setState((current) => configureUniverseClock(current, { speed }));
  }

  async function save() {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    const paused = configureUniverseClock(state, { status: "paused" });
    setState(paused);
    continuousStepCount.current = 0;
    setBusy(true);
    try {
      const archive = createRuntimeArchive(paused);
      await storage.put(archive);
      setStatus(`已保存检查点：第 ${paused.clock.step} 步`);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "运行存档保存失败。");
    } finally {
      operationInProgress.current = false;
      setBusy(false);
    }
  }

  async function restoreLatest() {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    const paused = configureUniverseClock(state, { status: "paused" });
    setState(paused);
    continuousStepCount.current = 0;
    setBusy(true);
    try {
      const archives = (await storage.list()).filter((archive) => archive.universeDefinitionId === paused.identity.universeDefinitionId);
      const latest = [...archives].sort((left, right) => right.state.clock.step - left.state.clock.step)[0];
      if (!latest) throw new Error("当前宇宙没有可恢复的运行检查点。");
      const restored = configureUniverseClock(restoreRuntimeArchive(latest), { status: "paused" });
      setState(restored);
      continuousStepCount.current = 0;
      setHistoryTick(restored.clock.tick);
      setStatus(`已恢复检查点：第 ${restored.clock.step} 步`);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "运行存档恢复失败。");
    } finally {
      operationInProgress.current = false;
      setBusy(false);
    }
  }

  return {
    state,
    events,
    historyTick,
    viewedObject,
    status,
    error,
    busy,
    advance,
    toggleRunning,
    pause,
    changeSpeed,
    setHistoryTick,
    save,
    restoreLatest,
    causalNetwork,
    causalNode,
    directCauses,
    directEffects,
    setCausalNodeId,
  };
}

export type RuntimeUniverseController = ReturnType<typeof useRuntimeUniverseModel>;
