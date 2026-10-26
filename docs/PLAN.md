# Diorama: 5-day build plan

**Hacktoberfest 2026, Week 4 DEV Challenge.** Everything is in IST (Asia/Calcutta).
**Finish line: Friday 30 Oct, 6 PM. Submission is due Saturday 31 Oct, so you finish one day early.**

> No plan is foolproof. This one is built to survive failures: every day has an exit test
> and a fallback, and there is a cut list for when you run behind.

---

## 0. What you are building

**Diorama** turns an image (photo, sketch, logo, poster) into a small 3D website.

1. A **local vision model** through Ollama looks at the image and returns a scene description as JSON.
2. Plain code **validates and repairs** that JSON (small models often get JSON wrong).
3. A **generator** writes a one-page website with a rotating Three.js scene.

Why it fits the challenge: the open-weight model is the core, nothing leaves the laptop, and it
is a new repo started this week.

Honest limits to say in the post: it makes a *stylised scene from basic shapes*, not an
accurate 3D model of the object. Real image-to-3D (TripoSR, Hunyuan3D) needs a GPU and is out of scope.

## 1. Rules you must follow (from the DEV challenge hub)

- Repo must be **started inside Oct 26 to 31**. Do not copy code from SIYA or any old repo. Ideas are fine; code is not.
- One DEV post, using **that week's template** (theme is revealed when the challenge launches; check each morning).
- Credit anything borrowed (Three.js is MIT: say so). Using AI tools is allowed.
- Commits after the deadline must be noted in the README.
- You publish the post from **your own DEV account**.

## 2. Day-by-day schedule

| Day | Date | Goal | Exit test (must be true to move on) |
|---|---|---|---|
| 1 | Mon 26 Oct | Repo, schema, validator | `npm test` passes; repo public on GitHub today |
| 2 | Tue 27 Oct | Ollama vision client, repair, fallback | Tests pass against a fake server; one real call works |
| 3 | Wed 28 Oct | Generator: scene to website | Generated page opens in Live Server and shows the scene |
| 4 | Thu 29 Oct | CLI, real runs, README, screenshots | 3 real images give 3 working pages, saved as proof |
| 5 | Fri 30 Oct | Polish, DEV post, **publish** | Post is live and listed on the challenge page by 6 PM |
| Buffer | Sat 31 Oct | Emergencies only | No new features. Typos and broken links only |

Each day is about 3 to 4 hours. Do the **Hacktoberfest swag items** too (section 6), they take minutes.

---

## Day 1, Mon 26 Oct: foundation (about 3 hours)

**VS Code setup (once)**
1. Install Node.js 20+ and Ollama. Install the VS Code extensions **Live Server** (Ritwick Dey) and **Prettier**.
2. In a terminal: `ollama pull gemma3:4b` (vision-capable). Low on RAM (under 8 GB)? Use a smaller vision model from ollama.com/library (for example `moondream`).
3. Check Ollama works: `ollama run gemma3:4b "say hi"`.

**Create the project**
```bash
mkdir diorama && cd diorama
git init
npm init -y
npm pkg set type=module scripts.test="node --test"
npm install three            # only dependency; MIT licensed
mkdir -p src tests examples docs out
```
Create a **public GitHub repo** named `diorama` today and push (`git remote add origin ...`, `git push -u origin main`). A first commit dated today proves it started in the window.

**Write the plan and tickets into the repo.** Copy sections 2 to 5 of this file into `docs/PLAN.md`.

**Scene schema (test first).** Create `tests/schema.test.js` before `src/schema.js`:
- Valid scene passes through unchanged.
- Unknown shape is dropped. More than 12 objects are cut to 12.
- Colours must match `#rrggbb`; bad ones are replaced by a palette colour.
- Positions are clamped to -5..5 and sizes to 0.2..3.
- Title is trimmed to 60 characters; sections capped at 4.
- Empty or non-object input gives the **fallback scene** (a default preset), never a crash.

Then write `src/schema.js` (`validateScene(raw) -> scene`) until green. Commit: `test: scene schema` then `feat: scene validator`.

