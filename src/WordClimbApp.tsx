import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronRight, Home, Mountain as MountainIcon, Undo2 } from "lucide-react";
import confetti from "canvas-confetti";
import { Button } from "./Button";
import Mountain from "./Mountain";
import ParentReport from "./ParentReport";
import InstallCard from "./InstallCard";
import { CARD_BY_ID, LEVELS } from "./lib/wordClimbContent";
import {
  type CardStates,
  type Grade,
  type QueueItem,
  NEW_CARD_STATE,
  ROUND_SIZE,
  answerCard,
  buildRound,
  localDay,
  unlockedLevelCount,
} from "./lib/wordClimbSchedule";
import { type ReadingLog, currentLevel, ladder, loadCards, loadLog, logGrade, saveCards, saveLog } from "./lib/readingLog";

// The ladder is in ./lib/wordClimbContent.ts, the SM-2 scheduler in
// ./lib/wordClimbSchedule.ts and what's remembered (plus the parent report)
// in ./lib/readingLog.ts. This file owns the screens.
//
// How a round works: the child reads the card aloud and a grown-up answers
// one question: did they read it without help? Yes or Not yet, then straight
// on to the next card. A "Not yet" card comes back a few cards later in the
// same round for another try; that repeat doesn't change its schedule.

const ANSWERS: { grade: Grade; label: string; hint: string; fill: string; keys: string[] }[] = [
  { grade: "again", label: "Not yet", hint: "Needed help", fill: "bg-again", keys: ["1", "n", "ArrowLeft"] },
  { grade: "good", label: "Yes!", hint: "Read it", fill: "bg-good", keys: ["2", "y", "ArrowRight"] },
];

/** The biggest type that still fits the card, from a phone up to a full-width tablet. */
function cardTextClass(text: string) {
  if (text.length <= 6) return "text-8xl md:text-[10rem] lg:text-[12rem]";
  if (text.length <= 11) return "text-6xl md:text-8xl xl:text-9xl";
  if (text.length <= 24) return "text-5xl md:text-7xl xl:text-8xl";
  if (text.length <= 48) return "text-4xl md:text-6xl xl:text-7xl";
  return "text-3xl md:text-5xl xl:text-6xl";
}

type Screen = "home" | "playing" | "round-over" | "report";

interface HistoryEntry {
  queue: QueueItem[];
  states: CardStates;
  log: ReadingLog;
}

