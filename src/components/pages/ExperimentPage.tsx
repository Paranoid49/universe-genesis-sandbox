import { useRef, useState } from "preact/hooks";
import { constitutionModule, type InterventionModuleSpec, type OntologyModuleSpec } from "../../sim/current";
import type { BranchLaboratoryController } from "../../ui/useBranchLaboratory";
import { Dices } from "../icons";
import { SectionHeader } from "../common";

export function ExperimentPage({ laboratory }: { laboratory: BranchLaboratoryController }) {
  const state = laboratory.currentBranch?.state;
  const objects = state ? Object.values(state.objects) : [];
  const ontology = state ? constitutionModule<OntologyModuleSpec>(state.identity.constitution, "ontology").spec : undefined;
  const capabilities = state ? constitutionModule<InterventionModuleSpec>(state.identity.constitution, "intervention").spec.capabilities : [];
  const [experimentObjectId, setExperimentObjectId] = useState(objects[0]?.id ?? "");
  const [interventionObjectId, setInterventionObjectId] = useState(objects[0]?.id ?? "");
  const experimentObject = objects.find((entry) => entry.id === experimentObjectId) ?? objects[0];
  const interventionObject = objects.find((entry) => entry.id === interventionObjectId) ?? objects[0];
  const objectKind = ontology?.objectKinds.find((entry) => entry.id === experimentObject?.kind);
  const experimentFields = objectKind?.attributes.filter((entry) => typeof entry.initial === "number") ?? [];
  const [targetTick, setTargetTick] = useState(state?.clock.tick ?? 0);
  const [experimentField, setExperimentField] = useState(experimentFields[0]?.id ?? "");
  const [experimentDelta, setExperimentDelta] = useState(5);
  const [capabilityId, setCapabilityId] = useState(capabilities[0]?.id ?? "");
  const [interventionDelta, setInterventionDelta] = useState(5);
  const importRef = useRef<HTMLTextAreaElement>(null);
  const applicableCapabilities = capabilities.filter((entry) => interventionObject && entry.targetKinds.includes(interventionObject.kind));
  const activeCapability = applicableCapabilities.find((entry) => entry.id === capabilityId) ?? applicableCapabilities[0];
  const activeExperimentField = experimentFields.find((entry) => entry.id === experimentField) ?? experimentFields[0];
  const currentExperimentValue = activeExperimentField && experimentObject ? experimentObject.attributes[activeExperimentField.id] : undefined;
  const experimentMinimum = typeof currentExperimentValue === "number" && activeExperimentField?.minimum !== undefined ? activeExperimentField.minimum - currentExperimentValue : undefined;
  const experimentMaximum = typeof currentExperimentValue === "number" && activeExperimentField?.maximum !== undefined ? activeExperimentField.maximum - currentExperimentValue : undefined;
  return <section className="observation-workbench" aria-label="宇宙实验室">
    <SectionHeader icon={<Dices size={18} />} title="宇宙实验室" text="界外实验创建新分支，宇宙内干预由当前宇宙宪法决定" />
    {laboratory.error && <p className="input-error" role="alert">{laboratory.error}</p>}
    {laboratory.status && <p className="runtime-status" role="status">{laboratory.status}</p>}
    <section className="runtime-history" aria-label="界外实验">
      <h3>界外实验｜创建新分支</h3><p>改变过去或当前条件只会创建子分支，父分支不会被改写。</p>
      <label><span>分叉逻辑时刻：{targetTick}</span><input aria-label="实验分叉逻辑时刻" type="range" min={0} max={state?.clock.tick ?? 0} value={targetTick} onChange={(event) => setTargetTick(Number(event.target.value))} /></label>
      <label><span>实验对象</span><select value={experimentObject?.id ?? ""} onChange={(event) => setExperimentObjectId(event.target.value)}>{objects.map((entry) => <option key={entry.id} value={entry.id}>{objectLabel(ontology, entry.kind, entry.id)}</option>)}</select></label>
      {experimentFields.length === 0
        ? <p>当前宇宙没有可调整的数值条件。</p>
        : <label><span>实验条件</span><select value={activeExperimentField?.id ?? ""} onChange={(event) => setExperimentField(event.target.value)}>{experimentFields.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}
      <label><span>条件变化</span><input type="number" min={experimentMinimum} max={experimentMaximum} value={experimentDelta} onChange={(event) => setExperimentDelta(Number(event.target.value))} /></label>
      <button type="button" disabled={laboratory.busy || !activeExperimentField || !experimentObject} onClick={() => laboratory.createExperiment(targetTick, activeExperimentField?.id ?? "", experimentDelta, experimentObject?.id)}>创建实验分支</button>
    </section>
    <section className="runtime-history" aria-label="宇宙内干预">
      <h3>宇宙内干预｜进入当前历史</h3><p>干预会成为正式因果输入，提交后不能从当前历史中清除。</p>
      {!activeCapability
        ? <><label><span>干预对象</span><select value={interventionObject?.id ?? ""} onChange={(event) => setInterventionObjectId(event.target.value)}>{objects.map((entry) => <option key={entry.id} value={entry.id}>{objectLabel(ontology, entry.kind, entry.id)}</option>)}</select></label><p>当前宇宙宪法不提供宇宙内干预能力，或所选对象不在能力目标范围内，玩家仍可使用界外实验创建分支。</p></>
        : <>
          <label><span>干预对象</span><select value={interventionObject?.id ?? ""} onChange={(event) => setInterventionObjectId(event.target.value)}>{objects.map((entry) => <option key={entry.id} value={entry.id}>{objectLabel(ontology, entry.kind, entry.id)}</option>)}</select></label>
          <label><span>干预能力</span><select value={activeCapability.id} onChange={(event) => setCapabilityId(event.target.value)}>{applicableCapabilities.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
          <label><span>干预强度</span><input type="number" min={activeCapability.minimumDelta} max={activeCapability.maximumDelta} value={interventionDelta} onChange={(event) => setInterventionDelta(Number(event.target.value))} /></label>
          <button type="button" disabled={laboratory.busy} onClick={() => laboratory.intervene(activeCapability.field, interventionDelta, interventionObject?.id, activeCapability.id)}>提交宇宙内干预</button>
        </>}
    </section>
    <section className="runtime-history" aria-label="分类型分享">
      <h3>分类型分享</h3>
      <label><span>创世条件包｜只创建共同起点</span><textarea readOnly value={laboratory.genesisPackage} /></label>
      <label><span>历史分支包｜恢复共享节点，首次继续时分叉</span><textarea readOnly value={laboratory.historyPackage} /></label>
      <label><span>导入创世条件包或历史分支包</span><textarea ref={importRef} /></label>
      <button type="button" disabled={laboratory.busy} onClick={() => laboratory.importPackage(importRef.current?.value ?? "")}>导入为独立本地分支</button>
    </section>
  </section>;
}

function objectLabel(ontology: OntologyModuleSpec | undefined, kindId: string, objectId: string): string {
  return `${ontology?.objectKinds.find((entry) => entry.id === kindId)?.name ?? "未知对象类型"}｜${objectId}`;
}
