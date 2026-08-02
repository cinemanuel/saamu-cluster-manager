# Design System — Saamu Cluster Manager

This is the source of truth for the app's visual language: color tokens, typography, the rotation-ring component, and the reasoning behind them. It exists so future work stays consistent without re-deriving these decisions from scratch.

**Status:** Locked in for the Entry 10 visual design pass (July 2026), extended by the elevation/hierarchy polish pass that followed it. Applies to the whole app going forward.

## Principles

**Fast.** This is a low-bandwidth-conscious tool built for coordinators on Nigerian mobile networks, not a showcase app. Every design decision is weighed against load cost and rendering simplicity first.

This is why typography uses **Inter only** — for headings and body/data alike. A second display typeface is an extra font file to download, an extra flash-of-unstyled-text window, and extra decisions about which face wins in a given context. Hierarchy comes from **weight and size**, not a second typeface:

- Page titles: `font-semibold`, larger size (`text-xl`/`text-2xl`)
- Section headings: `font-medium`, small-caps-adjacent treatment via size (`text-sm`), muted color
- Body/data: `font-normal`, base size
- Stat values (e.g. a payout figure, a paid/late count): `text-lg font-semibold` — a deliberate step up from its own label, not just heavier weight at the same size (see [Typographic scale](#typographic-scale))

**Meaningful color, not decoration.** Every color in this system maps to something real about the data (a payment is genuinely paid, a position genuinely holds the active turn) — never applied for visual variety alone.

## Color tokens

Defined as CSS custom properties in `app/globals.css`, exposed to Tailwind via `@theme`. Forced light mode only (see [Dark mode](#dark-mode) below).

| Token | Hex | Tailwind class (proposed) | Usage |
|---|---|---|---|
| `--color-bg` | `#FAF8F5` | `bg-bg` | Page background |
| `--color-surface` | `#FFFFFF` | `bg-surface` | Elevated content: cards, tiles, tables, the nav bar, standalone forms. Always paired with `border-border` + `shadow-sm` (see [Elevation](#elevation--surfaces)) |
| `--color-ink` | `#1A1A18` | `text-ink` | Primary text |
| `--color-primary` | `#1F6E4A` | `bg-primary` / `text-primary` | Trust accent — confirmed/paid/positive actions, primary buttons |
| `--color-primary-hover` | `#164E35` | `hover:bg-primary-hover` | Primary button hover state — same hue/saturation as primary, darkened 8% lightness |
| `--color-primary-active` | `#0D2E1F` | `active:bg-primary-active` | Primary button press state — darkened 16% lightness |
| `--color-accent` | `#C08A2E` | `bg-accent` | Status accent — "active turn / needs attention." **Badge fills only, never as plain text** (see [Contrast](#contrast-verification)) |
| `--color-danger` | `#C0392B` | `text-danger` / `bg-danger` | Late/overdue payments only. Used sparingly — this is a warning color, not a general error color |
| `--color-border` | `#E5E1DA` | `border-border` | Decorative borders/dividers only (table rows, card edges) — fails non-text contrast, deliberately, see below |
| `--color-border-strong` | `#988E7C` | `border-border-strong` | Load-bearing borders that must meet the 3:1 non-text target — currently only `buttonSecondary`'s outline, since a button's boundary is functional, not decorative |
| `--color-ring-active` | `#B5822B` | (rotation-ring stroke only) | A darker, stroke-safe amber for the rotation-ring's active segment. `--color-accent` stays badge-fill-only per its own contrast rule; the ring needed its own token rather than reusing a color that's documented as failing outside badge fills |
| `--color-muted` | `#767167` | `text-muted` | Secondary/helper text, labels; also the rotation-ring's "remaining position" stroke (replacing `--color-border`, which fails non-text contrast) |

`--color-muted` is **not** the `#8A8579` originally proposed — it's been darkened (same hue, ~42°, same ~7% saturation, lower lightness) to actually pass AA contrast for small text. See below.

`--color-primary-hover`/`--color-primary-active` are the same hue (152.7°) and saturation (56%) as `--color-primary`, only darkened — not arbitrary darker greens.

### Contrast verification

Computed via the WCAG relative-luminance formula, not eyeballed. AA requires 4.5:1 for normal text, 3:1 for large text (≥18pt, or ≥14pt bold) and for non-text UI boundaries.

| Pair | Ratio | Result |
|---|---|---|
| `#1A1A18` text on `#FAF8F5` bg | 16.44:1 | Pass |
| `#1F6E4A` (primary) as plain text on bg | 5.85:1 | Pass |
| `#1F6E4A` badge fill + white text | 6.20:1 | Pass |
| `#1F6E4A` badge fill + charcoal text | 2.81:1 | **Fails — use white text on green badges** |
| `#C08A2E` (accent) as plain text on bg | 2.86:1 | **Fails outright — never use as text color** |
| `#C08A2E` badge fill + charcoal text | 5.74:1 | Pass — **this is the only approved amber usage** |
| `#C08A2E` badge fill + white text | 3.04:1 | Fails for normal text — do not pair amber with white |
| `#C0392B` (danger) as plain text on bg | 5.13:1 | Pass |
| `#C0392B` badge fill + white text | 5.44:1 | Pass |
| `#C0392B` badge fill + charcoal text | 3.20:1 | Fails for normal text — use white text on red badges |
| `#767167` (muted, final) on bg | 4.58:1 | Pass |
| `#E5E1DA` (border) on bg | 1.23:1 | Fails non-text contrast, but this is a deliberately subtle divider, not a load-bearing UI boundary — consistent with this app's pre-existing border style, not a regression |
| `#1A1A18` text on `#FFFFFF` surface | 17.43:1 | Pass — slightly better than on bg |
| `#767167` (muted) on `#FFFFFF` surface | 4.85:1 | Pass |
| `#E5E1DA` (border) on `#FFFFFF` surface | 1.30:1 | Same non-text caveat as above |
| `#988E7C` (border-strong) on bg | 3.05:1 | Pass — non-text 3:1, used where a border is load-bearing (see below) |
| `#988E7C` (border-strong) on `#FFFFFF` surface | 3.23:1 | Pass |
| `#B5822B` (ring-active) on bg | 3.20:1 | Pass — non-text 3:1 |
| `#B5822B` (ring-active) on `#FFFFFF` surface | 3.39:1 | Pass |
| `#164E35` (primary-hover) + white text | 9.65:1 | Pass |
| `#0D2E1F` (primary-active) + white text | 14.71:1 | Pass |

Every text token has **equal or better** contrast on the white surface than it had on the page background — introducing `--color-surface` doesn't regress anything already verified above.

**Rule of thumb:** green and red are legible as plain colored text *or* as badges. Amber is legible **only** as a badge fill with dark (`#1A1A18`) text — it must never be used as a text color on its own.

## Elevation & surfaces

Every content container — data tables, dashboard stat tiles, the nav bar, the two standalone forms (cluster, member) — sits on `bg-surface` (white) rather than directly on `bg-bg` (warm off-white), with `border border-border` and Tailwind's built-in `shadow-sm` utility. No bespoke shadow token: Tailwind's default shadow is already soft and neutral enough for this purpose, and inventing a tinted one would be custom CSS for no real gain (see "Fast").

**Corner radius is deliberately different per element type**, so shape alone tells you what something is before you read it:

| Element type | Radius | Class |
|---|---|---|
| Cards/tiles/tables/forms (elevation containers) | 12px | `rounded-xl` |
| Secondary buttons | 8px | `rounded-lg` |
| Primary buttons | 8px | `rounded-lg` |
| Status badges, the rotation-ring's legend | fully round | `rounded-full` |

This matters because the first version of the clusters-list action row used `rounded-full` for its button chips — identical to `StatusBadge`, making informational badges and clickable actions look like the same kind of thing. Buttons and badges must never share a corner radius.

**Which forms get elevated cards:** only the two standalone-page forms, `cluster-form.tsx` and `member-form.tsx` (they're the entire content of their own page). The small inline forms — add position, assign member, start/advance cycle, mark paid/waive/revert — do **not** get their own card; they're compact, embedded controls that live inside a page section (a table row, a tile) that's already elevated. Nesting a card inside a card there would read as visual clutter, not hierarchy.

**Table rows** get `hover:bg-bg` (the row highlights to the page's own background color, not a new token — a free, correct-looking hover state since the row already sits on a lighter surface than the page) and `last:border-b-0` so the final row doesn't double up its divider against the card's own bottom border.

**Empty states** (no clusters/members/positions/cycles/payments/payouts yet) get the same elevation treatment as the card they replace — `rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted shadow-sm` — rather than floating as bare, unbounded text. Previously, switching from a populated table to its empty state meant an abrupt downgrade from "elevated card" to "plain paragraph," which read as unfinished rather than a deliberate state. Icons were considered and explicitly declined: this app has exactly one SVG (the rotation-ring), and adding icons here would either reopen that decision or need its own narrower justification neither of which this call warranted — the more generous `p-8` padding and centered text carry the "deliberately designed, not decoration" intent instead. Doesn't apply to `assign-member-form.tsx`'s inline "No members in this cluster yet." — that's a compact embedded control inside an already-elevated table row, not a page-level empty state, matching the same small-inline-forms-don't-get-their-own-card rule from above.

**Mobile table scroll affordance:** every table card is wrapped in an outer `relative` div around the existing `overflow-x-auto` one, with a `pointer-events-none` gradient div (`bg-gradient-to-l from-surface to-transparent`, `w-8`, `sm:hidden`) positioned over its right edge. Below the `sm` breakpoint, a table that overflows its card was scrollable but looked cut off — no visible scrollbar, no indication there was more to the right, so the last visible column read as truncated/broken rather than "swipe for more." The fade is a fixed decorative affordance (always rendered when the table has rows, not JS-detected against actual scroll position), which keeps every one of these 6 table pages a plain Server Component — adding real scroll-position detection would mean converting each to a Client Component for a purely cosmetic hint. Hidden at `sm` and above, where these tables generally fit without needing to scroll.

## Typographic scale

Formalizing what was already implicit, plus one real gap: every stat figure across the app (Total pot, Coordinator fee, Net payout, paid/pending/late counts, etc.) previously rendered at `font-medium` with no explicit size — literally the same 16px as a table cell or a sentence of body text, so a number meant to be scanned at a glance carried no more visual weight than routine prose.

| Tier | Class | Used for |
|---|---|---|
| Page title | `text-xl font-semibold` (20px/600) | The one `<h1>` per page |
| Section/card title | `text-sm font-medium text-muted` (14px/500) | Dashboard tile headings, payouts page section headings — one tier covers both, since a tile heading and a card heading are the same kind of thing here |
| Stat value | `text-lg font-semibold` (18px/600) | A figure meant to be scanned, not read — payout/pot amounts, paid/pending/late/waived/outstanding counts. Sits between section titles and page titles: present enough to draw the eye, never competing with the page's own `<h1>` |
| Body/data | Default (16px/400), `font-medium` for plain emphasis | Table cells, form values, prose — anything meant to be read in context, not scanned as a headline number |
| Label | `text-muted` at default size | The caption above a stat value or table header (e.g. "Total pot", "Coordinator fee") |

**What's deliberately *not* a stat value:** names (Next collector), dates (Start date), and short categorical text (Current cycle "Cycle 3", Contribution frequency "monthly") stay at plain body weight even when they sit in the same tile as a genuine stat — they're metadata to read, not quantities to scan, and bumping them too would flatten the distinction this tier exists to create.

## Spacing scale

Not new tokens — Tailwind's default spacing scale is already 4px-based, so `1/2/3/4/6/8/12` already equal exactly `4/8/12/16/24/32/48px`. The rule is to use **only these steps, deliberately**, rather than the incidental mix (`gap-1.5`, `px-2.5`, `py-1.5` — 6px/10px/6px, none of them on the scale) that had crept in.

| Step | Px | Typical use |
|---|---|---|
| `1` | 4px | Icon-to-label gaps, tightest spacing |
| `2` | 8px | Compact control padding, gaps between adjacent chips/badges |
| `3` | 12px | Form-row gaps, small inline form padding |
| `4` | 16px | Standard input/button padding, table cell padding |
| `6` | 24px | Card internal padding, section-to-section gaps |
| `8` | 32px | Larger page-level spacing |
| `12` | 48px | Major page-section separation |

## Button hierarchy

Three tiers, defined as shared class-string constants in `app/components/button-styles.ts` (`buttonPrimary`, `buttonSecondary`, `buttonTertiary`) — plain strings rather than a wrapper component, since they're used on both `<button>` (Server Action submits) and `<Link>` (navigation) and carry no other logic. Callers append their own padding/text-size classes on top; the base strings deliberately exclude sizing so a caller's size never fights the shared string for the same CSS property.

| Tier | Look | Used for |
|---|---|---|
| **Primary** | Filled `bg-primary`, white text, `shadow-sm`, `rounded-lg`, `hover:bg-primary-hover`, `active:bg-primary-active` | New cluster/member/position, Save changes, Start/Advance cycle, Mark paid, Sign in — the one clearly-intended action per page |
| **Secondary** | `border-border-strong` + `bg-surface`, `rounded-lg`, `hover:border-primary hover:text-primary` | Frequent nav-style actions: Members/Rotation/Cycles/Payouts (clusters list and dashboard quick-links), Assign, Waive, Revert to pending, Sign out |
| **Tertiary/quiet** | Plain `text-muted`, `hover:text-ink hover:underline`, no border or fill | Infrequent actions: Edit, "View payments" |

Text-only, no icons — this app has exactly one SVG (the rotation-ring); adding an icon set for tertiary buttons was considered and deliberately deferred rather than assumed.

## Status color mapping

Applied consistently everywhere a status already appears (dashboard, clusters list, payments, cycles):

| State | Treatment |
|---|---|
| Paid / confirmed / positive action | `#1F6E4A` — badge (white text) or plain text |
| Active turn (the rotation-wheel concept — whose position is currently collecting) | `#C08A2E` — **badge only**, charcoal text |
| Pending (not yet due), draft, waived, not started | Neutral — `#E5E1DA` fill, `#1A1A18` text (or plain `text-muted`) |
| Late | `#C0392B` — badge (white text) or plain text, used sparingly, only for genuinely overdue payments |

**"Active turn" is deliberately narrower than "pending."** Amber means *this specific position/cluster is the one currently collecting* — a single, rare thing per cluster (the rotation dial's active segment, a cluster's `active` status). A payment that's merely `pending` (not yet due, no action needed yet) is the normal, expected state for most members most of the time; coloring every one of those amber would mean most of a payments table is amber, which dilutes the signal amber is supposed to carry and reads as decoration rather than meaning. Only a payment that's actually overdue escalates to `danger` (red). This distinction matters enough to spell out because the two concepts ("active turn" and "pending") look similar in English but aren't the same axis — one is about rotation position, the other is about payment timing.

## The rotation-ring component

A small circular dial representing a cluster's rotation: each segment is one position in the rotation order, filled or unfilled based on whether that position has collected its payout. This ties directly to the real ajo/esusu concept — a rotating "wheel" of members — rather than being arbitrary decoration.

**Location:** `app/components/rotation-ring.tsx` (new — no prior SVG/icon component exists in this codebase).

### Prop contract

```ts
type RotationRingProps = {
  /** Total number of positions in the cluster's rotation. */
  totalPositions: number
  /** 1-indexed position number currently active (the position whose cycle is in progress), or null if the cluster hasn't started (draft) or has no active cycle. */
  activePosition: number | null
  /** Count of positions that have already completed their payout (used to fill segments before the active one). */
  completedCount: number
  /** Diameter in pixels. Defaults to a legible size — never shrink this
   * to the point of being unreadable, it's the signature element. */
  size?: number
  /** Accessible label, e.g. "Cluster 66: position 3 of 5 active." Required — this is a visual-only indicator otherwise. */
  ariaLabel: string
}
```

### Segment coloring

- Completed positions (`index < completedCount`): stroked `#1F6E4A` (primary)
- Active position (`index === activePosition - 1`): stroked `#B5822B` (`--color-ring-active`, **not** `--color-accent` — the ring's stroke is non-text UI that needs 3:1 contrast on its own, and plain `#C08A2E` only clears that bar as a badge fill with dark text, not as a thin stroke on a light surface)
- Remaining positions: stroked `#767167` (`--color-muted`, **not** `--color-border`, which fails non-text contrast and would make "remaining" segments functionally invisible)
- Draft cluster (`activePosition === null`, `completedCount === 0`): every segment gets the "remaining" treatment above

**Single-position rotations** (`totalPositions === 1`) are drawn as two 180° arcs rather than one 0°–360° arc — a full-circle arc has coincident start/end points and doesn't render at all in SVG.

**Stroke stays inside the viewBox:** the ring's radius is `size / 2 - strokeWidth / 2 - 1`, not a fixed `-3px` inset, so the round stroke caps never extend past the edge of the SVG regardless of `size` (a fixed inset clipped the stroke at larger sizes, e.g. the 64px dashboard ring).

### Legend

The ring alone doesn't communicate "3 of 5" at a glance — it's a dial, not a readout. The component renders a small text legend next to it: `${activePosition}/${totalPositions}` when a cycle is active, `${completedCount}/${totalPositions}` otherwise (draft or fully completed). No new props needed — this is computed internally from the existing prop contract. The legend is marked `aria-hidden`; the SVG's own `aria-label` already carries the equivalent information for screen readers, so the two aren't announced twice.

Legend text size follows ring size: `text-sm font-medium text-ink` at 48px+ (dashboard), `text-xs font-medium text-muted` below that (clusters list) — this is a component-internal threshold (`size >= 48`), not a prop.

### Sizes

The ring is this app's signature element and was previously too small to read (24px list, 32px dashboard). Current call-site sizes:

- Clusters list: `size={36}`
- Dashboard cluster-status tile: `size={64}` — it has a whole dedicated tile, unlike a table row

The component itself defaults to `size={40}` when the prop is omitted — no call site currently relies on this default (both existing usages pass an explicit size), but it's there as a legible fallback for any future usage that doesn't specify one.

### Usage sites

- Dashboard's cluster-status tile (one ring per selected cluster)
- Clusters list (one small ring per row) — the page queries `slots` (for slot count) and `cycles` (for active cycle position) per cluster to render this

## Dashboard greeting and tip of the day

A design brief was reviewed for a broader dashboard rework (hero sections, a "community pulse," activity feeds, member stories, new CTAs) and mostly rejected — it assumed product architecture this app doesn't have, and two parts were real privacy/security concerns rather than just scope: cross-coordinator activity aggregation, and displaying named members' financial actions as a public feed. Neither is happening. Two small, honest pieces were pulled out and built instead:

**Greeting:** the dashboard's `<h1>` is `Welcome back, {displayName}.` instead of the plain word "Dashboard." `displayName` is `user.user_metadata?.full_name`, falling back to `user.email` — the only field guaranteed present on an authenticated session, already used elsewhere (`app/page.tsx`: "Signed in as {user?.email}"). There's no `profiles`/`coordinators` table in this schema (`full_name` exists only on `members`, i.e. rotation participants, not the coordinator); `user_metadata.full_name` may or may not be populated depending on how an account was provisioned, so the fallback is load-bearing, not decorative.

**Tip of the day:** a small card (`rounded-xl border border-border bg-surface p-4 shadow-sm`, matching the app's standard card elevation but sized down from the p-6 stat tiles) showing one of a fixed set of five tips (`app/dashboard/tips.ts`), written as real, generic ajo/esusu savings-discipline advice — never a fabricated platform statistic or named-user activity. Rotation is deterministic by calendar day (UTC-based day-of-year modulo the tip count), not random and not client-side — every viewer sees the same tip on a given day, and it's a plain Server Component like the rest of the dashboard.

## Navigation

`app/site-nav.tsx` is now `bg-surface` + `shadow-sm`, wider link spacing (`gap-6`, 24px), a heavier app-title (`text-base font-semibold`, was the same weight/size as everything else), and a visible active-link indicator (`border-b-2 border-primary` under the current section, `border-b-2 border-transparent` otherwise, so the layout doesn't shift between states).

Below the `sm` breakpoint the nav stacks vertically (`flex-col`, links row wrapping via `flex-wrap`) instead of forcing the title, both links, and the sign-out button onto one line — at narrow widths that would either clip or force horizontal scroll on the one bar that should never need it.

**This is the app's first Client Component** (`'use client'`, `usePathname()`), needed to know which link is active. Everything else in the app is server-rendered. The JS cost is negligible (a nav bar, no data fetching), but it's a real pattern shift worth naming given "Fast" is a stated principle — the alternative (passing the active section as a server-rendered prop from every page) was considered and rejected as more boilerplate for no real benefit here.

### Back/forward history controls

A `←`/`→` pair sits leftmost in the nav, before the brand link — global history navigation (`router.back()` / `router.forward()`), distinct from the per-page "← Back to X" links that stay untouched throughout the app. Those two mechanisms solve different problems and neither replaces the other: the per-page links go to a specific logical parent resource (works even with no browser history at all, e.g. a bookmarked or refreshed URL); the nav's back/forward retraces actual browser history (works only once there's history to retrace, e.g. useless on a bookmarked first visit).

**Styling:** neither existing button tier fit — Primary/Secondary are page actions, and Tertiary is an underlined text link (wrong for a single glyph). These are persistent chrome controls, so they get their own minimal treatment: `text-muted`/`hover:text-ink` (Tertiary's color language) as `h-8 w-8` icon buttons instead of underlined text, plus the same `disabled:opacity-50 disabled:pointer-events-none` pattern `buttonPrimary` already uses. Glyphs are literal `←`/`→` characters (not an icon set), consistent with the "text-only" decision above, with `aria-label`s since a bare glyph isn't self-explanatory to screen readers.

**Why sessionStorage, not component state:** `SiteNav` is rendered per-page (not from a shared layout — see `grep -rl SiteNav app`), so it remounts on every navigation; any history state kept in React state or component-local refs would reset on every page load, permanently disabling both buttons. `sessionStorage` survives the remount and is scoped to the tab, which is also the right lifetime — no reason for back/forward availability to persist once the tab closes.

**Disabled-state logic:** the naive version of this (a `sessionStorage` flag meaning "has any in-app navigation happened yet this session") shipped first and had a real bug, caught in review: `/clusters` → `/dashboard` → Back correctly lands on `/clusters`, but the flag-based version left Back *enabled* there too, since the flag only ever asked "have I navigated at all," never "am I back at the entry the app actually started from." A second Back click from that point would go past `/clusters` to whatever was before the app — an auth redirect step, an expired OAuth callback — silently leaving the app rather than just running out of app-internal history.

The fix: stamp a monotonically increasing index onto each browser history entry's own `state` object (`history.replaceState({ ...state, appNavIndex: n }, '')`) the first time it's seen, and track the very first index handed out this session (the app's "root") in `sessionStorage`. Because `history.state` is restored per-entry by the browser itself on back/forward, comparing the *current* entry's stamped index to the root is correct even across `SiteNav`'s remounts, and correctly re-disables Back once the user is actually back at the entry point — no flag to go stale. Forward compares the current index to the highest index handed out so far; branching to a new link after going back doesn't need explicit "invalidate the old forward entries" handling, because the browser already truncates those from real history, so there's nothing left to reach even though the counter itself never decreases.

This also fixed a second, narrower bug in the original flag-based version: it only reconciled on `pathname` changes, so a query-only navigation (e.g. the dashboard's `?cluster=` switcher, which doesn't change `pathname`) could leave stale state in place. The corrected version reconciles on every render (not gated by a dependency array) plus a `popstate` listener as a defensive backstop, so it isn't tied to pathname changing at all.

**Is forward worth it:** debatable, flagged rather than silently decided. Back is the common case; forward is rare even in browsers themselves. It's included here because the disabled-state tracking needed for a *correct* Back already made a *reasonably* correct Forward cheap to add, but its imprecision above (single-hop only) is a real, accepted limitation, not an oversight.

## Dark mode

**Dropped for this pass.** The app previously had a full dark palette (`prefers-color-scheme: dark`, `~49` `dark:` utility instances across the codebase). This is an internal coordinator tool, not public-facing, and a proper dark variant of this new system is out of scope here. The visual pass removes the old dark-mode CSS and `dark:` utility classes rather than leaving them half-updated against the new light tokens; a dark variant can be scoped as its own future slice if it turns out to matter.
