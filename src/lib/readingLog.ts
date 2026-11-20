// Everything Word Climb remembers, kept on the device in localStorage, and the
// parent report built from it. Nothing is sent anywhere.
//
//   word-climb-cards   each card's SM-2 schedule (CardStates)
//   word-climb-log     what happened when: days practiced, recent grades, and
//                      the day each card became known
//
// Everything here except load/save is a pure function of its arguments.

import { CARDS, LEVELS, GRADES, type Card } from "./wordClimbContent";
import {
  type CardStates,
  type Grade,
  addDays,
  levelProgress,
  parseCardState,
  unlockedLevelCount,
} from "./wordClimbSchedule";

export const CARDS_KEY = "word-climb-cards";
export const LOG_KEY = "word-climb-log";
const RECENT_DAYS = 60;

export interface LogEntry {
  cardId: string;
  grade: Grade;
  day: string; // YYYY-MM-DD, local
  /** A same-round repeat after help, which doesn't change the schedule. */
  redrill: boolean;
}

export interface ReadingLog {
  version: 1;
  /** Every day with at least one card read, oldest first. */
  daysPracticed: string[];
  /** Grades from the last RECENT_DAYS. */
  recent: LogEntry[];
  /** Day each card first became known (secure). */
  knownOn: Record<string, string>;
  totalCardsRead: number;
}

export function emptyLog(): ReadingLog {
  return { version: 1, daysPracticed: [], recent: [], knownOn: {}, totalCardsRead: 0 };
}

export function logGrade(log: ReadingLog, entry: LogEntry, becameKnown: boolean): ReadingLog {
  const cutoff = addDays(entry.day, -RECENT_DAYS);
  return {
    ...log,
    daysPracticed: log.daysPracticed.includes(entry.day) ? log.daysPracticed : [...log.daysPracticed, entry.day],
    recent: [...log.recent.filter((e) => e.day > cutoff), entry],
    knownOn: becameKnown && !log.knownOn[entry.cardId] ? { ...log.knownOn, [entry.cardId]: entry.day } : log.knownOn,
    totalCardsRead: log.totalCardsRead + 1,
  };
}

/** Takes back the last logged grade (the game's Undo button). */
export function unlogLast(log: ReadingLog, cardId: string): ReadingLog {
  const i = log.recent.map((e) => e.cardId).lastIndexOf(cardId);
  if (i < 0) return log;
  const removed = log.recent[i];
  const recent = [...log.recent.slice(0, i), ...log.recent.slice(i + 1)];
  const knownOn = { ...log.knownOn };
  if (knownOn[cardId] === removed.day) delete knownOn[cardId];
  const stillPlayed = recent.some((e) => e.day === removed.day);
  return {
    ...log,
    recent,
    knownOn,
    daysPracticed: stillPlayed ? log.daysPracticed : log.daysPracticed.filter((d) => d !== removed.day),
    totalCardsRead: Math.max(0, log.totalCardsRead - 1),
  };
}

// ── Storage ──────────────────────────────────────────────────────────────────

export function normalizeLog(raw: unknown): ReadingLog {
  if (!raw || typeof raw !== "object" || (raw as ReadingLog).version !== 1) return emptyLog();
  const r = raw as ReadingLog;
  return {
    version: 1,
    daysPracticed: Array.isArray(r.daysPracticed) ? r.daysPracticed : [],
    recent: Array.isArray(r.recent) ? r.recent : [],
    knownOn: r.knownOn && typeof r.knownOn === "object" ? r.knownOn : {},
    totalCardsRead: typeof r.totalCardsRead === "number" ? r.totalCardsRead : 0,
  };
}

