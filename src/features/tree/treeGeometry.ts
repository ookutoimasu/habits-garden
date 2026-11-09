import { TREE_CONFIG } from '../../domain/treeConfig';
import { TreeBiologicalState, TreeStage } from '../../domain/types';

/**
 * Детерминированный генератор псевдослучайных чисел (Mulberry32).
 */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Создаёт независимый детерминированный генератор случайных чисел для конкретного узла/ветви
 * по паре (habitSeed, nodeId). Появление новых ветвей или листьев при росте никогда
 * не сдвигает случайные параметры уже существующих ветвей.
 */
export function createNodeRng(habitSeed: number, nodeId: string): () => number {
  let hash = (2166136261 ^ (habitSeed >>> 0)) >>> 0;
  for (let i = 0; i < nodeId.length; i++) {
    hash ^= nodeId.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return createSeededRng(hash || 1);
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export interface BranchSegmentGeometry {
  id: string;
  /** Замкнутый SVG-путь сужающегося ствола/ветви */
  pathD: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth: number;
  color: string;
}

export interface LeafGeometry {
  id: string;
  x: number;
  y: number;
  angleDeg: number;
  scale: number;
  rx: number;
  ry: number;
  fill: string;
  stroke: string;
  veinX2: number;
}

export interface BudGeometry {
  id: string;
  x: number;
  y: number;
  angleDeg: number;
  radiusX: number;
  radiusY: number;
  fill: string;
}

export interface RootFlareGeometry {
  pathD: string;
  color: string;
}

export interface TreeSceneGeometry {
  viewBox: string;
  stage: TreeStage;
  baseY: number;
  centerX: number;
  trunkFill: string;
  roots: RootFlareGeometry[];
  branches: BranchSegmentGeometry[];
  buds: BudGeometry[];
  leaves: LeafGeometry[];
}

/**
 * Строит гладкий замкнутый SVG-путь сужающегося сегмента ветви или ствола
 * от (x1, y1) с радиусом r1 до (x2, y2) с радиусом r2 и контрольной точкой изгиба (cx, cy).
 */
function buildTaperedBranchPath(
  x1: number,
  y1: number,
  r1: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number,
  r2: number
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const rMid = (r1 + r2) * 0.52;

  const lx1 = (x1 + nx * r1).toFixed(1);
  const ly1 = (y1 + ny * r1).toFixed(1);
  const lcx = (cx + nx * rMid).toFixed(1);
  const lcy = (cy + ny * rMid).toFixed(1);
  const lx2 = (x2 + nx * r2).toFixed(1);
  const ly2 = (y2 + ny * r2).toFixed(1);

  const rx2 = (x2 - nx * r2).toFixed(1);
  const ry2 = (y2 - ny * r2).toFixed(1);
  const rcx = (cx - nx * rMid).toFixed(1);
  const rcy = (cy - ny * rMid).toFixed(1);
  const rx1 = (x1 - nx * r1).toFixed(1);
  const ry1 = (y1 - ny * r1).toFixed(1);

  return `M ${lx1} ${ly1} Q ${lcx} ${lcy} ${lx2} ${ly2} A ${r2.toFixed(1)} ${r2.toFixed(1)} 0 0 1 ${rx2} ${ry2} Q ${rcx} ${rcy} ${rx1} ${ry1} Z`;
}

function interpolateHexColor(hexA: string, hexB: string, t: number): string {
  const ratio = clamp(t, 0, 1);
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(hexA);
  const [r2, g2, b2] = parse(hexB);
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

interface RawLeafCandidate {
  id: string;
  x: number;
  y: number;
  angleDeg: number;
  dropOrder: number;
  shadeVariant: number;
  sizeFactor: number;
}

interface RawBudCandidate {
  id: string;
  x: number;
  y: number;
  angleDeg: number;
  priority: number;
}

/**
 * Генерирует полную детерминированную геометрию дерева на основе постоянного `seed`
 * и непрерывного биологического состояния `state`.
 * Каждая ветвь использует собственный независимый генератор `createNodeRng(seed, branchId)`,
 * поэтому появление новых ответвлений при росте не меняет форму уже существующих ветвей.
 */
export function generateTreeGeometry(
  seed: number,
  state: TreeBiologicalState
): TreeSceneGeometry {
  const trunkRng = createNodeRng(seed, 'trunk_main');
  const centerX = 160;
  const baseY = 238;

  const dev = clamp(
    state.development,
    TREE_CONFIG.initialDevelopment,
    TREE_CONFIG.stageThresholds.maxVisualDevelopment
  );
  const devNorm = clamp(
    (dev - TREE_CONFIG.initialDevelopment) /
      (TREE_CONFIG.stageThresholds.maxVisualDevelopment - TREE_CONFIG.initialDevelopment),
    0,
    1
  );

  const dryFactor = clamp(1 - state.vitality, 0, 1);
  const trunkColor = interpolateHexColor('#5C4033', '#6D5D53', dryFactor * 0.7);
  const branchColor = interpolateHexColor('#6B4C3B', '#77685E', dryFactor * 0.75);
  const twigColor = interpolateHexColor('#7A5946', '#85776E', dryFactor * 0.8);

  const branches: BranchSegmentGeometry[] = [];
  const leafCandidates: RawLeafCandidate[] = [];
  const budCandidates: RawBudCandidate[] = [];
  const roots: RootFlareGeometry[] = [];

  const trunkLength = 34 + Math.pow(devNorm, 0.78) * 86;
  const trunkBaseRadius = 2.2 + Math.pow(devNorm, 0.85) * 11.5;
  const trunkTopRadius = Math.max(1.1, trunkBaseRadius * 0.42);

  const trunkLeanDeg = (trunkRng() - 0.5) * 10;
  const trunkCurveOffset = (trunkRng() - 0.5) * 18 * (0.4 + 0.6 * devNorm);
  const trunkRad = ((trunkLeanDeg - 90) * Math.PI) / 180;

  const trunkTopX = centerX + Math.cos(trunkRad) * trunkLength;
  const trunkTopY = baseY + Math.sin(trunkRad) * trunkLength;
  const trunkCtrlX = (centerX + trunkTopX) * 0.5 + trunkCurveOffset;
  const trunkCtrlY = (baseY + trunkTopY) * 0.5;

  branches.push({
    id: 'trunk_main',
    pathD: buildTaperedBranchPath(
      centerX,
      baseY + 2,
      trunkBaseRadius,
      trunkCtrlX,
      trunkCtrlY,
      trunkTopX,
      trunkTopY,
      trunkTopRadius
    ),
    x1: centerX,
    y1: baseY,
    x2: trunkTopX,
    y2: trunkTopY,
    depth: 0,
    color: trunkColor,
  });

  if (dev >= 35) {
    const rootScale = clamp((dev - 35) / 65, 0, 1);
    const leftRootX = centerX - (10 + rootScale * 18);
    const rightRootX = centerX + (10 + rootScale * 18);
    const rootY = baseY + 4;
    roots.push({
      pathD: `M ${(centerX - trunkBaseRadius * 0.9).toFixed(1)} ${(baseY - 6).toFixed(1)} Q ${(centerX - trunkBaseRadius * 1.2).toFixed(1)} ${baseY.toFixed(1)} ${leftRootX.toFixed(1)} ${rootY.toFixed(1)} L ${(centerX + 2).toFixed(1)} ${(baseY + 3).toFixed(1)} Z`,
      color: trunkColor,
    });
    roots.push({
      pathD: `M ${(centerX + trunkBaseRadius * 0.9).toFixed(1)} ${(baseY - 6).toFixed(1)} Q ${(centerX + trunkBaseRadius * 1.2).toFixed(1)} ${baseY.toFixed(1)} ${rightRootX.toFixed(1)} ${rootY.toFixed(1)} L ${(centerX - 2).toFixed(1)} ${(baseY + 3).toFixed(1)} Z`,
      color: trunkColor,
    });
  }

  const apexSpread = 22 + trunkRng() * 12;
  budCandidates.push({
    id: 'bud_apex',
    x: trunkTopX,
    y: trunkTopY,
    angleDeg: trunkLeanDeg,
    priority: 0.98,
  });

  leafCandidates.push(
    {
      id: 'leaf_apex_left',
      x: trunkTopX - 2,
      y: trunkTopY + 2,
      angleDeg: trunkLeanDeg - apexSpread - 18,
      dropOrder: 0.08,
      shadeVariant: trunkRng(),
      sizeFactor: 0.95,
    },
    {
      id: 'leaf_apex_right',
      x: trunkTopX + 2,
      y: trunkTopY + 2,
      angleDeg: trunkLeanDeg + apexSpread + 18,
      dropOrder: 0.14,
      shadeVariant: trunkRng(),
      sizeFactor: 0.95,
    },
    {
      id: 'leaf_apex_top',
      x: trunkTopX,
      y: trunkTopY - 2,
      angleDeg: trunkLeanDeg + (trunkRng() - 0.5) * 14,
      dropOrder: 0.04,
      shadeVariant: trunkRng(),
      sizeFactor: 0.88,
    }
  );

  // Рекурсивная генерация скелетных ветвей с независимым RNG на каждую ветвь по её постоянному `branchId`
  const spawnBranch = (
    branchId: string,
    parentX1: number,
    parentY1: number,
    parentCtrlX: number,
    parentCtrlY: number,
    parentX2: number,
    parentY2: number,
    parentRadiusStart: number,
    parentRadiusEnd: number,
    parentAngleDeg: number,
    depth: number,
    sideIndex: number,
    birthDev: number,
    fullSpanDev: number
  ) => {
    if (dev <= birthDev) {
      return;
    }

    const branchRng = createNodeRng(seed, branchId);
    const tAttach = 0.38 + branchRng() * 0.52;
    const side = sideIndex % 2 === 0 ? -1 : 1;
    const baseAngleOffset = side * (24 + branchRng() * 24) + (branchRng() - 0.5) * 8;
    const maxLen =
      depth === 1
        ? 28 + branchRng() * 26
        : depth === 2
        ? 18 + branchRng() * 18
        : 10 + branchRng() * 12;
    const bendFactor = (branchRng() - 0.5) * 12;
    const subCount = depth === 1 ? 3 : depth === 2 ? 2 : 0;

    const leafSlots = depth === 1 ? 3 : depth === 2 ? 4 : 5;
    const precomputedLeafParams = Array.from({ length: leafSlots }, (_, li) => ({
      tPos: 0.35 + (li / leafSlots) * 0.65,
      sideSign: li % 2 === 0 ? -1 : 1,
      angleJitter: (branchRng() - 0.5) * 28,
      dropOrder: clamp(0.06 + branchRng() * 0.92, 0.05, 0.99),
      shadeVariant: branchRng(),
      sizeFactor: 0.78 + branchRng() * 0.36,
    }));

    const budPriority = 0.2 + branchRng() * 0.78;

    const childConfigs = Array.from({ length: subCount }, (_, ci) => ({
      childId: `${branchId}__${ci}`,
      childSideIndex: sideIndex + ci + 1,
      childBirthDev: birthDev + 6 + ci * 8 + branchRng() * 6,
      childSpanDev: fullSpanDev * 0.85,
    }));

    const growthProgress = clamp((dev - birthDev) / fullSpanDev, 0, 1);
    const smoothProgress = Math.pow(growthProgress, 0.82);

    const omt = 1 - tAttach;
    const startX =
      omt * omt * parentX1 + 2 * omt * tAttach * parentCtrlX + tAttach * tAttach * parentX2;
    const startY =
      omt * omt * parentY1 + 2 * omt * tAttach * parentCtrlY + tAttach * tAttach * parentY2;

    const currentLen = maxLen * smoothProgress * (0.55 + 0.45 * devNorm);
    if (currentLen <= 0.05) {
      return;
    }

    const angleDeg = parentAngleDeg + baseAngleOffset;
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    const endX = startX + Math.cos(rad) * currentLen;
    const endY = startY + Math.sin(rad) * currentLen;

    const ctrlX = (startX + endX) * 0.5 + bendFactor * smoothProgress;
    const ctrlY = (startY + endY) * 0.5 - Math.abs(bendFactor) * 0.25 * smoothProgress;

    const parentRadiusAtT =
      parentRadiusStart + (parentRadiusEnd - parentRadiusStart) * tAttach;
    const rStart = Math.max(0.4, parentRadiusAtT * 0.68 * smoothProgress);
    const rEnd = Math.max(0.25, rStart * 0.42);

    const color = depth === 1 ? branchColor : twigColor;

    branches.push({
      id: branchId,
      pathD: buildTaperedBranchPath(startX, startY, rStart, ctrlX, ctrlY, endX, endY, rEnd),
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
      depth,
      color,
    });

    budCandidates.push({
      id: `bud_${branchId}`,
      x: endX,
      y: endY,
      angleDeg,
      priority: budPriority,
    });

    for (let li = 0; li < precomputedLeafParams.length; li++) {
      const lp = precomputedLeafParams[li];
      if (smoothProgress < lp.tPos * 0.6) continue;
      const t = lp.tPos;
      const omtL = 1 - t;
      const lx = omtL * omtL * startX + 2 * omtL * t * ctrlX + t * t * endX;
      const ly = omtL * omtL * startY + 2 * omtL * t * ctrlY + t * t * endY;

      leafCandidates.push({
        id: `leaf_${branchId}_${li}`,
        x: lx,
        y: ly,
        angleDeg: angleDeg + lp.sideSign * 38 + lp.angleJitter,
        dropOrder: lp.dropOrder,
        shadeVariant: lp.shadeVariant,
        sizeFactor: lp.sizeFactor * clamp(0.5 + 0.5 * smoothProgress, 0.55, 1.05),
      });
    }

    if (depth < 3) {
      for (const cc of childConfigs) {
        spawnBranch(
          cc.childId,
          startX,
          startY,
          ctrlX,
          ctrlY,
          endX,
          endY,
          rStart,
          rEnd,
          angleDeg,
          depth + 1,
          cc.childSideIndex,
          cc.childBirthDev,
          cc.childSpanDev
        );
      }
    }
  };

  const primaryBranchSchedules = [
    { birthDev: 5, spanDev: 18 },
    { birthDev: 9, spanDev: 20 },
    { birthDev: 15, spanDev: 22 },
    { birthDev: 22, spanDev: 25 },
    { birthDev: 32, spanDev: 28 },
    { birthDev: 46, spanDev: 30 },
    { birthDev: 62, spanDev: 32 },
  ];

  primaryBranchSchedules.forEach((sched, idx) => {
    spawnBranch(
      `b_1_${idx}`,
      centerX,
      baseY,
      trunkCtrlX,
      trunkCtrlY,
      trunkTopX,
      trunkTopY,
      trunkBaseRadius,
      trunkTopRadius,
      trunkLeanDeg,
      1,
      idx,
      sched.birthDev,
      sched.spanDev
    );
  });

  const healthyPalette = ['#2D6A4F', '#3B7A57', '#40916C', '#52B788'];
  const dullPalette = ['#8A795D', '#9C8359', '#7E6B4F', '#A38B63'];

  const leaves: LeafGeometry[] = [];
  for (const cand of leafCandidates) {
    if (state.canopyRecovery <= cand.dropOrder - 0.02) {
      continue;
    }
    const appearScale = clamp((state.canopyRecovery - (cand.dropOrder - 0.04)) / 0.14, 0.15, 1);
    const totalScale = cand.sizeFactor * appearScale;

    const paletteIdx = Math.min(
      healthyPalette.length - 1,
      Math.floor(cand.shadeVariant * healthyPalette.length)
    );
    const fill = interpolateHexColor(
      healthyPalette[paletteIdx],
      dullPalette[paletteIdx],
      state.leafDullness
    );
    const stroke = interpolateHexColor('#1B4332', '#5C4D38', state.leafDullness);

    leaves.push({
      id: cand.id,
      x: cand.x,
      y: cand.y,
      angleDeg: cand.angleDeg,
      scale: totalScale,
      rx: 6.2 * totalScale,
      ry: 3.1 * totalScale,
      fill,
      stroke,
      veinX2: 8.8 * totalScale,
    });
  }

  const buds: BudGeometry[] = [];
  if (state.budFactor > 0.05 && state.vitality > 0.12) {
    for (const bCand of budCandidates) {
      if (bCand.priority <= state.budFactor + 0.25) {
        const bScale = clamp(0.65 + state.budFactor * 0.55, 0.6, 1.2);
        buds.push({
          id: bCand.id,
          x: bCand.x,
          y: bCand.y,
          angleDeg: bCand.angleDeg,
          radiusX: 2.8 * bScale,
          radiusY: 1.7 * bScale,
          fill: '#74C69D',
        });
      }
    }
  }

  return {
    viewBox: '0 0 320 300',
    stage: state.stage,
    baseY,
    centerX,
    trunkFill: trunkColor,
    roots,
    branches,
    buds,
    leaves,
  };
}
