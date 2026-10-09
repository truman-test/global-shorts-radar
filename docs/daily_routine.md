# Daily orchestrator routine (runs every morning at 09:40 KST)

Goal: channel "디지털 생존노트" (@digitalsurvivalnote) reaches 1,000 subscribers by 2026-11-07 with
one original Korean Short per day. The human owner delegated all judgment to the orchestrator except
the two things only they may do: **upload in YouTube Studio** and **approve facts (`radar verify`)**.
Everything else is the orchestrator's job. Talk to the owner in plain, short Korean.

## Hard rules (never break)
- Never run `radar verify` (or edit the verification table) yourself; only the owner approves facts.
- Never upload, and never drive YouTube/Studio with a browser (YouTube ToS forbids automated access).
  API uploads stay locked private until the API audit passes, so they are useless before that.
- Never download, transcribe, translate or re-upload anyone else's video/audio. Source Shorts are idea signals.
- Keys live only in `.env`; never print them, never commit them (grep the staged diff before every commit).
- Publishable voice is Supertonic only (`--backend supertonic`, the default). edge-tts output is preview only.
- Git: `git fetch` first; if `origin/ccr-c7c12be1-dq783t` has commits you do not have, merge them before
  pushing. Commit as `git -c user.name=skaak -c user.email=skaakdl@gmail.com commit`, message ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `media/`, `data/`, `.env`, `/secrets/`.
- If something fails, fix the cause if it is clearly inside this project; otherwise stop that step and report it.

## Steps
1. **Radar fresh?** Windows Task Scheduler runs `radar run` at 09:10. If `reports/` has no report from
   today, run `PYTHONUTF8=1 .venv/Scripts/radar.exe run` (about 700 quota units).
2. **Channel check:** `PYTHONUTF8=1 .venv/Scripts/python.exe tools/channel_stats.py`. It records stats,
   detects yesterday's upload, marks it `published` in `content/schedule.json` and logs it. If the
   previous day's scheduled video is not on the channel, note it (do not nag; just mention once).
3. **Keep 3 days ready:** for the next 3 unpublished dates in `content/schedule.json`, the video must
   exist in `media/final/<script id>/` and be publishable. For an entry that is `planned`:
   - if its source candidate is now `verified` (`radar brief` / DB `verification`), run
     `radar script-check content/scripts/<id>.json`, then
     `radar produce content/scripts/<id>.json --out media/final` (about 3.5 min each), extract a frame at
     ~2.5 s and ~50% to look at it, check loudness (target −14 LUFS ±1.5), and set status `ready`;
   - if the owner rejected a fact (status `false`), drop the entry and pull the next approved story forward.
   Fill empty future dates from approved, unscheduled scripts (`content/scripts/2026-10-09-*.json` etc.).
   Prefer variety: don't put two stories of the same kind (e.g. two voice-clone calls) back to back.
4. **Notepad:** `PYTHONUTF8=1 .venv/Scripts/python.exe tools/upload_notepad.py` writes
   `media/upload/업로드_예정.txt` plus thumbnails. It exits non-zero if a scheduled video is missing.
5. **Fact-approval batch (only when needed):** if fewer than 5 future days are `ready` or approved
   and no approval request is still waiting, prepare the next batch of up to 7 stories:
   - pick on-topic candidates from today's report (`reports/radar_*.md`, ranking + Topic fit), skipping
     published/used source ids (`published` table, existing scripts) and off-topic items;
   - for each: a Korean fact sheet `content/week*/<video_id>.md` (claims → exact source URL, publisher, date,
     short quote; uncertainties; one prevention action) and a draft script
     `content/scripts/<yyyy-mm-dd>-<slug>.json` that passes `radar script-check --allow-unverified`.
     Use official/primary sources (경찰청, 금융감독원, KISA, 방통위, FBI/FTC, vendor statements) and open every URL.
     Parallel research agents are fine; review their work before using it;
   - write `media/upload/사실확인_요청_<yyyymmdd>.md` for the owner: per story 3–5 lines (what the video
     claims, the 1–3 key sources) and the exact approve command
     `PYTHONUTF8=1 .venv/Scripts/radar.exe verify <video_id> --status verified --source <url> --note "<짧게>"`
     and the reject command (`--status false`). Add the stories to `content/schedule.json` as `planned`.
6. **Commit and push** scripts, fact sheets, schedule and code changes (not media).
7. **Tell the owner** with one push notification (PushNotification, under 200 chars, Korean): today's video
   title and that `media/upload/업로드_예정.txt` is ready; plus "사실 확인 요청 N건" if a batch is waiting
   or a problem that needs them. Send the notepad and today's thumbnail with SendUserFile if available.
8. **Weekly (Mondays):** a short Korean review in `reports/weekly_<yyyymmdd>.md`: subscribers, views per
   video, which hooks/topics did best, and what to change in the next batch (topics, hook style, length).
