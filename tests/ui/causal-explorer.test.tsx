import { fireEvent, render, screen, within } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { CausalExplorer } from "../../src/components/CausalExplorer";
import { getDirectCauses, getDirectEffects, type CausalGraph } from "../../src/sim";

const universe = { name: "测试宇宙" };

const graph: CausalGraph = {
  version: "test-causality@1",
  randomBindingVersion: "test-random-bindings@1",
  generation: {
    version: "test-inputs@1",
    id: "generation:test",
    inputs: [],
  },
  rootNodeIds: ["axiom"],
  nodes: [
    {
      id: "axiom",
      subjectId: "axiom.test",
      kind: "axiom",
      label: "测试宇宙公理",
      description: "允许测试状态发生变化。",
      root: "axiom",
      directCauseIds: [],
      directEffectIds: ["cause"],
      ruleIds: [],
      randomSampleRefs: [],
    },
    {
      id: "cause",
      subjectId: "state.before",
      kind: "initial_state",
      label: "前置状态满足",
      description: "变化发生前的状态满足规则条件。",
      directCauseIds: ["axiom"],
      directEffectIds: ["result"],
      ruleIds: ["axiom"],
      randomSampleRefs: [],
    },
    {
      id: "result",
      subjectId: "event.result",
      kind: "timeline_event",
      label: "测试结果形成",
      description: "规则作用后形成可查询的结果。",
      directCauseIds: ["cause"],
      directEffectIds: ["effect"],
      ruleIds: ["axiom"],
      randomSampleRefs: [{
        decisionId: "stream:test#1:1",
        streamId: "stream:test#1",
        namespace: "test",
        sampleIndexes: [1],
        firstSampleIndex: 1,
        lastSampleIndex: 1,
        purpose: "选择测试结果",
        candidateSetId: "set:test",
        selectedValue: "测试结果",
      }],
    },
    {
      id: "effect",
      subjectId: "observation.effect",
      kind: "observation",
      label: "后续影响出现",
      description: "结果继续传播后形成观测信号。",
      directCauseIds: ["result"],
      directEffectIds: [],
      ruleIds: ["axiom"],
      randomSampleRefs: [],
    },
  ],
  edges: [
    { id: "edge.axiom-cause", from: "axiom", to: "cause", kind: "applies", label: "公理允许前置状态" },
    { id: "edge.cause-result", from: "cause", to: "result", kind: "triggers", label: "前置状态触发结果" },
    { id: "edge.result-effect", from: "result", to: "effect", kind: "observes", label: "结果产生观测影响" },
  ],
  cycleAuthorizations: [],
  randomTrace: {
    algorithmVersion: "test-random@1",
    generationId: "generation:test",
    seedMaterial: "test-seed",
    seedFingerprint: "00000000",
    totalSamples: 1,
    streams: [{
      algorithmVersion: "test-random@1",
      streamId: "stream:test#1",
      namespace: "test",
      seedFingerprint: "00000000",
      sampleCount: 1,
      lastSampleIndex: 1,
      decisions: [{
        decisionId: "stream:test#1:1",
        sampleIndex: 1,
        sampleValue: 0.25,
        operation: "pick",
        parameters: { kind: "pick", candidates: ["测试结果", "其他结果"] },
        candidateSetId: "set:test",
        candidates: ["测试结果", "其他结果"],
        selectedValue: "测试结果",
      }],
    }],
  },
  randomResultBindings: [{
    decisionId: "stream:test#1:1",
    resultNodeId: "result",
    resultSubjectId: "event.result",
    nodeKind: "timeline_event",
    bindingKind: "collection_member",
    locator: {
      kind: "entity_id",
      entityKind: "timeline_event",
      entityId: "event.result",
      containerKind: "collection_member",
    },
    outputValueFingerprint: "fnv1a32:00000000",
  }],
};

describe("因果查询组件", () => {
  it("可以从一个结果双向查询直接关系与完整文字路径", async () => {
    const user = userEvent.setup();
    const target = graph.nodes.find((node) => node.id === "result")!;
    const directCause = getDirectCauses(graph, target.id)[0];
    const directEffect = getDirectEffects(graph, target.id)[0];

    render(<CausalExplorer universe={universe} graph={graph} initialNodeId={target.id} />);

    expect(screen.getByRole("heading", { name: target.label })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "为什么发生" }).getAttribute("aria-selected")).toBe("true");
    const causePanel = screen.getByRole("tabpanel");
    const directCauseArea = causePanel.querySelector<HTMLElement>(".causal-direct-relations")!;
    expect(within(directCauseArea).getByRole("button", { name: new RegExp(directCause.label) })).toBeTruthy();
    expect(within(causePanel).getByText("路径 1")).toBeTruthy();
    await user.click(screen.getByText("查看确定性抽样记录"));
    expect(screen.getByText(/选中 测试结果/)).toBeTruthy();
    expect(screen.getByText(/测试结果、其他结果/)).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "产生了什么后果" }));
    const effectPanel = screen.getByRole("tabpanel");
    const directEffectArea = effectPanel.querySelector<HTMLElement>(".causal-direct-relations")!;
    expect(within(directEffectArea).getByRole("button", { name: new RegExp(directEffect.label) })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "产生了什么后果" }).getAttribute("aria-selected")).toBe("true");
  });

  it("支持结果筛选、方向键连续浏览和标签键盘切换", async () => {
    const user = userEvent.setup();
    const selectableNodes = graph.nodes.filter((node) => !node.root);
    const onNodeSelect = vi.fn();
    const { container } = render(
      <CausalExplorer universe={universe} graph={graph} initialNodeId={selectableNodes[0].id} onNodeSelect={onNodeSelect} />,
    );

    const activeResult = container.querySelector<HTMLButtonElement>(".causal-result-list > button.active")!;
    fireEvent.keyDown(activeResult, { key: "ArrowDown" });
    expect(onNodeSelect).toHaveBeenCalledWith(selectableNodes[1].id);
    expect(document.activeElement?.textContent).toContain(selectableNodes[1].label);

    const causesTab = screen.getByRole("tab", { name: "为什么发生" });
    causesTab.focus();
    fireEvent.keyDown(causesTab, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "产生了什么后果" }));

    const searchInput = screen.getByRole("searchbox", { name: "选择要追溯的结果" });
    await user.clear(searchInput);
    await user.type(searchInput, selectableNodes.at(-1)!.label);
    const filteredButtons = container.querySelectorAll(".causal-result-list > button:not(.causal-load-more)");
    expect(filteredButtons).toHaveLength(1);
    expect(filteredButtons[0].textContent).toContain(selectableNodes.at(-1)!.label);
  });

  it("没有自动化可检测的无障碍违规", async () => {
    const view = render(<CausalExplorer universe={universe} graph={graph} />);
    expect((await axe(view.container)).violations).toEqual([]);

    view.rerender(<CausalExplorer universe={universe} graph={graph} initialNodeId="other-graph-node" />);
    expect(screen.getByRole("heading", { name: "无法定位指定因果结果" })).toBeTruthy();
    expect(screen.getByText("other-graph-node")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "测试结果形成" })).toBeNull();
    expect((await axe(view.container)).violations).toEqual([]);

    view.rerender(<CausalExplorer universe={universe} graph={graph} selectedNodeId="expired-controlled-node" />);
    expect(screen.getByText("expired-controlled-node")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "测试结果形成" })).toBeNull();
  });
});
