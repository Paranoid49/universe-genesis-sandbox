import { useState } from "react";
import type { Civilization, Galaxy, Planet, StarSystem, UniverseSummary } from "../sim";

export function useUniverseSelection(universe: UniverseSummary) {
  const [selectedGalaxyId, setSelectedGalaxyId] = useState<string>();
  const [selectedSystemId, setSelectedSystemId] = useState<string>();
  const [selectedPlanetId, setSelectedPlanetId] = useState<string>();
  const [selectedCivilizationId, setSelectedCivilizationId] = useState<string>();
  const selectedGalaxy = universe.galaxies.find((galaxy) => galaxy.id === selectedGalaxyId) ?? universe.galaxies[0];
  const selectedSystem = selectedGalaxy?.starSystems.find((system) => system.id === selectedSystemId) ?? selectedGalaxy?.starSystems[0];
  const selectedPlanet = selectedSystem?.planets.find((planet) => planet.id === selectedPlanetId) ?? selectedSystem?.planets[0];
  const selectedCivilization = universe.civilizations.find((civilization) => civilization.id === selectedCivilizationId) ?? universe.civilizations[0];

  function selectGalaxy(galaxy: Galaxy) {
    const firstSystem = galaxy.starSystems[0];
    setSelectedGalaxyId(galaxy.id);
    setSelectedSystemId(firstSystem?.id);
    setSelectedPlanetId(firstSystem?.planets[0]?.id);
  }

  function selectSystem(system: StarSystem) {
    setSelectedSystemId(system.id);
    setSelectedPlanetId(system.planets[0]?.id);
  }

  function selectPlanet(planet: Planet) {
    setSelectedPlanetId(planet.id);
  }

  function selectCivilization(civilization: Civilization) {
    setSelectedCivilizationId(civilization.id);
  }

  return {
    selectedCivilization,
    selectedGalaxy,
    selectedPlanet,
    selectedSystem,
    selectCivilization,
    selectGalaxy,
    selectPlanet,
    selectSystem,
  };
}
