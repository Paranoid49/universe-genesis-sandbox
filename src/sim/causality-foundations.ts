import {
  add,
  compact,
  derived,
  isRuleNodeId,
  type NodeSpec,
  randomRefs,
  root,
  unique,
} from "./causality-builder";
import { AXIOMS, lawDomainIds, metricAliases, metricIds, type CausalMappingContext } from "./causality-model";

export function addRootsAndAxioms(context: CausalMappingContext): void {
  const { builder, subjects, universe, interventions, generation } = context;
  const inputByInternalRootId = new Map(generation.inputs.map((input) => [input.rootNodeId, input]));
  const inputEvidence = (rootNodeId: string) => {
    const input = inputByInternalRootId.get(rootNodeId);
    if (!input) throw new Error(`生成清单缺少输入根 ${rootNodeId}。`);
    return { kind: input.kind, order: input.order, subjectId: input.subjectId, value: input.value };
  };
  const roots: NodeSpec[] = [
    root("input:seed", "input.seed", "input", "Seed 输入", `规范化 Seed 为 ${universe.seed}。`, inputEvidence("input:seed")),
    root("input:ruleset", universe.rulesetVersion, "input", "规则版本输入", universe.rulesetVersion, inputEvidence("input:ruleset")),
    root("input:template", universe.templateId, "input", "模板选择输入", universe.templateId, inputEvidence("input:template")),
    root(
      "initial-state:template-configuration",
      "initial-state:template-configuration",
      "initial_state",
      "模板初始配置",
      "规则集提供模板权重、候选内容与静态创世参数。",
    ),
    root(
      "initial-state:creation-origin",
      "initial-state:creation-origin",
      "initial_state",
      "创世初态",
      "在首个时间线事件发生前，宇宙处于尚未展开历史的创世初态。",
    ),
  ];
  roots.forEach((node) => add(builder, subjects, node));

  const labels: Array<[string, string]> = [
    [AXIOMS.templateResolution, "模板解析规则"],
    [AXIOMS.universeAssembly, "宇宙聚合规则"],
    [AXIOMS.lawGeneration, "法则生成规则"],
    [AXIOMS.lawInteraction, "法则关系规则"],
    [AXIOMS.metricDerivation, "指标派生规则"],
    [AXIOMS.timelineGeneration, "时间线生成规则"],
    [AXIOMS.timelineProjection, "时间线影响投影规则"],
    [AXIOMS.spaceGeneration, "空间对象生成规则"],
    [AXIOMS.biosphereGeneration, "生物圈生成规则"],
    [AXIOMS.civilizationGeneration, "文明生成规则"],
    [AXIOMS.mythologyGeneration, "神话生成规则"],
    [AXIOMS.interventionApplication, "干预应用规则"],
    [AXIOMS.explanationProjection, "解释投影规则"],
    [AXIOMS.observationProjection, "观察结果投影规则"],
    [AXIOMS.shareProjection, "分享投影规则"],
    [AXIOMS.eventEffectProjection, "事件效果投影规则"],
    [AXIOMS.stateValueDerivation, "状态值公式证据规则"],
    [AXIOMS.summaryGrouping, "统计分组证据规则"],
    [AXIOMS.summaryFiltering, "统计筛选证据规则"],
    [AXIOMS.authorizedFeedback, "授权反馈闭环高阶公理"],
  ];
  labels.forEach(([id, label]) => add(builder, subjects, root(id, id, "axiom", label, `${label}是当前规则版本中的显式公理。`)));

  interventions.forEach((input, index) => {
    const rootNodeId = `input:intervention:${index + 1}:${input.id}`;
    add(builder, subjects, root(
    rootNodeId,
    input.id,
    "input",
    `玩家干预输入 ${index + 1}`,
    `${input.miracleType} -> ${input.targetId}`,
    inputEvidence(rootNodeId),
  ), [`intervention-input:${index}`]);
  });
}

export function addTemplateAndName(context: CausalMappingContext): void {
  const { builder, subjects, universe, trace } = context;
  add(builder, subjects, derived(
    `template:${universe.templateId}`,
    `template.${universe.templateId}`,
    "template",
    `模板：${universe.archetype}`,
    `模板 ${universe.templateId} 提供初始权重与内容候选。`,
    ["input:template", "input:ruleset", "initial-state:template-configuration"],
    [AXIOMS.templateResolution],
  ));
  add(builder, subjects, derived(
    "universe:name",
    "universe.name",
    "universe_name",
    universe.name,
    `名称由 Seed、模板候选与确定性名称流共同选定。`,
    ["input:seed", `template:${universe.templateId}`],
    [AXIOMS.universeAssembly],
    randomRefs(trace, ["root.names.universe"], "生成宇宙名称"),
  ), ["universe-name"]);
}

