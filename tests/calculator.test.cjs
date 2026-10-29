"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { AGENTS, DRIVERS, SOURCES, LICENSE_CREDITS, VERIFIED_DATE, defaults, calculate } = require("../calculator.js");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function oneAgent(id = "journey-creation") {
  const input = defaults();
  input.journeys = 1;
  input.contacts = 1;
  input.buffer = 0;
  input.agents.forEach(agent => { agent.enabled = false; });
  Object.assign(input.agents.find(agent => agent.id === id), { enabled: true, adoption: 100, volume: 1, rate: 1 });
  return input;
}

function inputTag(id) {
  const tag = html.match(new RegExp(`<input\\b[^>]*\\sid="${id}"[^>]*>`));
  assert.ok(tag, `index.html is missing input #${id}`);
  return tag[0];
}

test("illustrative scenario is deterministic and credits no license capacity", () => {
  const result = calculate(defaults());
  assert.deepEqual(result.rows.map(row => [row.id, row.reach, row.activities, row.credits]), [
    ["journey-creation", 10, 80, 2000],
    ["outreach-optimization", 2500, 7500, 37500]
  ]);
  assert.equal(result.knownCredits, 39500);
  assert.equal(result.licenseCredits, 0);
  assert.equal(result.included, 0);
  assert.equal(result.planningCredits, 45425);
  assert.equal(result.additional, 45425);
  assert.equal(result.paygCost, 454.25);
  assert.equal(result.packs, 2);
  assert.equal(result.packCost, 400);
  assert.equal(result.unusedPackCredits, 4575);
  assert.equal(result.complete, true);
});

test("both documented agent identities are covered once, and Journey Copilot is not added separately", () => {
  assert.deepEqual(AGENTS.map(agent => agent.id), ["journey-creation", "outreach-optimization"]);
  assert.equal(new Set(AGENTS.map(agent => agent.name)).size, AGENTS.length);
  assert.ok(AGENTS.every(agent => agent.status === "Preview" && DRIVERS[agent.driver]));
  assert.ok(!AGENTS.some(agent => /journey copilot/i.test(agent.name)));
  assert.match(AGENTS[0].note, /Replaces Journey Copilot/);

  const duplicate = defaults();
  duplicate.agents[1].id = "journey-creation";
  assert.throws(() => calculate(duplicate), /duplicate agent identity/);
  const alias = defaults();
  alias.agents[0].id = "journey-copilot";
  assert.throws(() => calculate(alias), /replaces Journey Copilot/);
  const extra = defaults();
  extra.agents.push({ id: "journey-copilot", enabled: true, adoption: 100, volume: 1, rate: 1 });
  assert.throws(() => calculate(extra), /two documented agent identities/);
  const missing = defaults();
  missing.agents.pop();
  assert.throws(() => calculate(missing), /two documented agent identities/);
});

test("each agent uses its own workload driver", () => {
  const creation = oneAgent("journey-creation");
  creation.journeys = 3;
  creation.contacts = 1000;
  assert.equal(calculate(creation).knownCredits, 3);
  const outreach = oneAgent("outreach-optimization");
  outreach.journeys = 3;
  outreach.contacts = 1000;
  assert.equal(calculate(outreach).knownCredits, 1000);
});

test("zero journeys and contacts create no demand or cost, even with missing rates", () => {
  const input = defaults();
  input.journeys = 0;
  input.contacts = 0;
  input.agents.forEach(agent => { agent.rate = ""; agent.enabled = true; });
  const result = calculate(input);
  for (const key of ["knownCredits", "planningCredits", "additional", "paygCost", "packCost", "packs", "unusedPackCredits"]) assert.equal(result[key], 0);
  assert.equal(result.complete, true);
  const zeroAdoption = defaults();
  zeroAdoption.agents.forEach(agent => { agent.adoption = 0; agent.rate = ""; });
  assert.equal(calculate(zeroAdoption).complete, true);
});

test("all disabled agents contribute zero; inactive invalid controls are ignored", () => {
  const input = defaults();
  input.agents.forEach(agent => { agent.enabled = false; agent.rate = -1; agent.volume = ""; agent.adoption = "nope"; });
  const result = calculate(input);
  assert.equal(result.knownCredits, 0);
  assert.equal(result.planningCredits, 0);
  assert.equal(result.paygCost, 0);
  assert.equal(result.packs, 0);
  assert.equal(result.complete, true);
  assert.ok(result.rows.every(row => !row.enabled && row.credits === 0));
});

