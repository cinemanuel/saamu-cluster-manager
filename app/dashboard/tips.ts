// A small fixed set of real, non-fabricated tips about rotational-savings
// discipline -- not platform statistics, not named-user activity. Rotates
// deterministically by calendar day (UTC) rather than randomly, so it's the
// same tip for every viewer on a given day and genuinely changes daily,
// without needing any storage or client-side JS.
export const DASHBOARD_TIPS = [
  "Esusu and ajo have worked for generations because everyone trusts everyone to pay their turn — consistency is the whole system.",
  "A cluster runs smoothest when contributions come in before they're due, not after a reminder.",
  "Small, regular contributions build more trust over time than occasional large ones — steady beats sporadic.",
  "Clear records — who's paid, who's collected — are what turn a rotating fund into one people trust for years.",
  "A rotational savings group is only as strong as its most behind member — checking in early protects everyone's turn.",
] as const

export function getTipOfTheDay(date: Date = new Date()): string {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1)
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const dayOfYear = Math.round((today - startOfYear) / 86400000)
  return DASHBOARD_TIPS[dayOfYear % DASHBOARD_TIPS.length]
}
