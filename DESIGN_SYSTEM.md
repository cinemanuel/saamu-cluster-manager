# Design System — Saamu Cluster Manager

This is the source of truth for the app's visual language: color tokens, typography, the rotation-ring component, and the reasoning behind them. It exists so future work stays consistent without re-deriving these decisions from scratch.

**Status:** Locked in for the Entry 10 visual design pass (July 2026). Applies to the whole app going forward.

## Principles

**Fast.** This is a low-bandwidth-conscious tool built for coordinators on Nigerian mobile networks, not a showcase app. Every design decision is weighed against load cost and rendering simplicity first.

This is why typography uses **Inter only** — for headings and body/data alike. A second display typeface is an extra font file to download, an extra flash-of-unstyled-text window, and extra decisions about which face wins in a given context. Hierarchy comes from **weight and size**, not a second typeface:

- Page titles: `font-semibold`, larger size (`text-xl`/`text-2xl`)
- Section headings: `font-medium`, small-caps-adjacent treatment via size (`text-sm`), muted color
- Body/data: `font-normal`, base size
- Emphasis within data (e.g. a stat value): `font-medium`, same size as its label

**Meaningful color, not decoration.** Every color in this system maps to something real about the data (a payment is genuinely paid, a position genuinely holds the active turn) — never applied for visual variety alone.

## Color tokens

Defined as CSS custom properties in `app/globals.css`, exposed to Tailwind via `@theme`. Forced light mode only (see [Dark mode](#dark-mode) below).

| Token | Hex | Tailwind class (proposed) | Usage |
|---|---|---|---|
| `--color-bg` | `#FAF8F5` | `bg-bg` | Page background |
| `--color-ink` | `#1A1A18` | `text-ink` | Primary text |
| `--color-primary` | `#1F6E4A` | `bg-primary` / `text-primary` | Trust accent — confirmed/paid/positive actions, primary buttons |
| `--color-accent` | `#C08A2E` | `bg-accent` | Status accent — "active turn / needs attention." **Badge fills only, never as plain text** (see [Contrast](#contrast-verification)) |
| `--color-danger` | `#C0392B` | `text-danger` / `bg-danger` | Late/overdue payments only. Used sparingly — this is a warning color, not a general error color |
| `--color-border` | `#E5E1DA` | `border-border` | All borders/dividers |
| `--color-muted` | `#767167` | `text-muted` | Secondary/helper text, labels |

`--color-muted` is **not** the `#8A8579` originally proposed — it's been darkened (same hue, ~42°, same ~7% saturation, lower lightness) to actually pass AA contrast for small text. See below.

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

**Rule of thumb:** green and red are legible as plain colored text *or* as badges. Amber is legible **only** as a badge fill with dark (`#1A1A18`) text — it must never be used as a text color on its own.

## Status color mapping

Applied consistently everywhere a status already appears (dashboard, clusters list, payments, cycles):

| State | Treatment |
|---|---|
| Paid / confirmed / positive action | `#1F6E4A` — badge (white text) or plain text |
| Active turn / pending / needs attention | `#C08A2E` — **badge only**, charcoal text |
| Draft / not started | Neutral — `#E5E1DA` fill, `#1A1A18` text (or plain `text-muted`) |
| Late | `#C0392B` — badge (white text) or plain text, used sparingly, only for genuinely overdue payments |

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
  /** Diameter in pixels. Defaults to a compact size for list/tile use. */
  size?: number
  /** Accessible label, e.g. "Cluster 66: position 3 of 5 active." Required — this is a visual-only indicator otherwise. */
  ariaLabel: string
}
```

### Segment coloring

- Completed positions (`index < completedCount`): filled `#1F6E4A`
- Active position (`index === activePosition - 1`): filled `#C08A2E`
- Remaining positions: unfilled, stroked `#E5E1DA`
- Draft cluster (`activePosition === null`, `completedCount === 0`): every segment unfilled/neutral

### Usage sites

- Dashboard's cluster-status tile (one ring per selected cluster)
- Clusters list (one small ring per row) — this requires a new query on that page (slot count + active cycle position per cluster), since the clusters list currently fetches only `clusters` table columns and has no cycle/slot data today

## Dark mode

**Dropped for this pass.** The app previously had a full dark palette (`prefers-color-scheme: dark`, `~49` `dark:` utility instances across the codebase). This is an internal coordinator tool, not public-facing, and a proper dark variant of this new system is out of scope here. The visual pass removes the old dark-mode CSS and `dark:` utility classes rather than leaving them half-updated against the new light tokens; a dark variant can be scoped as its own future slice if it turns out to matter.
