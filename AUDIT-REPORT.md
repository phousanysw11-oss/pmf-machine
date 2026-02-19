# PMF Machine — Spec Audit Report

Audit date: 2025-02-18. Each spec item is marked **Working**, **Broken**, or **Missing**, with fixes for failures.

---

## Flow 1 (Pain)

| Spec | Status | Notes |
|------|--------|--------|
| Text input with 10-char minimum | **Working** | Enforced in Flow1Client |
| AI generates 3 rephrased versions | **Working** | flow1 API returns 3 options |
| Can select a version | **Working** | Selection state and UI |
| Confidence question appears | **Working** | CUSTOMERS / OBSERVED / GUESS |
| GUESS shows -5 penalty warning | **Working** | Warning text and penalty applied |
| Can lock the flow | **Working** | Lock with confirm |
| Locked state prevents editing | **Working** | Read-only view when locked |

---

## Flow 2 (Customer)

| Spec | Status | Notes |
|------|--------|--------|
| Blocked until Flow 1 locked | **Working** | flow2/page checks flow 1 locked |
| AI generates 3 customer profiles | **Working** | flow2 API |
| Can select or write custom | **Working** | Select or custom text |
| Confidence tracked | **Working** | Stored in data |
| Can lock | **Working** | Lock with confirm |

---

## Flow 3 (Solution)

| Spec | Status | Notes |
|------|--------|--------|
| Blocked until Flow 2 locked | **Working** | flow3/page checks flows 1–2 locked |
| AI generates 3 challenges | **Working** | flow3 API |
| Must defend each challenge | **Working** | Defend each, then rate |
| AI rates defense STRONG/WEAK/NONE | **Working** | flow3 API returns rating |
| Override path with -15 penalty | **Working** | Override applies -15 |
| Can lock | **Working** | Lock with confirm |

---

## Flow 4 (Price)

| Spec | Status | Notes |
|------|--------|--------|
| 3 price scenarios generated | **Working** | flow4 API |
| Honesty gate question | **Working** | honesty_question + evaluation |
| Contradiction detection | **Working** | CONTRADICTED state and path |
| Margin preview calculation | **Working** | Table with cost % and verdict |
| Early kill if no viable margin | **Working** *(fixed)* | When best margin < 30%, "No viable margin" alert with "Kill product" and "Choose different price"; "Continue to confirm" hidden |
| Can lock | **Working** | Lock from CONFIRM |

---

## Flow 5 (Channel)

| Spec | Status | Notes |
|------|--------|--------|
| Channel recommendations | **Working** | flow5 API |
| Capability checklist | **Working** | Checklist in UI |
| Gap classification | **Working** | Gap types and display |
| Cumulative penalty display | **Working** | Penalties shown |
| Scouting brief generated | **Working** | Brief from API / state |
| Can lock | **Working** | Lock with confirm |

---

## Flow 7 (Experiment)

| Spec | Status | Notes |
|------|--------|--------|
| Uncertainty ranking works | **Working** | Rank uncertainties, select one |
| AI designs one experiment | **Working** | flow7 API returns spec |
| Execution check question | **Working** | "Can you execute?" path |
| Simplification path | **Working** | "Can't execute" → simpler design |
| Can start experiment with timer | **Working** | startNow sets started_at; time_limit_hours in spec. *Note: No countdown UI — only started time and limit in text.* |
| Record Results link | **Working** *(fixed)* | Now links to `/products/[id]/flow6?experimentId=expId` (was 404 `/experiments/[expId]`). Flow 6 page uses `experimentId` from query when provided. |

---

## Flow 8 (Assets)

| Spec | Status | Notes |
|------|--------|--------|
| 3 ad variants generated | **Missing** | No Flow 8 route, API, or page |
| Can select/combine/edit | **Missing** | — |
| Checklist generated | **Missing** | — |
| Price included in all variants | **Missing** | — |

**Fix:** Implement Flow 8 per spec: add `flow8` page and `api/ai/flow8` (or equivalent) with 3 ad variants, select/combine/edit, checklist, and price in all variants. Alternatively document as out of scope.