export default function WordClimbApp() {
  const [states, setStates] = useState<CardStates>(loadCards);
  const [log, setLog] = useState<ReadingLog>(loadLog);
  const [screen, setScreen] = useState<Screen>("home");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [levelUp, setLevelUp] = useState<string | null>(null);

  useEffect(() => saveCards(states), [states]);
  useEffect(() => saveLog(log), [log]);

  const today = localDay(new Date());
  const levels = useMemo(() => ladder(states), [states]);
  const current = useMemo(() => currentLevel(states), [states]);
  const readyToday = useMemo(() => buildRound(states, today).length > 0, [states, today]);

  const startRound = () => {
    const round = buildRound(states, today);
    if (!round.length) return setScreen("home");
    setQueue(round);
    setHistory([]);
    setScreen("playing");
  };

  const handleGrade = (grade: Grade) => {
    const item = queue[0];
    if (!item) return;
    setHistory((h) => [...h, { queue, states, log }]);

    const next = answerCard({ states, queue, shown: history.length }, grade, today, Date.now());
    const nextStates = next.states;
    if (!item.redrill) {
      const before = states[item.cardId] ?? NEW_CARD_STATE;
      const after = nextStates[item.cardId];
      const opened = unlockedLevelCount(nextStates);
      if (opened > unlockedLevelCount(states)) {
        setLevelUp(LEVELS[opened - 1].title);
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, disableForReducedMotion: true });
        window.setTimeout(() => setLevelUp(null), 3000);
      }
      setStates(nextStates);
      setLog(logGrade(log, { cardId: item.cardId, grade, day: today, redrill: false }, after.secure && !before.secure));
    } else {
      setLog(logGrade(log, { cardId: item.cardId, grade, day: today, redrill: true }, false));
    }

    setQueue(next.queue);
    if (!next.queue.length) setScreen("round-over");
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setStates(last.states);
    setLog(last.log);
    setQueue(last.queue);
    setHistory(history.slice(0, -1));
    setScreen("playing");
  };

  // Keys answer too: 1 / N / ← for Not yet, 2 / Y / → for Yes. No dependency
  // array: handleGrade closes over state.
  useEffect(() => {
    if (screen !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const answer = ANSWERS.find((a) => a.keys.includes(e.key.length === 1 ? e.key.toLowerCase() : e.key));
      if (answer) handleGrade(answer.grade);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (screen === "report") {
    return <ParentReport states={states} log={log} today={today} onClose={() => setScreen("home")} />;
  }

  const card = screen === "playing" && queue[0] ? CARD_BY_ID.get(queue[0].cardId) : undefined;
  const toNext = Math.max(0, current.needed - current.known);
  // Solid: known. Light: read once, made solid by a good read on another day.
  const knownPct = Math.min(100, (current.known / current.needed) * 100);
  const oncePct = Math.min(100 - knownPct, (current.readOnce / current.needed) * 100);
  const levelBar = (
    <div className='h-3 rounded-full bg-ink/10 overflow-hidden flex'>
      <div className='h-full bg-trail transition-all duration-500' style={{ width: `${knownPct}%` }} />
      <div className='h-full bg-trail/35 transition-all duration-500' style={{ width: `${oncePct}%` }} />
    </div>
  );
  const onceNote =
    current.readOnce > 0 ? `${current.readOnce} read once. Read ${current.readOnce === 1 ? "it" : "them"} again on another day to lock ${current.readOnce === 1 ? "it" : "them"} in.` : null;

  return (
    <div className='h-full flex flex-col safe-area relative'>
      {levelUp && (
        <div className='absolute inset-x-0 top-6 z-50 flex justify-center pointer-events-none' role='status'>
          <div className='rounded-2xl bg-card border-2 border-trail shadow-lg px-6 py-4 text-center'>
            <div className='text-sm font-bold uppercase tracking-wide text-trail'>New level!</div>
            <div className='text-2xl font-bold'>{levelUp}</div>
          </div>
        </div>
      )}

      {screen === "home" && (
        <div className='flex-1 min-h-0 flex flex-col md:flex-row gap-4 p-4 sm:p-6'>
          <div className='flex-1 min-h-0 flex items-center justify-center'>
            <div className='h-full max-h-[70vh] md:max-h-full aspect-[400/560]'>
              <Mountain levels={levels} />
            </div>
          </div>
          <div className='md:w-[24rem] shrink-0 flex flex-col justify-center gap-4'>
            <div className='flex items-center justify-between'>
              <h1 className='text-3xl font-bold flex items-center gap-2'>
                <MountainIcon className='w-8 h-8 text-trail' /> Word Climb
              </h1>
              <Button variant='ghost' size='sm' onClick={() => setScreen("report")}>
                <BarChart3 className='w-4 h-4' /> Grown-ups
              </Button>
            </div>
            <div className='rounded-2xl bg-card border border-line p-5'>
              <div className='text-sm font-bold uppercase tracking-wide text-ink-muted'>
                {current.grade} · level {current.index + 1} of {levels.length}
              </div>
              <div className='text-2xl font-bold mt-1 mb-3'>{current.title}</div>
              {levelBar}
              <p className='mt-2 text-ink-muted'>
                {current.status === "done"
                  ? "You reached the top! Keep reading to stay sharp."
                  : toNext === 0
                    ? "One more good read to climb higher!"
                    : `${toNext} more to the next stop`}
              </p>
              {onceNote && <p className='text-sm text-ink-muted'>{onceNote}</p>}
            </div>
            {readyToday ? (
              <Button variant='primary' size='xl' onClick={startRound}>
                Start reading <ChevronRight className='w-6 h-6' />
              </Button>
            ) : (
              <div className='rounded-2xl bg-card border border-line p-5 text-center'>
                <div className='text-xl font-bold'>All done for today!</div>
                <div className='text-ink-muted'>Come back tomorrow to keep climbing.</div>
              </div>
            )}
            <InstallCard />
          </div>
        </div>
      )}

      {screen === "playing" && card && (
        <>
          <div className='flex items-center gap-3 px-3 pt-3 shrink-0'>
            <Button variant='ghost' size='icon' aria-label='Home' onClick={() => setScreen("home")}>
              <Home className='w-6 h-6' />
            </Button>
            <div className='flex-1 min-w-0'>
              <div className='flex justify-between text-sm font-bold text-ink-muted mb-1'>
                <span className='truncate'>{current.title}</span>
                <span className='tabular-nums shrink-0'>
                  {history.length + 1} / {ROUND_SIZE}
                </span>
              </div>
              {levelBar}
            </div>
            <Button variant='ghost' size='icon' aria-label='Undo' onClick={undo} disabled={history.length === 0}>
              <Undo2 className='w-6 h-6' />
            </Button>
          </div>

          <div className='flex-1 min-h-0 m-3 rounded-3xl bg-card border border-line flex items-center justify-center p-6 overflow-hidden'>
            <p lang='en' className={`font-reading text-center leading-snug text-balance max-w-full break-words ${cardTextClass(card.text)}`}>
              {card.text}
            </p>
          </div>

          <div className='px-3 pb-3 shrink-0'>
            <div className='text-center text-sm font-bold text-ink-muted mb-2'>Grown-up: did they read it without help?</div>
            <div className='grid grid-cols-2 gap-3'>
              {ANSWERS.map((answer) => (
                <button
                  key={answer.grade}
                  type='button'
                  aria-keyshortcuts={answer.keys[0]}
                  onClick={() => handleGrade(answer.grade)}
                  className={`h-24 md:h-32 rounded-2xl text-white flex flex-col items-center justify-center select-none touch-manipulation active:brightness-90 ${answer.fill}`}
                >
                  <span className='text-3xl md:text-4xl font-bold'>{answer.label}</span>
                  <span className='text-sm md:text-base opacity-90'>{answer.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {screen === "round-over" && (
        <div className='flex-1 flex flex-col items-center justify-center gap-6 p-6 text-center'>
          <div className='text-5xl md:text-7xl font-bold'>Great reading!</div>
          <div className='text-xl text-ink-muted'>
            {history.length} cards read · {current.title}
          </div>
          <div className='w-full max-w-sm'>{levelBar}</div>
          {onceNote && <div className='text-ink-muted max-w-sm'>{onceNote}</div>}
          <div className='flex flex-col sm:flex-row gap-3'>
            {readyToday && (
              <Button variant='primary' size='xl' onClick={startRound}>
                Keep climbing <ChevronRight className='w-6 h-6' />
              </Button>
            )}
            <Button variant='secondary' size='xl' onClick={() => setScreen("home")}>
              <Home className='w-6 h-6' /> {readyToday ? "Done for now" : "All done for today"}
            </Button>
          </div>
          <Button variant='ghost' size='md' onClick={undo}>
            <Undo2 className='w-5 h-5' /> Undo last card
          </Button>
        </div>
      )}
    </div>
  );
}
