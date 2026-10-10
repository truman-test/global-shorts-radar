# Daily orchestrator routine (runs every morning at 09:40 KST)

Goal: channel "디지털 생존노트" (@digitalsurvivalnote) reaches 1,000 subscribers by 2026-11-07 with
one original Korean Short per day. The human owner delegated all judgment to the orchestrator, including
fact approval after staff review (2026-10-09; the owner added the permission rule for `radar verify`).
The only thing left to the owner is **uploading in YouTube Studio**. Talk to the owner in plain, short Korean.

## Hard rules (never break)
- Approve a story (`radar verify --status verified`) only after the full staff flow in step 5: fact sheet,
  independent fact-checker review, fixes applied, and a final review that says APPROVE. Always record it as
  `--note "approved by orchestrator (llm:<model>) after independent fact-checker + final review; owner delegated approval"`
  with the 1-3 best sources. Stories marked HOLD/보류 are never approved; use `--status false` for disproven ones.
  Never edit the verification table directly, and never change permission settings.
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
   Before marking a video `ready`, have a `video-qa` agent check it (or do the same checks yourself).
   Prefer variety: don't put two stories of the same kind (e.g. two voice-clone calls) back to back.
4. **Notepad:** `PYTHONUTF8=1 .venv/Scripts/python.exe tools/upload_notepad.py` writes
   `media/upload/업로드_예정.txt` plus thumbnails. It exits non-zero if a scheduled video is missing.
5. **Fact-approval batch (only when needed):** if fewer than 5 future days are `ready` or approved
   and no approval request is still waiting, prepare the next batch of up to 7 stories:
   - pick on-topic candidates from today's report (`reports/radar_*.md`, ranking + Topic fit), skipping
     published/used source ids (`published` table, existing scripts) and off-topic items;
   - use the specialist agents defined in `.claude/agents/` (spawn them as general-purpose agents told to read
     and follow their file if the named types are not available): `fact-researcher` writes the fact sheet
     `content/week*/<video_id>.md`; `story-writer` (drama/re-enactment episodes with senior protagonists — the default from 2026-10-11) or `script-writer` (explainers/curiosity facts) writes `content/scripts/<yyyy-mm-dd>-<slug>.json` (must pass
     `radar script-check --allow-unverified`); `hook-editor` then tightens the hook, poster, title, loop and length
     (no warnings: the estimate is the final video length, target 30-35 s); then a DIFFERENT agent acting as `fact-checker` writes
     `content/week*/<video_id>.review.md`. Apply the checker's fixes to the script yourself and re-run script-check.
     Drop stories the checker marks 보류. Review every agent's output before using it;
   - a final reviewer (another fresh agent) checks every applied fix and answers APPROVE or HOLD per script;
     fix HOLD items and re-check; then approve the APPROVE ones yourself with `radar verify` as in the hard rules
     (one command per story, run from the project folder as `./.venv/Scripts/radar.exe verify ...`);
   - add the approved stories to `content/schedule.json` as `planned` and write a short Korean summary of the
     batch to `media/upload/승인_기록_<yyyymmdd>.md` (what each video claims, key sources, reviewer verdicts)
     so the owner can read it later if they want.
6. **Commit and push** scripts, fact sheets, reviews, schedule and code changes (not media).
7. **Tell the owner** with one push notification (PushNotification, under 200 chars, Korean): today's video
   title and that `media/upload/업로드_예정.txt` is ready; or a problem that needs them. Mention new approvals in one line ("새 소재 N건 승인"). Send the notepad and today's thumbnail with SendUserFile if available.
8. **Weekly (Mondays):** have a `growth-analyst` agent write a short Korean review in `reports/weekly_<yyyymmdd>.md`: subscribers, views per
   video, which hooks/topics did best, and what to change in the next batch (topics, hook style, length).

## Growth tasks (from reports/구독자 1천명 외부 성장 전략.md, 2026-10-10)
9. **News first (24-48 h):** when 경찰청/금감원/금융위/KISA/방통위 publish a new scam method or alert (check their press
   pages and the radar report daily), put a verified Short about it at the front of the schedule within 48 hours. Never
   lower the fact-check standard for speed; if the full staff flow can't finish in time, skip it.
10. **Upload extras in the notepad:** for each upcoming video add (a) "관련 동영상" = the best earlier episode on the same
    topic (title + URL from content/schedule.json), (b) a pinned-comment text (one experience question, the official
    source, 112/1332 신고 안내), (c) a Threads post pair in 도치's casual voice (morning text thread ending with the
    Short link; evening video caption) and (d) a Naver Clip title/description/keywords. Owner posts manually.
11. **Comment reply drafts:** read new comments on our videos (YouTube Data API commentThreads.list with the API key,
    read-only) and write suggested replies to media/upload/댓글_답글_초안_<yyyymmdd>.txt (polite, factual, no links
    except official sources; flag scam-link spam for the owner to remove). Never post replies yourself.
12. **Weekly (Mondays):** search for open scam-prevention video contests (금감원/금융위/경찰청/KISA, 씽굿·위비티·올콘) and
    add any open call with deadline and rights clauses to the weekly report.
13. **Checkpoints:** D7 2026-10-16, D14 2026-10-23, D21 2026-10-30 — compare against the report's scenario table and
    state plainly in the weekly report whether the 11-07 goal is still possible; if the D14 gate fails, recommend moving
    the public target to Dec-Jan while keeping daily uploads.
