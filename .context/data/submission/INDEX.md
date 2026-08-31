# Submission Package Index

AURA's Devpost submission package lives in `.context/data/submission/`.
Each file covers one section of the Devpost entry; the long-form
Devpost description is `README.md` in this directory.

## Files (in Devpost field order)

| # | File | Devpost field / purpose |
| --- | --- | --- |
| 00 | `00-title-and-tagline.md` | Project title + tagline |
| 01 | `01-problem-and-motivation.md` | Problem / motivation |
| 02 | `02-what-aura-does.md` | What AURA does |
| 03 | `03-ten-agent-crew.md` | How the 10-agent crew works |
| 04 | `04-webmcp-usage.md` | How WebMCP is used |
| 05 | `05-human-veto.md` | Human Veto story |
| 06 | `06-technical-implementation.md` | Technical implementation |
| 07 | `07-demo-instructions.md` | Demo instructions (90s run sheet) |
| 08 | `08-built-with.md` | Built-with technologies |
| 09 | `09-screenshots.md` | Screenshots / thumbnail |
| 10 | `10-demo-video.md` | Demo video script + recording notes |
| 11 | `11-required-hackathon-questions.md` | **The 4 required Devpost narrative fields** |
| 12 | `12-positioning.md` | **The leading one-liner + proof chain** |
| — | `README.md` | Long-form Devpost description (paste-ready) |

## Build-stage evidence (executed, not claimed)

| Pause | Gates | Acceptance tests | Evidence |
| --- | --- | --- | --- |
| 1 — End-to-end production | 1a + 1b + 1c + 1d + 1e | 38 / 38 PASS | `/tmp/pause1.log` |
| 2 — Human Veto + recovery + external | 2a + 2b | 15 / 15 PASS | `/tmp/pause2.log` |
| 3 — Final demo / submission readiness | 3 | 11 / 11 PASS | `/tmp/pause3.log` |
| **TOTAL** | **8 gates** | **64 / 64 PASS** | `/tmp/final_build_mode_v3.log` |</oldString>

Run the harness yourself:

```bash
bash scripts/verify/build-mode.sh           # full run with 3 strategic pauses
bash scripts/verify/build-mode.sh --no-pause # fire-and-forget
```
