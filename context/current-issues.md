# Current Issues & PR1 Verification Log

Tracker for in-flight UI work. Issues at the top, verified-pass items at the bottom.

---

## Open Issues

### LCP performance — login page (5.55s, poor)
- **Symptom**: Local LCP measured at 5.55 s. INP 8 ms (good), CLS 0 (good). Last measured before the round-7 typography pass; expected to be *worse* now (see below).
- **Cause (current — post round-7 typography pass)**: webfont payload grew. The entry CSS now imports 4 Fontsource variable families (`geist`, `geist-mono`, `roboto`, `montserrat`) and declares 14 `@font-face` rules pointing at local `.otf` files for Founders Grotesk (10 weights/styles incl. 2 condensed variants) + Spock ESS Bold. Combined with the 1.6 MB single JS bundle, the meteors/border-beam paint still can't start until everything resolves.
- **Plan**:
  - (a) Drop the `.otf` files in favor of subset `.woff2` (≈50% size reduction). Only ship the weights actually used — initial audit: Founders Regular/Medium/Semibold/Bold + Spock Bold cover the existing pages; Light/Italic/Condensed/XCondensed variants can be deferred until a callsite needs them.
  - (b) Drop fontsource's full-language CSS in favor of latin + latin-ext only for all four variable families.
  - (c) Preload the LCP-critical fonts via `<link rel="preload" as="font" type="font/woff2" crossorigin>` (Spock Bold + Founders Bold for headings, Geist 400 for body).
  - (d) Lazy-route the authenticated routes via `React.lazy` so `/login` ships its own small chunk.
  - (e) Move Meteors render behind an `IntersectionObserver`/`requestIdleCallback` so it doesn't compete with LCP.
- **Owner**: PR1.5 (perf pass — separate small PR before PR2 dashboards merge).

---

## Resolved (fixed this session)

### Meteor tail direction — was reversed
- **Symptom**: tail leading the dot instead of trailing it.
- **Cause**: tail span had its own `rotate(215deg)` on top of the parent's animated rotation. Parent rotates 215° from the animation; child re-rotated another 215° → tail pointed bottom-right in screen instead of up-right.
- **Fix**: removed the inner `rotate(215deg)` from the tail's transform. The tail now extends rightward in the parent's local frame, which becomes up-and-right in screen coords after the 215° animation rotation — i.e. trailing behind the falling dot.
- **File**: [meteors.tsx](src/components/ui/magicui/meteors.tsx).

### Border beam misaligned on sign-in button
- **Symptom**: beam appeared rounded while the button looked square — visible offset between the beam and the button's edges.
- **Cause**: BorderBeam was rendered as a sibling inside a separate wrapper `<div>`. Shadcn Button's own focus/active styles slightly shifted the visible rect away from the wrapper's bounding box.
- **Fix**: mounted BorderBeam *inside* the Button as a child, with `relative overflow-hidden` on the button. The beam now inherits the button's exact `rounded-md` and traces its real border.
- **File**: [LoginPage.tsx](src/pages/auth/LoginPage.tsx).

---

## Verified Pass — PR1 manual verification

| # | Check | Status |
|---|---|---|
| 1 | Dev server starts; login page renders | Pass |
| 2 | Meteors render across page (after tail fix above) | Pass |
| 3 | Theme toggle (dark default, persists, sun/moon swap) | Pass |
| 4 | DotPattern background visible in AppShell | Pass |
| 5 | `prefers-reduced-motion` disables Meteors / BorderBeam loop / WordFadeIn | Pass |
| 6 | No regressions on Employee / Manager / Admin dashboards | Pass |
| 7 | `npm test` → 17/17 pass | Pass |
| 8 | `npm run build` + `npm run preview` clean | Pass |

Pre-existing build warnings from `tw-animate-css` (`@utility` rule unknown to lightningcss) are not introduced by this PR — safe to ignore.
