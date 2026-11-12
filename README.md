# Saamu Cluster Manager

**A coordinator tool for running rotating savings circles (ajo / esusu / adashe) in Nigeria.**

Built and product-managed by **Emmanuel Kalasuwe**, who designed it to run a real 11-member weekly savings circle he coordinates.

Live app: [saamu-cluster-manager.vercel.app](https://saamu-cluster-manager.vercel.app) (coordinator sign-in only, because it holds members' personal details)

---

## The problem

Ajo runs on trust, a notebook and a WhatsApp group. The coordinator keeps track of who has paid, whose turn it is to collect, and who can be trusted, mostly from memory. When something goes wrong, there is no record to settle the argument.

The biggest risk is not payment processing. It is **default risk**: a member collects the pot early in the rotation and then stops contributing. Every main feature in Saamu exists to control that one risk.

## What it does

| Feature | Why it exists |
|---|---|
| **Clusters** (savings groups) with contribution amount and coordinator fee | One place for each group's rules |
| **Member profiles with KYC**: name, WhatsApp, photo, home address, business name and address | Know who you are lending trust to |
| **Automatic trust tiers** (Tier 1 to 3, based on how complete the KYC is) | Turns "I know her" into a visible rule |
| **Protected payout slots**: only fully verified Tier 3 members can take the first two payout positions | Stops the highest-risk default before it can happen |
| **Cycles and payment tracking** per member per round | A record of who paid what, and when |
| **Configurable coordinator payout fee** | The business model: the coordinator earns a fee from each week's collector |
| **Coordinator dashboard** | The weekly view of the whole circle |
| **Multiple coordinators, with super-admin oversight** | Each coordinator only sees their own groups (enforced in the database) |

## Product decisions worth reading

- **Bank transfer over Paystack.** I compared direct bank transfer with Paystack virtual accounts. Paystack automates attribution, but its next-working-day settlement made the group's same-day Saturday payout impossible, and its fees would have eaten most of the coordinator fee. Simple transfer won on both cost and fit.
- **Rules before tooling.** Default risk is handled by rotation order and protected slots, not by payment software.
- **Simple over feature-heavy.** The target users (traders, artisans, small business owners) trust people more than apps and live on WhatsApp, so the interface stays deliberately plain.

## How it was built

Saamu was built in small, verified slices using AI-assisted development (Claude Code). I acted as the product manager: I set scope, wrote the rules, tested every slice live, and led the debugging.

- **[BUILD_LOG.md](./BUILD_LOG.md):** every slice, what was built, how it was verified and what broke
- **[Case studies](./docs/case-studies/):** root-cause write-ups of real production bugs, for example a "green" keep-alive job that was silently failing, and a rejected slot change that silently wiped a valid payout position
- **[Bug logs](./docs/bug-logs/)**

**Stack:** Next.js, TypeScript, Tailwind CSS, Supabase (Postgres with row-level security and storage), Vercel, GitHub Actions.

## What I learned

The most useful lesson was not technical. The tool works, and the pain it addresses is real. But for a small group that already trusts each other, a WhatsApp group, bank alerts and the coordinator's memory are "good enough", and I still don't find myself needing the tool week to week.

That taught me to tell **a real problem** apart from **a problem painful enough to change a habit**. Where I'd take Saamu next is where that pain is sharp: larger circles, cooperatives and groups that need records for accountability.

---

*Contact: open an issue on this repo, or reach me through GitHub [@cinemanuel](https://github.com/cinemanuel).*
