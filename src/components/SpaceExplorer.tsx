import { Orbit, Sparkles, Sprout, Telescope } from "./icons";
import type { Galaxy, Planet, StarSystem, UniverseSummary } from "../sim";
import { biosphereLevelName, civilizationFateName, galaxyTypeName, orbitZoneName, planetTypeName, speciesTypeName, starSystemTypeName } from "../ui/labels";
import type { SpaceStats } from "../ui/selectors";
import { AttributeBar, RegisteredResult, ResultValue, SectionHeader, SourceList, StatTile, TraceCauseButton } from "./common";

export function SpaceExplorer({
  universe,
  stats,
  selectedGalaxy,
  selectedSystem,
  selectedPlanet,
  sourceLabelById,
  onSelectGalaxy,
  onSelectSystem,
  onSelectPlanet,
}: {
  universe: UniverseSummary;
  stats: SpaceStats;
  selectedGalaxy?: Galaxy;
  selectedSystem?: StarSystem;
  selectedPlanet?: Planet;
  sourceLabelById: Map<string, string>;
  onSelectGalaxy: (galaxy: Galaxy) => void;
  onSelectSystem: (system: StarSystem) => void;
  onSelectPlanet: (planet: Planet) => void;
}) {
  if (!selectedGalaxy || !selectedSystem || !selectedPlanet) {
    return null;
  }

  const biosphere = selectedPlanet.biosphere;
  const civilizationSeed = biosphere?.civilizationSeed;

  return (
    <section id="space-explorer" className="space-panel" aria-label="局部对象探索">
      <SectionHeader
        icon={<Telescope size={18} />}
        title="局部探索"
        text={`${universe.name} 的传统空间结构浏览视图`}
      />
      <div className="space-stats" aria-label="局部对象统计">
        <StatTile label="星系" value={stats.galaxyCount} subjectId="space.stats.galaxies" />
        <StatTile label="恒星系" value={stats.systemCount} subjectId="space.stats.systems" />
        <StatTile label="行星" value={stats.planetCount} subjectId="space.stats.planets" />
        <StatTile label="生命样本" value={stats.biosphereCount} subjectId="space.stats.biospheres" />
        <StatTile label="文明候选" value={stats.civilizationSeedCount} subjectId="space.stats.civilizationSeeds" />
      </div>
      <div className="space-grid">
        <section className="space-list" aria-label="星系列表">
          <h4>星系列表</h4>
          <div>
            {universe.galaxies.map((galaxy) => <div className="space-choice" key={galaxy.id}>
              <button
                className={galaxy.id === selectedGalaxy.id ? "space-select active" : "space-select"}
                type="button"
                onClick={() => onSelectGalaxy(galaxy)}
              >
                <span>
                  <Orbit size={15} />
                  <RegisteredResult subjectId={galaxy.id} value={galaxy.name}>{galaxy.name}</RegisteredResult>
                </span>
              </button>
              <small>
                <ResultValue subjectId={`${galaxy.id}.type`} label={`${galaxy.name}类型`} strategy="state" value={galaxy.type}>{galaxyTypeName(galaxy.type)}</ResultValue>
                <ResultValue subjectId={`${galaxy.id}.starSystems.count`} label={`${galaxy.name}恒星系数量`} strategy="state" value={galaxy.starSystems.length}>{galaxy.starSystems.length} 系</ResultValue>
              </small>
              <TraceCauseButton subjectId={galaxy.id} label={galaxy.name} />
            </div>)}
          </div>
        </section>

        <section className="space-list" aria-label="恒星系与行星列表">
          <h4><RegisteredResult subjectId={selectedGalaxy.id} value={selectedGalaxy.name}>{selectedGalaxy.name}</RegisteredResult> 的恒星系</h4>
          <TraceCauseButton subjectId={selectedGalaxy.id} label={selectedGalaxy.name} />
          <div>
            {selectedGalaxy.starSystems.map((system) => <div className="space-choice" key={system.id}>
              <button
                className={system.id === selectedSystem.id ? "space-select active" : "space-select"}
                type="button"
                onClick={() => onSelectSystem(system)}
              >
                <span>
                  <Sparkles size={15} />
                  <RegisteredResult subjectId={system.id} value={system.name}>{system.name}</RegisteredResult>
                </span>
              </button>
              <small>
                <ResultValue subjectId={`${system.id}.type`} label={`${system.name}类型`} strategy="state" value={system.type}>{starSystemTypeName(system.type)}</ResultValue>
                <ResultValue subjectId={`${system.id}.planets.count`} label={`${system.name}行星数量`} strategy="state" value={system.planets.length}>{system.planets.length} 星</ResultValue>
              </small>
              <TraceCauseButton subjectId={system.id} label={system.name} />
            </div>)}
          </div>
          <h4>行星</h4>
          <div className="planet-select-list">
            {selectedSystem.planets.map((planet) => <div className="space-choice" key={planet.id}>
              <button
                className={planet.id === selectedPlanet.id ? "space-select active" : "space-select"}
                type="button"
                onClick={() => onSelectPlanet(planet)}
              >
                <span>
                  <Sprout size={15} />
                  <RegisteredResult subjectId={planet.id} value={planet.name}>{planet.name}</RegisteredResult>
                </span>
              </button>
              <small>
                <ResultValue subjectId={`${planet.id}.type`} label={`${planet.name}类型`} strategy="state" value={planet.type}>{planetTypeName(planet.type)}</ResultValue>
                {planet.biosphere
                  ? <ResultValue subjectId={`${planet.id}.biosphere.level`} label={`${planet.name}生物圈等级`} strategy="state" value={planet.biosphere.level}>{biosphereLevelName(planet.biosphere.level)}</ResultValue>
                  : <ResultValue subjectId={`${planet.id}.biosphere.absent`} label={`${planet.name}未形成生物圈`} strategy="cause" value={false}>无生命</ResultValue>}
              </small>
              <TraceCauseButton subjectId={planet.id} label={planet.name} />
            </div>)}
          </div>
        </section>

        <article className="space-detail" aria-label="行星详情">
          <span>
            行星详情｜<RegisteredResult subjectId={selectedGalaxy.id} value={selectedGalaxy.name}>{selectedGalaxy.name}</RegisteredResult> / <RegisteredResult subjectId={selectedSystem.id} value={selectedSystem.name}>{selectedSystem.name}</RegisteredResult>
          </span>
          <h3><RegisteredResult subjectId={selectedPlanet.id} value={selectedPlanet.name}>{selectedPlanet.name}</RegisteredResult></h3>
          <div className="result-traces">
            <TraceCauseButton subjectId={selectedGalaxy.id} label={selectedGalaxy.name} />
            <TraceCauseButton subjectId={selectedSystem.id} label={selectedSystem.name} />
            <TraceCauseButton subjectId={selectedPlanet.id} label={selectedPlanet.name} />
          </div>
          <p className="result-sentence">
            <ResultValue subjectId={`${selectedPlanet.id}.type`} label="行星类型" strategy="state" value={selectedPlanet.type}>{planetTypeName(selectedPlanet.type)}</ResultValue>
            ，位于<ResultValue subjectId={`${selectedPlanet.id}.orbitZone`} label="轨道区域" strategy="state" value={selectedPlanet.orbitZone}>{orbitZoneName(selectedPlanet.orbitZone)}</ResultValue>
            ，恒星光度 <ResultValue subjectId={`${selectedSystem.id}.luminosity`} label="恒星光度" strategy="state" value={selectedSystem.luminosity}>{selectedSystem.luminosity}</ResultValue>
            ，星系因果风险 <ResultValue subjectId={`${selectedGalaxy.id}.causalHazard`} label="星系因果风险" strategy="state" value={selectedGalaxy.causalHazard}>{selectedGalaxy.causalHazard}</ResultValue>。
          </p>
          <div className="detail-metrics">
            <AttributeBar label="宜居性" value={selectedPlanet.habitability} subjectId={`${selectedPlanet.id}.habitability`} />
            <AttributeBar label="魔法饱和" value={selectedPlanet.magicSaturation} subjectId={`${selectedPlanet.id}.magicSaturation`} />
            <AttributeBar label="大气" value={selectedPlanet.atmosphere} subjectId={`${selectedPlanet.id}.atmosphere`} />
            <AttributeBar label="水量" value={selectedPlanet.water} subjectId={`${selectedPlanet.id}.water`} />
            <AttributeBar label="稳定" value={selectedPlanet.stability} subjectId={`${selectedPlanet.id}.stability`} />
          </div>
          <div className="biosphere-block">
            <div>
              <b>生物圈</b>
              {biosphere ? (
                <span>
                  <small>
                    <ResultValue subjectId={`${selectedPlanet.id}.biosphere.level`} label="生物圈等级" strategy="state" value={biosphere.level}>{biosphereLevelName(biosphere.level)}</ResultValue>
                    <ResultValue subjectId={`${selectedPlanet.id}.biosphere.dominantForm`} label="主导形态" strategy="state" value={biosphere.dominantForm}>{biosphere.dominantForm}</ResultValue>
                    <ResultValue subjectId={`${selectedPlanet.id}.biosphere.complexity`} label="生物圈复杂度" strategy="state" value={biosphere.complexity}>复杂度 {biosphere.complexity}</ResultValue>
                  </small>
                  <TraceCauseButton subjectId={`${selectedPlanet.id}.biosphere`} label={`${selectedPlanet.name}生物圈`} />
                </span>
              ) : (
                <span>
                  <small>当前样本未形成稳定生命圈</small>
                  <TraceCauseButton subjectId={`${selectedPlanet.id}.biosphere.absent`} label="未形成生物圈" />
                </span>
              )}
            </div>
            {biosphere && (
              <div className="detail-metrics">
                <AttributeBar label="魔法适应" value={biosphere.magicAdaptation} subjectId={`${selectedPlanet.id}.biosphere.magicAdaptation`} />
                <AttributeBar label="文明概率" value={biosphere.civilizationChance} subjectId={`${selectedPlanet.id}.biosphere.civilizationChance`} />
              </div>
            )}
          </div>
          <div className="civilization-prelude">
            <b>阶段 5 文明入口</b>
            {civilizationSeed ? (
              <div>
                <span>
                  <ResultValue subjectId={`${selectedPlanet.id}.civilization-seed.speciesType`} label="文明候选物种" strategy="state" value={civilizationSeed.speciesType}>{speciesTypeName(civilizationSeed.speciesType)}</ResultValue>
                  <ResultValue subjectId={`${selectedPlanet.id}.civilization-seed.fate`} label="文明候选命运" strategy="state" value={civilizationSeed.fate}>{civilizationFateName(civilizationSeed.fate)}</ResultValue>
                </span>
                <TraceCauseButton subjectId={`${selectedPlanet.id}.civilization-seed`} label={`${selectedPlanet.name}文明候选`} />
                <div className="detail-metrics">
                  <AttributeBar label="科技" value={civilizationSeed.technologyLevel} subjectId={`${selectedPlanet.id}.civilization-seed.technologyLevel`} />
                  <AttributeBar label="魔法" value={civilizationSeed.magicLevel} subjectId={`${selectedPlanet.id}.civilization-seed.magicLevel`} />
                  <AttributeBar label="信仰" value={civilizationSeed.faithIntensity} subjectId={`${selectedPlanet.id}.civilization-seed.faithIntensity`} />
                  <AttributeBar label="扩张" value={civilizationSeed.expansionDrive} subjectId={`${selectedPlanet.id}.civilization-seed.expansionDrive`} />
                  <AttributeBar label="稳定" value={civilizationSeed.stability} subjectId={`${selectedPlanet.id}.civilization-seed.stability`} />
                </div>
              </div>
            ) : (
              <div>
                <small>当前行星没有达到文明候选门槛</small>
                {biosphere && <TraceCauseButton subjectId={`${selectedPlanet.id}.civilization-seed.absent`} label="未形成文明候选" />}
              </div>
            )}
          </div>
          <div className="source-grid">
            <SourceList title="事件来源" ids={selectedPlanet.sourceEventIds} sourceLabelById={sourceLabelById} />
            <SourceList title="法则来源" ids={selectedPlanet.sourceRuleIds} sourceLabelById={sourceLabelById} />
          </div>
        </article>
      </div>
    </section>
  );
}
