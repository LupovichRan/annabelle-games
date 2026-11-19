# Calm UI – the low-clutter rules (reference: `store.html`)

The owner's request: *"everything is very, very cluttered. I want it easy on the eyes, also suited to people with ADHD:
comfortable, light, not overloaded."* The game shop (`store.html`) was built as the reference for this look. The home page
adopts the same rules next. This file is the checklist.

## How solid is the evidence?

Honest summary: there is **no ADHD-specific web standard**, and controlled studies on ADHD and interface design are few and
small. What exists is (a) W3C guidance for cognitive and learning disabilities in general, which explicitly covers attention,
(b) WCAG 2.2 success criteria that happen to protect attention, and (c) practitioner writing and small qualitative studies.
The rules below are taken from (a) and (b) wherever possible; (c) is used only where it agrees with them.

## The rules

Each rule says what to do, where it comes from, and how the shop does it.

### 1. Five main choices or fewer per screen
- **Source:** COGA 4.6.3 *Avoid Too Much Content*: "five or less main choices on each screen"; extra links go in the footer.
- **Shop:** 3 tabs; one view at a time. "My games" has 2 buttons above the list. "For you" shows at most 3 ideas.
  Browsing shows one category at a time (6 chips), never all shelves at once. The calm-mode switch lives in the footer.
- **Home page:** show only the kid's library (6–9 tiles), one "add games" entry to the shop, and move everything else
  (album, challenges, themes, family board, language) behind one profile/menu button.

### 2. One primary action per screen
- **Source:** COGA 4.3.1 / 4.3.4 (make the most important task and action easy to find), 4.6.2 *Make Short Critical Paths*.
- **Shop:** exactly one filled blue button per screen ("Add games", "Get – free", "Play"). Everything else is a white
  outline button or plain row.
- **Home page:** the one filled button is "play / continue". No second filled button.

### 3. One accent colour; the emoji is the only colour of a tile
- **Source:** COGA 4.2.3 *Use a Consistent Visual Design*, 4.4.11 (foreground not obscured by busy backgrounds); UXPA
  (reduce clutter, make the main action stand out).
- **Shop:** warm paper background `#f5f2ec`, white cards, ink `#2b3140`, soft text `#5a6272`, one accent `#34639f`,
  one success green `#2c6e52`. No gradients. A tile is a white card; its emoji sits on a square tinted with 20 % of the
  game's old gradient colour (`tint(grad[0])`), so games stay recognisable without 46 gradients competing.
- **Home page:** replace the gradient tiles with the same white card + tinted emoji square. Themes may change the
  background and accent, never add per-tile gradients in calm mode.

### 4. White space and chunking
- **Source:** COGA 4.4.10 *Use White Spacing* ("Put white space around objects and text"), 4.3.5 (break into chunks),
  4.3.3 (clear page structure).
- **Shop:** 16 px side gutters, 18 px between blocks, 10 px between rows, rows 68 px high. Facts in the detail sheet are a
  chunk of exactly 3 (age, round length, pace). Lists are one column on a phone, two on a desktop, max width 860 px.

### 5. No motion the user did not ask for
- **Source:** WCAG 2.2.2 *Pause, Stop, Hide* (A); WCAG 2.3.3 *Animation from Interactions* (AAA); COGA 4.6.1 *Limit
  Interruptions* (let users limit moving content and noises); COGA 4.5.1 *Controls and Content Do Not Move Unexpectedly*;
  UXPA ("animations should have an option to be turned off"); the eye-tracking study on animated UI elements notes that
  irrelevant animation distracts and that most guidance here is still anecdotal.
- **Shop:** nothing loops, blinks, floats or auto-plays. No particles, no confetti, no WebGL background (the shop calls
  `Vibe.off()` in calm mode). The only motion is direct feedback to a tap: the 0.8 s "adding" bar and a 0.12 s fade of the
  sheet. With `prefers-reduced-motion: reduce` both are removed and the game is simply added.