export function parseCards(raw: unknown): CardStates {
  const out: CardStates = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, value] of Object.entries(raw)) {
    const state = parseCardState(value);
    if (state) out[id] = state;
  }
  return out;
}

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save ${key}`, e);
  }
}

export const loadCards = () => parseCards(read(CARDS_KEY));
export const saveCards = (cards: CardStates) => write(CARDS_KEY, cards);
export const loadLog = () => normalizeLog(read(LOG_KEY));
export const saveLog = (log: ReadingLog) => write(LOG_KEY, log);

// ── Where the child is on the ladder ─────────────────────────────────────────

export type LevelStatus = "done" | "current" | "locked";

export interface LevelReport {
  index: number;
  id: string;
  title: string;
  grade: string;
  status: LevelStatus;
  known: number;
  /** Read without help once, waiting for the second day that makes it known. */
  readOnce: number;
  total: number;
  needed: number;
}

export function ladder(states: CardStates): LevelReport[] {
  const open = unlockedLevelCount(states);
  return LEVELS.map((level, index) => {
    const { secure, total, needed } = levelProgress(states, index);
    const readOnce = CARDS.filter((c) => c.levelIndex === index && !states[c.id]?.secure && states[c.id]?.firstReadOn).length;
    // The top level has nothing above it to open, so it's done once it would
    // have opened one.
    const status: LevelStatus = index < open - 1 || (index === LEVELS.length - 1 && secure >= needed)
      ? "done"
      : index === open - 1
        ? "current"
        : "locked";
    return { index, id: level.id, title: level.title, grade: level.grade, status, known: secure, readOnce, total, needed };
  });
}

/** The level being climbed: the highest open one. */
export function currentLevel(states: CardStates): LevelReport {
  const levels = ladder(states);
  return levels[unlockedLevelCount(states) - 1];
}

// ── The parent report ────────────────────────────────────────────────────────

export interface GradeReport {
  grade: string;
  levelsDone: number;
  levelCount: number;
  levels: LevelReport[];
}

export interface TrickyCard {
  text: string;
  misses: number;
}

export interface ReadingReport {
  current: LevelReport;
  grades: GradeReport[];
  wordsKnown: number;
  phrasesAndSentencesKnown: number;
  cardsKnown: number;
  totalCards: number;
  totalCardsRead: number;
  daysPracticed: number;
  streak: number;
  week: {
    daysPracticed: number;
    cardsRead: number;
    /** Share of scheduled reads done without help (Good or Easy). */
    unaided: number | null;
    newlyKnown: string[];
  };
  tricky: TrickyCard[];
  dueTomorrow: number;
}

/** Consecutive days practiced, ending today (or yesterday, if not yet today). */
export function streakOf(days: string[], today: string): number {
  const set = new Set(days);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

const byId = new Map<string, Card>(CARDS.map((c) => [c.id, c]));

export function buildReport(states: CardStates, log: ReadingLog, today: string): ReadingReport {
  const levels = ladder(states);
  const weekStart = addDays(today, -6);
  const weekRows = log.recent.filter((e) => e.day >= weekStart);
  const scheduled = weekRows.filter((e) => !e.redrill);
  const unaided = scheduled.filter((e) => e.grade === "good" || e.grade === "easy").length;
  const known = CARDS.filter((c) => states[c.id]?.secure);

  const tricky = CARDS.filter((c) => (states[c.id]?.lapses ?? 0) > 0 || (states[c.id]?.lastGrade === "again" && !states[c.id]?.secure))
    .map((c) => ({ text: c.text, misses: Math.max(states[c.id].lapses, 1), last: states[c.id].updatedAt }))
    .sort((a, b) => b.misses - a.misses || b.last - a.last)
    .slice(0, 8)
    .map(({ text, misses }) => ({ text, misses }));

  const tomorrow = addDays(today, 1);

  return {
    current: levels[unlockedLevelCount(states) - 1],
    grades: GRADES.map((grade) => {
      const inGrade = levels.filter((l) => l.grade === grade);
      return { grade, levels: inGrade, levelCount: inGrade.length, levelsDone: inGrade.filter((l) => l.status === "done").length };
    }),
    wordsKnown: known.filter((c) => c.kind === "word").length,
    phrasesAndSentencesKnown: known.filter((c) => c.kind !== "word").length,
    cardsKnown: known.length,
    totalCards: CARDS.length,
    totalCardsRead: log.totalCardsRead,
    daysPracticed: log.daysPracticed.length,
    streak: streakOf(log.daysPracticed, today),
    week: {
      daysPracticed: new Set(weekRows.map((e) => e.day)).size,
      cardsRead: weekRows.length,
      unaided: scheduled.length > 0 ? unaided / scheduled.length : null,
      newlyKnown: Object.entries(log.knownOn)
        .filter(([, day]) => day >= weekStart)
        .map(([id]) => byId.get(id)?.text)
        .filter((t): t is string => !!t),
    },
    tricky,
    dueTomorrow: CARDS.filter((c) => {
      const s = states[c.id];
      return !!s?.dueOn && s.reviews > 0 && s.dueOn <= tomorrow;
    }).length,
  };
}
