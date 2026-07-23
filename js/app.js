import { parseCSV } from "./csv.js";

const TITLE_CONCEPT = "TITLE";
const DATA = {
  vendor: "./data/vendor_mapping_canonical.csv",
  type: "./data/type_mapping_canonical.csv",
  optionNames: "./data/option_names_canonical.csv",
  optionValues: "./data/option_values_linked_canonical.csv",
};

// (concept_id, raw value) join key — matches the reference generator exactly.
const valueKey = (conceptId, rawValue) => `${conceptId} ${rawValue}`;

// ---- reference tables built from the canonical CSVs -------------------------

const refs = {
  vendor: new Map(),          // raw_vendor -> { abv, brand }
  type: new Map(),            // raw -> { id, normalized }
  concept: new Map(),         // raw_option_name -> { concept, conceptId }
  value: new Map(),           // "conceptId rawValue" -> normalized
  valuesByConcept: new Map(), // conceptId -> [{ raw, normalized }]
};

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return res.text();
}

async function loadReferences() {
  const [vendorText, typeText, namesText, valuesText] = await Promise.all([
    fetchText(DATA.vendor), fetchText(DATA.type),
    fetchText(DATA.optionNames), fetchText(DATA.optionValues),
  ]);

  for (const row of parseCSV(vendorText).rows) {
    const raw = row["raw_vendor"];
    if (raw) refs.vendor.set(raw, { abv: row["vendor_abv"], brand: row["vendor_brand"] });
  }
  for (const row of parseCSV(typeText).rows) {
    const raw = row["raw"];
    if (raw) refs.type.set(raw, { id: row["id"], normalized: row["normalized"] });
  }
  for (const row of parseCSV(namesText).rows) {
    const raw = row["raw_option_name"];
    if (raw) refs.concept.set(raw, { concept: row["concept"], conceptId: row["concept_id"] });
  }
  for (const row of parseCSV(valuesText).rows) {
    const cid = row["concept_id"];
    const raw = row["raw_option_value"];
    const normalized = row["normalized_option_value"];
    refs.value.set(valueKey(cid, raw), normalized);
    if (!refs.valuesByConcept.has(cid)) refs.valuesByConcept.set(cid, []);
    refs.valuesByConcept.get(cid).push({ raw, normalized });
  }
}

// ---- dropdown population ----------------------------------------------------

const byLocale = (a, b) => a.localeCompare(b);

function fillDatalist(el, items) {
  el.replaceChildren(...items.map((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    return opt;
  }));
}

function populateStaticDropdowns() {
  fillDatalist(
    document.getElementById("vendor-list"),
    [...refs.vendor.keys()].sort(byLocale)
  );
  fillDatalist(
    document.getElementById("type-list"),
    [...refs.type.keys()].sort(byLocale)
  );
  const optionNames = [...refs.concept.keys()].sort(byLocale);
  for (const list of document.querySelectorAll(".option-name-list")) {
    fillDatalist(list, optionNames);
  }
}

// The value list for an option row depends on the chosen option name's concept.
function refreshValueList(rowEl) {
  const nameInput = rowEl.querySelector(".option-name");
  const valueList = rowEl.querySelector(".option-value-list");
  const concept = refs.concept.get(nameInput.value.trim());
  if (!concept) { fillDatalist(valueList, []); return; }
  const values = refs.valuesByConcept.get(concept.conceptId) || [];
  const seen = new Set();
  const raws = [];
  for (const v of values) {
    if (!seen.has(v.raw)) { seen.add(v.raw); raws.push(v.raw); }
  }
  fillDatalist(valueList, raws.sort(byLocale));
}

// ---- SKU computation --------------------------------------------------------

// Returns { sku, errors[], notes[] }. sku is null when vendor/type can't resolve.
function computeSku() {
  const errors = [];
  const notes = [];

  const rawVendor = document.getElementById("vendor").value.trim();
  const rawType = document.getElementById("type").value.trim();

  if (!rawVendor) return { sku: null, errors: ["Select a Vendor."], notes };
  const vendor = refs.vendor.get(rawVendor);
  if (!vendor) return { sku: null, errors: [`Unknown vendor: "${rawVendor}". Pick one from the list.`], notes };

  if (!rawType) return { sku: null, errors: ["Select a Type."], notes };
  const type = refs.type.get(rawType);
  if (!type) return { sku: null, errors: [`Unknown type: "${rawType}". Pick one from the list.`], notes };

  const segments = [];
  document.querySelectorAll(".option-row").forEach((rowEl, i) => {
    const rawName = rowEl.querySelector(".option-name").value.trim();
    const rawValue = rowEl.querySelector(".option-value").value.trim();
    if (!rawName && !rawValue) return;              // empty slot
    if (rawName && !rawValue) { notes.push(`Option ${i + 1}: name set but value empty — skipped.`); return; }
    if (!rawName && rawValue) { errors.push(`Option ${i + 1}: value set but no option name.`); return; }

    const concept = refs.concept.get(rawName);
    if (!concept) { errors.push(`Option ${i + 1}: unknown option name "${rawName}".`); return; }
    if (concept.concept === TITLE_CONCEPT) return;  // placeholder contributes no segment

    const normalized = refs.value.get(valueKey(concept.conceptId, rawValue)) ?? rawValue.toUpperCase();
    if (!refs.value.has(valueKey(concept.conceptId, rawValue))) {
      notes.push(`Option ${i + 1}: "${rawValue}" not in the dictionary — normalized as "${normalized}".`);
    }
    segments.push(`${concept.conceptId}_${normalized}`);
  });

  if (errors.length) return { sku: null, errors, notes };

  const prefix = `${vendor.abv}-${type.id}`;
  const sku = [prefix, ...segments].join("-");
  return { sku, errors, notes };
}

// ---- rendering --------------------------------------------------------------

const skuOutput = document.getElementById("sku-output");
const copyBtn = document.getElementById("copy-btn");
const messages = document.getElementById("messages");

function render() {
  const { sku, errors, notes } = computeSku();

  if (sku) {
    skuOutput.textContent = sku;
    skuOutput.classList.remove("empty");
    copyBtn.disabled = false;
  } else {
    skuOutput.textContent = "—";
    skuOutput.classList.add("empty");
    copyBtn.disabled = true;
  }

  messages.replaceChildren();
  for (const e of errors) messages.appendChild(msgEl(e, "error"));
  for (const n of notes) messages.appendChild(msgEl(n, "note"));
}

function msgEl(text, kind) {
  const el = document.createElement("div");
  el.className = `msg msg-${kind}`;
  el.textContent = text;
  return el;
}

async function copySku() {
  const text = skuOutput.textContent;
  if (!text || copyBtn.disabled) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for non-secure contexts / older browsers.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const original = copyBtn.textContent;
  copyBtn.textContent = "Copied!";
  copyBtn.classList.add("copied");
  setTimeout(() => { copyBtn.textContent = original; copyBtn.classList.remove("copied"); }, 1200);
}

// ---- wiring -----------------------------------------------------------------

function wireEvents() {
  document.getElementById("form").addEventListener("input", (e) => {
    if (e.target.classList.contains("option-name")) {
      refreshValueList(e.target.closest(".option-row"));
    }
    render();
  });
  copyBtn.addEventListener("click", copySku);
}

async function init() {
  try {
    await loadReferences();
    populateStaticDropdowns();
    wireEvents();
    render();
  } catch (err) {
    messages.replaceChildren(msgEl(`Could not load reference data: ${err.message}`, "error"));
  }
}

init();
