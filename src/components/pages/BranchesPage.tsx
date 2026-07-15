import type { BranchLaboratoryController } from "../../ui/useBranchLaboratory";
import { Link } from "../icons";
import { SectionHeader } from "../common";

export function BranchesPage({ laboratory }: { laboratory: BranchLaboratoryController }) {
  const current = laboratory.currentBranch;
  return <section className="observation-workbench" aria-label="历史分支管理器">
    <SectionHeader icon={<Link size={18} />} title="历史分支" text="分支身份、共同祖先、状态差异与因果差异" />
    {laboratory.error && <p className="input-error" role="alert">{laboratory.error}</p>}
    {laboratory.status && <p className="runtime-status" role="status">{laboratory.status}</p>}
    {current && <section className="runtime-history" aria-label="当前分支身份">
      <h3>当前分支</h3><p>{current.branchId}</p>
      <p>父分支：{current.parentBranchId ?? "根分支"}｜分叉时刻：{current.forkTick}</p>
      <p>共同历史范围：{current.commonTransitionCount} 个已提交转换</p>
      <p>状态哈希：{current.stateHash}</p><p>历史哈希：{current.historyHash}</p><p>检查点：{current.checkpointId}</p>
      <p>可继续运行：是｜访问模式：{current.accessMode === "shared-readonly" ? "共享节点，首次继续时创建本地子分支" : "本地可写分支"}</p>
      <button type="button" disabled={laboratory.busy} onClick={laboratory.saveCurrent}>保存当前分支</button>
    </section>}
    <section className="runtime-history" aria-label="分支列表">
      <h3>本地分支</h3>
      {laboratory.branches.map((branch) => <article key={branch.branchId}>
        <b>{branch.branchId === current?.branchId ? "当前分支" : `分支 ${branch.branchId.slice(-8)}`}</b>
        <p>时刻 {branch.state.clock.tick}｜谱系 {branch.lineage.length} 层｜历史 {branch.historyHash.slice(-8)}</p>
        <button type="button" disabled={branch.branchId === current?.branchId || laboratory.busy} onClick={() => laboratory.switchBranch(branch.branchId)}>切换到此分支</button>
        <button type="button" disabled={branch.branchId === current?.branchId} onClick={() => laboratory.compareWith(branch.branchId)}>与当前分支比较</button>
      </article>)}
    </section>
    {laboratory.comparison && <section className="runtime-history" aria-label="共同祖先分支比较">
      <h3>共同祖先分支比较</h3>
      <p>共同祖先：{laboratory.comparison.commonAncestorBranchId}</p>
      <p>共同转换：{laboratory.comparison.commonTransitionCount} 步</p>
      <p>首个不同输入：{laboratory.comparison.firstDifferentInput?.leftId ?? "无"} ↔ {laboratory.comparison.firstDifferentInput?.rightId ?? "无"}</p>
      <p>状态差异：{laboratory.comparison.stateDifferences.length} 项｜左侧独有因果节点：{laboratory.comparison.leftOnlyCausalNodeIds.length}｜右侧独有因果节点：{laboratory.comparison.rightOnlyCausalNodeIds.length}</p>
      <p>仍然相同：{laboratory.comparison.commonStateFieldCount} 个状态字段｜{laboratory.comparison.commonCausalNodeIds.length} 个因果节点</p>
      {laboratory.comparison.historiesConvergedToSameState && <p>当前状态已经收敛，但两条因果历史仍保持独立。</p>}
      {laboratory.comparison.stateDifferences.map((entry, index) => {
        const evidence = laboratory.comparison!.differenceEvidence[index];
        return <article key={`${entry.objectId}:${entry.field}`}><b>{entry.objectId}｜{entry.field}</b><p>{String(entry.before)} → {String(entry.after)}</p><p>输入：{evidence.inputIds.join("、") || "无显式输入"}</p><p>规则：{evidence.ruleIds.join("、") || entry.ruleId}</p><p>转换：{[...evidence.leftTransitionIds, ...evidence.rightTransitionIds].join("、") || "无转换"}</p><p>因果节点：{evidence.causalNodeIds.join("、") || "无新增因果节点"}</p></article>;
      })}
      <p>左侧独有因果路径：{laboratory.comparison.leftOnlyCausalPaths.length} 条｜右侧独有因果路径：{laboratory.comparison.rightOnlyCausalPaths.length} 条</p>
    </section>}
    <section className="runtime-history" aria-label="跨宇宙比较边界"><h3>跨宇宙比较</h3><p>跨宇宙仅可静态对照，不存在共同历史、共同祖先或首个分歧点。</p></section>
  </section>;
}
