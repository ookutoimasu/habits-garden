import React, { useState } from 'react';
import { Plus, Sprout } from 'lucide-react';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
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
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-7 space-y-5 bg-white">
      {/* При первом запуске предлагаем демонстрационный сад или начало с пустого */}
      {!hasChosenGardenMode && habits.length === 0 && (
        <section
          aria-label="Выбор начального режима сада"
          data-testid="first-launch-banner"
          className="w-full bg-white border border-[#E6E6E6] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1.5 max-w-xl">
            <h2 className="text-base sm:text-lg font-medium text-[#111111]">
              Добро пожаловать в Habits Garden
            </h2>
            <p className="text-sm text-[#666666] leading-relaxed">
              Каждая привычка здесь растёт как живое дерево со своим постоянным ветвлением.
              Вы можете осмотреть готовый демонстрационный сад с деревьями на разных стадиях
              роста или сразу начать со своего пустого сада. Демонстрационные записи хранятся
              отдельно и никогда не смешиваются с вашей личной историей.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="primary"
              size="md"
              onClick={() => chooseGardenMode('demo')}
              data-testid="choose-demo-garden-btn"
            >
              Открыть демонстрационный сад
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => chooseGardenMode('personal')}
              data-testid="choose-empty-garden-btn"
            >
              Начать с пустого сада
            </Button>
          </div>
        </section>
      )}

      {/* Компактная верхняя строка галереи с кнопкой добавления привычки */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg sm:text-xl font-medium text-[#111111] tracking-tight">
          {gardenMode === 'demo' ? 'Демонстрационный сад' : 'Сад привычек'}
        </h1>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsAddModalOpen(true)}
          data-testid="add-habit-btn"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Добавить привычку</span>
        </Button>
      </div>

      {/* Плотная галерея деревьев на чистом белом фоне */}
      {habits.length === 0 ? (
        <section
          aria-label="Пустой сад"
          data-testid="empty-garden-state"
          className="w-full bg-white border border-[#E6E6E6] rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4"
        >
          <div className="w-11 h-11 rounded-full border border-[#E6E6E6] flex items-center justify-center text-[#111111]">
            <Sprout className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h2 className="text-base font-medium text-[#111111]">
              В вашем саду пока нет деревьев
            </h2>
            <p className="text-sm text-[#666666]">
              Создайте первую привычку с отметкой за день или таймером времени — она появится
              молодым ростком в маленьком горшке.
            </p>
          </div>
          <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setIsAddModalOpen(true)}
            >
              Посадить первую привычку
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => chooseGardenMode('demo')}
            >
              Посмотреть демонстрационный сад
            </Button>
          </div>
        </section>
      ) : (
        <section
          aria-label="Галерея деревьев привычек"
          data-testid="garden-grid"
          className="grid grid-cols-[repeat(auto-fill,minmax(122px,136px))] sm:grid-cols-[repeat(auto-fill,minmax(132px,146px))] justify-center sm:justify-start justify-items-center gap-x-1.5 gap-y-1.5 sm:gap-x-2.5 sm:gap-y-2.5 py-1"
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
