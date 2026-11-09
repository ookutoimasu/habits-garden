import React from 'react';
import { AppProvider, useApp } from './AppProvider';
import { Button } from '../components/ui/Button';
import { GardenPage } from '../features/garden/GardenPage';
import { HabitPage } from '../features/habits/HabitPage';
import { SimulationPanel } from '../features/simulation/SimulationPanel';

const AppShell: React.FC = () => {
  const {
    habits,
    selectedHabitId,
    selectHabit,
    gardenMode,
    chooseGardenMode,
    isSimulationOpen,
    enterSimulation,
    exitSimulation,
  } = useApp();

  const selectedHabit = selectedHabitId
    ? habits.find((h) => h.id === selectedHabitId) ?? null
    : null;

  return (
    <div className="min-h-screen bg-white text-[#111111] flex flex-col">
      {/* Верхняя шапка приложения: 3 зоны по контракту, адаптивная без горизонтального скролла */}
      <header className="w-full bg-white border-b border-[#E6E6E6]">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 sm:gap-6">
          {/* Зона 1: Название приложения */}
          <button
            type="button"
            onClick={() => selectHabit(null)}
            className="text-sm sm:text-lg font-medium tracking-tight text-[#111111] whitespace-nowrap shrink-0 cursor-pointer text-left rounded-full px-2 py-1 hover:bg-[#F4F4F6] transition-colors"
          >
            Habits Garden
          </button>

          {/* Зона 2: Переключение Личный сад / Демонстрационный сад */}
          <nav
            aria-label="Режим сада"
            className="flex items-center gap-1.5 sm:gap-2"
          >
            <Button
              variant={gardenMode === 'personal' ? 'selected' : 'ghost'}
              size="sm"
              onClick={() => chooseGardenMode('personal')}
              data-testid="nav-personal-garden"
              aria-pressed={gardenMode === 'personal'}
            >
              Личный сад
            </Button>
            <Button
              variant={gardenMode === 'demo' ? 'selected' : 'ghost'}
              size="sm"
              onClick={() => chooseGardenMode('demo')}
              data-testid="nav-demo-garden"
              aria-pressed={gardenMode === 'demo'}
            >
              Демо-сад
            </Button>
          </nav>

          {/* Зона 3: Тоггл закрытой по умолчанию панели проверки времени */}
          <div className="flex items-center shrink-0">
            <Button
              variant={isSimulationOpen ? 'selected' : 'secondary'}
              size="sm"
              onClick={() => (isSimulationOpen ? exitSimulation() : enterSimulation())}
              data-testid="toggle-simulation-btn"
              aria-expanded={isSimulationOpen}
            >
              {isSimulationOpen ? 'Скрыть проверку' : 'Проверка времени'}
            </Button>
          </div>
        </div>
      </header>

      {/* Панель проверки времени (по умолчанию закрыта) */}
      <SimulationPanel />

      {/* Основное содержимое экрана */}
      <main className="flex-1 w-full">
        {selectedHabit ? <HabitPage habit={selectedHabit} /> : <GardenPage />}
      </main>
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

export default App;