test("blank rate is unknown, not free, and partial totals are explicitly flagged", () => {
  const input = oneAgent();
  for (const blank of ["", " ", null]) {
    input.agents[0].rate = blank;
    const result = calculate(input);
    assert.equal(result.complete, false);
    assert.equal(result.unpriced[0].id, "journey-creation");
    assert.equal(result.rows[0].credits, null);
    assert.equal(result.knownCredits, 0);
  }
  input.agents[0].rate = 0;
  const free = calculate(input);
  assert.equal(free.complete, true);
  assert.equal(free.knownCredits, 0);

  const partial = defaults();
  partial.agents[1].rate = "";
  const result = calculate(partial);
  assert.equal(result.complete, false);
  assert.deepEqual(result.unpriced.map(row => row.id), ["outreach-optimization"]);
  assert.equal(result.knownCredits, 2000);
  assert.equal(result.planningCredits, 2300);
});

test("Customer Insights includes no credits; only allocated capacity reduces additional credits", () => {
  assert.equal(LICENSE_CREDITS, 0);
  const input = defaults();
  input.otherCapacity = 20000;
  let result = calculate(input);
  assert.equal(result.included, 20000);
  assert.equal(result.additional, 25425);
  assert.equal(result.packs, 2);
  input.otherCapacity = 50000;
  result = calculate(input);
  assert.equal(result.additional, 0);
  assert.equal(result.paygCost, 0);
  assert.equal(result.packs, 0);
  assert.equal(result.packCost, 0);
  input.agents.forEach(agent => { agent.adoption = 0; });
  assert.equal(calculate(input).included, 50000);
});

test("buffer applied once, whole credit ceiling once and whole packs rounded up", () => {
  const input = oneAgent();
  input.agents[0].rate = 100;
  input.buffer = 10;
  let result = calculate(input);
  assert.equal(result.planningCredits, 110);
  input.agents[0].rate = 25000;
  input.buffer = 0;
  assert.equal(calculate(input).packs, 1);
  input.agents[0].rate = 25000.01;
  result = calculate(input);
  assert.equal(result.planningCredits, 25001);
  assert.equal(result.packs, 2);
  assert.equal(result.unusedPackCredits, 24999);
});

test("fractional adoption and activities are not prematurely rounded", () => {
  const input = oneAgent();
  input.journeys = 3;
  input.agents[0].adoption = 50;
  input.agents[0].volume = 0.5;
  input.agents[0].rate = 2;
  const result = calculate(input);
  assert.equal(result.rows[0].reach, 1.5);
  assert.equal(result.rows[0].activities, 0.75);
  assert.equal(result.knownCredits, 1.5);
  assert.equal(result.planningCredits, 2);
});

test("whole-credit normalization does not erase genuine small fractional usage", () => {
  const input = oneAgent();
  input.agents[0].rate = 1.00000000000001;
  assert.equal(calculate(input).planningCredits, 2);
  input.agents[0].rate = 100;
  input.buffer = 10;
  assert.equal(calculate(input).planningCredits, 110);
  input.agents[0].rate = 25000.000001;
  input.buffer = 0;
  assert.equal(calculate(input).packs, 2);
});

test("invalid, negative, missing, infinite and out-of-bound inputs are rejected", () => {
  for (const [field, driver] of Object.entries(DRIVERS)) {
    for (const bad of [-1, 1.5, driver.max + 1, "", " ", "nope", "0x10", "1_000", NaN, Infinity, -Infinity, null, undefined, true, [], {}]) {
      const input = defaults();
      input[field] = bad;
      assert.throws(() => calculate(input), new RegExp(driver.label), `${field} accepted ${String(bad)}`);
    }
    const atLimit = defaults();
    atLimit[field] = String(driver.max);
    assert.doesNotThrow(() => calculate(atLimit));
  }
  for (const [field, value] of [["otherCapacity", -1], ["otherCapacity", 1.5], ["otherCapacity", Infinity], ["otherCapacity", "1e13"], ["buffer", -1], ["buffer", 101], ["buffer", "Infinity"], ["packSize", 0], ["packSize", 1.5], ["paygRate", -0.01], ["paygRate", "NaN"], ["packPrice", -1], ["packPrice", null]]) {
    const input = defaults();
    input[field] = value;
    assert.throws(() => calculate(input), undefined, `${field} accepted ${String(value)}`);
  }
  for (const [field, value] of [["adoption", 101], ["adoption", -1], ["adoption", ""], ["volume", ""], ["volume", -1], ["volume", Infinity], ["volume", 1000001], ["rate", -1], ["rate", "NaN"], ["rate", "0b1"], ["rate", true], ["rate", undefined], ["enabled", "true"], ["enabled", 1]]) {
    const input = oneAgent();
    input.agents[0][field] = value;
    assert.throws(() => calculate(input), /Journey Creation/, `${field} accepted ${String(value)}`);
  }
});

