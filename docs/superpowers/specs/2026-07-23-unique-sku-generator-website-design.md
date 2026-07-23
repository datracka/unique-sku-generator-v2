# Design: unique-sku-generator-website

Date: 2026-07-23

## Purpose

An interactive, static website (plain HTML/CSS/JS, GitHub Pages deployable) that
generates a deterministic, spec-compliant SKU for a **new product** from
`Vendor` + `Type` + `Options`, following the clean-path logic in
`NEW-PRODUCT-SKU-TOOL-SPEC.md`. The user picks values from dropdowns and copies
the resulting SKU directly from the screen.

## SKU format (identical to the repo's generated path)

```
VENDOR_id-TYPE_id[-CONCEPT_id_VALUE ...]
```

- `VENDOR_id` = `vendor_abv` from `vendor_mapping_canonical.csv`.
- `TYPE_id` = `id` from `type_mapping_canonical.csv`.
- one segment per filled option, in slot order (Option1 -> 2 -> 3):
  `CONCEPT_id_NORMALIZED_VALUE`
  - `CONCEPT_id` = `concept_id` from `option_names_canonical.csv` (raw name -> concept).
  - `NORMALIZED_VALUE` from `option_values_linked_canonical.csv`, keyed by
    `(concept_id, raw value)` -> `normalized_option_value`; fallback `value.toUpperCase()`.
  - the `TITLE` / `Default Title` placeholder concept contributes no segment.
- segments join with `-`. A product with no real options yields `VENDOR_id-TYPE_id`.

No hashes, no handle, no title inference, no supplier code, no price. Pure lookup + join.

## Data source

The four canonical reference files, copied verbatim from
`skus-generator-v2/data/` into `./data/`:
- `vendor_mapping_canonical.csv`
- `type_mapping_canonical.csv`
- `option_names_canonical.csv`
- `option_values_linked_canonical.csv`

## Structure

- `index.html` — form + live result.
- `styles.css` — styling.
- `js/csv.js` — minimal CSV parser (handles quoted fields, commas, newlines).
- `js/app.js` — load CSVs, build dropdowns, compute SKU, copy to clipboard.
- `data/` — the 4 canonical CSVs.
- `README.md` — deploy steps.

## UX / behavior

- **Vendor** dropdown: distinct `raw_vendor` values (label shows brand).
- **Type** dropdown: distinct `raw` types (label shows normalized).
- **Three option rows**, each: option-name dropdown (distinct `raw_option_name`)
  and a value dropdown **filtered** to the chosen concept's known raw values.
  Because values come from the dictionary, "unknown value" cannot occur.
- SKU display updates live; **Copy** button uses the Clipboard API with a
  fallback. Empty/invalid selections show guidance rather than a broken SKU.
- Deterministic: same selections always produce the same SKU.

## Out of scope (v1)

- The spec's cross-catalog **uniqueness contract** (registry of already-issued
  SKUs) is not enforced in this interactive tool. A UI note states this. A
  paste-in registry check can be added later.

## Deploy

Relative asset paths so it works from any GitHub Pages subpath. README documents
enabling Pages on the repo. No build step.
