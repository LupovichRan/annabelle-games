# Telemetry, audit log and in-app reports (owner notes)

The site is static; three small scripts, loaded on every page by `playtime.js`, talk to one Supabase project
(`https://leitieyscvpebpgdengu.supabase.co`) with the public *publishable* key. The site can only **INSERT**
(row level security: no read, update or delete for the anon role). You read the data in the Supabase dashboard.

| file | job |
|---|---|
| `kid.js` | the kid profile (name stays on the device; a random `kid` uuid is what telemetry uses) |
| `telemetry.js` | `KidApp.track(type, data)`, `KidApp.audit(action, target, detail, actor)`, automatic events, the reproduction trail |
| `feedback.js` | the 🐞 button (drag it anywhere, or press F8, or call `KidApp.report()`), the report dialog |
| `vendor/html2canvas.min.js` | draws the screenshot (loaded only when the dialog opens) |

## What is never sent
The kid's name (also blanked in screenshots and scrubbed from labels and error texts), anything typed outside the
report dialog, letter/digit keys, input values, room codes / `?s=` / `?room=` URL parameters, localStorage dumps, the parent PIN.
Limit: a name that a game paints inside a `<canvas>` cannot be blanked in a screenshot (the dialog shows the picture
and has a "don't send the picture" box).

## Tables
- **`events`** – usage. `kid, device, sess, type, client_ts, page, game, age, gender, lang, ver, data`.
  Automatic types: `page_view` {ref, vw, vh, dpr, touch, pwa}, `session_end` {sec (visible seconds on that page), events, errors},
  `error` {msg, src, line, col} (deduplicated, max 10 per page), `game_start`, `level` {level, stars, score, sec},
  `game_end` {sec, score, win, quit}. The game events are derived from the existing `AnnabelleRewards.award()` calls
  (`play` → `game_start`; `levelClear` / `star` → `level`; `win` / `score` → `game_end`). Games may add their own (`answer`, `onboard`, `net`, …).
  Batched every ~10 s and when the page is left; max 120 events per page view; offline rows wait in `localStorage annabelle-tq` (max 200).
- **`audit`** – who did what. `kid, device, sess, actor ('kid'|'parent'|'system'), action, target, page, client_ts, detail`.
  Parent panel: `panel_opened` {via: pin|new-pin|math}, `pin_set`, `pin_changed`, `limits_changed` (target `daily-limit`, `bonus-time`,
  `today-reset`, `lock`, `unlock`, `bedtime`, `bedtime-from`, `bedtime-to`; detail = the resulting settings),
  `progress_reset` (target = game ids or `all`). Reports: `report_sent` (target = the short report number).
- **`reports`** – bug / idea / fix requests. `kind ('bug'|'feature'|'fix'), note, page, url (cleaned), ua, viewport, lang, age, gender, ver,
  steps, state, screenshot_path, audio_path`, plus `status` (`new` → `seen` / `planned` / `done` / `rejected`) and `owner_note` for you.
  - `steps` = the reproduction trail: the last ≤ 80 actions before the dialog opened, each `{t (ms), k, p (page), d, n (repeat count), x (tap position on a canvas, %)}`
    with `k` = `page` | `click` | `tap` | `key` | `reward` | `error` | `net` | `audit`.
  - `state` = `{rid (the number shown to the kid), shot, voice, online, pwa, tel, hook}`; `hook` is the page's own test-hook state
    (`window.__<page>.state()`), trimmed to a few KB, as it was just before the dialog opened.
  - `ver` = the service-worker cache name (same as `VERSION` in `sw.js`), or `dev` when no service worker is installed yet.

## Ready-made views
- `stats_daily` – per day: kids, sessions, game_starts, game_ends, errors
- `stats_games` – per game: starts, kids, avg_seconds, errors, last_seen
- `stats_kids` – per anonymous kid: age, gender, first_seen, last_seen, sessions, game_starts, games_tried
- `stats_learning` – per kid + game + skill: answers, pct_correct, avg_ms (from `answer` events)

```sql
select * from stats_daily order by day desc limit 14;
select * from stats_games order by starts desc;
```

## Reading reports (SQL editor)
```sql
-- newest reports
select ts, state->>'rid' as nr, kind, page, lang, age, ver, left(note, 120) as note, screenshot_path, audio_path, status
from reports order by ts desc limit 50;

-- one report (the number the kid saw) with its trail, one line per step
select to_timestamp((s->>'t')::bigint / 1000.0) as at, s->>'k' as what, s->>'p' as page, s->>'d' as detail, s->>'n' as times, s->>'x' as pos
from reports r, jsonb_array_elements(r.steps) s
where r.state->>'rid' = 'ABC123' order by 1;

-- the game state at that moment, and everything that browser session sent
select jsonb_pretty(state) from reports where state->>'rid' = 'ABC123';
select ts, type, page, data from events where sess = (select sess from reports where state->>'rid' = 'ABC123') order by ts;

-- most frequent JS errors of the last week
select data->>'msg' as msg, data->>'src' as src, data->>'line' as line, count(*), count(distinct kid) as kids, max(ver) as last_ver
from events where type = 'error' and ts > now() - interval '7 days' group by 1, 2, 3 order by 4 desc;

-- mark as handled
update reports set status = 'done', owner_note = 'fixed in …' where state->>'rid' = 'ABC123';

-- remove the automatic test rows
delete from reports where note like 'selftest%'; delete from events where type like 'selftest%' or device like 'selftest%';
delete from audit where action like 'selftest%' or device like 'selftest%';
```

## Screenshots and voice notes
Supabase dashboard → **Storage** → bucket **reports** (private). `screenshot_path` is `shot/<yyyymmdd>/<nr>-<random>.jpg`
(JPEG, ≤ 300 KB, longest side ≤ 1280 px), `audio_path` is `voice/<yyyymmdd>/<nr>-<random>.webm` (≤ 20 s; `.mp4` from Safari).
Open the folder of the day and click the file that starts with the report number. A report written offline is kept on the
device and sent later **without** picture and recording (`state.queued = true`).

## Switching telemetry off
- One device (parent): set `localStorage` key `annabelle-telemetry` to `"0"` (browser console: `localStorage.setItem('annabelle-telemetry','0')`).
  Then no event and no audit row is sent or queued; only a report that somebody explicitly sends still goes out.
  Remove the key (or set `"1"`) to switch it back on.
- Everybody: remove `telemetry.js` and `feedback.js` from the loader at the end of `playtime.js` (each module is optional),
  or revoke the INSERT policies in Supabase.

## Deploy notes
- Pages with a CSP need `connect-src https://leitieyscvpebpgdengu.supabase.co` (already there), and `img-src blob: data:` / `media-src blob:`.
- Add `kid.js`, `telemetry.js`, `feedback.js`, `vendor/html2canvas.min.js` to the `FILES` list of `sw.js` so they work offline from the first visit
  (they are cached at runtime after their first use anyway).
- The 🐞 button position is remembered per page in `localStorage kidapp-fbpos` (not part of profile snapshots).