---

## Flow 6 (Signals)

| Spec | Status | Notes |
|------|--------|--------|
| Can input experiment data | **Working** | Flow 6 form and API |
| Vanity metrics auto-classified as NOISE | **Working** | signals.ts / flow6 API |
| Rule-based pre-filter works | **Working** | classifyByRules in signals |
| AI classifies remaining | **Working** | AI classification for non-noise |
| Signal quality score displayed | **Working** | e.g. SUMMARY as X/100 |

*Note: Flow 6 is experiment-scoped; product-level flow_data for flow 6 may not persist. Flow 10 can use signal_quality_score from flow 6 data when that row exists.*

---

## Flow 9 (Results)

| Spec | Status | Notes |
|------|--------|--------|
| Gates evaluated correctly | **Working** | gates.ts used by flow9/flow10 |
| AI recommendation generated | **Working** | flow9 API |
| Can approve or override | **Working** | Approve vs override UI |
| Override penalty applied | **Working** *(fixed)* | Override penalty stored on decision; **scoring now includes it** (see Cross-cutting) |
| Routes to correct next step | **Working** | Links to flow10 / killed / product |

---

## Flow 10 (Verdict)

| Spec | Status | Notes |
|------|--------|--------|
| PMF score computed correctly | **Working** *(fixed)* | Decision override penalties now included in total |
| All components scored | **Working** | Foundation, experiment, consistency, penalties, modifiers |
| Hard kill conditions checked | **Working** | checkHardKills in scoring.ts |
| Verdict displayed with breakdown | **Working** | Flow10Client shows breakdown |
| Routes to scale/fix/kill | **Working** | PMF_CONFIRMED → product; PMF_PARTIAL → flow7; NO_PMF → killed |

---

## Cross-cutting

| Spec | Status | Notes |
|------|--------|--------|
| Data persists in Supabase | **Working** | flow_data, experiments, decisions, etc. |
| Navigation between flows works | **Working** | Links and flow stepper |
| Flow dependencies enforced | **Working** | Each flow page checks prior locks |
| Penalties accumulate correctly | **Working** *(fixed)* | `sumPenalties()` in scoring.ts now includes Flow 9 decision `override_penalty` (was 0); still capped at -40 total |
| Mobile responsive | **Working** | Responsive layout/Tailwind |
| Loading states on all AI calls | **Working** | Loading spinners / states in clients |
| Error handling on all API calls | **Working** | Error states and messages in UI |

---

## Fixes applied in this audit

1. **Scoring — decision override penalties**  
   **Issue:** `sumPenalties()` in `src/lib/scoring.ts` only used `flow_data.penalties`; Flow 9 override penalties were never included.  
   **Fix:** `sumPenalties(flowData, decisions)` now adds each decision’s `override_penalty` to the total and to `penalty_sources` (as flow 9), with the same -40 cap.

2. **Flow 4 — early kill when no viable margin**  
   **Issue:** No "early kill if no viable margin" path; user could always "Continue to confirm."  
   **Fix:** In Flow4Client, when best margin in the preview table is < 30%, show "No viable margin" alert, "Kill product" (link to `/products/[id]/killed`), and "Choose different price" (back to SELECTION); "Continue to confirm" is hidden in that case.

3. **Flow 7 — Record Results 404**  
   **Issue:** "Record Results" linked to `/products/[id]/experiments/[expId]`, which does not exist.  
   **Fix:** Link changed to `/products/[id]/flow6?experimentId=expId`. Flow 6 page updated to use `searchParams.experimentId` when provided, so the correct experiment is loaded.

4. **Flow 8**  
   **Issue:** Entire flow missing.  
   **Fix:** Not implemented; either add Flow 8 per spec or document as out of scope (this report documents it as missing).

---

## Summary

- **Flows 1–7, 9, 10:** All listed spec items are working after the above fixes.
- **Flow 8:** Fully missing (no route/API/page).
- **Cross-cutting:** All items working; penalty accumulation fixed to include Flow 9 override penalties.
