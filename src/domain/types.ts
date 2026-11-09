export type TrackingMode = 'check' | 'timer';

export type TreeStage = 'sprout' | 'young' | 'large' | 'mature';

export interface CheckRecord {
  /** Local date string YYYY-MM-DD */
  dateKey: string;
  /** Timestamp (ms) when the check-in occurred */
  completedAtMs: number;
}

export interface TimerInterval {
  startMs: number;
  endMs: number;
}

export interface TimerSession {
  id: string;
  habitId: string;
  startedAtMs: number;
  endedAtMs: number;
  /** Total active duration in milliseconds */
  durationMs: number;
  /** Intervals of actual work */
  intervals: TimerInterval[];
}

export interface ActiveTimerState {
  id: string;
  habitId: string;
  startedAtMs: number;
  status: 'running' | 'paused';
  /** Completed running intervals before current pause/run */
  accumulatedIntervals: TimerInterval[];
  /** Timestamp when current running segment started (if status === 'running') */
  currentSegmentStartMs: number | null;
}

export interface Habit {
  id: string;
  title: string;
  mode: TrackingMode;
  /** Target days per 7-day period (1..7) */
  targetDaysPerWeek: number;
  /** Daily goal in minutes (used when mode === 'timer', default e.g. 20) */
  dailyTargetMinutes: number;
  /** Creation timestamp in ms */
  createdAtMs: number;
  /** Local date string YYYY-MM-DD of creation (anchor for 7-day periods) */
  createdDateKey: string;
  /** Permanent deterministic seed for SVG tree geometry */
  seed: number;
  /** Explicit check-in records (for 'check' mode) */
  checks: CheckRecord[];
  /** Saved completed timer sessions (for 'timer' mode) */
  sessions: TimerSession[];
  /** Local date keys (YYYY-MM-DD) where completion particles were already shown */
  rewardedDateKeys: string[];
}

export interface PeriodInfo {
  periodIndex: number;
  /** YYYY-MM-DD inclusive start */
  startDateKey: string;
  /** YYYY-MM-DD inclusive end (7th day) */
  endDateKey: string;
  startMs: number;
  endMs: number;
  completedDaysCount: number;
  targetDays: number;
  isGoalMet: boolean;
  /** Days elapsed inside this period including today (1..7) */
  dayOfPeriod: number;
  /** Remaining days in this period including today if not yet completed */
  remainingPossibleDays: number;
}

export interface DayStatus {
  dateKey: string;
  timestampStartMs: number;
  timestampEndMs: number;
  isCompleted: boolean;
  completedAtMs: number | null;
  totalTimerSeconds: number;
  targetTimerSeconds: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface TreeBiologicalState {
  /**
   * Long-term structural development: continuous [0..100+].
   * Never decreases during neglect; only pauses when vitality is low.
   * Never jumps abruptly on check-in; grows continuously over time when nourished.
   */
  development: number;
  /**
   * Current vitality / moisture & vigor: continuous [0..1].
   * 1.0 = thriving, 0.0 = dormant bare trunk after ~14-21 days of neglect.
   */
  vitality: number;
  /**
   * Canopy fullness / leaf recovery: continuous [0..1].
   * Drops as leaves dull and fall during neglect; recovers gradually over ~3 weeks
   * of regular plan adherence (buds first, then young leaves, then full canopy).
   */
  canopyRecovery: number;
  /**
   * Bud prominence [0..1]: high when recovering from wilt before full leaves open,
   * or on young growing tips.
   */
  budFactor: number;
  /**
   * Leaf color warmth / dullness [0..1]: 0 = healthy fresh green, 1 = dry/autumnal dull brown-ochre before falling.
   */
  leafDullness: number;
  /** Discrete stage derived from development */
  stage: TreeStage;
  /** Human-readable Russian label for stage */
  stageLabel: string;
  /** Human-readable Russian description of current condition */
  conditionLabel: string;
  /** Current 7-day period summary */
  currentPeriod: PeriodInfo;
}

export interface StorageSchemaV1 {
  version: 1;
  hasChosenGardenMode: boolean;
  gardenMode: 'personal' | 'demo';
  habits: Habit[];
  activeTimer: ActiveTimerState | null;
}
