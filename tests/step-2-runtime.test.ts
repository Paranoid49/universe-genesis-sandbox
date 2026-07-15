import { describe, expect, it } from "vitest";
import {
  advanceSimulationClock,
  advanceUniverseState,
  assertUniverseStateSemantics,
  buildRuntimeCausalNetwork,
  createRuntimeArchive,
  createLegacyInitialUniverseState as createInitialUniverseState,
  createRuntimeRandomStream,
  createSimulationClock,
  configureUniverseClock,
  parseRuntimeArchive,
  setSimulationRunStatus,
  setSimulationSpeed,
  projectRuntimeEvents,
  restoreRuntimeArchive,
  runtimeObjectAtTick,
  runtimeStateFingerprint,
  serializeRuntimeArchive,
  RuntimeArchiveError,
  runtimeDirectCauses,
  runtimeDirectEffects,
  validateRuntimeCausalNetwork,
} from "../src/sim";

describe("步骤 2 运行时基础契约", () => {
  it("逻辑时钟不读取墙上时间并以不可变值推进", () => {
    const initial = createSimulationClock();
    const running = setSimulationRunStatus(initial, "running");
    const faster = setSimulationSpeed(running, 4);
    const advanced = advanceSimulationClock(faster, 5);

    expect(initial).toEqual({ version: "ugs-simulation-clock@1", tick: 0, step: 0, status: "paused", speed: 1 });
    expect(advanced).toEqual({ version: "ugs-simulation-clock@1", tick: 5, step: 1, status: "running", speed: 4 });
    expect(Object.isFrozen(initial)).toBe(true);
    expect(Object.isFrozen(advanced)).toBe(true);
  });

  it("随机流从快照恢复后的下一次抽样与未中断运行一致", () => {
    const uninterrupted = createRuntimeRandomStream("RUNTIME-SEED-001", "evolution.primary");
    const prefix = [uninterrupted.next(), uninterrupted.int(1, 10), uninterrupted.bool(0.4)];
    const snapshot = uninterrupted.snapshot();
    const expectedNext = [uninterrupted.next(), uninterrupted.int(-5, 5), uninterrupted.bool(0.75)];

    const restored = createRuntimeRandomStream("RUNTIME-SEED-001", "evolution.primary", snapshot);
    const restoredNext = [restored.next(), restored.int(-5, 5), restored.bool(0.75)];

    expect(prefix).toHaveLength(3);
    expect(restoredNext).toEqual(expectedNext);
    expect(restored.sampleCount).toBe(uninterrupted.sampleCount);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("随机流拒绝跨宇宙身份、未知版本和损坏游标", () => {
    const snapshot = createRuntimeRandomStream("RUNTIME-SEED-002", "evolution.primary").snapshot();

    expect(() => createRuntimeRandomStream("OTHER-SEED", "evolution.primary", snapshot)).toThrow("身份");
    expect(() => createRuntimeRandomStream("RUNTIME-SEED-002", "other", snapshot)).toThrow("身份");
    expect(() => createRuntimeRandomStream("RUNTIME-SEED-002", "evolution.primary", { ...snapshot, version: "unknown" as typeof snapshot.version })).toThrow("版本");
    expect(() => createRuntimeRandomStream("RUNTIME-SEED-002", "evolution.primary", { ...snapshot, sampleCount: -1 })).toThrow("游标");
  });

  it("时钟和随机输入边界拒绝无效值", () => {
    expect(() => advanceSimulationClock(createSimulationClock(), 0)).toThrow("推进量");
    const stream = createRuntimeRandomStream("RUNTIME-SEED-003", "evolution.primary");
    expect(() => stream.int(3, 2)).toThrow("范围");
    expect(() => stream.bool(1.1)).toThrow("概率");
  });

  it("相同初始条件产生完全一致的状态序列", () => {
    let left = createInitialUniverseState({ seed: "STATE-SEQUENCE-001", templateId: "hard_science" });
    let right = createInitialUniverseState({ seed: "STATE-SEQUENCE-001", templateId: "hard_science" });
    expect(left.identity.version).toBe("ugs-universe-definition@4");
    expect(Object.isFrozen(left.identity.initialInputIds)).toBe(true);
    for (let index = 0; index < 8; index += 1) {
      left = advanceUniverseState(left);
      right = advanceUniverseState(right);
      expect(right).toEqual(left);
      expect(runtimeStateFingerprint(right)).toBe(runtimeStateFingerprint(left));
    }
  });

  it("运行控制状态不改变世界身份或切断后续因果状态链", () => {
    const initial = createInitialUniverseState({ seed: "CLOCK-CONTROL-001", templateId: "hard_science" });
    const advanced = advanceUniverseState(initial);
    const running = configureUniverseClock(advanced, { status: "running", speed: 8 });
    const paused = configureUniverseClock(running, { status: "paused" });
    const continued = advanceUniverseState(paused);

    expect(running.id).toBe(advanced.id);
    expect(paused.id).toBe(advanced.id);
    expect(runtimeStateFingerprint(running)).toBe(runtimeStateFingerprint(advanced));
    expect(continued.transitions.at(-1)?.beforeStateId).toBe(advanced.id);
    expect(validateRuntimeCausalNetwork(buildRuntimeCausalNetwork(continued))).toEqual([]);
  });

  it("每个对象事实变化都完整进入状态差异并可反向恢复历史对象", () => {
    const initial = createInitialUniverseState({ seed: "COMPLETE-DIFF-001", templateId: "hard_science" });
    const objectId = Object.keys(initial.objects)[0];
    const advanced = advanceUniverseState(initial);
    const transition = advanced.transitions[0];
    const before = flattenRuntimeObject(initial.objects[objectId]);
    const after = flattenRuntimeObject(advanced.objects[objectId]);
    const changedFields = Object.keys(after).filter((field) => before[field] !== after[field]).sort();
    const differenceFields = transition.differences.map((difference) => difference.field).sort();

    expect(differenceFields).toEqual(changedFields);
    expect(differenceFields).toContain("revision");
    expect(differenceFields).toContain("updatedAtTick");
    expect(runtimeObjectAtTick(advanced, objectId, 0)).toEqual(initial.objects[objectId]);

    const network = buildRuntimeCausalNetwork(advanced);
    for (const [index] of transition.differences.entries()) {
      expect(network.nodes.some((node) => node.subjectId === `${transition.id}.difference.${index + 1}`)).toBe(true);
    }
  });

  it("持久对象保持身份并按照宪法持续演化", () => {
    let state = createInitialUniverseState({ seed: "OBJECT-LIFECYCLE-001", templateId: "hard_science" });
    const objectId = Object.keys(state.objects)[0];
    const initialObject = state.objects[objectId];
    for (let index = 0; index < 8; index += 1) state = advanceUniverseState(state);
    const evolvedObject = state.objects[objectId];

    expect(evolvedObject.id).toBe(initialObject.id);
    expect(evolvedObject.revision).toBeGreaterThan(0);
    expect(evolvedObject.status).toBe(initialObject.status);
    expect(evolvedObject.attributes.cohesion).not.toBe(initialObject.attributes.cohesion);
    expect(state.transitions).toHaveLength(state.clock.step);

    const continued = advanceUniverseState(state);
    const followUp = projectRuntimeEvents(continued).at(-1);
    expect(continued.objects[objectId].id).toBe(objectId);
    expect(continued.objects[objectId].revision).toBe(evolvedObject.revision + 1);
    expect(followUp?.objectId).toBe(objectId);
    expect(followUp?.tick).toBe(continued.clock.tick);
  });

  it("历史事件可以只由已提交状态差异重新投影", () => {
    let state = createInitialUniverseState({ seed: "EVENT-PROJECTION-001", templateId: "high_magic" });
    state = advanceUniverseState(advanceUniverseState(state));
    const first = projectRuntimeEvents(state);
    const second = projectRuntimeEvents(state);

    expect(first).toEqual(second);
    expect(first).toHaveLength(state.transitions.length);
    expect(first.every((event) => event.tick <= state.clock.tick)).toBe(true);
    expect(first.every((event) => event.causeSubjectIds.some((id) => id.startsWith("rule.")))).toBe(true);
    expect(first.every((event) => event.causeSubjectIds.some((id) => id.includes("constitution.evolution")))).toBe(true);
  });

  it("历史对象投影不会改写当前状态、输入日志或随机流", () => {
    let state = createInitialUniverseState({ seed: "HISTORY-VIEW-001", templateId: "high_magic" });
    state = advanceUniverseState(state, [{ id: "history-input-1", kind: "advance-time", order: 1, payload: { ticks: 1 } }]);
    state = advanceUniverseState(state, [{ id: "history-input-2", kind: "advance-time", order: 2, payload: { ticks: 1 } }]);
    const objectId = Object.keys(state.objects)[0];
    const fingerprint = runtimeStateFingerprint(state);
    const inputs = state.inputLog;
    const randomStreams = state.randomStreams;

    const initialView = runtimeObjectAtTick(state, objectId, 0);
    const currentView = runtimeObjectAtTick(state, objectId, state.clock.tick);

    expect(initialView.revision).toBe(0);
    expect(currentView).toEqual(state.objects[objectId]);
    expect(runtimeStateFingerprint(state)).toBe(fingerprint);
    expect(state.inputLog).toBe(inputs);
    expect(state.randomStreams).toBe(randomStreams);
    expect(() => runtimeObjectAtTick(state, objectId, -1)).toThrow("位置");
    expect(() => runtimeObjectAtTick(state, objectId, state.clock.tick + 1)).toThrow("位置");
    expect(() => runtimeObjectAtTick(state, "missing", 0)).toThrow("对象");
  });

  it("保存状态对象后继续推进与原运行路径的下一状态一致", () => {
    let uninterrupted = createInitialUniverseState({ seed: "STATE-RESTORE-001", templateId: "mythic" });
    uninterrupted = advanceUniverseState(advanceUniverseState(uninterrupted));
    const restored = structuredClone(uninterrupted);

    expect(advanceUniverseState(restored)).toEqual(advanceUniverseState(uninterrupted));
  });

  it("状态转换拒绝重复输入、错序输入和被篡改状态", () => {
    const initial = createInitialUniverseState({ seed: "STATE-INPUT-001", templateId: "low_magic" });
    const first = advanceUniverseState(initial, [{ id: "input-1", kind: "advance", order: 1, payload: {} }]);

    expect(() => advanceUniverseState(first, [{ id: "input-1", kind: "advance", order: 2, payload: {} }])).toThrow("ID");
    expect(() => advanceUniverseState(first, [{ id: "input-2", kind: "advance", order: 1, payload: {} }])).toThrow("顺序");
    expect(() => advanceUniverseState({ ...first, id: "tampered" })).toThrow("身份");
  });

  it("运行状态语义校验拒绝差异、输入引用、随机决定和最终随机流篡改", () => {
    const state = advanceUniverseState(
      createInitialUniverseState({ seed: "STATE-SEMANTICS-001", templateId: "low_magic" }),
      [{ id: "semantic-input-1", kind: "advance", order: 1, payload: {} }],
    );
    expect(() => assertUniverseStateSemantics(state)).not.toThrow();

    const tamperedBefore = structuredClone(state);
    tamperedBefore.transitions[0].differences[0].before = 999;
    expect(() => assertUniverseStateSemantics(tamperedBefore)).toThrow("转换的语义校验失败");

    const missingInput = structuredClone(state);
    (missingInput.transitions[0].inputIds as string[])[0] = "missing-input";
    expect(() => assertUniverseStateSemantics(missingInput)).toThrow("输入引用无效");

    const tamperedDecision = structuredClone(state);
    tamperedDecision.transitions[0].randomDecisions[0].selectedValue = "999";
    expect(() => assertUniverseStateSemantics(tamperedDecision)).toThrow("转换的语义校验失败");

    const tamperedRandom = structuredClone(state);
    const streamId = Object.keys(tamperedRandom.randomStreams)[0];
    tamperedRandom.randomStreams[streamId].sampleCount += 1;
    (tamperedRandom as { id: string }).id = runtimeTestStateId(tamperedRandom as unknown as Record<string, unknown>);
    expect(() => assertUniverseStateSemantics(tamperedRandom)).toThrow("最终对象、随机流或历史");
  });

  it("运行存档恢复后的下一状态与未中断运行一致", () => {
    let uninterrupted = createInitialUniverseState({ seed: "ARCHIVE-RESTORE-001", templateId: "polytheistic_war" });
    uninterrupted = advanceUniverseState(advanceUniverseState(uninterrupted));
    const envelope = createRuntimeArchive(uninterrupted);
    const restored = restoreRuntimeArchive(envelope);

    expect(restored).toEqual(uninterrupted);
    expect(advanceUniverseState(restored)).toEqual(advanceUniverseState(uninterrupted));
  });

  it("运行存档序列化结果可校验并稳定往返", () => {
    const state = advanceUniverseState(createInitialUniverseState({ seed: "ARCHIVE-ROUNDTRIP-001", templateId: "dream_realm" }));
    const serialized = serializeRuntimeArchive(createRuntimeArchive(state));
    const parsed = parseRuntimeArchive(serialized);

    expect(serializeRuntimeArchive(parsed)).toBe(serialized);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.state)).toBe(true);
    expect(Object.isFrozen(parsed.state.transitions[0].differences)).toBe(true);
  });

  it("对象经过多步宪法演化后的运行存档仍能稳定序列化并恢复", () => {
    let state = createInitialUniverseState({ seed: "ARCHIVE-STATUS-CHANGE-001", templateId: "hard_science" });
    for (let index = 0; index < 8; index += 1) state = advanceUniverseState(state);

    const serialized = serializeRuntimeArchive(createRuntimeArchive(state));
    const parsed = parseRuntimeArchive(serialized);

    expect(Object.values(parsed.state.objects)[0].status).toBe(Object.values(state.objects)[0].status);
    expect(serializeRuntimeArchive(parsed)).toBe(serialized);
  });

  it("运行存档拒绝损坏内容、未知版本和身份拼接", () => {
    const state = advanceUniverseState(
      createInitialUniverseState({ seed: "ARCHIVE-REJECT-001", templateId: "mechanical_divinity" }),
      [{ id: "archive-input-1", kind: "advance-time", order: 1, payload: { ticks: 1 } }],
    );
    const valid = JSON.parse(serializeRuntimeArchive(createRuntimeArchive(state))) as Record<string, unknown>;
    const expectCode = (payload: unknown, code: string) => {
      try {
        parseRuntimeArchive(JSON.stringify(payload));
        throw new Error("预期运行存档被拒绝。");
      } catch (error) {
        expect(error).toBeInstanceOf(RuntimeArchiveError);
        expect((error as RuntimeArchiveError).code).toBe(code);
      }
    };

    expect(() => parseRuntimeArchive("{")).toThrow("JSON");
    expectCode({ ...valid, checksum: undefined }, "runtime-archive.invalid-shape");
    expectCode({ ...valid, version: "unknown" }, "runtime-archive.unsupported-version");
    expectCode({ ...valid, checksum: "00000000" }, "runtime-archive.checksum-mismatch");

    const mismatchedIdentity: Record<string, unknown> = { ...valid, universeDefinitionId: "other" };
    const { checksum: _identityChecksum, ...identityPayload } = mismatchedIdentity;
    expectCode({ ...identityPayload, checksum: runtimeTestFingerprint(identityPayload) }, "runtime-archive.identity-mismatch");

    const mismatchedStateFingerprint: Record<string, unknown> = { ...valid, stateFingerprint: "00000000" };
    const { checksum: _stateChecksum, ...statePayload } = mismatchedStateFingerprint;
    expectCode({ ...statePayload, checksum: runtimeTestFingerprint(statePayload) }, "runtime-archive.state-mismatch");

    const mismatchedHistory: Record<string, unknown> = { ...valid, transitionCount: 2 };
    const { checksum: _historyChecksum, ...historyPayload } = mismatchedHistory;
    expectCode({ ...historyPayload, checksum: runtimeTestFingerprint(historyPayload) }, "runtime-archive.history-mismatch");

    const missingRandom = structuredClone(valid);
    (missingRandom.state as Record<string, unknown>).randomStreams = {};
    const { checksum: _randomChecksum, ...randomPayload } = missingRandom;
    expectCode({ ...randomPayload, checksum: runtimeTestFingerprint(randomPayload) }, "runtime-archive.state-mismatch");

    const missingInput = structuredClone(valid);
    (missingInput.state as Record<string, unknown>).inputLog = [];
    const { checksum: _inputChecksum, ...inputPayload } = missingInput;
    expectCode({ ...inputPayload, checksum: runtimeTestFingerprint(inputPayload) }, "runtime-archive.state-mismatch");

    const missingTransition = structuredClone(valid);
    (missingTransition.state as Record<string, unknown>).transitions = [];
    const { checksum: _transitionChecksum, ...transitionPayload } = missingTransition;
    expectCode({ ...transitionPayload, checksum: runtimeTestFingerprint(transitionPayload) }, "runtime-archive.state-mismatch");

    const semanticMismatch = structuredClone(valid);
    const semanticState = semanticMismatch.state as { transitions: Array<{ differences: Array<{ before: unknown }> }> };
    semanticState.transitions[0].differences[0].before = 999;
    const semanticStateRecord = semanticMismatch.state as Record<string, unknown>;
    semanticStateRecord.id = runtimeTestStateId(semanticStateRecord);
    semanticMismatch.stateId = semanticStateRecord.id;
    semanticMismatch.stateFingerprint = runtimeTestStateFingerprint(semanticStateRecord);
    const { checksum: _semanticChecksum, ...semanticPayload } = semanticMismatch;
    expectCode({ ...semanticPayload, checksum: runtimeTestFingerprint(semanticPayload) }, "runtime-archive.state-mismatch");
  });

  it("运行事件进入可双向查询且根可达的因果网络", () => {
    let state = createInitialUniverseState({ seed: "RUNTIME-CAUSE-001", templateId: "causal_fracture" });
    state = advanceUniverseState(advanceUniverseState(state));
    const network = buildRuntimeCausalNetwork(state);
    const event = projectRuntimeEvents(state)[0];
    const eventNode = network.nodes.find((node) => node.subjectId === event.id)!;
    const causes = runtimeDirectCauses(network, eventNode.id);

    expect(validateRuntimeCausalNetwork(network)).toEqual([]);
    expect(causes.map((node) => node.kind)).toContain("transition");
    expect(runtimeDirectEffects(network, causes[0].id).map((node) => node.id)).toContain(eventNode.id);
    expect(network.nodes.filter((node) => node.kind === "random")).toHaveLength(state.clock.step * 2);
    expect(network.nodes.filter((node) => node.kind === "random").every((node) => node.description.includes("原始样本"))).toBe(true);
  });

  it("运行因果校验拒绝孤立节点、悬空原因和邻接篡改", () => {
    const network = buildRuntimeCausalNetwork(advanceUniverseState(createInitialUniverseState({ seed: "RUNTIME-CAUSE-002", templateId: "hard_science" })));
    const orphan = { ...network.nodes.find((node) => !node.root)!, directCauseIds: [] };
    const orphanNetwork = { ...network, nodes: network.nodes.map((node) => node.id === orphan.id ? orphan : node) };
    expect(validateRuntimeCausalNetwork(orphanNetwork).map((issue) => issue.code)).toContain("ORPHAN_NODE");

    const missingCause = { ...orphan, directCauseIds: ["missing"] };
    const missingNetwork = { ...network, nodes: network.nodes.map((node) => node.id === missingCause.id ? missingCause : node) };
    expect(validateRuntimeCausalNetwork(missingNetwork).map((issue) => issue.code)).toContain("MISSING_CAUSE");

    const wrongEffects = { ...network.nodes[0], directEffectIds: [] };
    const wrongEffectsNetwork = { ...network, nodes: [wrongEffects, ...network.nodes.slice(1)] };
    expect(validateRuntimeCausalNetwork(wrongEffectsNetwork).map((issue) => issue.code)).toContain("ADJACENCY_MISMATCH");

    const duplicateNodeNetwork = { ...network, nodes: [...network.nodes, network.nodes[0]] };
    expect(validateRuntimeCausalNetwork(duplicateNodeNetwork).map((issue) => issue.code)).toContain("DUPLICATE_NODE");

    const duplicateEdgeNetwork = { ...network, edges: [...network.edges, network.edges[0]] };
    expect(validateRuntimeCausalNetwork(duplicateEdgeNetwork).map((issue) => issue.code)).toContain("DUPLICATE_EDGE");

    const invalidRoot = { ...network.nodes.find((node) => node.root)!, root: false };
    const invalidRootNetwork = { ...network, nodes: network.nodes.map((node) => node.id === invalidRoot.id ? invalidRoot : node) };
    expect(validateRuntimeCausalNetwork(invalidRootNetwork).map((issue) => issue.code)).toContain("INVALID_ROOT");

    const cycleA = {
      id: "runtime-cause:test-cycle-a",
      subjectId: "test-cycle-a",
      kind: "state" as const,
      label: "测试循环甲",
      description: "仅用于验证非法循环拒绝。",
      root: false,
      directCauseIds: ["runtime-cause:test-cycle-b"],
      directEffectIds: ["runtime-cause:test-cycle-b"],
    };
    const cycleB = {
      ...cycleA,
      id: "runtime-cause:test-cycle-b",
      subjectId: "test-cycle-b",
      label: "测试循环乙",
      directCauseIds: [cycleA.id],
      directEffectIds: [cycleA.id],
    };
    const cycleNetwork = {
      ...network,
      nodes: [...network.nodes, cycleA, cycleB],
      edges: [
        ...network.edges,
        { id: "runtime-edge:test-cycle-a", from: cycleA.id, to: cycleB.id, relation: "changes" as const },
        { id: "runtime-edge:test-cycle-b", from: cycleB.id, to: cycleA.id, relation: "changes" as const },
      ],
    };
    const cycleCodes = validateRuntimeCausalNetwork(cycleNetwork).map((issue) => issue.code);
    expect(cycleCodes).toContain("NO_ROOT_PATH");
    expect(cycleCodes).toContain("ILLEGAL_CYCLE");
  });
});

