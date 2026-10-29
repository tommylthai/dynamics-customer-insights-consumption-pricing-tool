(function (root) {
  "use strict";

  const VERIFIED_DATE = "2026-10-29";
  const MAX = 1e12;
  // Customer Insights tenant licenses include no Copilot Credits (Dynamics 365 Licensing Guide, October 2026).
  const LICENSE_CREDITS = 0;
  const SOURCES = [
    { title: "First-party agent inventory (AI Hub)", url: "https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/ai-hub", note: "Lists two out-of-the-box agents, Journey Creation and Outreach Optimization, which consume Copilot Credits. Preview." },
    { title: "Journey Creation Agent", url: "https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/journey-creation-agent", note: "Uses Copilot Credits and replaces Journey Copilot for journey creation. Preview, English only, uses Anthropic models." },
    { title: "Outreach Optimization Agent", url: "https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/outreach-optimization-agent", note: "Consumes Copilot Credits while choosing email send times for each contact in a journey. Preview." },
    { title: "AI Hub prerequisites", url: "https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/ai-hub-prerequisites", note: "Agents need Copilot Studio capacity (prepaid or pay-as-you-go) allocated to the environment. Still uses legacy message terminology." },
    { title: "Dynamics 365 Licensing Guide (October 2026)", url: "https://aka.ms/dynamics365licensingguide", note: "Copilot Credits are required for Dynamics 365 agents. Only Sales, Customer Service, Finance and Supply Chain Management Premium include credits; Customer Insights entitlements include none." },
    { title: "Customer Insights pricing", url: "https://www.microsoft.com/en-us/dynamics-365/products/customer-insights/pricing", note: "Tenant license entitlements are Unified and Interacted People; no Copilot Credits are listed. License fees are excluded here." },
    { title: "Copilot features in Customer Insights - Journeys", url: "https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/copilot-overview", note: "Query assist, content ideas, content rewrite and image recommendations. The page doesn't mention Copilot Credits, so these features aren't metered here." },
    { title: "Copilot Studio credit licensing", url: "https://learn.microsoft.com/en-us/microsoft-copilot-studio/billing-licensing", note: "Copilot Credits replaced messages on September 1, 2025. Actual consumption varies with the actions performed." },
    { title: "Copilot Credits billing rates", url: "https://learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-messages-management#copilot-credits-billing-rates", note: "Generic feature rates, such as 2 credits per generative answer and 5 per agent action. No rates are published for these Customer Insights - Journeys agents." },
    { title: "Copilot Studio capacity management", url: "https://learn.microsoft.com/en-us/power-platform/admin/manage-copilot-studio-messages-capacity", note: "Allocate credits to environments, set monthly consumption limits for each agent, and monitor usage." },
    { title: "Pay-as-you-go meter", url: "https://learn.microsoft.com/en-us/power-platform/admin/pay-as-you-go-meters", note: "Published USD reference: $0.01 per Copilot Credit. Region, contract and taxes may differ." },
    { title: "Copilot Studio prepaid packs", url: "https://www.microsoft.com/en-us/copilot/products/copilot-studio", note: "Published USD reference: $200/month per pack of 25,000 credits. Pre-purchase plans aren't modeled." },
    { title: "Microsoft agent usage estimator guidance", url: "https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-usage-estimator", note: "Recommends a 10-20% planning buffer. It doesn't cover these agents, and this calculator doesn't reproduce its formulas." }
  ];

  const DRIVERS = {
    journeys: { label: "New journeys per month", singular: "new journey", plural: "new journeys", max: 1000000 },
    contacts: { label: "Contacts entering journeys per month", singular: "contact", plural: "contacts", max: 1000000000 }
  };

  const AGENTS = [
    {
      id: "journey-creation", name: "Journey Creation Agent", short: "Journey Creation", status: "Preview",
      description: "Builds a journey's structure from a natural-language conversation, using your existing segments, triggers and content.",
      driver: "journeys", adoptionHelp: "Share of new journeys", reach: "with the agent",
      volumeLabel: "Prompts per journey", volumeHelp: "Include clarifications and refinements",
      rateLabel: "Credits per prompt", unit: "prompts", activity: "prompt", per: "journey",
      note: "Replaces Journey Copilot for journey creation, so count that work here only once. English only; uses Anthropic models, which needs a tenant opt-in. It doesn't create segments or content.",
      source: "https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/journey-creation-agent",
      adoption: 50, volume: 8, rate: 25, enabled: true
    },
    {
      id: "outreach-optimization", name: "Outreach Optimization Agent", short: "Outreach Optimization", status: "Preview",
      description: "Chooses when and how often each contact receives journey emails, honoring quiet times and consent.",
      driver: "contacts", adoptionHelp: "Share of contacts entering journeys", reach: "through agent steps",
      volumeLabel: "Optimized emails per contact", volumeHelp: "Emails the agent times for each contact",
      rateLabel: "Credits per optimized email", unit: "optimized emails", activity: "optimized email", per: "contact",
      note: "Email only. Microsoft hasn't published its metering unit, so credits per optimized email is a planning proxy. Pilot it, then use measured usage from the Power Platform admin center.",
      source: "https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/outreach-optimization-agent",
      adoption: 25, volume: 3, rate: 5, enabled: true
    }
  ];

  function defaults() {
    return {
      journeys: 20, contacts: 10000, otherCapacity: 0,
      buffer: 15, paygRate: 0.01, packSize: 25000, packPrice: 200,
      agents: AGENTS.map(({ id, enabled, adoption, volume, rate }) => ({
        id, enabled, adoption, volume, rate
      }))
    };
  }

  // Plain decimal or scientific notation only: no hex, binary, octal or other implicit conversions.
  const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

  function number(value, label, options = {}) {
    const min = options.min ?? 0;
    const max = options.max ?? MAX;
    if ((typeof value !== "string" && typeof value !== "number") ||
        (typeof value === "string" && !DECIMAL.test(value.trim()))) {
      throw new Error(`${label}: enter a number.`);
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new Error(`${label}: enter a finite number from ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")}.`);
    }
    if (options.integer && !Number.isSafeInteger(parsed)) {
      throw new Error(`${label}: enter a whole number.`);
    }
    // -0 is a valid zero, but it must never be displayed as "-0".
    return parsed === 0 ? 0 : parsed;
  }

  function bounded(value, label) {
    if (!Number.isFinite(value) || value > MAX) {
      throw new Error(`${label} exceeds the supported planning limit of ${MAX.toLocaleString("en-US")}. Reduce the inputs.`);
    }
    return value;
  }

  function calculate(input) {
    if (!input || typeof input !== "object") throw new Error("A calculator scenario is required.");
    const drivers = Object.fromEntries(Object.entries(DRIVERS).map(([key, driver]) => [
      key, number(input[key], driver.label, { integer: true, max: driver.max })
    ]));
    const otherCapacity = number(input.otherCapacity, "Allocated monthly credits", { integer: true });
    const buffer = number(input.buffer, "Planning buffer", { max: 100 });
    const paygRate = number(input.paygRate, "USD per credit", { max: 1000 });
    const packSize = number(input.packSize, "Credits per pack", { integer: true, min: 1 });
    const packPrice = number(input.packPrice, "USD per pack", { max: 1000000000 });
    if (!Array.isArray(input.agents) || input.agents.length !== AGENTS.length) {
      throw new Error("Include each of the two documented agent identities exactly once.");
    }
    const ids = new Set(input.agents.map(agent => agent?.id));
    if (ids.size !== AGENTS.length || AGENTS.some(agent => !ids.has(agent.id))) {
      throw new Error("Unknown or duplicate agent identity. Journey Creation Agent replaces Journey Copilot; don't add Journey Copilot separately.");
    }
    const rows = AGENTS.map(definition => {
      const agent = input.agents.find(item => item.id === definition.id);
      if (typeof agent.enabled !== "boolean") throw new Error(`${definition.name}: enabled must be true or false.`);
      if (!agent.enabled) return { id: agent.id, enabled: false, adoption: null, volume: null, reach: 0, activities: 0, rate: null, credits: 0, unpriced: false };
      const adoption = number(agent.adoption, `${definition.short} adoption`, { max: 100 });
      const volume = number(agent.volume, `${definition.short} ${definition.volumeLabel.toLowerCase()}`, { max: 1000000 });
      const reach = drivers[definition.driver] * adoption / 100;
      const activities = bounded(reach * volume, `${definition.short} monthly ${definition.unit}`);
      const missingRate = agent.rate === null || (typeof agent.rate === "string" && agent.rate.trim() === "");
      const rate = missingRate ? null : number(agent.rate, `${definition.short} ${definition.rateLabel.toLowerCase()}`, { max: 1000000 });
      const unpriced = activities > 0 && missingRate;
      const credits = unpriced ? null : bounded(activities * (rate ?? 0), `${definition.short} monthly credits`);
      return { id: agent.id, enabled: true, adoption, volume, reach, activities, rate, credits, unpriced };
    });
    const unpriced = rows.filter(row => row.unpriced);
    const knownCredits = bounded(rows.reduce((sum, row) => sum + (row.credits ?? 0), 0), "Total credits");
    const included = bounded(LICENSE_CREDITS + otherCapacity, "Available capacity");
    const buffered = bounded(knownCredits * (1 + buffer / 100), "Buffered credits");
    // Remove arithmetic noise at a whole-credit boundary, not genuine fractional credits.
    const nearestCredit = Math.round(buffered);
    const roundingNoise = Number.EPSILON * Math.max(1, buffered) * 2;
    const planningCredits = Math.ceil(Math.abs(buffered - nearestCredit) <= roundingNoise ? nearestCredit : buffered);
    const additional = Math.max(0, planningCredits - included);
    const packs = Math.ceil(additional / packSize);
    const paygCost = bounded(additional * paygRate, "Pay-as-you-go cost");
    const packCost = bounded(packs * packPrice, "Pack cost");
    return {
      journeys: drivers.journeys, contacts: drivers.contacts, rows, unpriced, complete: unpriced.length === 0,
      knownCredits, licenseCredits: LICENSE_CREDITS, otherCapacity, included, buffered, planningCredits,
      additional, packs, unusedPackCredits: packs * packSize - additional,
      paygCost, packCost, buffer, paygRate, packSize, packPrice
    };
  }

  const api = { VERIFIED_DATE, LICENSE_CREDITS, DRIVERS, AGENTS, SOURCES, defaults, calculate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.JourneysCalculator = api;
})(typeof globalThis === "undefined" ? this : globalThis);
