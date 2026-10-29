# Dynamics 365 Customer Insights - Journeys Agents Consumption Pricing Tool

A standalone, dependency-free web calculator for monthly Copilot Credit planning
for the first-party Dynamics 365 Customer Insights - Journeys agents.

**Live site:** https://tommylthai.github.io/dynamics-customer-insights-consumption-pricing-tool/

Open `index.html` directly, or use Node.js 18+:

```powershell
npm start
# Open http://127.0.0.1:4173
npm test
```

Set `$env:PORT` before `npm start` to change the loopback-only preview port.
No install, build, account, API key, or Power Apps environment is required.
The page needs only `index.html`, `styles.css`, `calculator.js`, and `app.js`.

Every push to `main` runs `.github/workflows/pages.yml`: `npm test` must pass
before the repository root is published to GitHub Pages (source: GitHub
Actions). The workflow can also be re-run manually from the Actions tab.

## Coverage and source verification

Primary sources were checked on **October 29, 2026**.
[AI Hub](https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/ai-hub)
lists two out-of-the-box agents that consume Copilot Credits. Both are in
preview and have independent include, adoption, volume and rate controls:

| Agent | Workload driver | Planning activity unit | Example default |
| --- | --- | --- | --- |
| [Journey Creation Agent](https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/journey-creation-agent) | New journeys per month | Prompt, including clarifications and refinements | 50% of journeys x 8 prompts x 25 credits |
| [Outreach Optimization Agent](https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/outreach-optimization-agent) | Contacts entering journeys per month | Email the agent times for a contact | 25% of contacts x 3 emails x 5 credits |

Journey Creation Agent **replaces Journey Copilot** for journey creation, so
Journey Copilot is not a separate row; the engine rejects duplicate or alias
identities. Journey Creation is English only, uses Anthropic models (tenant
opt-in required) and doesn't create segments or content. Outreach Optimization
is email only.

The [Copilot overview](https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/copilot-overview)
features (segment query assist, content ideas, content rewrite, image
recommendations) are not metered: Microsoft doesn't document Copilot Credit use
for them. Out of scope: agents you build in Copilot Studio for conversational
journeys, the Customer Insights MCP server, Customer Insights skills in
Microsoft 365 Copilot, and Customer Insights - Data.

## Rates are assumptions, not a Microsoft tariff

Microsoft hasn't published credits per activity for these agents. Default rates
(25 credits per Journey Creation prompt, 5 per optimized email) are
**illustrative planning assumptions**, as are the default journeys, contacts,
adoption and volumes. The 5-credit default matches the generic agent action rate
in [Copilot Studio billing rates](https://learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-messages-management#copilot-credits-billing-rates)
as a reference point only. Replace rates with measured averages from a pilot,
using actual usage in the Power Platform admin center.

Clear an agent's rate to mark it unknown. If an enabled agent has activity but
no rate, its credits are `null`, its workload is explicitly unpriced, and all
numeric totals and costs are labeled partial. Zero is an explicit assumption of
no incremental credit consumption, never an automatic replacement for a blank.
Disabling a workload excludes it; it does not assert that the agent is free.

The [Microsoft agent usage estimator](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-usage-estimator)
recommends a 10-20% buffer but doesn't cover these agents. This tool uses its
own transparent planning model rather than reproducing that estimator.

## Calculation and entitlement

For each agent:

`monthly driver x adoption / 100 x activities per driver unit x assumed credits per activity`

1. Sum priced activity credits without per-agent rounding. Fractional journeys,
   contacts and activities are expected averages.
2. Apply the editable buffer (15% example), then round up once to a whole
   planning credit. This is a conservative budgeting rule, not billing logic.
3. Available capacity = 0 included credits + allocated monthly credits.
4. Additional credits = max(0, planning credits - available capacity).
5. Compare additional credits x PAYG rate with whole packs:
   ceil(additional credits / pack size) x pack price.

The [Dynamics 365 Licensing Guide](https://aka.ms/dynamics365licensingguide)
(October 2026) says Copilot Credits are required for Dynamics 365 agent usage.
Only Sales, Customer Service, Finance and Supply Chain Management Premium
include 1,000 credits per user per month; Customer Insights entitlements (also
on the [pricing page](https://www.microsoft.com/en-us/dynamics-365/products/customer-insights/pricing))
include none. [AI Hub prerequisites](https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/ai-hub-prerequisites)
require Copilot Studio capacity allocated to the environment, from prepaid
packs, pay-as-you-go or eligible Premium credits
([capacity management](https://learn.microsoft.com/en-us/power-platform/admin/manage-copilot-studio-messages-capacity)).
Enter only credits this environment can use, net of other workloads. The
[credit licensing page](https://learn.microsoft.com/en-us/microsoft-copilot-studio/billing-licensing)
explains the September 2025 change from messages to Copilot Credits; some
Customer Insights pages still say "messages".

Verified public USD list prices, shown as fixed, grayed-out read-only fields
(confirm contract or regional pricing with Microsoft or a partner):

- [PAYG meter](https://learn.microsoft.com/en-us/power-platform/admin/pay-as-you-go-meters):
  **$0.01/credit**.
- [Copilot Studio monthly packs](https://www.microsoft.com/en-us/copilot/products/copilot-studio):
  **$200 for 25,000 credits/month**.

These are alternative capacity purchase models, not additive costs. The tool
does not model pre-purchase plans, discounts, Customer Insights license fees,
other services, tax, currency conversion or rollover.

## UX and maintenance

The design matches the existing Dynamics 365 Sales and Customer Insights pricing
tools: the same navy token palette, top disclaimer banner, gradient hero with
verification badge, collapsible quick start, intake cards, important-notice
callout, accent-striped agent cards with Preview badges, a sticky monthly
estimate, and a mobile total bar. Light/dark themes, native accessible number
inputs, labeled switches, keyboard focus, reduced-motion and forced-colors
support, print styling, and JSON estimate export are included. Fixed Microsoft
list prices are read-only (still focusable), an excluded agent's fields are
disabled until it is included again, and every planning assumption stays
editable.

`?scoutTheme=light|dark` (or `?theme=light|dark`) sets the initial theme; other
values are ignored. Otherwise the last theme chosen with **Switch theme** (saved
in local storage as `ci-journeys-agents-theme`) or the system preference is
used. Calculator inputs stay in memory only, with no tracking, external assets
or network requests.

`calculator.js` is the shared browser/Node calculation engine and source
registry. `app.js` renders and validates the UI. `npm test` uses the built-in
Node test runner and covers the example scenario, agent identity and aliases,
workload drivers, zero demand, disabling, unknown rates, entitlement and
allocation, rounding, invalid and negative input, overflow, and page/engine
consistency. When updating inventory or rates, verify the primary sources,
update `VERIFIED_DATE` and the dates in `index.html`, and keep the methodology
honest about uncertainties.
