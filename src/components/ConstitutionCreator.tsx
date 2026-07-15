import {
  CONSTITUTION_MODULE_CATALOG,
  PRODUCT_CONSTITUTIONS,
  compareUniverseConstitutions,
  constitutionModule,
  type ActionModuleSpec,
  type CognitionModuleSpec,
  type ConstitutionModuleCategory,
  type ConstitutionPresetId,
  type InterventionModuleSpec,
  type ObservableModuleSpec,
  type TimeModuleSpec,
  type TopologyModuleSpec,
  type UniverseConstitution,
} from "../sim/current";
import { Dices, Sparkles } from "./icons";

export function ConstitutionCreator({
  draftSeed,
  constitution,
  activeConstitution,
  presetId,
  inputError,
  onDraftSeedChange,
  onPresetChange,
  onModuleChange,
  onCreate,
  onRandomize,
}: {
  draftSeed: string;
  constitution: UniverseConstitution;
  activeConstitution: UniverseConstitution;
  presetId: ConstitutionPresetId | "custom";
  inputError?: string;
  onDraftSeedChange: (value: string) => void;
  onPresetChange: (value: ConstitutionPresetId) => void;
  onModuleChange: (category: ConstitutionModuleCategory, moduleId: string) => void;
  onCreate: () => void;
  onRandomize: () => void;
}) {
  const time = constitutionModule<TimeModuleSpec>(constitution, "time").spec;
  const topology = constitutionModule<TopologyModuleSpec>(constitution, "topology").spec;
  const actions = constitutionModule<ActionModuleSpec>(constitution, "action").spec;
  const cognition = constitutionModule<CognitionModuleSpec>(constitution, "cognition").spec;
  const observable = constitutionModule<ObservableModuleSpec>(constitution, "observable").spec;
  const intervention = constitutionModule<InterventionModuleSpec>(constitution, "intervention").spec;
  const comparison = compareUniverseConstitutions(activeConstitution, constitution);
  const fallbackPresetId = PRODUCT_CONSTITUTIONS[0]?.presetId;
  if (!fallbackPresetId) throw new Error("缺少可用的宇宙宪法预设。");
  return <section className="topbar constitution-creator" aria-label="宇宙宪法创世">
    <div className="brand-block">
      <span className="brand-mark"><Sparkles size={18} /></span>
      <div><h1>Universe Genesis Sandbox</h1><p>多本体宇宙宪法</p></div>
    </div>
    <div className="tool-strip">
      <label className="seed-field"><span>Seed</span><input aria-invalid={Boolean(inputError)} aria-describedby={inputError ? "constitution-input-error" : undefined} value={draftSeed} onChange={(event) => onDraftSeedChange(event.target.value)} /></label>
      <label><span>宪法预设</span><select value={presetId === "custom" ? constitution.presetId ?? fallbackPresetId : presetId} onChange={(event) => onPresetChange(event.target.value as ConstitutionPresetId)}>{PRODUCT_CONSTITUTIONS.map((entry) => <option key={entry.presetId} value={entry.presetId}>{entry.name}</option>)}</select></label>
      <button className="primary-action" type="button" onClick={onCreate}><Sparkles size={17} />创世</button>
      <button className="icon-action" type="button" onClick={onRandomize}><Dices size={17} />随机 Seed</button>
      {inputError && <p className="input-error" id="constitution-input-error" role="alert">{inputError}</p>}
    </div>
    <details className="constitution-composer">
      <summary>组合宪法模块</summary>
      <div className="constitution-module-grid">
        {constitution.modules.map((selected) => <label key={selected.category}><span>{categoryName(selected.category)}</span><select value={selected.id} onChange={(event) => onModuleChange(selected.category, event.target.value)}>{CONSTITUTION_MODULE_CATALOG.filter((entry) => entry.category === selected.category).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>)}
      </div>
    </details>
    <section className="constitution-summary" aria-label="宪法摘要">
      <h2>{constitution.name}</h2><p>{constitution.description}</p>
      <p>宪法身份：{constitution.constitutionId}</p>
      <p>时间：{time.mode}｜{time.unitName}｜拓扑：{topology.mode}｜关系：{topology.relationNames.join("、")}</p>
      <p>公开公理：{actions.rules.filter((entry) => cognition.publicAxiomIds.includes(entry.id)).map((entry) => entry.name).join("、") || "无"}</p>
      <p>观察：{observable.methods.map((entry) => entry.name).join("、") || "无"}｜干预：{intervention.capabilities.map((entry) => entry.name).join("、") || "不提供宇宙内干预"}</p>
      <p>校验结果：宪法完整且可以启动</p>
    </section>
    {comparison.differences.some((entry) => entry.changed) && <section className="constitution-summary" aria-label="跨宇宙宪法比较"><h2>跨宇宙宪法比较</h2><p>双方没有共同历史，本工具只比较宪法模块，不提供共同祖先或首个分歧点结论。</p>{comparison.differences.filter((entry) => entry.changed).map((entry) => <p key={entry.category}>{categoryName(entry.category)}：{entry.leftModuleName} → {entry.rightModuleName}</p>)}</section>}
  </section>;
}

function categoryName(category: ConstitutionModuleCategory): string {
  return ({
    ontology: "本体",
    action: "作用",
    constraint: "约束",
    priority: "优先级",
    time: "时间",
    topology: "拓扑",
    cognition: "认知边界",
    observable: "可观察量",
    event: "事件分类",
    intervention: "干预能力",
    boundary: "宇宙边界",
  } as Record<ConstitutionModuleCategory, string>)[category];
}
