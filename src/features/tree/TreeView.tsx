import React, { useMemo } from 'react';
import { TreeBiologicalState, TreeStage } from '../../domain/types';
import { CompletionParticles } from './CompletionParticles';
import { generateTreeGeometry } from './treeGeometry';

interface TreeViewProps {
  seed: number;
  state: TreeBiologicalState;
  size?: 'card' | 'detail';
  showParticles?: boolean;
  ariaLabel?: string;
}

/**
 * Отрисовывает лаконичный плоский чёрный силуэт горшка (#111111) без бликов,
 * градиентов и декоративных деталей, с видимым слоем коричневой почвы у основания ствола.
 */
const TreeContainerBase: React.FC<{
  stage: TreeStage;
  baseY: number;
  centerX: number;
  vitality: number;
}> = ({ stage, baseY, centerX, vitality }) => {
  const soilColor = vitality < 0.35 ? '#7D6E61' : '#4A3B31';

  const dimensions: Record<
    TreeStage,
    { topHalf: number; bottomHalf: number; height: number; soilRx: number; soilRy: number }
  > = {
    sprout: { topHalf: 23, bottomHalf: 16, height: 32, soilRx: 20, soilRy: 2.6 },
    young: { topHalf: 30, bottomHalf: 21, height: 36, soilRx: 27, soilRy: 3.1 },
    large: { topHalf: 38, bottomHalf: 27, height: 40, soilRx: 35, soilRy: 3.6 },
    mature: { topHalf: 46, bottomHalf: 34, height: 42, soilRx: 43, soilRy: 4.0 },
  };

  const { topHalf, bottomHalf, height, soilRx, soilRy } = dimensions[stage];
  const topY = baseY;
  const bottomY = baseY + height;

  return (
    <g data-testid={`pot-${stage}`}>
      <path
        data-testid="pot-silhouette"
        d={`M ${centerX - topHalf} ${topY} L ${centerX + topHalf} ${topY} L ${centerX + bottomHalf} ${bottomY} L ${centerX - bottomHalf} ${bottomY} Z`}
        fill="#111111"
      />
      <ellipse
        data-testid="pot-soil"
        cx={centerX}
        cy={topY}
        rx={soilRx}
        ry={soilRy}
        fill={soilColor}
      />
    </g>
  );
};

/**
 * Компонент отрисовки живого SVG-дерева.
 * Отображает переданное состояние (`TreeBiologicalState`), не вычисляя и не меняя правила роста.
 */
export const TreeView: React.FC<TreeViewProps> = ({
  seed,
  state,
  size = 'card',
  showParticles = false,
  ariaLabel,
}) => {
  const geometry = useMemo(() => generateTreeGeometry(seed, state), [seed, state]);

  // В карточке галереи убираем лишние пустые поля вокруг дерева (сохраняя запас под крупные кроны и кадки)
  // и пропорционально уменьшаем контейнер, чтобы деревья стояли плотнее без раздувания масштаба.
  const viewBox = size === 'card' ? '40 54 240 230' : geometry.viewBox;

  const sizeClass =
    size === 'detail'
      ? 'w-full max-w-[340px] h-[280px] sm:h-[320px]'
      : 'w-[114px] h-[110px] sm:w-[124px] sm:h-[120px]';

  return (
    <div
      className={`relative flex items-center justify-center select-none ${sizeClass}`}
      data-testid={`tree-view-${state.stage}`}
      data-stage={state.stage}
      data-vitality={state.vitality.toFixed(2)}
      data-canopy={state.canopyRecovery.toFixed(2)}
      data-development={state.development.toFixed(2)}
    >
      <svg
        viewBox={viewBox}
        className="w-full h-full overflow-hidden"
        role="img"
        aria-label={
          ariaLabel ??
          `${state.stageLabel}. ${state.conditionLabel}. Развитие ${Math.round(
            state.development
          )}`
        }
      >
        {/* Основание: плоский чёрный силуэт горшка и коричневая почва */}
        <TreeContainerBase
          stage={geometry.stage}
          baseY={geometry.baseY}
          centerX={geometry.centerX}
          vitality={state.vitality}
        />

        {/* Корневой развал у зрелых деревьев */}
        {geometry.roots.map((root, i) => (
          <path key={`root_${i}`} d={root.pathD} fill={root.color} />
        ))}

        {/* Ствол и ветви */}
        <g data-testid="tree-branches">
          {geometry.branches.map((branch) => (
            <path key={branch.id} d={branch.pathD} fill={branch.color} />
          ))}
        </g>

        {/* Почки (особенно заметны на ростке и при восстановлении кроны после увядания) */}
        <g data-testid="tree-buds">
          {geometry.buds.map((bud) => (
            <g
              key={bud.id}
              transform={`translate(${bud.x.toFixed(1)}, ${bud.y.toFixed(1)}) rotate(${bud.angleDeg.toFixed(1)})`}
            >
              <ellipse
                cx={0}
                cy={-bud.radiusY * 0.6}
                rx={bud.radiusX}
                ry={bud.radiusY}
                fill={bud.fill}
                stroke="#2D6A4F"
                strokeWidth="0.6"
              />
            </g>
          ))}
        </g>

        {/* Листья */}
        <g data-testid="tree-leaves">
          {geometry.leaves.map((leaf) => (
            <g
              key={leaf.id}
              transform={`translate(${leaf.x.toFixed(1)}, ${leaf.y.toFixed(1)}) rotate(${leaf.angleDeg.toFixed(1)})`}
            >
              <path
                d={`M 0 0 Q ${leaf.rx.toFixed(1)} ${(-leaf.ry * 1.15).toFixed(1)} ${(leaf.rx * 2.05).toFixed(1)} 0 Q ${leaf.rx.toFixed(1)} ${(leaf.ry * 1.15).toFixed(1)} 0 0 Z`}
                fill={leaf.fill}
                stroke={leaf.stroke}
                strokeWidth="0.45"
              />
              <line
                x1="1"
                y1="0"
                x2={leaf.veinX2.toFixed(1)}
                y2="0"
                stroke={leaf.stroke}
                strokeWidth="0.4"
                strokeOpacity="0.65"
              />
            </g>
          ))}
        </g>

        {/* Золотые частицы выполнения */}
        <CompletionParticles active={showParticles} />
      </svg>
    </div>
  );
};
