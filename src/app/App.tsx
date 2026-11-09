import React from 'react';
import { AppProvider, useApp } from './AppProvider';
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
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-8">
          {/* Зона 1: Название приложения */}
          <button
            type="button"
            onClick={() => selectHabit(null)}
            className="text-sm sm:text-lg font-medium tracking-tight text-[#111111] whitespace-nowrap shrink-0 cursor-pointer text-left"
          >
            Habits Garden
          </button>

          {/* Зона 2: Переключение Личный сад / Демонстрационный сад */}
          <nav
            aria-label="Режим сада"
            className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-normal text-[#666666]"
          >
            <button
              type="button"
              onClick={() => chooseGardenMode('personal')}
              data-testid="nav-personal-garden"
              className={`min-h-[38px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                gardenMode === 'personal'
                  ? 'text-[#111111] font-medium underline underline-offset-4'
                  : 'hover:text-[#111111]'
              }`}
            >
              Личный сад
            </button>
            <button
              type="button"
              onClick={() => chooseGardenMode('demo')}
              data-testid="nav-demo-garden"
              className={`min-h-[38px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                gardenMode === 'demo'
                  ? 'text-[#111111] font-medium underline underline-offset-4'
                  : 'hover:text-[#111111]'
              }`}
            >
              Демо-сад
            </button>
          </nav>

          {/* Зона 3: Тоггл закрытой по умолчанию панели проверки времени */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => (isSimulationOpen ? exitSimulation() : enterSimulation())}
              data-testid="toggle-simulation-btn"
              aria-expanded={isSimulationOpen}
              className={`min-h-[38px] px-2.5 sm:px-3.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isSimulationOpen
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#111111] border-[#CCCCCC] hover:border-[#111111]'
              }`}
            >
              {isSimulationOpen ? 'Скрыть проверку' : 'Проверка времени'}
            </button>
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