test("decimal strings are accepted and negative zero never reaches results", () => {
  const input = defaults();
  Object.assign(input, { journeys: "20", contacts: "1e4", otherCapacity: "-0", buffer: "15.0" });
  input.agents[0].rate = "25.";
  input.agents[1].rate = ".5e1";
  assert.equal(calculate(input).knownCredits, 39500);

  const zero = defaults();
  Object.assign(zero, { journeys: "-0", contacts: -0, otherCapacity: "-0", buffer: "-0" });
  zero.agents.forEach(agent => { agent.adoption = "-0"; agent.volume = "-0"; agent.rate = "-0"; });
  const result = calculate(zero);
  const values = [result.journeys, result.contacts, result.otherCapacity, result.included, result.buffer,
    result.knownCredits, result.buffered, result.planningCredits, result.additional, result.paygCost,
    ...result.rows.flatMap(row => [row.adoption, row.volume, row.reach, row.activities, row.rate, row.credits])];
  assert.ok(values.every(value => !Object.is(value, -0)), "a value is -0");
});

test("unknown agent IDs and missing scenarios cannot fabricate success", () => {
  const input = defaults();
  input.agents[1].id = "conversational-journeys";
  assert.throws(() => calculate(input), /Unknown or duplicate/);
  const nullAgent = defaults();
  nullAgent.agents[0] = null;
  assert.throws(() => calculate(nullAgent), /Unknown or duplicate/);
  const noAgents = defaults();
  noAgents.agents = "all";
  assert.throws(() => calculate(noAgents), /two documented/);
  for (const bad of [null, undefined, 42, "scenario"]) assert.throws(() => calculate(bad), /scenario/);
});

test("large finite inputs cannot overflow totals into Infinity or unsafe planning values", () => {
  const input = oneAgent("outreach-optimization");
  input.contacts = DRIVERS.contacts.max;
  input.agents[1].volume = 1000000;
  assert.throws(() => calculate(input), /supported planning limit/);
  input.agents[1].volume = 1000;
  input.agents[1].rate = 2;
  assert.throws(() => calculate(input), /supported planning limit/);
});

test("only the published list prices are read-only, and they match the engine defaults", () => {
  const readonlyInputs = html.match(/<input\b[^>]*\sreadonly(?=[\s/>])[^>]*>/g) || [];
  assert.deepEqual(readonlyInputs.map(tag => tag.match(/\sid="([^"]+)"/)[1]), ["paygRate", "packSize", "packPrice"]);
  const published = { paygRate: 0.01, packSize: 25000, packPrice: 200 };
  const input = defaults();
  for (const tag of readonlyInputs) {
    const id = tag.match(/\sid="([^"]+)"/)[1];
    assert.equal(input[id], published[id]);
    assert.equal(Number(tag.match(/\svalue="([^"]*)"/)[1]), published[id]);
  }
});

test("static page fallbacks, input limits and verification dates match the engine", () => {
  const input = defaults();
  for (const [id, driver] of Object.entries(DRIVERS)) {
    const tag = inputTag(id);
    assert.equal(Number(tag.match(/\svalue="([^"]*)"/)[1]), input[id]);
    assert.equal(Number(tag.match(/\smax="([^"]*)"/)[1]), driver.max);
  }
  for (const id of ["otherCapacity", "buffer"]) assert.equal(Number(inputTag(id).match(/\svalue="([^"]*)"/)[1]), input[id]);
  const result = calculate(input);
  const total = result.knownCredits.toLocaleString("en-US");
  assert.ok(html.includes(`id="total-credits">${total}<`));
  assert.ok(html.includes(`id="mobile-total">${total}<`));
  assert.ok(html.includes(`= ${total} credits/month, or ${result.planningCredits.toLocaleString("en-US")} with a 15% buffer`));
  assert.ok(html.includes(`>${input.agents.length} of ${AGENTS.length} included<`));
  assert.match(VERIFIED_DATE, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal((html.match(new RegExp(`datetime="${VERIFIED_DATE}"`, "g")) || []).length, 2);
});

test("every agent and source links to a primary Microsoft HTTPS page", () => {
  const urls = SOURCES.map(source => source.url);
  assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) assert.match(url, /^https:\/\/(learn\.microsoft\.com|www\.microsoft\.com|aka\.ms)\//);
  for (const agent of AGENTS) assert.ok(urls.includes(agent.source), `${agent.id} source is not listed`);
  assert.ok(SOURCES.every(source => source.title && source.note));
});
