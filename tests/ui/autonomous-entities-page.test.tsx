import { render, screen, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { RuntimeNavigation } from "../../src/components/RuntimeNavigation";
import { RuntimeApplication } from "../../src/components/RuntimeApplication";
import { AutonomousEntitiesPage } from "../../src/components/pages/AutonomousEntitiesPage";
import {
  LIVING_TIDE,
  advanceUniverseState,
  buildRuntimeCausalNetwork,
  createInitialUniverseState,
  runtimeDirectCauses,
  runtimeDirectEffects,
  type UniverseState,
} from "../../src/sim/current";

function formedState(): UniverseState {
  return advanceUniverseState(advanceUniverseState(createInitialUniverseState({ seed: "STEP6-UI-001", constitution: LIVING_TIDE })));
}

function AutonomousEntitiesTestApp({ state }: { state: UniverseState }) {
  const network = useMemo(() => buildRuntimeCausalNetwork(state), [state]);
  const [nodeId, setNodeId] = useState<string>();
  const node = network.nodes.find((entry) => entry.id === nodeId);
  return <AutonomousEntitiesPage state={state} causal={{
    node,
    directCauses: node ? runtimeDirectCauses(network, node.id) : [],
    directEffects: node ? runtimeDirectEffects(network, node.id) : [],
    select: setNodeId,
  }} />;
}

describe("步骤 6 自主实体页面", () => {
  it("无主体宇宙不显示入口，形成主体后才显示入口", () => {
    const onChange = vi.fn();
    const view = render(<RuntimeNavigation activePage="universe" hasEntities={false} onChange={onChange} onOpenLegacy={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /自主实体/ })).toBeNull();
    view.rerender(<RuntimeNavigation activePage="universe" hasEntities onChange={onChange} onOpenLegacy={vi.fn()} />);
    expect(screen.getByRole("button", { name: /自主实体/ })).toBeTruthy();
  });

  it("支持选择实体、查看行为关系叙述并进入行动因果", async () => {
    const user = userEvent.setup();
    const state = formedState();
    const { container } = render(<AutonomousEntitiesTestApp state={state} />);

    const selector = screen.getByRole("combobox", { name: "选择自主实体" });
    expect(selector.querySelectorAll("option")).toHaveLength(2);
    expect(screen.getAllByText("行动产生后果").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "自主关系" }).textContent).toContain("共潮");
    expect(screen.getByRole("region", { name: "公开叙述" }).textContent).toContain("叙述不等于事实");
    await user.selectOptions(selector, Object.values(state.autonomy.entities)[1].id);
    expect((selector as HTMLSelectElement).value).toBe(Object.values(state.autonomy.entities)[1].id);

    await user.click(screen.getAllByRole("button", { name: "查看行动因果" })[0]);
    expect(screen.getByRole("region", { name: "自主行动因果" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "为什么发生" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "已经产生" })).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "状态变化" })[0]);
    expect(screen.getByRole("region", { name: "自主行动因果" }).textContent).toContain("已产生状态变化");
    expect(screen.getByRole("region", { name: "自主行动因果" }).textContent).not.toMatch(/\d+\s*→\s*\d+/);
    await user.click(screen.getByRole("button", { name: "状态转换" }));
    const effects = screen.getByRole("heading", { name: "已经产生" }).parentElement!;
    await user.click(within(effects).getAllByRole("button", { name: "状态变化" })[0]);
    const publicCausalText = screen.getByRole("region", { name: "自主行动因果" }).textContent ?? "";
    expect(publicCausalText).toContain("已产生状态变化");
    expect(publicCausalText).not.toContain("attributes.");
    expect(publicCausalText).not.toMatch(/\d+\s*→\s*\d+/);
    await user.click(screen.getByRole("button", { name: "关闭行动因果" }));
    expect(screen.queryByRole("region", { name: "自主行动因果" })).toBeNull();

    expect(container.textContent).not.toMatch(/autonomy-(?:perception|memory|belief|intent):/);
    expect(container.textContent).not.toContain("runtime.object.");
    expect(container.textContent).not.toContain("cost-rejected");
  });

  it("自主实体页面通过 axe 检查", async () => {
    const { container } = render(<AutonomousEntitiesTestApp state={formedState()} />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("无主体、停止主体和空公开证据均使用明确条件状态", () => {
    const causal = { node: undefined, directCauses: [], directEffects: [], select: vi.fn() };
    const empty = render(<AutonomousEntitiesPage state={createInitialUniverseState({ seed: "STEP6-UI-EMPTY", constitution: LIVING_TIDE })} causal={causal} />);
    expect(empty.container.textContent).toBe("");
    empty.unmount();

    let ceased = createInitialUniverseState({ seed: "STEP6-UI-CEASED", constitution: LIVING_TIDE });
    for (let index = 0; index < 4; index += 1) ceased = advanceUniverseState(ceased);
    const ceasedView = render(<AutonomousEntitiesPage state={ceased} causal={causal} />);
    expect(screen.getByText("自主性终止")).toBeTruthy();
    expect(screen.getByRole("region", { name: "自主关系" }).textContent).toContain("已终止");
    ceasedView.unmount();

    const sparse = structuredClone(formedState()) as MutableUniverseState;
    sparse.autonomy.relations = {};
    sparse.autonomy.narratives = {};
    sparse.autonomy.mythArchives = {};
    sparse.transitions.forEach((transition) => { transition.autonomy.actions = []; });
    const sparseEntity = Object.values(sparse.autonomy.entities).sort((left, right) => left.id.localeCompare(right.id))[0];
    sparse.objects[sparseEntity.objectId].kind = "unknown-kind";
    render(<AutonomousEntitiesPage state={sparse} causal={causal} />);
    expect(screen.getByText("尚无行为。")).toBeTruthy();
    expect(screen.getByText("尚无关系。")).toBeTruthy();
    expect(screen.getByText("尚无叙述。")).toBeTruthy();
    expect(screen.getByText(/未知承载类型/)).toBeTruthy();
  });

  it("拒绝、静默与根因空后果均使用可读标签", () => {
    const state = structuredClone(formedState()) as MutableUniverseState;
    const entity = Object.values(state.autonomy.entities).sort((left, right) => left.id.localeCompare(right.id))[0];
    const selectedAction = state.transitions[1].autonomy.actions.find((action) => action.entityId === entity.id)!;
    selectedAction.status = "rejected";
    state.transitions[1].autonomy.actions.push({ ...selectedAction, id: "autonomy-action:idle-ui", status: "idle" });
    const relation = Object.values(state.autonomy.relations)[0];
    relation.sourceEntityId = entity.id;
    relation.targetEntityId = "autonomy-entity:missing";
    const select = vi.fn();
    render(<AutonomousEntitiesPage state={state} causal={{
      node: { id: "root", subjectId: "root", kind: "root", label: "根公理", description: "合法根因。", root: true, directCauseIds: [], directEffectIds: [] },
      directCauses: [],
      directEffects: [],
      select,
    }} />);
    expect(screen.getByText("行动被规则拒绝")).toBeTruthy();
    expect(screen.getByText("保持观察")).toBeTruthy();
    expect(screen.getByRole("region", { name: "自主关系" }).textContent).toContain("未知实体");
    expect(screen.getAllByText("合法根因。")).toHaveLength(2);
    expect(screen.getByText("尚无后果。")).toBeTruthy();
    expect(screen.getByText("根因｜根因")).toBeTruthy();
  });

  it("潮生会话能够进入全部条件页面并返回兼容入口", async () => {
    const user = userEvent.setup();
    const onOpenLegacy = vi.fn();
    render(<RuntimeApplication active onOpenLegacy={onOpenLegacy} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "宪法预设" }), "living-tide@1");
    await user.click(screen.getByRole("button", { name: "创世" }));
    await user.click(screen.getByRole("button", { name: "单步推进" }));
    await user.click(screen.getByRole("button", { name: "单步推进" }));
    for (const name of [/自主实体：/, /研究记录：/, /实验：/, /历史分支：/, /已发生历史：/, /存档：/, /观察：/, /当前宇宙：/]) {
      await user.click(screen.getByRole("button", { name }));
    }
    await user.click(screen.getByRole("button", { name: /旧版兼容：/ }));
    expect(onOpenLegacy).toHaveBeenCalledOnce();
  });
});

type DeepMutable<T> = T extends readonly (infer Entry)[] ? DeepMutable<Entry>[] : T extends object ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> } : T;
type MutableUniverseState = DeepMutable<UniverseState>;
