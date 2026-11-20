import { describe, it, expect } from "vitest";
import { CARDS, LEVELS } from "./wordClimbContent";
import { type CardStates, NEW_CARD_STATE, addDays, applyGrade } from "./wordClimbSchedule";
import { buildReport, currentLevel, emptyLog, ladder, logGrade, normalizeLog, streakOf, unlogLast } from "./readingLog";

const D0 = "2026-11-02";
const level0 = CARDS.filter((c) => c.levelIndex === 0);
const knownState = () => applyGrade(applyGrade(NEW_CARD_STATE, "good", D0, 1), "good", addDays(D0, 1), 2);

function knowLevel0(share = 1): CardStates {
  return Object.fromEntries(level0.slice(0, Math.ceil(level0.length * share)).map((c) => [c.id, knownState()]));
}

describe("log", () => {
  it("counts days practiced once each and remembers when a card became known", () => {
    let log = emptyLog();
    log = logGrade(log, { cardId: "a", grade: "good", day: D0, redrill: false }, false);
    log = logGrade(log, { cardId: "a", grade: "good", day: addDays(D0, 1), redrill: false }, true);
    log = logGrade(log, { cardId: "b", grade: "again", day: addDays(D0, 1), redrill: false }, false);
    expect(log.daysPracticed).toEqual([D0, addDays(D0, 1)]);
    expect(log.knownOn).toEqual({ a: addDays(D0, 1) });
    expect(log.totalCardsRead).toBe(3);
  });

  it("drops grades older than 60 days but keeps the day count", () => {
    let log = logGrade(emptyLog(), { cardId: "a", grade: "good", day: D0, redrill: false }, false);
    log = logGrade(log, { cardId: "a", grade: "good", day: addDays(D0, 90), redrill: false }, false);
    expect(log.recent).toHaveLength(1);
    expect(log.daysPracticed).toHaveLength(2);
  });

  it("undoes the last grade, including a first day and a known card", () => {
    const before = emptyLog();
    const after = logGrade(before, { cardId: "a", grade: "good", day: D0, redrill: false }, true);
    expect(unlogLast(after, "a")).toEqual(before);
  });

  it("falls back to empty on garbage", () => {
    expect(normalizeLog("x")).toEqual(emptyLog());
  });
});

describe("streak", () => {
  it("counts back from today, or from yesterday if today isn't played yet", () => {
    const days = [addDays(D0, -2), addDays(D0, -1), D0];
    expect(streakOf(days, D0)).toBe(3);
    expect(streakOf(days, addDays(D0, 1))).toBe(3);
    expect(streakOf(days, addDays(D0, 2))).toBe(0);
    expect(streakOf([addDays(D0, -3), D0], D0)).toBe(1);
  });
});

describe("ladder", () => {
  it("starts on the first level with everything else locked", () => {
    const levels = ladder({});
    expect(levels[0].status).toBe("current");
    expect(levels.slice(1).every((l) => l.status === "locked")).toBe(true);
    expect(currentLevel({}).index).toBe(0);
  });

  it("counts cards read once but not yet confirmed", () => {
    const states = { [level0[0].id]: applyGrade(NEW_CARD_STATE, "good", D0, 1) };
    expect(ladder(states)[0]).toMatchObject({ known: 0, readOnce: 1 });
  });

  it("marks a level done once the next one opens", () => {
    const levels = ladder(knowLevel0(0.8));
    expect(levels[0].status).toBe("done");
    expect(levels[1].status).toBe("current");
  });
});

describe("report", () => {
  it("summarizes what's known, the week, and what's tricky", () => {
    const states = knowLevel0();
    const tricky = level0[0].id;
    states[tricky] = applyGrade(states[tricky], "again", addDays(D0, 3), 3);
    let log = emptyLog();
    log = logGrade(log, { cardId: level0[1].id, grade: "good", day: addDays(D0, 1), redrill: false }, true);
    log = logGrade(log, { cardId: tricky, grade: "again", day: addDays(D0, 3), redrill: false }, false);
    log = logGrade(log, { cardId: tricky, grade: "good", day: addDays(D0, 3), redrill: true }, false);

    const r = buildReport(states, log, addDays(D0, 3));
    expect(r.cardsKnown).toBe(level0.length);
    expect(r.wordsKnown).toBe(level0.length);
    expect(r.current.index).toBe(1);
    expect(r.grades[0].levelsDone).toBe(1);
    expect(r.grades.reduce((n, g) => n + g.levelCount, 0)).toBe(LEVELS.length);
    expect(r.week.cardsRead).toBe(3);
    expect(r.week.unaided).toBe(0.5); // the redrill doesn't count
    expect(r.week.newlyKnown).toEqual([level0[1].text]);
    expect(r.tricky[0]).toEqual({ text: level0[0].text, misses: 1 });
    expect(r.dueTomorrow).toBeGreaterThan(0);
  });
});
