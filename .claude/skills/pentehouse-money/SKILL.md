---
name: pentehouse-money
description: "Business/revenue router for Pentehouse Barbearia — Loja 20, Porto. Use for growth, conversion, local SEO/GEO, reservations, reviews, offers, experiments, or when the user asks to apply Show Me The Money to Pentehouse."
---

# Pentehouse Money

Project-scoped bridge for **Pentehouse Barbearia — Loja 20, Porto**.

## Operating stance

- Business type: `retail-local`.
- Production site: `https://pentehouse.pt/`.
- Preserve the existing visual identity and customer experience.
- Do not add generic sections, dashboards, popups, scripts, or dependencies without a measured reason.
- Inspect the existing implementation before proposing or changing anything.
- Reuse existing SEO pages, structured data, booking flow, CI, and asset optimisation.
- Prefer one measurable experiment at a time.

## Revenue path

Treat this as the core funnel:

`local discovery -> site/Google profile -> service intent -> booking CTA -> WhatsApp -> confirmed appointment -> visit -> repeat/review`

Optimise the weakest observable step first.

## Routing

When the global Show Me The Money suite is installed, use its relevant skill as the execution layer:

- `/money-strategy` for positioning/offers.
- `/money-seo` for local SEO/GEO.
- `/money-content` for useful local content.
- `/money-quality` before shipping meaningful changes.
- `/money-ops` for recurring operations and monitoring.
- `/money-finance` only when real revenue/cost data is available.

For day-to-day operations, route to `/pentehouse-money-ops`.

If Show Me The Money is not installed, this project skill still works as the Pentehouse-specific operating layer; do not block the task.

## Decision rule

Every action must answer:

1. What business signal are we trying to improve?
2. What is the smallest safe change?
3. How will we measure it?
4. What result means keep / revert / iterate?

Do not fabricate bookings, reviews, rankings, revenue, conversion rates, or customer data.

## Attribution

Inspired by **Show Me The Money** by iamzifei / Orris AI:
https://github.com/iamzifei/show-me-the-money

The upstream skill pack is not vendored or redistributed in this repository.
