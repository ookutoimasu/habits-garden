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
 * Отрисовывает горшок, кадку или открытую землю в зависимости от стадии развития дерева.
 */
const TreeContainerBase: React.FC<{
  stage: TreeStage;
  baseY: number;
  centerX: number;
  vitality: number;
}> = ({ stage, baseY, centerX, vitality }) => {
  const soilColor = vitality < 0.35 ? '#7D6E61' : '#4A3B31';

  if (stage === 'sprout') {
    // Маленький керамический горшок
    return (
      <g data-testid="pot-sprout">
        <ellipse cx={centerX} cy={baseY + 42} rx={26} ry={3.5} fill="#EBEBEB" />
        <path
          d={`M ${centerX - 24} ${baseY + 4} L ${centerX + 24} ${baseY + 4} L ${centerX + 18} ${baseY + 41} L ${centerX - 18} ${baseY + 41} Z`}
          fill="#C87D55"
          stroke="#A6623E"
          strokeWidth="1"
        />
        <rect
          x={centerX - 27}
          y={baseY - 2}
          width={54}
          height={7}
          rx={1.5}
          fill="#D48961"
          stroke="#A6623E"
          strokeWidth="1"
        />
        <ellipse cx={centerX} cy={baseY - 1} rx={22} ry={3} fill={soilColor} />
      </g>
    );
  }

  if (stage === 'young') {
    // Средний глиняный горшок
    return (
      <g data-testid="pot-young">
        <ellipse cx={centerX} cy={baseY + 48} rx={36} ry={4.5} fill="#EBEBEB" />
        <path
          d={`M ${centerX - 33} ${baseY + 5} L ${centerX + 33} ${baseY + 5} L ${centerX + 25} ${baseY + 47} L ${centerX - 25} ${baseY + 47} Z`}
          fill="#B86F49"
          stroke="#945433"
          strokeWidth="1.1"
        />
        <rect
          x={centerX - 37}
          y={baseY - 2}
          width={74}
          height={8}
          rx={2}
          fill="#C67B54"
          stroke="#945433"
          strokeWidth="1.1"
        />
        <ellipse cx={centerX} cy={baseY - 1} rx={31} ry={3.8} fill={soilColor} />
      </g>
    );
  }

  if (stage === 'large') {
    // Прочная деревянная кадка с обручами
    return (
      <g data-testid="pot-large">
        <ellipse cx={centerX} cy={baseY + 52} rx={48} ry={5} fill="#EBEBEB" />
        <path
          d={`M ${centerX - 44} ${baseY + 1} L ${centerX + 44} ${baseY + 1} L ${centerX + 38} ${baseY + 51} L ${centerX - 38} ${baseY + 51} Z`}
          fill="#8B6343"
          stroke="#63442B"
          strokeWidth="1.2"
        />
        {/* Вертикальные дощечки кадки */}
        <line
          x1={centerX - 22}
          y1={baseY + 2}
          x2={centerX - 19}
          y2={baseY + 51}
          stroke="#6E4D32"
          strokeWidth="0.9"
        />
        <line
          x1={centerX}
          y1={baseY + 2}
          x2={centerX}
          y2={baseY + 51}
          stroke="#6E4D32"
          strokeWidth="0.9"
        />
        <line
          x1={centerX + 22}
          y1={baseY + 2}
          x2={centerX + 19}
          y2={baseY + 51}
          stroke="#6E4D32"
          strokeWidth="0.9"
        />
        {/* Металлические стяжные обручи */}
        <path
          d={`M ${centerX - 43} ${baseY + 13} L ${centerX + 43} ${baseY + 13}`}
          stroke="#3A3A3A"
          strokeWidth="2.8"
        />
        <path
          d={`M ${centerX - 40} ${baseY + 38} L ${centerX + 40} ${baseY + 38}`}
          stroke="#3A3A3A"
          strokeWidth="2.8"
        />
        <ellipse cx={centerX} cy={baseY + 1} rx={42} ry={4.5} fill={soilColor} />
      </g>
    );
  }

  // Зрелое дерево в открытой земле
  return (
    <g data-testid="pot-mature">
      <ellipse cx={centerX} cy={baseY + 16} rx={82} ry={9} fill="#F0EFEA" />
      <path
        d={`M ${centerX - 76} ${baseY + 14} Q ${centerX} ${baseY - 12} ${centerX + 76} ${baseY + 14} Q ${centerX} ${baseY + 22} ${centerX - 76} ${baseY + 14} Z`}
        fill={soilColor}
      />
      {vitality >= 0.45 && (
        <path
          d={`M ${centerX - 64} ${baseY + 11} Q ${centerX} ${baseY - 8} ${centerX + 64} ${baseY + 11}`}
          fill="none"
          stroke="#4F775A"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      )}
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

  const heightClass =
    size === 'detail'
      ? 'w-full max-w-[360px] h-[300px] sm:h-[340px]'
      : 'w-full h-[210px] sm:h-[225px]';

  return (
    <div
      className={`relative flex items-center justify-center select-none ${heightClass}`}
      data-testid={`tree-view-${state.stage}`}
      data-stage={state.stage}
      data-vitality={state.vitality.toFixed(2)}
      data-canopy={state.canopyRecovery.toFixed(2)}
      data-development={state.development.toFixed(2)}
    >
      <svg
        viewBox={geometry.viewBox}
        className="w-full h-full overflow-visible"
        role="img"
        aria-label={
          ariaLabel ??
          `${state.stageLabel}. ${state.conditionLabel}. Развитие ${Math.round(
            state.development
          )}`
        }
      >
        {/* Основание: горшок / кадка / земля */}
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