- **Home page:** in calm mode stop idle animations (bouncing tiles, sparkles, floating pets, pulsing buttons). Keep only
  feedback that answers a tap and ends within about a second.

### 6. No badges that nag, no red dots, no counters that grow
- **Source:** COGA 4.6.1 *Limit Interruptions*; UXPA lists pop-up notifications and flashing elements as the main distractors.
- **Shop:** "new" is a quiet grey word inside the detail sheet, not a badge on the tile. Installed games get a small green
  "Yours ✓". No unread counts, no "NEW!" stickers, no pop-ups. Telemetry is silent.
- **Home page:** at most one notice at a time, as a plain line the kid can ignore. No dot on the shop button.

### 7. No time pressure, no countdowns, no limits presented as rules
- **Source:** COGA 4.5.9 *Avoid Data Loss and "Timeouts"*; WCAG 2.2.1 *Timing Adjustable* (A).
- **Shop:** the undo bar stays until the next action – it does not disappear after a few seconds. "6 to 9 is a comfy
  number" is advice, never a limit: nothing is blocked at 10 or 20 games.

### 8. Undo instead of "are you sure?"
- **Source:** COGA 4.5.2 *Let Users Go Back*, 4.5.5 *Make it Easy to Undo*, 4.8.3 *Clearly State the Results and
  Disadvantages of Actions*.
- **Shop:** add, remove and pack are instant and each offers one-tap undo (a removed game returns to the same place; a
  pack undo removes only what the pack added). Every remove says what happens: "Your progress is kept."

### 9. Things stay where they are
- **Source:** COGA 4.5.1; COGA 4.2.2 / 4.2.3 (familiar, consistent design); WCAG 3.2.3 *Consistent Navigation* (AA),
  3.2.6 *Consistent Help* (A).
- **Shop:** home button, title and tabs never move. Suggestions are computed without randomness, so the screen is the
  same on the next visit. Lists re-render in place and focus stays on the control that was used.
- **Home page:** the kid's own order (`GameCatalog.lib()`) is the order, always. No "surprise" reshuffling.

### 10. Remember, so the kid does not have to
- **Source:** COGA Objective 6 / 4.7.5 *Do Not Rely on Users' … Memorizing Information*; WCAG 3.3.7 *Redundant Entry* (A).
- **Shop:** remembers the last tab, category and filters (`annabelle-store-ui`); never the search text. The count of
  installed games is written out ("8 games on my home screen").

### 11. Short literal words, icon + word together
- **Source:** COGA 4.4.1 *Use Clear Words*, 4.4.5 *Keep Text Succinct*, 4.4.4 *Use Literal Language*, 4.2.7 *Use Icons that
  Help the User*, 4.5.6 *Use Clear Visible Labels*.
- **Shop:** every game has exactly one sentence. Buttons say what they do ("Remove from home"). Every icon has a word next
  to it (the two arrows in arrange mode carry an `aria-label` and sit beside the word "Remove"). Base text 17 px, never
  under 14 px, line height 1.45.