**Scene shape:**
```json
{
  "title": "Desk lamp landing page",
  "mood": "calm",
  "palette": { "background": "#101820", "primary": "#f2aa4c", "accent": "#e0e0e0" },
  "objects": [
    { "shape": "sphere", "color": "#f2aa4c", "position": [0, 0, 0], "size": 1.2, "animation": "float" }
  ],
  "sections": [ { "heading": "Warm light", "text": "Short description." } ]
}
```
Allowed: shape = box | sphere | cylinder | cone | torus. animation = none | spin | float | pulse.
mood = calm | energetic | dark | playful | elegant.

**Evening:** do the swag steps in section 6 (MyMLH sign-in, 10:30 PM livestream check-in).

**Fallback if stuck:** skip the clamps, keep only "valid or fallback". Add clamps on Day 2.

---

## Day 2, Tue 27 Oct: the model client (about 3 to 4 hours)

**Tests first** (`tests/ollama.test.js`), using a fake `fetch`, no real model:
- Request goes to `POST {host}/api/chat` with `stream: false`, the model name, the image as **base64** in `messages[].images`, and a JSON schema in `format`.
- Connection refused, HTTP error, missing model (404) and timeout each give a clear error message.
- URL handling: trim, strip trailing slash, add `http://`, reject other schemes.

**Repair tests** (`tests/repair.test.js`):
- Strips ```` ```json ```` fences. Extracts the first `{...}` from chatty text.
- Invalid JSON triggers **one retry** that includes the parse error in the prompt.
- Still invalid after the retry gives the fallback scene and a warning, never a crash.

**Then implement** `src/ollama.js`, `src/repair.js`, `src/prompt.js`.
Prompt rules for the model: "Describe the image as a simple 3D scene. Use only these shapes... Output only JSON matching the schema."
Ollama supports a JSON schema in `format` (structured outputs). If your Ollama version rejects it, update Ollama and note the version in the README.

**Exit test:** run once for real:
```bash
node src/cli.js examples/test1.jpg --print-json
```
(If the CLI is not built yet, use a short script.) A real scene JSON must come back and pass `validateScene`.

**Fallback if the vision model is poor:** try `qwen2.5vl` if your RAM allows, or simplify the prompt to colours + 3 shapes. Record which model you used.

---

## Day 3, Wed 28 Oct: the generator (about 3 to 4 hours)

**Tests first** (`tests/generate.test.js`):
- Output is a complete HTML document with the title and every section heading.
- **Escaping:** a title like `<script>alert(1)</script>` appears escaped, not as a tag. Model text is untrusted.
- No external URLs in the output (works offline); a `Content-Security-Policy` meta tag is present.
- Object count in the page equals the scene's object count; colours come from the validated scene only.

**Implement** `src/generate.js`: writes `out/<name>/index.html` and copies `node_modules/three/build/three.module.min.js` next to it.
Scene code uses an import map or a relative import of that file. Browsers block `file://` module imports, so you **open the page with the Live Server extension** (right-click `index.html` -> Open with Live Server).

Page requirements: dark/light background from `palette.background`, one mesh per object, simple lighting, slow auto-rotation, `animation` handled per object, responsive canvas, readable text sections.

**Exit test:** `node src/cli.js examples/test1.jpg` creates a page; Live Server shows it with moving objects.

**Fallback:** if animations are fiddly, ship `none` and `spin` only.

---

## Day 4, Thu 29 Oct: real runs and proof (about 3 to 4 hours)

1. Finish the CLI: `node src/cli.js <image> [--model gemma3:4b] [--host http://localhost:11434] [--out out/name] [--print-json]`. Exit code 2 and a readable message on bad input. **Test the CLI with an injected fake model** like earlier projects.
2. Run it on **3 to 5 real images** you own or that are public domain: a hand sketch, a product-style photo, a logo you made. No third-party logos.
3. For each run save: the input image, the JSON the model returned, the validated scene, a screenshot of the page.
4. Note **what went wrong** (bad JSON, odd shapes, wrong colours). Judges like honest failure notes, and this is your best writing material.
5. Write the README with real commands, real output, limits, the model used, Ollama version, credits (Three.js, MIT).
6. Record a 20 to 30 second screen capture (the VS Code Live Server window is fine).

