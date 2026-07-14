import { ScrollText, Sparkles, UsersRound } from "./icons";
import { useMemo, useState } from "react";
import type { Civilization, UniverseSummary } from "../sim";
import { civilizationEventTypeName, civilizationFateName, civilizationPathName, mythologyTypeName, signed, speciesTypeName } from "../ui/labels";
import type { CivilizationStats } from "../ui/selectors";
import { AttributeBar, RegisteredResult, ResultValue, SectionHeader, SourceList, StatTile, TraceCauseButton } from "./common";

const PAGE_SIZE = 30;

export function CivilizationPanel({
  universe,
  stats,
  selectedCivilization,
  sourceLabelById,
  onSelectCivilization,
}: {
  universe: UniverseSummary;
  stats: CivilizationStats;
  selectedCivilization?: Civilization;
  sourceLabelById: Map<string, string>;
  onSelectCivilization: (civilization: Civilization) => void;
}) {
  const [query, setQuery] = useState("");
  const [pathFilter, setPathFilter] = useState("all");
  const [page, setPage] = useState(0);
  const pathOptions = useMemo(
    () => [...new Set(universe.civilizations.map((civilization) => civilization.path))].sort(),
    [universe.civilizations],
  );
  const filteredCivilizations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    return universe.civilizations.filter((civilization) => {
      const matchesPath = pathFilter === "all" || civilization.path === pathFilter;
      const searchText = `${civilization.name} ${civilization.originPlanetName} ${civilizationPathName(civilization.path)} ${civilizationFateName(civilization.fate)}`.toLocaleLowerCase("zh-CN");
      return matchesPath && (!normalizedQuery || searchText.includes(normalizedQuery));
    });
  }, [pathFilter, query, universe.civilizations]);
  const pageCount = Math.max(1, Math.ceil(filteredCivilizations.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount - 1);
  const visibleCivilizations = filteredCivilizations.slice(visiblePage * PAGE_SIZE, (visiblePage + 1) * PAGE_SIZE);

  return (
    <section className="civilization-panel" aria-label="文明演化">
      <SectionHeader
        icon={<UsersRound size={18} />}
        title="文明演化"
        text={`${universe.name} 的文明与神话条件视图`}
      />
      <div className="civilization-stats" aria-label="文明统计">
        <StatTile label="文明" value={stats.civilizationCount} subjectId="civilization.stats.total" />
        <StatTile label="路径" value={stats.pathCount} subjectId="civilization.stats.paths" />
        <StatTile label="神话系统" value={stats.mythologyCount} subjectId="civilization.stats.mythologies" />
        <StatTile label="高风险" value={stats.highRiskCount} subjectId="civilization.stats.highRisk" />
      </div>

      {selectedCivilization ? (
        <div className="civilization-grid">
          <section className="civilization-list" aria-label="文明列表">
            <h4>文明列表</h4>
            <div className="civilization-filters">
              <label>
                <span>搜索文明</span>
                <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="名称、行星、路径或终局" />
              </label>
              <label>
                <span>文明路径</span>
                <select value={pathFilter} onChange={(event) => { setPathFilter(event.target.value); setPage(0); }}>
                  <option value="all">全部路径</option>
                  {pathOptions.map((path) => <option key={path} value={path}>{civilizationPathName(path)}</option>)}
                </select>
              </label>
              <small role="status">找到 {filteredCivilizations.length} 个文明，每页最多显示 {PAGE_SIZE} 个</small>
            </div>
            <div className="civilization-results">
              {visibleCivilizations.map((civilization) => <div className="civilization-choice" key={civilization.id}>
                <button
                  className={civilization.id === selectedCivilization.id ? "civilization-select active" : "civilization-select"}
                  type="button"
                  onClick={() => onSelectCivilization(civilization)}
                  title={`查看${civilization.name}`}
                >
                  <span>
                    <Sparkles size={15} />
                    <RegisteredResult subjectId={civilization.id} value={civilization.name}>{civilization.name}</RegisteredResult>
                  </span>
                </button>
                <small>
                  <ResultValue subjectId={`${civilization.id}.path`} label={`${civilization.name}文明路径`} strategy="state" value={civilization.path}>{civilizationPathName(civilization.path)}</ResultValue>
                  <ResultValue subjectId={`${civilization.id}.fate`} label={`${civilization.name}文明命运`} strategy="state" value={civilization.fate}>{civilizationFateName(civilization.fate)}</ResultValue>
                </small>
                <TraceCauseButton subjectId={civilization.id} label={civilization.name} />
              </div>)}
              {visibleCivilizations.length === 0 && <p className="civilization-empty">没有符合当前筛选条件的文明。</p>}
            </div>
            {pageCount > 1 && <div className="civilization-pagination" aria-label="文明分页">
              <button type="button" disabled={visiblePage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>上一页</button>
              <span>第 {visiblePage + 1} / {pageCount} 页</span>
              <button type="button" disabled={visiblePage >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>下一页</button>
            </div>}
          </section>

          <article className="civilization-detail" aria-label="文明详情">
            <span>
              文明详情｜<RegisteredResult subjectId={selectedCivilization.originGalaxyId} value={selectedCivilization.originGalaxyName}>{selectedCivilization.originGalaxyName}</RegisteredResult> / <RegisteredResult subjectId={selectedCivilization.originStarSystemId} value={selectedCivilization.originStarSystemName}>{selectedCivilization.originStarSystemName}</RegisteredResult> / <RegisteredResult subjectId={selectedCivilization.originPlanetId} value={selectedCivilization.originPlanetName}>{selectedCivilization.originPlanetName}</RegisteredResult>
            </span>
            <h3><RegisteredResult subjectId={selectedCivilization.id} value={selectedCivilization.name}>{selectedCivilization.name}</RegisteredResult></h3>
            <TraceCauseButton subjectId={selectedCivilization.id} label={selectedCivilization.name} />
            <div className="result-traces">
              <TraceCauseButton subjectId={selectedCivilization.originGalaxyId} label={selectedCivilization.originGalaxyName} />
              <TraceCauseButton subjectId={selectedCivilization.originStarSystemId} label={selectedCivilization.originStarSystemName} />
              <TraceCauseButton subjectId={selectedCivilization.originPlanetId} label={selectedCivilization.originPlanetName} />
            </div>
            <p className="result-sentence">
              <ResultValue subjectId={`${selectedCivilization.id}.speciesType`} label="文明物种" strategy="state" value={selectedCivilization.speciesType}>{speciesTypeName(selectedCivilization.speciesType)}</ResultValue>
              走向<ResultValue subjectId={`${selectedCivilization.id}.path`} label="文明路径" strategy="state" value={selectedCivilization.path}>{civilizationPathName(selectedCivilization.path)}</ResultValue>
              ，当前终局倾向为<ResultValue subjectId={`${selectedCivilization.id}.fate`} label="文明命运" strategy="state" value={selectedCivilization.fate}>{civilizationFateName(selectedCivilization.fate)}</ResultValue>。
            </p>
            <div className="detail-metrics">
              <AttributeBar label="科技" value={selectedCivilization.technologyLevel} subjectId={`${selectedCivilization.id}.technologyLevel`} />
              <AttributeBar label="魔法" value={selectedCivilization.magicLevel} subjectId={`${selectedCivilization.id}.magicLevel`} />
              <AttributeBar label="信仰" value={selectedCivilization.faithIntensity} subjectId={`${selectedCivilization.id}.faithIntensity`} />
              <AttributeBar label="扩张" value={selectedCivilization.expansionDrive} subjectId={`${selectedCivilization.id}.expansionDrive`} />
              <AttributeBar label="稳定" value={selectedCivilization.stability} subjectId={`${selectedCivilization.id}.stability`} />
              <AttributeBar label="灭绝风险" value={selectedCivilization.extinctionRisk} subjectId={`${selectedCivilization.id}.extinctionRisk`} />
            </div>
            <div className="mythology-block" aria-label="神话系统">
              <b>神话系统</b>
              <span>
                <ResultValue subjectId={`${selectedCivilization.id}.mythology.type`} label="神话类型" strategy="state" value={selectedCivilization.mythology.type}>{mythologyTypeName(selectedCivilization.mythology.type)}</ResultValue>
                <ResultValue subjectId={`${selectedCivilization.id}.mythology.deityName`} label="神名" strategy="state" value={selectedCivilization.mythology.deityName}>{selectedCivilization.mythology.deityName}</ResultValue>
                <ResultValue subjectId={`${selectedCivilization.id}.mythology.influenceLevel`} label="神话影响" strategy="state" value={selectedCivilization.mythology.influenceLevel}>影响 {selectedCivilization.mythology.influenceLevel}</ResultValue>
              </span>
              <p><ResultValue subjectId={`${selectedCivilization.id}.mythology.origin`} label="神话起源" strategy="state" value={selectedCivilization.mythology.origin}>{selectedCivilization.mythology.origin}</ResultValue></p>
              <p><ResultValue subjectId={`${selectedCivilization.id}.mythology.relationToCivilization`} label="神话文明关系" strategy="state" value={selectedCivilization.mythology.relationToCivilization}>{selectedCivilization.mythology.relationToCivilization}</ResultValue></p>
              <small><ResultValue subjectId={`${selectedCivilization.id}.mythology`} label="神话解释" strategy="cause" value={selectedCivilization.mythology.explanation}>{selectedCivilization.mythology.explanation}</ResultValue></small>
              <TraceCauseButton
                subjectId={`${selectedCivilization.id}.mythology`}
                label={`${selectedCivilization.name}神话`}
              />
            </div>
            <div className="source-grid">
              <SourceList title="事件来源" ids={selectedCivilization.sourceEventIds} sourceLabelById={sourceLabelById} />
              <SourceList title="法则来源" ids={selectedCivilization.sourceRuleIds} sourceLabelById={sourceLabelById} />
            </div>
          </article>

          <section className="civilization-history" aria-label="文明历史">
            <h4>
              <ScrollText size={16} />
              文明历史
            </h4>
            <div>
              {selectedCivilization.historyEvents.map((event) => (
                <article key={event.id}>
                  <span><ResultValue subjectId={event.id} label={`${event.title}元数据`} strategy="cause" value={{ ageLabel: event.ageLabel, type: event.type, impact: event.impact }}>
                    {event.ageLabel}｜{civilizationEventTypeName(event.type)}｜影响 {signed(event.impact)}
                  </ResultValue></span>
                  <b><ResultValue subjectId={event.id} label={`${event.title}标题`} strategy="cause" value={event.title}>{event.title}</ResultValue></b>
                  <p><ResultValue subjectId={event.id} label={`${event.title}描述`} strategy="cause" value={event.description}>{event.description}</ResultValue></p>
                  <TraceCauseButton subjectId={event.id} label={event.title} />
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="civilization-empty">当前宇宙没有达到阶段 5 门槛的文明样本。</div>
      )}
    </section>
  );
}
