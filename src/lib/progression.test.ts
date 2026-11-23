// Integrity tests for the climb as a whole: play simulated children through
// the same answerCard() the app uses, one round a day for many days, answering
// only Yes or Not yet, and check that the game really starts small, only ever
// shows what has been unlocked, and moves on to harder material over time.

import { describe, it, expect } from "vitest";
import { CARDS, CARD_BY_ID, GRADES, LEVELS, type Card } from "./wordClimbContent";
import { type CardStates, type Grade, REDRILL_GAP, ROUND_SIZE, addDays, answerCard, startRound, unlockedLevelCount } from "./wordClimbSchedule";

const DAY1 = "2026-01-05";
const CARD_INDEX = new Map(CARDS.map((c, i) => [c.id, i]));
const letters = (c: Card) => c.text.replace(/[^a-z]/gi, "").length;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Shown {
  day: number;
  cardId: string;
  redrill: boolean;
  grade: Grade;
  /** Levels open at the moment the card was shown. */
  open: number;
  firstTime: boolean;
}

/**
 * Plays `days` days, one round a day. `answer` gets the card and how many
 * times this child has seen it, and returns true for Yes.
 */
function play(days: number, answer: (card: Card, seen: number) => boolean) {
  let states: CardStates = {};
  const seen: Record<string, number> = {};
  const shown: Shown[] = [];
  const openByDay: number[] = [];
  const roundSizes: number[] = [];
  let day = DAY1;
  for (let d = 1; d <= days; d++) {
    let round = startRound(states, day);
    while (round.queue.length) {
      const item = round.queue[0];
      const card = CARD_BY_ID.get(item.cardId)!;
      const n = seen[card.id] ?? 0;
      const grade: Grade = answer(card, n) ? "good" : "again";
      shown.push({ day: d, cardId: card.id, redrill: item.redrill, grade, open: unlockedLevelCount(round.states), firstTime: n === 0 });
      seen[card.id] = n + 1;
      round = answerCard(round, grade, day, d);
    }
    roundSizes.push(round.shown);
    states = round.states;
    openByDay.push(unlockedLevelCount(states));
    day = addDays(day, 1);
  }
  return { states, shown, openByDay, roundSizes };
}

// A child who gets a card right more often each time they see it.
function typical(seed: number) {
  const r = rng(seed);
  return (_card: Card, seen: number) => r() < Math.min(0.95, 0.55 + 0.1 * seen);
}

const always = (yes: boolean) => () => yes;

describe("the ladder itself gets harder", () => {
  const byGrade = (pick: (c: Card) => boolean, measure: (c: Card) => number) =>
    GRADES.map((g) => {
      const cards = CARDS.filter((c) => LEVELS[c.levelIndex].grade === g && pick(c));
      return cards.reduce((s, c) => s + measure(c), 0) / cards.length;
    });

  it("starts with tiny words: the first level is all one to three letters", () => {
    const first = CARDS.filter((c) => c.levelIndex === 0);
    expect(first.every((c) => c.words === 1 && letters(c) <= 3)).toBe(true);
    expect(letters(CARDS[0])).toBe(1);
  });

  it("uses longer single words grade by grade", () => {
    const avg = byGrade((c) => c.kind === "word" && c.words === 1, letters);
    for (let i = 1; i < avg.length; i++) expect(avg[i], `${GRADES[i]} vs ${GRADES[i - 1]}`).toBeGreaterThan(avg[i - 1]);
  });

  it("uses more syllables per word grade by grade", () => {
    const avg = byGrade((c) => c.kind === "word", (c) => c.syllables / c.words);
    for (let i = 1; i < avg.length; i++) expect(avg[i], `${GRADES[i]} vs ${GRADES[i - 1]}`).toBeGreaterThan(avg[i - 1]);
  });

  it("uses longer sentences grade by grade", () => {
    const avg = byGrade((c) => c.kind === "sentence", (c) => c.words);
    for (let i = 1; i < avg.length; i++) expect(avg[i], `${GRADES[i]} vs ${GRADES[i - 1]}`).toBeGreaterThan(avg[i - 1]);
  });
});

