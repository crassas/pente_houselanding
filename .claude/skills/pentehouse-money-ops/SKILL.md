---
name: pentehouse-money-ops
description: "Lightweight production operations skill for Pentehouse Barbearia. Use for recurring business health, reservations, local SEO, reviews, conversion checks, experiments, and safe operational follow-up without adding weight to the customer-facing site."
---

# Pentehouse Money Ops

Run Pentehouse as a **local retail/service business**, not as a SaaS.

## Mode

`production`

The site is live. Protect bookings, search visibility, brand identity, phone/WhatsApp paths, and existing indexed URLs.

## First checks

Before changing code:

1. Read the relevant repo files.
2. Check whether the capability already exists.
3. Separate technical health from business performance.
4. Do not duplicate existing CI, image optimisation, SEO pages, structured data, or booking logic.

## Business health signals

Prioritise real signals in this order:

1. Confirmed appointments / reservation requests.
2. WhatsApp booking starts.
3. Booking CTA engagement.
4. Google Business Profile actions when data is available: calls, website visits, directions.
5. Organic impressions/clicks and local queries.
6. Review count, rating, recency, and review response coverage.
7. Core Web Vitals / uptime / broken booking paths.

If a signal cannot currently be measured, say so. Do not invent a proxy unless it is explicitly labelled as a proxy.

## Operating loops

### On demand
- Verify site and booking path.
- Inspect current search/landing-page opportunity.
- Find one conversion or local-discovery bottleneck.
- Recommend or implement the smallest measurable fix.

### Weekly
- Local SEO/GEO check.
- Booking funnel check.
- Search-query/page movement.
- Google Business Profile/reviews check when connected.
- One experiment maximum unless there is a production fault.

### After a deploy
- Verify homepage and indexed local landing pages.
- Verify phone/WhatsApp/reservation flows.
- Check canonical, robots, sitemap and structured data if affected.
- Compare performance to the previous known baseline when data exists.

## Guardrails

Never autonomously:

- change prices;
- spend money on ads;
- send bulk customer messages;
- publish social posts;
- edit Google Business Profile facts;
- alter payment terms;
- delete indexed pages;
- change address, phone, opening hours, barbers, services, or legal/customer-policy copy;
- force-push or perform destructive git/database actions.

Those actions require explicit user instruction.

## Anti-bloat rule

Do not add analytics libraries, CRMs, popups, chat widgets, tracking pixels, or new dependencies just because they are common.

If measurement is missing, first propose the lightest viable instrumentation. Prefer native/server-side or existing-platform data when it can answer the question.

## Output contract

For each run, return:

- **State** — what is actually true now.
- **Constraint** — the weakest observable business step.
- **Action** — one concrete action.
- **Measure** — the signal used to judge it.
- **Safety** — anything that needs user approval.

If the global `/money-ops` skill is available, use it for orchestration while these Pentehouse-specific rules remain authoritative.

## Attribution

Pentehouse integration inspired by **Show Me The Money / money-ops**:
https://github.com/iamzifei/show-me-the-money

The upstream pack is not copied into this repository.
