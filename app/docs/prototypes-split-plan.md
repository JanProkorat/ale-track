Split HTML Prototypes into Maintainable Source Files

     Context

     docs/mobile_prototype.html has grown to 5,748 lines / 385 KB with 22 self-contained iOS scenes inside one
     monolithic file. Editing, searching, and reviewing a single scene requires scrolling through thousands of
     unrelated lines. The two sibling prototypes have the same problem at smaller scale (trainer_prototype.html
      1,414 lines, notion_portal.html 2,400 lines).

     Goal: split each prototype into small source files (one per scene + shared CSS/JS) while keeping the
     viewing story unchanged — the committed *.html artifact should continue to open directly in a browser with
      all interactivity intact, so nothing downstream (PROGRESS.md references, design reviews, the
     prototype-scene skill) needs a new runtime.

     Chosen approach (confirmed with user): build-time concatenation, one source file per scene, applied to all
      three prototypes.

     Approach

     For each prototype, create a docs/<name>/ source directory and a tiny Node build script that concatenates
     sources back into the original top-level docs/<name>.html. The built file is committed so git clone → open
      HTML still works without running anything.

     Source layout

     All source files live under a single new folder docs/prototypes/, one sub-directory per prototype. Built
     HTML artifacts stay at their current top-level paths (docs/mobile_prototype.html,
     docs/trainer_prototype.html, docs/notion_portal.html) so every existing bookmark, PROGRESS.md reference,
     and design review link keeps working.

     docs/prototypes/
       build.mjs                  ← single build script for all three prototypes
       mobile/
         index.html               ← template shell with <!-- include: ... --> markers
         styles/
           tokens.css             ← :root vars + .dark override (lines 78–114 today)
           layout.css             ← phone shell, status bar, tab bar, #pnav
           components.css         ← .ios-*, .meal-*, .trainer-*, etc.
         scripts/
           nav.js                 ← showPhone(), toggleNavGroup(), nav label map
           state.js               ← setCollabState, setPendingPlans, setWaitingState, renderWeightUI
           weight.js              ← weight tracking module (date picker, history)
           detail.js              ← food/recipe detail language switching
         scenes/                  ← 22 files, one per ph-* scene
           today.html
           discover.html
           plans.html
           plan-history.html
           plan-detail-complete.html
           pending-questionnaires.html
           profile.html
           messages.html
           archive.html
           chat.html
           chat-former.html
           trainer-profile.html
           invite-detail.html
           onb-intro.html
           onb-s1.html
           onb-s2.html
           onb-summary.html
           onb-success.html
           nutrition-plan-detail.html
           food-detail.html
           recipe-detail.html
           training-plan-detail.html
       trainer/
         index.html
         styles/ { tokens.css, layout.css, components.css }
         scripts/ { nav.js, state.js }
         scenes/ { …~10 ph-* scenes… }
       notion/
         index.html
         styles/ { tokens.css, layout.css, components.css }
         scripts/ { nav.js, sidebar.js, state.js }
         scenes/ { …s-* scenes… }       ← notion uses showScreen() + .active, not showPhone()

     Each scenes/*.html contains exactly the scene block — <div class="phone" id="ph-..."
     style="display:none">…</div> for mobile/trainer, <div id="s-..." class="screen">…</div> for notion. No
     wrapper markup. Scene IDs (ph-*, s-*) and nav call sites (showPhone('ph-...'), showScreen('s-...')) stay
     identical so the prototype-scene skill and any bookmarks keep working.

     Template format

     index.html is the output skeleton with include directives the build script understands:

     <!DOCTYPE html>
     <html lang="cs">
     <head>
       <meta charset="utf-8">
       <link rel="preconnect" href="https://fonts.googleapis.com">
       <!-- …existing <head> chrome from current file… -->
       <style>
         <!-- include: styles/tokens.css -->
         <!-- include: styles/layout.css -->
         <!-- include: styles/components.css -->
       </style>
     </head>
     <body>
       <nav id="pnav"> <!-- existing nav markup --> </nav>
       <div id="stage">
         <!-- include: scenes/today.html -->
         <!-- include: scenes/discover.html -->
         <!-- …22 scene includes in current document order… -->
       </div>
       <script>
         <!-- include: scripts/nav.js -->
         <!-- include: scripts/state.js -->
         <!-- include: scripts/weight.js -->
         <!-- include: scripts/detail.js -->
       </script>
     </body>
     </html>

     Order of scene includes preserves the current DOM order so nav-button layout and any
     document-order-sensitive behavior (first scene visible, etc.) is unchanged.

     Build script

     File: docs/prototypes/build.mjs (one script for all three prototypes)

     ~40 lines of plain Node (ESM, no deps):

     import { readFile, writeFile } from 'node:fs/promises';
     import { resolve } from 'node:path';

     const prototypes = [
       { src: 'mobile',  out: 'mobile_prototype.html' },
       { src: 'trainer', out: 'trainer_prototype.html' },
       { src: 'notion',  out: 'notion_portal.html' },
     ];

     const INCLUDE_RE = /<!--\s*include:\s*(\S+?)\s*-->/g;
     const PROTO_DIR  = resolve('docs', 'prototypes');
     const OUT_DIR    = resolve('docs');

     async function build({ src, out }) {
       const root = resolve(PROTO_DIR, src);
       const template = await readFile(resolve(root, 'index.html'), 'utf8');
       const expanded = await expand(template, root);
       const banner = `<!-- GENERATED from docs/prototypes/${src}/ — do not edit by hand. Run: node
     docs/prototypes/build.mjs -->\n`;
       await writeFile(resolve(OUT_DIR, out), banner + expanded);
       console.log(`✓ built docs/${out}`);
     }

     async function expand(text, root) {
       const parts = [];
       let last = 0;
       for (const m of text.matchAll(INCLUDE_RE)) {
         parts.push(text.slice(last, m.index));
         parts.push(await readFile(resolve(root, m[1]), 'utf8'));
         last = m.index + m[0].length;
       }
       parts.push(text.slice(last));
       return parts.join('');
     }

     for (const p of prototypes) await build(p);

     Add a root-level npm script in the existing package.json (root workspace, not web/ or mobile/):
     "build:proto": "node docs/prototypes/build.mjs". If no root package.json exists, the command stays node
     docs/prototypes/build.mjs — no setup required, Node is already a dev dependency via web/mobile.

     The first line of each built file is a <!-- GENERATED … --> banner pointing at the source directory so
     anyone opening the file in an editor sees the warning immediately.

     Migration mechanics (one-time, per prototype)

     1. Create docs/prototypes/<name>/ directory tree.
     2. Copy design tokens block → styles/tokens.css (strip surrounding <style> tags).
     3. Copy remaining CSS rules → styles/layout.css + styles/components.css (split on comment-delimited
     sections already present in the file).
     4. Copy each scene block → scenes/<scene>.html (<div class="phone" id="ph-X">…</div> for mobile/trainer,
     <div id="s-X" class="screen">…</div> for notion).
     5. Copy JS into modules matching the comment sections already in the existing <script> block.
     6. Create index.html template with include markers.
     7. Run the build; byte-diff the output against the pre-refactor file to confirm zero semantic change (only
      whitespace / the banner line should differ).
     8. Commit source tree + regenerated artifact together.

     Related file updates

     - .claude/skills/prototype-scene/SKILL.md — update "where to add scenes" instructions to point at
     docs/prototypes/<name>/scenes/ and mention running node docs/prototypes/build.mjs after edits. Keep the
     existing wiring contract (scene IDs, nav buttons, token rules) verbatim — it still applies.
     - docs/PROGRESS.md — add entry at end per project convention.

     Key files to modify / create

     ┌─────────────────────────────────────────┬─────────────────────────────────────────────────┐
     │                  Path                   │                     Action                      │
     ├─────────────────────────────────────────┼─────────────────────────────────────────────────┤
     │ docs/prototypes/build.mjs               │ Create                                          │
     ├─────────────────────────────────────────┼─────────────────────────────────────────────────┤
     │ docs/prototypes/mobile/**               │ Create (template + 3 CSS + 4 JS + 22 scenes)    │
     ├─────────────────────────────────────────┼─────────────────────────────────────────────────┤
     │ docs/prototypes/trainer/**              │ Create (same structure, ~10 scenes)             │
     ├─────────────────────────────────────────┼─────────────────────────────────────────────────┤
     │ docs/prototypes/notion/**               │ Create (same structure, showScreen() variant)   │
     ├─────────────────────────────────────────┼─────────────────────────────────────────────────┤
     │ docs/mobile_prototype.html              │ Replace with generated output (same path)       │
     ├─────────────────────────────────────────┼─────────────────────────────────────────────────┤
     │ docs/trainer_prototype.html             │ Replace with generated output (same path)       │
     ├─────────────────────────────────────────┼─────────────────────────────────────────────────┤
     │ docs/notion_portal.html                 │ Replace with generated output (same path)       │
     ├─────────────────────────────────────────┼─────────────────────────────────────────────────┤
     │ .claude/skills/prototype-scene/SKILL.md │ Update to reference source dirs + build command │
     ├─────────────────────────────────────────┼─────────────────────────────────────────────────┤
     │ package.json (root, if exists)          │ Add build:proto script                          │
     └─────────────────────────────────────────┴─────────────────────────────────────────────────┘

     Reused patterns / no new conventions

     - CSS custom properties / design tokens — unchanged (--ios-*, --bg, etc.).
     - showPhone(id) / showScreen(id) — unchanged function names and call sites.
     - Scene IDs (ph-*, s-*) — unchanged.
     - iOS status bar + tab bar chrome — copied verbatim into layout.css.
     - No new runtime dependencies, no bundler, no framework.

     Verification

     1. Byte-equivalence check (strongest signal). Before deleting the old monolith, stash it as
     mobile_prototype.html.bak, run the build, then diff <(sed '/^<!-- GENERATED/d' docs/mobile_prototype.html)
      docs/mobile_prototype.html.bak. Whitespace-only differences are acceptable; any structural diff is a bug
     in the split. Repeat for trainer and notion.
     2. Manual scene walkthrough. Open each built docs/*.html in a browser and click every nav button; confirm
     each scene appears, the active nav highlight updates, and scene-internal interactions (weight picker on
     ph-today, language switch on ph-food-detail/ph-recipe-detail, acceptInvite, archiveConv, toggleQAnswers,
     onboarding step transitions, setCollabState/setPendingPlans/setWaitingState state toggles) still work.
     3. Dark mode. Toggle the .dark class on <body> via DevTools and confirm tokens still apply across all
     scenes.
     4. Source-edit round-trip. Edit one scene file (e.g. change a label in scenes/today.html), run node
     docs/build-prototypes.mjs, reload the browser, confirm the change appears and no other scene is affected.
     5. Skill sanity check. Follow the updated prototype-scene skill end-to-end to add a throwaway scene,
     confirm the skill's instructions still produce a working scene with the new layout, then revert.