### 12. Big targets, visible focus, no drag required
- **Source:** WCAG 2.5.8 *Target Size (Minimum)* (AA, 24 px – we use 44 px, the site's kid rule is 48 px), 2.5.7 *Dragging
  Movements* (AA), 2.4.7 *Focus Visible* (AA), 2.4.11 *Focus Not Obscured* (AA), 2.4.13 *Focus Appearance* (AAA).
- **Shop:** every target is at least 44 × 44 px (tested). Reordering uses ▲ ▼ buttons, no drag. Focus is a 3 px accent
  outline with 3 px offset. The sheet traps focus, closes with Escape and returns focus to the row that opened it.

### 13. Search is always there, and forgiving
- **Source:** COGA 4.3.6 *Provide Search*, 4.5.8 *Accept different input formats*.
- **Shop:** one search box; it matches the name in all three languages, the sentence and the topic words, ignores accents,
  niqqud and hyphens, and searches every category. An empty result offers one button: "Clear search and filters".

### 14. Give the user the switch
- **Source:** COGA Objective 8 – 4.9.1 *Let Users Control When the Content Moves or Changes*, 4.9.3 *Support
  Simplification*; UXPA ("Focus Mode" toggle). The FocusView study (ASSETS 2025) found viewers with ADHD differ – what
  distracts one person stimulates another – and that too many settings are themselves a distraction. So: **one** switch.
- **Shop / site:** calm mode, default ON for everybody (below).

## Calm mode – the contract

| | |
|---|---|
| Key | `localStorage 'annabelle-calm'` – `'0'` = lively; anything else or missing = calm (**default ON, new and existing users**) |
| Read | `GameCatalog.calm()` – or, in a module that does not load `catalog.js`: `localStorage.getItem('annabelle-calm') !== '0'` |
| Write | `GameCatalog.setCalm(true|false)` |
| Signals | `<html data-calm="1|0">` (set by `catalog.js` at load and on change); `window` event `annabelle-calm` with `detail.calm`; `GameCatalog.onchange(cb)` gets `'calm'` |
| Scope | The key starts with `annabelle-` and is not in the album / playtime KEEP lists, so it is saved per profile. To make it device-wide, add `calm` to those KEEP regexes. |

What each module should do when calm is ON:

- **vibe.js** – do not boot: treat calm like `annabelle-vibe = '0'` (API stays as no-ops; `Vibe.on()` when the switch goes off).
- **juice.js** – its `calm()` helper should return `reducedMotion || localStorage 'annabelle-calm' !== '0'`: no flying coins,
  no confetti, no particles; the level-up becomes the quiet card it already shows for reduced motion. Sounds follow
  `annabelle-muted` as today.
- **index.html** – flat tiles (rule 3), no idle animation (rule 5), no badges on tiles (rule 6), only the library (rule 1).
- **Games** – not affected. Calm mode is about menus and the reward layer, not about gameplay.
- `prefers-reduced-motion: reduce` always wins and removes the remaining feedback animations too.

## Pace leaves

`calm: 1..3` in the catalog is the pace of a game (1 = quiet, slow, no timers; 3 = fast). It is shown as three leaves where
**more green leaves = calmer** (pace 1 → 🍃🍃🍃, pace 3 → 🍃), always with the word (Calm / Medium / Fast) next to it.

## Measured on the shop

- First screen at 390 × 800: 12–13 interactive elements – 1 home, 3 tabs, 2 buttons, the kid's 6 games, and the calm
  switch when it peeks in. (The shared report button and the play-time badge are extra and belong to other modules.)
- No horizontal scroll at 360, 390 and 1366 px; all targets ≥ 44 px; he / fr / en.

## Sources

- W3C, *Making Content Usable for People with Cognitive and Learning Disabilities* (COGA, Working Group Note, 2021) –
  https://www.w3.org/TR/coga-usable/ (pattern numbers above are from this document)
- W3C, *What's New in WCAG 2.2* – https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ (2.4.11, 2.4.13, 2.5.7,
  2.5.8, 3.2.6, 3.3.7); WCAG 2.2 itself for 2.2.1, 2.2.2, 2.3.3, 2.4.7, 3.2.3 – https://www.w3.org/TR/WCAG22/
- B. Njemanze, *Designing for ADHD in UX*, UXPA International (2024/2025) – https://uxpa.org/designing-for-adhd-in-ux/
  (practitioner article: reduce clutter, focus mode, one clear action, minimal animation with an off switch)
- *Web-based Search: How Do Animated User Interface Elements Affect Autistic and Non-Autistic Users?* –
  https://arxiv.org/pdf/2211.11993 (eye tracking; autism, not ADHD; notes that cognitive-accessibility guidance is largely
  anecdotal)
- *FocusView: Understanding and Customizing Informational Video Watching Experiences for Viewers with ADHD* (ASSETS 2025) –
  https://madability.cs.wisc.edu/?p=489 (distraction differs per person; fewer options help)