export function addLawsAndInteractions(context: CausalMappingContext): void {
  const { builder, subjects, universe, trace } = context;
  for (const domainId of lawDomainIds) {
    const domain = universe.laws[domainId];
    const domainNodeId = `law-domain:${domainId}`;
    add(builder, subjects, derived(
      domainNodeId,
      domainId,
      "law_domain",
      domain.title,
      `${domain.source}；${domain.rating.explanation}`,
      ["input:seed", `template:${universe.templateId}`, "initial-state:template-configuration"],
      [AXIOMS.lawGeneration],
      randomRefs(trace, [`root.laws.${domainId}`], `生成${domain.title}`, [`law-domain:${domainId}`]),
    ), [`domain:${domainId}`]);
    domain.rules.forEach((law, index) => add(builder, subjects, derived(
      `law:${law.id}`,
      law.id,
      "law",
      law.name,
      law.explanation,
      [domainNodeId, `template:${universe.templateId}`, "input:seed"],
      [AXIOMS.lawGeneration],
      randomRefs(trace, [`root.laws.${domainId}`], `选择并赋值法则“${law.name}”`, [`law:${domainId}:slot:${index + 1}`]),
    )));
  }

  for (const interaction of universe.lawInteractions) {
    const source = subjects.first(interaction.sourceLawId);
    const target = subjects.first(interaction.targetLawId);
    add(builder, subjects, derived(
      `law-interaction:${interaction.id}`,
      interaction.id,
      "law_interaction",
      `法则${interaction.kind}`,
      interaction.explanation,
      compact([source, target, `template:${universe.templateId}`]),
      compact([AXIOMS.lawInteraction, source, target]),
      randomRefs(trace, ["root.laws.interactions"], "计算法则关系强度", [`law-interaction:${interaction.id}`]),
    ));
  }
}

export function addMetricsAndUniverseNarrative(context: CausalMappingContext): void {
  const { builder, subjects, universe, trace } = context;
  for (const metricId of metricIds) {
    const metric = universe.metrics[metricId];
    const sourceNodes = (metric.influences ?? []).flatMap((influence) => subjects.all(influence.sourceId));
    const interventionSources = universe.miracleState.appliedMiracles
      .filter((miracle) => miracle.immediateEffects.some((effect) => effect.metric === metricId))
      .map((miracle) => `intervention:${miracle.id}`);
    const ruleIds = unique([AXIOMS.metricDerivation, ...sourceNodes.filter((nodeId) => isRuleNodeId(nodeId))]);
    add(builder, subjects, derived(
      `metric:${metricId}`,
      `metric.${metricId}`,
      "metric",
      metric.label,
      `${metricId} = ${metric.value}；${metric.explanation}`,
      unique([`template:${universe.templateId}`, "input:seed", ...sourceNodes, ...interventionSources]),
      ruleIds,
      randomRefs(trace, ["root.metrics"], `计算指标 ${metricId}`, [`metric:${metricId}`]),
    ), metricAliases(metricId));
  }

  const lawNodes = lawDomainIds.map((id) => `law-domain:${id}`);
  const metricNodes = metricIds.map((id) => `metric:${id}`);
  add(builder, subjects, derived(
    "universe:tagline",
    "universe.tagline",
    "universe_tagline",
    "宇宙标语",
    universe.tagline,
    [`template:${universe.templateId}`, ...lawNodes, ...metricNodes],
    [AXIOMS.universeAssembly],
  ));
  add(builder, subjects, derived(
    "universe:description",
    "universe.description",
    "universe_description",
    "宇宙描述",
    universe.description,
    [`template:${universe.templateId}`, ...lawNodes, ...metricNodes],
    [AXIOMS.universeAssembly],
  ));
  add(builder, subjects, derived(
    "universe:identity",
    universe.seed,
    "universe",
    universe.name,
    `${universe.tagline} ${universe.description}`,
    ["input:seed", "input:ruleset", "universe:name", "universe:tagline", "universe:description"],
    [AXIOMS.universeAssembly],
  ), ["universe"]);
}
