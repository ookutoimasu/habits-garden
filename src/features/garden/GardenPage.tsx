import React, { useState } from 'react';
import { Plus, Sprout } from 'lucide-react';
import { useApp } from '../../app/AppProvider';
import { Modal } from '../../components/ui/Modal';
import { HabitForm } from '../habits/HabitForm';
import { HabitTreeCard } from './HabitTreeCard';

export const GardenPage: React.FC = () => {
  const {
    nowMs,
    habits,
    activeTimer,
    selectHabit,
    gardenMode,
    hasChosenGardenMode,
    chooseGardenMode,
    addHabit,
    activeParticleHabitId,
    stagePreviewPreset,
  } = useApp();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      {/* При первом запуске предлагаем демонстрационный сад или начало с пустого */}
      {!hasChosenGardenMode && habits.length === 0 && (
        <section
          aria-label="Выбор начального режима сада"
          data-testid="first-launch-banner"
          className="w-full bg-white border border-[#111111] rounded-md p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="space-y-2 max-w-xl">
            <h2 className="text-lg font-semibold text-[#111111]">
              Добро пожаловать в Habits Garden
            </h2>
            <p className="text-sm text-[#666666] leading-relaxed">
              Каждая привычка здесь растёт как живое дерево со своим постоянным ветвлением.
              Вы можете осмотреть готовый демонстрационный сад с деревьями на разных стадиях
              роста или сразу начать со своего пустого сада. Демонстрационные записи хранятся
              отдельно и никогда не смешиваются с вашей личной историей.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => chooseGardenMode('demo')}
              data-testid="choose-demo-garden-btn"
              className="min-h-[44px] px-4 py-2.5 bg-[#111111] hover:bg-[#2A2A2A] text-white text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              Открыть демонстрационный сад
            </button>
            <button
              type="button"
              onClick={() => chooseGardenMode('personal')}
              data-testid="choose-empty-garden-btn"
              className="min-h-[44px] px-4 py-2.5 bg-white hover:bg-[#F5F5F5] text-[#111111] border border-[#CCCCCC] hover:border-[#111111] rounded-md text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              Начать с пустого сада
            </button>
          </div>
        </section>
      )}

      {/* Заголовок сада и панель управления */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#E6E6E6]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#111111] tracking-tight">
            {gardenMode === 'demo' ? 'Демонстрационный сад' : 'Мой сад привычек'}
          </h1>
          <p className="text-sm text-[#666666] mt-1">
            {gardenMode === 'demo'
              ? 'Отдельная витрина деревьев разных стадий и режимов учёта. Личная история не затрагивается.'
              : 'Каждое дерево развивается непрерывно во времени от регулярного выполнения вашего плана.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            data-testid="add-habit-btn"
            className="min-h-[44px] px-4 py-2.5 bg-[#111111] hover:bg-[#2A2A2A] text-white text-sm font-medium rounded-md flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить привычку</span>
          </button>
        </div>
      </div>

      {/* Сетка деревьев в горшках или пустое состояние */}
      {habits.length === 0 ? (
        <section
          aria-label="Пустой сад"
          data-testid="empty-garden-state"
          className="w-full bg-white border border-[#E6E6E6] rounded-md p-10 sm:p-14 text-center flex flex-col items-center justify-center space-y-4"
        >
          <div className="w-12 h-12 rounded-md border border-[#E6E6E6] flex items-center justify-center text-[#111111]">
            <Sprout className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h2 className="text-base font-semibold text-[#111111]">
              В вашем саду пока нет деревьев
            </h2>
            <p className="text-sm text-[#666666]">
              Создайте первую привычку с отметкой за день или таймером времени — она появится
              молодым ростком в маленьком горшке.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="min-h-[44px] px-5 py-2.5 bg-[#111111] hover:bg-[#2A2A2A] text-white text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              Посадить первую привычку
            </button>
            <button
              type="button"
              onClick={() => chooseGardenMode('demo')}
              className="min-h-[44px] px-4 py-2.5 bg-white hover:bg-[#F5F5F5] text-[#111111] border border-[#CCCCCC] hover:border-[#111111] rounded-md text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              Посмотреть демонстрационный сад
            </button>
          </div>
        </section>
      ) : (
        <section
          aria-label="Коллекция деревьев привычек"
          data-testid="garden-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {habits.map((habit) => (
            <HabitTreeCard
              key={habit.id}
              habit={habit}
              nowMs={nowMs}
              activeTimer={activeTimer}
              showParticles={activeParticleHabitId === habit.id}
              stagePreviewPreset={stagePreviewPreset}
              onOpenHabit={selectHabit}
            />
          ))}
        </section>
      )}

      {/* Модальное окно создания новой привычки */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Новая привычка"
      >
        <HabitForm
          onCancel={() => setIsAddModalOpen(false)}
          onSubmit={(values) => {
            addHabit(values);
            setIsAddModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
};
