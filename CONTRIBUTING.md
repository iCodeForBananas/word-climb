# Contributing

Thanks for helping kids learn to read! Bug reports, new levels, better
sentences, accessibility fixes and translations are all welcome.

## Ground rules

Word Climb is for young children, so a few things are non-negotiable:

- **No data leaves the device.** No analytics, ads, accounts, network calls
  or third-party SDKs that phone home. (This is also what keeps it eligible
  for the kids' categories in both app stores.)
- **Never ask a child to read a word the ladder hasn't taught.** The content
  test enforces this for phrases and sentences.
- **Big text, big buttons.** Assume a five-year-old and a parent sharing a
  tablet.

## Making a change

1. Fork, then branch from `main`.
2. `npm install`, then `npm run dev` to try it as you work.
3. Add or update tests next to the code (`*.test.ts`) for anything in
   `src/lib/`. `npm test` must pass.
4. Open a pull request. CI tests it and builds Android and iOS apps you can
   download from the run to try it on a device.

### Adding or changing cards

Levels live in `LEVELS` in `src/lib/wordClimbContent.ts`, easiest first.

- A card's saved progress is keyed on its text, so fixing a typo in a card
  resets that one card for anyone who has seen it. Adding cards or levels is
  always safe.
- A phrase or sentence may only use words from cards at or before its level.
  If one really needs an earlier word, put it in that level's `extraWords`,
  where reviewers can see it.
- `wordClimbContent.test.ts` checks word counts per level, the controlled
  vocabulary, and duplicates.

### Changing the icon or splash screen

Edit the images in `resources/`, then run `npm run assets` to regenerate
every Android and iOS size.

## Reporting a bug

Open an issue with the device, OS version, what you tapped and what
happened. A screenshot helps.