**Exit test:** a clean clone works: `git clone`, `npm install`, `npm test`, run the CLI, open the page.

**Cut list if behind (cut in this order):** extra CLI flags, pulse animation, second template, the screen recording (use screenshots).

---

## Day 5, Fri 30 Oct: ship it (done by 6 PM)

**Morning (9 to 12)**
- Re-read the challenge page: the **Week 4 theme and submission template** should be visible now. Note required tags and any extra fields.
- Final `npm test`. Fix only real bugs. No new features.
- Tag a release: `git tag v0.1.0 && git push --tags`.

**Midday (12 to 3): write the DEV post** using the official template. Outline:
1. One-line pitch + who it is for.
2. Demo: before image, after page, short capture or GIF.
3. **Why open-weight matters here** (offline, private images, swappable model).
4. How it works (the 3 steps), with one code snippet.
5. What went wrong and how validation/repair fixed it.
6. Honest limits: stylised scene, not a real mesh.
7. Credits: Three.js (MIT), Ollama and the model you used, anything else borrowed.
8. Repo link and run instructions.
9. Teammates, if any, listed by DEV handle.

Writing quality is weighted most. Write it in your own words and voice; short sentences and real details beat a polished tone.

**Afternoon (3 to 6): publish.** Publish the post from your DEV account, open the challenge page and check the submission is recognised. Fix any template mistakes.
**Done by 6 PM.** Evening is free.

## Saturday 31 Oct: buffer
Only broken links, typos or a failed submission. Any commit after the deadline must be noted in the README.

---

## 3. Architecture

```
image -> ollama.js (vision model, JSON schema) -> repair.js -> schema.js (validate) -> generate.js -> out/<name>/index.html
                                                               ^ fallback scene on any failure
```

## 4. Test list (all runnable without a real model)

| Module | Tests |
|---|---|
| schema | valid passes, clamps, bad colours, unknown shapes, caps, empty input -> fallback |
| ollama | request shape, base64 image, errors, timeout, URL normalisation |
| repair | fences, chatter, one retry, fallback after failure |
| generate | escaping, no external URLs, CSP, object count, section headings |
| cli | fake model, bad file, missing model, exit codes |

Break the code on purpose once (change a clamp, drop the escaping) and confirm a test fails.

## 5. Risks and fixes

| Risk | Fix |
|---|---|
| Model returns invalid JSON | JSON schema in `format` + repair + one retry + fallback |
| Model too slow or no GPU | Smaller model (4B or less), 90 s timeout, say the speed in the README |
| Ollama CORS or version issues | CLI calls Ollama from Node, not from the browser, so CORS does not apply |
| Live Server blocks `file://` modules | Always use Live Server; document it |
| Model text contains HTML/JS | Escape everything, validate colours, never include model URLs |
| Behind schedule | Use the cut list; Day 5 morning is the last point to cut |
| Theme revealed later than expected | The prompt is general; fit the write-up to the theme on Day 5 |

## 6. Hacktoberfest swag (separate from the build, about 15 minutes)

1. **Today:** sign in at hacktoberfest.com with MyMLH and add your address (you do this; first 2 stickers per the site).
2. **Today, 10:30 PM IST:** join the livestream "Build an Open-Source AI Assistant Using Stagehand" and enter the on-screen code (third sticker).
3. Backup check-ins: Wed 28 Oct 7:30 PM and 10:30 PM, Fri 30 Oct 10:30 PM (times as shown on the schedule page; confirm the time zone selector says IST).
4. Check your sticker book after each step. Stickers ship 8 to 12 weeks after Hacktoberfest ends.

## 7. Definition of done

- [ ] Public repo started on or after 26 Oct, with history
- [ ] `npm test` passes on a clean clone
- [ ] 3 real runs with saved proof
- [ ] README has real output, limits, model and Ollama version, credits
- [ ] DEV post published with the official template, visible on the challenge page
- [ ] Done by Fri 30 Oct, 6 PM
