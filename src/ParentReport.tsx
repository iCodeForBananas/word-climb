import { useMemo } from "react";
import { Check, ChevronLeft, Flame, Lock } from "lucide-react";
import { Button } from "./Button";
import { buildReport, type LevelReport } from "./lib/readingLog";
import type { CardStates } from "./lib/wordClimbSchedule";
import type { ReadingLog } from "./lib/readingLog";

// For the grown-up: where the child is on the K-3 ladder, how the week went,
// and which words keep tripping them up.

const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);

export default function ParentReport({
  states,
  log,
  today,
  onClose,
}: {
  states: CardStates;
  log: ReadingLog;
  today: string;
  onClose: () => void;
}) {
  const r = useMemo(() => buildReport(states, log, today), [states, log, today]);
  const toNext = Math.max(0, r.current.needed - r.current.known);

  return (
    <div className='h-full flex flex-col bg-sky safe-area'>
      <div className='flex items-center gap-2 px-3 sm:px-6 py-3 shrink-0'>
        <Button variant='ghost' size='md' onClick={onClose}>
          <ChevronLeft className='w-5 h-5' /> Back
        </Button>
        <h1 className='text-xl font-bold'>Reading report</h1>
      </div>

      <div className='flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 pb-10' style={{ WebkitOverflowScrolling: "touch" }}>
        <div className='max-w-4xl mx-auto flex flex-col gap-4'>
          <section className='rounded-2xl bg-card border border-line p-5'>
            <div className='text-sm font-bold uppercase tracking-wide text-ink-muted'>Now reading</div>
            <div className='text-2xl font-bold mt-1'>
              {r.current.grade}: {r.current.title}
            </div>
            <div className='mt-3 h-3 rounded-full bg-ink/10 overflow-hidden'>
              <div className='h-full bg-trail rounded-full' style={{ width: `${Math.min(100, (r.current.known / r.current.needed) * 100)}%` }} />
            </div>
            <p className='mt-2 text-ink-muted'>
              {r.current.status === "done"
                ? "Top of the ladder reached. Reviews keep everything fresh."
                : `${r.current.known} of ${r.current.total} known. ${toNext === 0 ? "Next level opens with the next good read." : `${toNext} more to open the next level.`}`}
            </p>
          </section>

          <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
            <Stat label='Words known' value={String(r.wordsKnown)} />
            <Stat label='Phrases and sentences' value={String(r.phrasesAndSentencesKnown)} />
            <Stat label='Days practiced' value={String(r.daysPracticed)} />
            <Stat label='Streak' value={`${r.streak} day${r.streak === 1 ? "" : "s"}`} icon={r.streak > 1 ? <Flame className='w-5 h-5 text-hard' /> : null} />
          </div>

          <section className='rounded-2xl bg-card border border-line p-5'>
            <h2 className='font-bold text-lg mb-2'>Last 7 days</h2>
            {r.week.cardsRead === 0 ? (
              <p className='text-ink-muted'>No reading yet this week.</p>
            ) : (
              <ul className='flex flex-col gap-1.5'>
                <li>
                  Practiced on <b>{r.week.daysPracticed}</b> day{r.week.daysPracticed === 1 ? "" : "s"}, reading <b>{r.week.cardsRead}</b> cards.
                </li>
                <li>
                  Read <b>{pct(r.week.unaided)}</b> without help on the first try.
                </li>
                {r.week.newlyKnown.length > 0 && (
                  <li>
                    Newly known: <span className='font-reading'>{r.week.newlyKnown.slice(0, 30).join(", ")}</span>
                    {r.week.newlyKnown.length > 30 && ` and ${r.week.newlyKnown.length - 30} more`}
                  </li>
                )}
                <li className='text-ink-muted'>
                  {r.dueTomorrow} card{r.dueTomorrow === 1 ? "" : "s"} due for review by tomorrow.
                </li>
              </ul>
            )}
          </section>

          {r.tricky.length > 0 && (
            <section className='rounded-2xl bg-card border border-line p-5'>
              <h2 className='font-bold text-lg mb-1'>Tricky ones</h2>
              <p className='text-ink-muted text-sm mb-3'>Cards that needed help more than once. Worth a little practice away from the screen.</p>
              <div className='flex flex-wrap gap-2'>
                {r.tricky.map((t) => (
                  <span key={t.text} className='font-reading text-lg px-3 py-1 rounded-lg bg-again/10 text-ink'>
                    {t.text} <span className='text-sm text-ink-muted'>×{t.misses}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className='rounded-2xl bg-card border border-line p-5'>
            <h2 className='font-bold text-lg mb-1'>The ladder</h2>
            <p className='text-ink-muted text-sm mb-4'>
              Each level opens when 80% of the one before is known. A card counts as known once it's read without help on two different days.
            </p>
            <div className='grid md:grid-cols-2 gap-5'>
              {r.grades.map((g) => (
                <div key={g.grade}>
                  <div className='flex items-baseline justify-between mb-2'>
                    <h3 className='font-bold'>{g.grade}</h3>
                    <span className='text-sm text-ink-muted'>
                      {g.levelsDone} / {g.levelCount} levels
                    </span>
                  </div>
                  <ul className='flex flex-col gap-1.5'>
                    {g.levels.map((l) => (
                      <LevelRow key={l.id} level={l} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <p className='text-sm text-ink-muted text-center'>
            {r.totalCardsRead} cards read in all · {r.cardsKnown} of {r.totalCards} known. Everything stays on this device.
          </p>
        </div>
      </div>
    </div>
  );
}

function LevelRow({ level }: { level: LevelReport }) {
  const icon =
    level.status === "done" ? (
      <Check className='w-4 h-4 text-good shrink-0' aria-label='Done' />
    ) : level.status === "current" ? (
      <span className='w-4 h-4 rounded-full bg-primary shrink-0' aria-label='Current' />
    ) : (
      <Lock className='w-4 h-4 text-ink-muted/60 shrink-0' aria-label='Locked' />
    );
  return (
    <li className='flex items-center gap-2.5'>
      {icon}
      <span className={`flex-1 ${level.status === "locked" ? "text-ink-muted" : ""} ${level.status === "current" ? "font-bold" : ""}`}>{level.title}</span>
      {level.status !== "locked" && (
        <span className='text-sm text-ink-muted tabular-nums'>
          {level.known}/{level.total}
        </span>
      )}
    </li>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className='rounded-2xl bg-card border border-line p-4'>
      <div className='text-xs font-bold uppercase tracking-wide text-ink-muted'>{label}</div>
      <div className='text-2xl font-bold mt-1 flex items-center gap-1.5'>
        {value} {icon}
      </div>
    </div>
  );
}
