import { Orbit, Sparkles, Sprout, Telescope } from "./icons";
import type { Galaxy, Planet, StarSystem, UniverseSummary } from "../sim";
import { biosphereLevelName, civilizationFateName, galaxyTypeName, orbitZoneName, planetTypeName, speciesTypeName, starSystemTypeName } from "../ui/labels";
import type { SpaceStats } from "../ui/selectors";
import { AttributeBar, SectionHeader, SourceList, StatTile } from "./common";

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
        text={`${universe.name} 的 ${stats.galaxyCount} 个代表性星系、${stats.systemCount} 个恒星系、${stats.planetCount} 颗行星`}
      />
      <div className="space-stats" aria-label="局部对象统计">
        <StatTile label="星系" value={stats.galaxyCount} />
        <StatTile label="恒星系" value={stats.systemCount} />
        <StatTile label="行星" value={stats.planetCount} />
        <StatTile label="生命样本" value={stats.biosphereCount} />
        <StatTile label="文明候选" value={stats.civilizationSeedCount} />
      </div>
      <div className="space-grid">
        <section className="space-list" aria-label="星系列表">
          <h4>星系列表</h4>
          <div>
            {universe.galaxies.map((galaxy) => (
              <button
                className={galaxy.id === selectedGalaxy.id ? "space-select active" : "space-select"}
                key={galaxy.id}
                type="button"
                onClick={() => onSelectGalaxy(galaxy)}
                title={`查看${galaxy.name}`}
              >
                <span>
                  <Orbit size={15} />
                  {galaxy.name}
                </span>
                <small>
                  {galaxyTypeName(galaxy.type)}｜{galaxy.starSystems.length} 系
                </small>
              </button>
            ))}
          </div>
        </section>

        <section className="space-list" aria-label="恒星系与行星列表">
          <h4>{selectedGalaxy.name} 的恒星系</h4>
          <div>
            {selectedGalaxy.starSystems.map((system) => (
              <button
                className={system.id === selectedSystem.id ? "space-select active" : "space-select"}
                key={system.id}
                type="button"
                onClick={() => onSelectSystem(system)}
                title={`查看${system.name}`}
              >
                <span>
                  <Sparkles size={15} />
                  {system.name}
                </span>
                <small>
                  {starSystemTypeName(system.type)}｜{system.planets.length} 星
                </small>
              </button>
            ))}
          </div>
          <h4>行星</h4>
          <div className="planet-select-list">
            {selectedSystem.planets.map((planet) => (
              <button
                className={planet.id === selectedPlanet.id ? "space-select active" : "space-select"}
                key={planet.id}
                type="button"
                onClick={() => onSelectPlanet(planet)}
                title={`查看${planet.name}`}
              >
                <span>
                  <Sprout size={15} />
                  {planet.name}
                </span>
                <small>
                  {planetTypeName(planet.type)}｜{planet.biosphere ? biosphereLevelName(planet.biosphere.level) : "无生命"}
                </small>
              </button>
            ))}
          </div>
        </section>

        <article className="space-detail" aria-label="行星详情">
          <span>
            行星详情｜{selectedGalaxy.name} / {selectedSystem.name}
          </span>
          <h3>{selectedPlanet.name}</h3>
          <p>
            {planetTypeName(selectedPlanet.type)}，位于{orbitZoneName(selectedPlanet.orbitZone)}，恒星光度 {selectedSystem.luminosity}，星系因果风险 {selectedGalaxy.causalHazard}。
          </p>
          <div className="detail-metrics">
            <AttributeBar label="宜居性" value={selectedPlanet.habitability} />
            <AttributeBar label="魔法饱和" value={selectedPlanet.magicSaturation} />
            <AttributeBar label="大气" value={selectedPlanet.atmosphere} />
            <AttributeBar label="水量" value={selectedPlanet.water} />
            <AttributeBar label="稳定" value={selectedPlanet.stability} />
          </div>
          <div className="biosphere-block">
            <div>
              <b>生物圈</b>
              {biosphere ? (
                <small>
                  {biosphereLevelName(biosphere.level)}｜{biosphere.dominantForm}｜复杂度 {biosphere.complexity}
                </small>
              ) : (
                <small>当前样本未形成稳定生命圈</small>
              )}
            </div>
            {biosphere && (
              <div className="detail-metrics">
                <AttributeBar label="魔法适应" value={biosphere.magicAdaptation} />
                <AttributeBar label="文明概率" value={biosphere.civilizationChance} />
              </div>
            )}
          </div>
          <div className="civilization-prelude">
            <b>阶段 5 文明入口</b>
            {civilizationSeed ? (
              <div>
                <span>
                  {speciesTypeName(civilizationSeed.speciesType)}｜{civilizationFateName(civilizationSeed.fate)}
                </span>
                <div className="detail-metrics">
                  <AttributeBar label="科技" value={civilizationSeed.technologyLevel} />
                  <AttributeBar label="魔法" value={civilizationSeed.magicLevel} />
                  <AttributeBar label="信仰" value={civilizationSeed.faithIntensity} />
                  <AttributeBar label="扩张" value={civilizationSeed.expansionDrive} />
                  <AttributeBar label="稳定" value={civilizationSeed.stability} />
                </div>
              </div>
            ) : (
              <small>当前行星没有达到文明候选门槛</small>
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
