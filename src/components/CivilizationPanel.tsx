import { ScrollText, Sparkles, UsersRound } from "./icons";
import { useMemo, useState } from "react";
import type { Civilization, UniverseSummary } from "../sim";
import { civilizationEventTypeName, civilizationFateName, civilizationPathName, mythologyTypeName, signed, speciesTypeName } from "../ui/labels";
import type { CivilizationStats } from "../ui/selectors";
import { AttributeBar, SectionHeader, SourceList, StatTile } from "./common";

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
        text={`${universe.name} 的 ${stats.civilizationCount} 个文明样本，覆盖 ${stats.pathCount} 类路径与 ${stats.mythologyCount} 类神话系统`}
      />
      <div className="civilization-stats" aria-label="文明统计">
        <StatTile label="文明" value={stats.civilizationCount} />
        <StatTile label="路径" value={stats.pathCount} />
        <StatTile label="神话系统" value={stats.mythologyCount} />
        <StatTile label="高风险" value={stats.highRiskCount} />
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
              {visibleCivilizations.map((civilization) => (
                <button
                  className={civilization.id === selectedCivilization.id ? "civilization-select active" : "civilization-select"}
                  key={civilization.id}
                  type="button"
                  onClick={() => onSelectCivilization(civilization)}
                  title={`查看${civilization.name}`}
                >
                  <span>
                    <Sparkles size={15} />
                    {civilization.name}
                  </span>
                  <small>
                    {civilizationPathName(civilization.path)}｜{civilizationFateName(civilization.fate)}
                  </small>
                </button>
              ))}
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
              文明详情｜{selectedCivilization.originGalaxyName} / {selectedCivilization.originStarSystemName} / {selectedCivilization.originPlanetName}
            </span>
            <h3>{selectedCivilization.name}</h3>
            <p>
              {speciesTypeName(selectedCivilization.speciesType)}走向{civilizationPathName(selectedCivilization.path)}，当前终局倾向为{civilizationFateName(selectedCivilization.fate)}。
            </p>
            <div className="detail-metrics">
              <AttributeBar label="科技" value={selectedCivilization.technologyLevel} />
              <AttributeBar label="魔法" value={selectedCivilization.magicLevel} />
              <AttributeBar label="信仰" value={selectedCivilization.faithIntensity} />
              <AttributeBar label="扩张" value={selectedCivilization.expansionDrive} />
              <AttributeBar label="稳定" value={selectedCivilization.stability} />
              <AttributeBar label="灭绝风险" value={selectedCivilization.extinctionRisk} />
            </div>
            <div className="mythology-block" aria-label="神话系统">
              <b>神话系统</b>
              <span>
                {mythologyTypeName(selectedCivilization.mythology.type)}｜{selectedCivilization.mythology.deityName}｜影响 {selectedCivilization.mythology.influenceLevel}
              </span>
              <p>{selectedCivilization.mythology.origin}</p>
              <p>{selectedCivilization.mythology.relationToCivilization}</p>
              <small>{selectedCivilization.mythology.explanation}</small>
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
                  <span>
                    {event.ageLabel}｜{civilizationEventTypeName(event.type)}｜影响 {signed(event.impact)}
                  </span>
                  <b>{event.title}</b>
                  <p>{event.description}</p>
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