function runtimeTestFingerprint(value: unknown): string {
  const stable = (entry: unknown): string => {
    if (entry === undefined) return "[undefined]";
    if (entry === null || typeof entry !== "object") return JSON.stringify(entry);
    if (Array.isArray(entry)) return `[${entry.map(stable).join(",")}]`;
    return `{${Object.keys(entry as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((entry as Record<string, unknown>)[key])}`).join(",")}}`;
  };
  let hash = 0x811c9dc5;
  for (const character of stable(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function flattenRuntimeObject(object: import("../src/sim/contracts/runtime").RuntimeWorldObject): Record<string, string | number | boolean | null> {
  return {
    status: object.status,
    revision: object.revision,
    createdAtTick: object.createdAtTick,
    updatedAtTick: object.updatedAtTick,
    ...Object.fromEntries(Object.entries(object.attributes).map(([field, value]) => [`attributes.${field}`, value])),
  };
}

function runtimeTestStateId(state: Record<string, unknown>): string {
  const clock = state.clock as Record<string, unknown>;
  return `runtime-state:${runtimeTestFingerprint({
    identity: state.identity,
    clock: { version: clock.version, tick: clock.tick, step: clock.step },
    rules: state.rules,
    objects: state.objects,
    randomStreams: state.randomStreams,
    inputLog: state.inputLog,
    committedTransitionIds: state.committedTransitionIds,
  })}`;
}

function runtimeTestStateFingerprint(state: Record<string, unknown>): string {
  const clock = state.clock as Record<string, unknown>;
  return runtimeTestFingerprint({
    identity: state.identity,
    clock: { version: clock.version, tick: clock.tick, step: clock.step },
    rules: state.rules,
    objects: state.objects,
    randomStreams: state.randomStreams,
    inputLog: state.inputLog,
    transitions: state.transitions,
    committedTransitionIds: state.committedTransitionIds,
  });
}