describe("a typical child's climb", () => {
  const runs = [1, 2, 3].map((seed) => play(400, typical(seed)));

  it("starts on the smallest words", () => {
    for (const { shown } of runs) {
      expect(shown[0].cardId).toBe(CARDS[0].id);
      const firstDay = shown.filter((s) => s.day === 1);
      expect(firstDay.every((s) => CARD_BY_ID.get(s.cardId)!.levelIndex === 0)).toBe(true);
    }
  });

  it("only ever shows cards from levels that are open", () => {
    for (const { shown } of runs) {
      const bad = shown.filter((s) => CARD_BY_ID.get(s.cardId)!.levelIndex >= s.open);
      expect(bad).toEqual([]);
    }
  });

  it("meets new cards strictly in ladder order", () => {
    for (const { shown } of runs) {
      const order = shown.filter((s) => s.firstTime).map((s) => CARD_INDEX.get(s.cardId)!);
      for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
    }
  });

  it("never closes a level once it's open", () => {
    for (const { openByDay } of runs) {
      for (let i = 1; i < openByDay.length; i++) expect(openByDay[i]).toBeGreaterThanOrEqual(openByDay[i - 1]);
    }
  });

  it("moves to harder material over time", () => {
    for (const { shown } of runs) {
      const introduced = shown.filter((s) => s.firstTime).map((s) => CARD_BY_ID.get(s.cardId)!);
      const quarter = Math.floor(introduced.length / 4);
      const mean = (cards: Card[], f: (c: Card) => number) => cards.reduce((a, c) => a + f(c), 0) / cards.length;
      const quarters = [0, 1, 2, 3].map((q) => introduced.slice(q * quarter, (q + 1) * quarter));
      const words = quarters.map((q) => mean(q, (c) => c.words));
      const syllables = quarters.map((q) => mean(q, (c) => c.syllables));
      expect(words[3]).toBeGreaterThan(words[0]);
      expect(syllables[3]).toBeGreaterThan(syllables[0]);
      for (let q = 1; q < 4; q++) expect(syllables[q]).toBeGreaterThan(syllables[q - 1]);
    }
  });

  it("climbs through every grade and reaches the top", () => {
    for (const { openByDay, states } of runs) {
      const gradeOn = (g: string) => openByDay.findIndex((open) => LEVELS[open - 1].grade === g) + 1;
      const days = GRADES.map(gradeOn);
      expect(days.every((d) => d > 0)).toBe(true);
      for (let i = 1; i < days.length; i++) expect(days[i]).toBeGreaterThan(days[i - 1]);
      expect(openByDay[openByDay.length - 1]).toBe(LEVELS.length);
      expect(CARDS.filter((c) => states[c.id]?.secure).length).toBeGreaterThan(CARDS.length * 0.9);
    }
  });

  it("keeps rounds to 25 cards, plus the retries of its last few misses", () => {
    for (const { roundSizes } of runs) {
      expect(Math.max(...roundSizes)).toBeLessThanOrEqual(ROUND_SIZE + REDRILL_GAP + 1);
    }
  });

  it("has a full round to read every day while still climbing", () => {
    for (const { roundSizes, openByDay } of runs) {
      // The day's round is played before that day's openByDay entry, so a day
      // counts as climbing if the top wasn't open the day before.
      const climbing = roundSizes.filter((_, d) => d === 0 || openByDay[d - 1] < LEVELS.length);
      const mean = climbing.reduce((a, b) => a + b, 0) / climbing.length;
      expect(mean).toBeGreaterThanOrEqual(ROUND_SIZE);
      expect(mean).toBeLessThan(ROUND_SIZE + 1.5);
      expect(climbing.filter((n) => n < 20).length).toBeLessThan(climbing.length * 0.05);
    }
  });

  it("ends a struggling child's round instead of retrying forever", () => {
    const { roundSizes } = play(10, always(false));
    expect(Math.max(...roundSizes)).toBeLessThanOrEqual(ROUND_SIZE + REDRILL_GAP + 1);
  });

  it("brings a 'Not yet' card back later in the same round, without counting it", () => {
    const { shown } = runs[0];
    const misses = shown.filter((s) => s.grade === "again" && !s.redrill);
    expect(misses.length).toBeGreaterThan(50);
    for (const miss of misses) {
      const i = shown.indexOf(miss);
      const retry = shown.slice(i + 1).find((s) => s.cardId === miss.cardId);
      expect(retry?.day).toBe(miss.day);
      expect(retry?.redrill).toBe(true);
    }
  });

  it("spaces a known card further apart each time it's read without help", () => {
    const { shown } = play(200, always(true));
    const first = CARDS[0].id;
    const days = shown.filter((s) => s.cardId === first && !s.redrill).map((s) => s.day);
    const gaps = days.slice(1).map((d, i) => d - days[i]);
    expect(gaps.slice(0, 4)).toEqual([1, 6, 15, 38]);
  });
});

describe("guard rails", () => {
  it("can't open a level the same day the previous one opened", () => {
    const { openByDay } = play(60, always(true));
    openByDay.forEach((open, i) => expect(open).toBeLessThanOrEqual(i + 1));
    expect(openByDay[0]).toBe(1);
  });

  it("keeps a child who can't read the words yet on the first level", () => {
    const { openByDay, shown } = play(30, always(false));
    expect(openByDay[openByDay.length - 1]).toBe(1);
    expect(shown.every((s) => CARD_BY_ID.get(s.cardId)!.levelIndex === 0)).toBe(true);
  });

  it("holds the next level until 80% of the current one is known", () => {
    // Reads the first level's last five words wrong forever: 15 of 20 known is under 80%.
    const stuck = new Set(CARDS.filter((c) => c.levelIndex === 0).slice(-5).map((c) => c.id));
    const { openByDay } = play(30, (card) => !stuck.has(card.id));
    expect(openByDay[openByDay.length - 1]).toBe(1);
  });
});
