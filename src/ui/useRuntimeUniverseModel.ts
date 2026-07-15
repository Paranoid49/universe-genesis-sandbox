import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  advanceUniverseState,
  buildRuntimeCausalNetwork,
  configureUniverseClock,
  createInitialUniverseState,
  createRuntimeArchive,
  projectRuntimeEvents,
  restoreRuntimeArchive,
  restoreUniverseState,
  runtimeDirectCauses,
  runtimeDirectEffects,
  runtimeObjectAtTick,
  type SimulationSpeed,
  type UniverseConstitution,
} from "../sim/current";
import { browserRuntimeStorage, type RuntimeStorageAdapter } from "./runtimeStorage";
import { startRuntimeStepScheduler } from "./runtimeScheduler";
import { summarizeRuntimeArchives } from "./runtimeArchiveSummaries";

export const CONTINUOUS_STEP_BUDGET = 100;
export function useRuntimeUniverseModel({
  seed,
  constitution,
  storage = browserRuntimeStorage,
  active = true,
}: { seed: string; constitution: UniverseConstitution; storage?: RuntimeStorageAdapter; active?: boolean }) {
  const [state, setState] = useState(() => createInitialUniverseState({ seed, constitution }));
  const [historyTick, setHistoryTick] = useState(0);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [causalNodeId, setCausalNodeId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [archiveSummaries, setArchiveSummaries] = useState<readonly { stateId: string; step: number; tick: number }[]>([]);
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

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    storage.list().then((archives) => {
      if (!cancelled) setArchiveSummaries(summarizeRuntimeArchives(archives, state.identity.universeDefinitionId));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [active, state.identity.universeDefinitionId, storage]);

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

  function replaceState(nextState: typeof state, message?: string) {
    if (operationInProgress.current) return false;
    const restored = configureUniverseClock(restoreUniverseState(nextState), { status: "paused" });
    setState(restored);
    setHistoryTick(restored.clock.tick);
    setCausalNodeId(undefined);
    continuousStepCount.current = 0;
    setStatus(message);
    setError(undefined);
    return true;
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
      setArchiveSummaries((current) => Object.freeze([...current.filter((entry) => entry.stateId !== archive.stateId), { stateId: archive.stateId, step: archive.state.clock.step, tick: archive.state.clock.tick }].sort((left, right) => right.step - left.step)));
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
      const restored = (await loadLatestCheckpoint(paused.identity.universeDefinitionId)).state;
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

  async function loadLatestCheckpoint(universeDefinitionId = state.identity.universeDefinitionId) {
    const archives = (await storage.list()).filter((archive) => archive.universeDefinitionId === universeDefinitionId);
    setArchiveSummaries(summarizeRuntimeArchives(archives, universeDefinitionId));
    const latest = [...archives].sort((left, right) => right.state.clock.step - left.state.clock.step)[0];
    if (!latest) throw new Error("当前宇宙没有可恢复的运行检查点。");
    return { state: configureUniverseClock(restoreRuntimeArchive(latest), { status: "paused" }), checkpointId: latest.stateId };
  }

  return {
    state, events, historyTick, viewedObject, status, error, busy, archiveSummaries,
    advance, toggleRunning, pause, changeSpeed, replaceState, setHistoryTick, save, restoreLatest, loadLatestCheckpoint,
    causalNetwork, causalNode, directCauses, directEffects, setCausalNodeId,
  };
}

export type RuntimeUniverseController = ReturnType<typeof useRuntimeUniverseModel>;
