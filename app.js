(function () {
  "use strict";
  const { AGENTS, DRIVERS, SOURCES, VERIFIED_DATE, LICENSE_CREDITS, defaults, calculate } = window.JourneysCalculator;
  const $ = id => document.getElementById(id);
  const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  const moneyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rateFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const percentFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  const format = value => numberFormat.format(value);
  const money = value => moneyFormat.format(value);
  const rateMoney = value => rateFormat.format(value);
  const percent = value => `${percentFormat.format(value)}%`;
  const plural = (count, word, pluralWord = `${word}s`) => `${format(count)} ${count === 1 ? word : pluralWord}`;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
  const fields = ["journeys", "contacts", "otherCapacity", "buffer", "paygRate", "packSize", "packPrice"];
  const lockedFields = ["paygRate", "packSize", "packPrice"];
  const agentFields = ["adoption", "volume", "rate"];
  const THEME_KEY = "ci-journeys-agents-theme";
  let latest = null;
  let scenario = null;
  let initialized = false;
  let announceTimer = 0;
  let openedForPrint = [];

  function fieldMarkup(agent, field, label, attributes, help, extraDescription) {
    const id = `${agent.id}-${field}`;
    const describedBy = [`${id}-help`, extraDescription].filter(Boolean).join(" ");
    return `
          <div class="field">
            <label for="${id}">${escapeHtml(label)}</label>
            <input id="${id}" type="number" inputmode="decimal" ${attributes} value="${escapeHtml(agent[field])}" aria-describedby="${describedBy}">
            <small class="field-help" id="${id}-help">${escapeHtml(help)}</small>
          </div>`;
  }

  function renderCards() {
    $("agent-cards").innerHTML = AGENTS.map(agent => `
      <article class="agent-card" id="card-${agent.id}" aria-labelledby="title-${agent.id}">
        <div class="agent-head">
          <div>
            <div class="agent-title">
              <h3 class="agent-name" id="title-${agent.id}">${escapeHtml(agent.name)}</h3>
              <span class="badge">${escapeHtml(agent.status)}</span>
            </div>
            <p class="agent-description">${escapeHtml(agent.description)}</p>
          </div>
          <label class="switch">
            <input id="${agent.id}-enabled" type="checkbox" role="switch" ${agent.enabled ? "checked" : ""} aria-label="Include ${escapeHtml(agent.name)}">
            <span class="switch-track" aria-hidden="true"></span>
            <span class="switch-text" aria-hidden="true">Include</span>
          </label>
        </div>
        <fieldset class="agent-fields" id="${agent.id}-fields" aria-labelledby="title-${agent.id}">
          ${fieldMarkup(agent, "adoption", "Adoption (%)", 'min="0" max="100" step="0.1"', agent.adoptionHelp)}
          ${fieldMarkup(agent, "volume", agent.volumeLabel, 'min="0" max="1000000" step="any"', agent.volumeHelp)}
          ${fieldMarkup(agent, "rate", agent.rateLabel, 'min="0" max="1000000" step="any" placeholder="Unknown"', "Assumption, not a tariff", `note-${agent.id}`)}
        </fieldset>
        <div class="agent-result">
          <span class="formula" id="${agent.id}-formula"></span>
          <strong id="${agent.id}-result"></strong>
        </div>
        <p class="agent-note" id="note-${agent.id}">${escapeHtml(agent.note)} <a href="${escapeHtml(agent.source)}" target="_blank" rel="noopener noreferrer">Microsoft source<span class="sr-only"> for ${escapeHtml(agent.name)} (opens in a new tab)</span> &nearr;</a></p>
      </article>`).join("");
  }

  function renderSources() {
    $("source-list").innerHTML = SOURCES.map(source => `
      <li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}<span class="sr-only"> (opens in a new tab)</span> &nearr;</a><span class="source-note">${escapeHtml(source.note)}</span></li>`).join("");
  }

  function renderDates() {
    const date = new Date(`${VERIFIED_DATE}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return;
    const options = { day: "numeric", year: "numeric", timeZone: "UTC" };
    const labels = {
      "verified-short": new Intl.DateTimeFormat("en-US", { ...options, month: "short" }).format(date),
      "verified-long": new Intl.DateTimeFormat("en-US", { ...options, month: "long" }).format(date)
    };
    for (const [id, text] of Object.entries(labels)) {
      $(id).dateTime = VERIFIED_DATE;
      $(id).textContent = text;
    }
  }

  function renderExample() {
    try {
      const input = defaults();
      const result = calculate(input);
      const enabledCount = input.agents.filter(agent => agent.enabled).length;
      const capacity = result.included === 0
        ? `Customer Insights includes no Copilot Credits and this example allocates none, so all ${format(result.additional)} are additional credits`
        : `Customer Insights includes no Copilot Credits, so after ${format(result.included)} allocated credits that leaves ${format(result.additional)} additional credits`;
      $("example-flow").textContent = `${plural(result.journeys, DRIVERS.journeys.singular, DRIVERS.journeys.plural)} and ${plural(result.contacts, DRIVERS.contacts.singular, DRIVERS.contacts.plural)} entering journeys a month with ${enabledCount} example agents = ${format(result.knownCredits)} credits/month, or ${format(result.planningCredits)} with a ${percent(result.buffer)} buffer. ${capacity}: about ${money(result.paygCost)} pay-as-you-go or ${plural(result.packs, "prepaid pack")} (${money(result.packCost)}) per month.`;
    } catch (error) {
      // Keep the static example text if the defaults cannot be calculated.
    }
  }

  function readScenario() {
    const input = Object.fromEntries(fields.map(id => [id, $(id).value]));
    input.agents = AGENTS.map(({ id }) => ({
      id,
      enabled: $(`${id}-enabled`).checked,
      adoption: $(`${id}-adoption`).value,
      volume: $(`${id}-volume`).value,
      rate: $(`${id}-rate`).value
    }));
    return input;
  }

  function describe(input) {
    const label = input.dataset.label || input.labels?.[0]?.textContent.trim() || input.getAttribute("aria-label") || "Input";
    const card = input.closest(".agent-card");
    const agent = card && AGENTS.find(item => card.id === `card-${item.id}`);
    return agent ? `${agent.name} ${label.charAt(0).toLowerCase()}${label.slice(1)}` : label;
  }

  function announce(message) {
    if (!initialized) return;
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      $("live-status").textContent = message;
    }, 800);
  }

  // Make the sticky summary keyboard-scrollable only while it actually scrolls.
  function syncSummaryScroll() {
    const summary = $("estimate-summary");
    const scrollable = getComputedStyle(summary).overflowY !== "visible" && summary.scrollHeight > summary.clientHeight + 1;
    if (scrollable) summary.tabIndex = 0;
    else summary.removeAttribute("tabindex");
  }

  function update() {
    latest = null;
    scenario = null;
    $("errors").hidden = true;
    $("export").disabled = true;
    $("print").disabled = true;
    document.querySelectorAll('input[aria-invalid="true"]').forEach(input => input.removeAttribute("aria-invalid"));
    let enabledCount = 0;
    for (const agent of AGENTS) {
      const enabled = $(`${agent.id}-enabled`).checked;
      $(`${agent.id}-fields`).disabled = !enabled;
      $(`card-${agent.id}`).classList.toggle("is-disabled", !enabled);
      if (enabled) enabledCount++;
    }
    $("enabled-count").textContent = `${enabledCount} of ${AGENTS.length} included`;
    try {
      const invalid = [...document.querySelectorAll('main input[type="number"]')].find(input =>
        !input.disabled && !input.closest("fieldset:disabled") &&
        (!input.validity.valid || (input.value.trim() === "" && !input.id.endsWith("-rate")))
      );
      if (invalid) {
        invalid.setAttribute("aria-invalid", "true");
        const collapsed = invalid.closest("details:not([open])");
        if (collapsed) collapsed.open = true;
        throw new Error(`${describe(invalid)}: ${invalid.validationMessage || "enter a number."}`);
      }
      scenario = readScenario();
      latest = calculate(scenario);
      renderResult(latest);
      $("results").hidden = false;
      $("export").disabled = false;
      $("print").disabled = false;
    } catch (error) {
      latest = null;
      $("results").hidden = true;
      $("errors").textContent = `Estimate unavailable. ${error.message}`;
      $("errors").hidden = false;
      $("mobile-total").textContent = "Check inputs";
      for (const agent of AGENTS) {
        const enabled = $(`${agent.id}-enabled`).checked;
        $(`${agent.id}-formula`).textContent = enabled ? "" : "Turn on Include to add this workload.";
        $(`${agent.id}-result`).textContent = enabled ? "Check inputs" : "Not in this scenario";
        $(`${agent.id}-result`).classList.remove("is-unpriced");
      }
      announce(`Estimate unavailable. ${error.message}`);
    }
    syncSummaryScroll();
  }

  function renderResult(result) {
    const incomplete = !result.complete;
    const includedRows = result.rows.filter(row => row.enabled);
    const unpricedNames = result.unpriced.map(row => AGENTS.find(agent => agent.id === row.id).short);
    $("estimate-kind").textContent = incomplete ? "Known subtotal only - forecast incomplete" : "Illustrative credit estimate";
    $("total-credits").textContent = format(result.knownCredits);
    $("mobile-total").textContent = `${format(result.knownCredits)}${incomplete ? " (partial)" : ""}`;
    const status = $("forecast-status");
    status.classList.toggle("warning", incomplete);
    status.textContent = incomplete
      ? `${plural(result.unpriced.length, "included workload")} ${result.unpriced.length === 1 ? "has" : "have"} no rate: ${unpricedNames.join(", ")}. Their credits and costs are unknown and excluded, so these figures are partial, not a full budget.`
      : includedRows.length === 0
        ? "No agents are included. Turn on Include for at least one agent to estimate usage."
        : "Based on your workloads and assumed average rates, not published per-activity prices. Actual consumption varies.";
    $("subtotal").textContent = format(result.knownCredits);
    $("buffer-value").textContent = `(${percent(result.buffer)})`;
    $("buffer-credits").textContent = `+${format(result.buffered - result.knownCredits)}`;
    $("planning").textContent = format(result.planningCredits);
    $("included").textContent = format(result.included);
    const coverage = result.planningCredits === 0 ? 0 : Math.min(100, result.included / result.planningCredits * 100);
    $("capacity-fill").style.width = `${coverage}%`;
    const coverageText = result.planningCredits === 0
      ? `No ${incomplete ? "priced " : ""}consumption is modeled.`
      : `Available capacity covers ${percent(coverage)} of ${incomplete ? "known " : ""}planning credits.`;
    $("capacity-caption").textContent = `${format(result.licenseCredits)} credits included with Customer Insights + ${format(result.otherCapacity)} allocated credits. ${coverageText}${incomplete ? " Unpriced workloads are excluded." : ""}`;
    $("additional-label").textContent = incomplete ? "Additional credits (known only)" : "Additional credits";
    $("additional").textContent = format(result.additional);
    $("payg-cost").textContent = money(result.paygCost);
    $("payg-basis").textContent = `per month at ${rateMoney(result.paygRate)} per credit${incomplete ? " (partial)" : ""}`;
    $("pack-cost").textContent = money(result.packCost);
    $("pack-count").textContent = `${plural(result.packs, "pack")} \u00d7 ${money(result.packPrice)} per month${incomplete ? " (partial)" : ""}`;
    $("pack-unused").textContent = `Prepaid comparison uses ${format(result.packSize)}-credit packs, leaving ${plural(result.unusedPackCredits, "unused credit")} from whole-pack rounding. Pay-as-you-go and prepaid are alternatives, not additive. ${incomplete ? "Neither cost is a complete forecast." : "License fees and taxes are excluded."}`;

    for (const definition of AGENTS) {
      const row = result.rows.find(item => item.id === definition.id);
      const resultElement = $(`${definition.id}-result`);
      resultElement.classList.toggle("is-unpriced", row.unpriced);
      if (!row.enabled) {
        resultElement.textContent = "Not in this scenario";
        $(`${definition.id}-formula`).textContent = "Turn on Include to add this workload.";
        continue;
      }
      const driver = DRIVERS[definition.driver];
      const rateText = row.rate === null ? "unknown credits" : plural(row.rate, "credit");
      $(`${definition.id}-formula`).textContent = `${plural(result[definition.driver], driver.singular, driver.plural)} \u00d7 ${percent(row.adoption)} = ${format(row.reach)} ${definition.reach} \u00d7 ${plural(row.volume, definition.activity, definition.unit)} per ${definition.per} = ${plural(row.activities, definition.activity, definition.unit)} a month \u00d7 ${rateText} each`;
      resultElement.textContent = row.unpriced ? "Unpriced - excluded" : `${format(row.credits)} credits/mo`;
    }

    const rows = includedRows.map(row => {
      const definition = AGENTS.find(agent => agent.id === row.id);
      const tableRow = document.createElement("tr");
      if (row.unpriced) tableRow.className = "unpriced";
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = definition.short;
      const credits = document.createElement("td");
      credits.textContent = row.unpriced ? "Unpriced" : format(row.credits);
      const share = document.createElement("td");
      share.textContent = row.unpriced || result.knownCredits === 0 ? "n/a" : percent(row.credits / result.knownCredits * 100);
      tableRow.append(name, credits, share);
      return tableRow;
    });
    if (!rows.length) {
      const emptyRow = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 3;
      cell.className = "empty";
      cell.textContent = "No agents included.";
      emptyRow.append(cell);
      rows.push(emptyRow);
    }
    $("breakdown").replaceChildren(...rows);

    announce(incomplete
      ? `Partial estimate updated: ${format(result.knownCredits)} known credits per month before buffer; ${plural(result.unpriced.length, "included workload")} unpriced and excluded.`
      : `Estimate updated: ${format(result.knownCredits)} credits per month before buffer; ${format(result.additional)} additional credits.`);
  }

  function reset() {
    const example = defaults();
    for (const id of fields) $(id).value = example[id];
    for (const agent of example.agents) {
      $(`${agent.id}-enabled`).checked = agent.enabled;
      for (const field of agentFields) $(`${agent.id}-${field}`).value = agent[field];
    }
    update();
  }

  function currentTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function syncThemeButton() {
    $("theme-toggle").setAttribute("aria-label", `Switch theme (current: ${currentTheme()})`);
  }

  function exportEstimate() {
    if (!latest || !scenario) return;
    const output = {
      title: document.title,
      exportedAt: new Date().toISOString(),
      sourcesChecked: VERIFIED_DATE,
      disclaimer: "Non-binding informational estimate only. Confirm pricing, eligibility, and licensing terms with Microsoft or an authorized partner. All per-activity rates are user-editable assumptions, not official Microsoft rates. Customer Insights licenses include no Copilot Credits. Unknown active workloads are excluded from numeric subtotals. Actual consumption and costs vary.",
      status: latest.complete ? "Priced planning scenario (assumed rates)" : "INCOMPLETE - unpriced workloads excluded",
      scenario,
      result: latest,
      agents: AGENTS.map(({ id, name, status, driver, unit, activity, note, source }) => ({ id, name, status, driver, unit, activity, note, source })),
      sources: SOURCES
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ci-journeys-agent-estimate-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  renderCards();
  renderSources();
  renderDates();
  renderExample();
  syncThemeButton();
  $("license-credits").textContent = format(LICENSE_CREDITS);

  const main = document.querySelector("main");
  main.addEventListener("input", update);
  main.addEventListener("change", update);
  $("reset").addEventListener("click", reset);
  $("clear-rates").addEventListener("click", () => {
    for (const agent of AGENTS) $(`${agent.id}-rate`).value = "";
    update();
  });
  $("theme-toggle").addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (error) {
      // Storage can be unavailable in private or embedded contexts; the theme still switches.
    }
    syncThemeButton();
  });
  $("print").addEventListener("click", () => {
    if (latest) window.print();
  });
  $("export").addEventListener("click", exportEstimate);
  $("estimate-summary").addEventListener("toggle", syncSummaryScroll, true);
  if ("ResizeObserver" in window) new ResizeObserver(syncSummaryScroll).observe($("estimate-summary"));
  window.addEventListener("beforeprint", () => {
    openedForPrint = [...document.querySelectorAll("details:not([open]):not(.how-to)")];
    openedForPrint.forEach(details => { details.open = true; });
  });
  window.addEventListener("afterprint", () => {
    openedForPrint.forEach(details => { details.open = false; });
    openedForPrint = [];
  });

  // Read-only list prices always show the published values, even if the browser restored older form state.
  const published = defaults();
  for (const id of lockedFields) $(id).value = published[id];

  update();
  initialized = true;
})();
