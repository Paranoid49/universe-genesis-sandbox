import { render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExperimentPage } from "../../src/components/pages/ExperimentPage";
import { MATERIAL_EXPANSE, createInitialUniverseState, createRootBranch, type RuntimeWorldObject } from "../../src/sim/current";
import type { BranchLaboratoryController } from "../../src/ui/useBranchLaboratory";

describe("步骤 5 动态实验与干预页面", () => {
  it("使用宪法声明范围并把所选对象与能力提交给控制器", async () => {
    const user = userEvent.setup();
    const initial = createInitialUniverseState({ seed: "UI-DYNAMIC-TARGET-001", constitution: MATERIAL_EXPANSE });
    const first = Object.values(initial.objects)[0];
    const second = Object.freeze({ ...first, id: "runtime.object.02" }) satisfies RuntimeWorldObject;
    const state = { ...initial, objects: Object.freeze({ ...initial.objects, [second.id]: second }) };
    const branch = { ...createRootBranch(initial), state };
    const intervene = vi.fn(async () => true);
    const createExperiment = vi.fn(async () => true);
    const laboratory = {
      currentBranch: branch,
      busy: false,
      error: undefined,
      status: undefined,
      genesisPackage: "genesis",
      historyPackage: "history",
      createExperiment,
      intervene,
    } as unknown as BranchLaboratoryController;
    render(<ExperimentPage laboratory={laboratory} />);

    const numericInputs = screen.getAllByRole("spinbutton");
    expect(numericInputs[0].getAttribute("min")).toBe("-28");
    expect(numericInputs[0].getAttribute("max")).toBe("72");
    await user.selectOptions(screen.getByLabelText("干预对象"), second.id);
    await user.clear(numericInputs[1]);
    await user.type(numericInputs[1], "15");
    await user.click(screen.getByRole("button", { name: "提交宇宙内干预" }));
    expect(intervene).toHaveBeenCalledWith("energy", 15, second.id, "capability.material.energy-pulse");
  });
});
