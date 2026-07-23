# Spec: new-product SKU generator (clean path)

A separate, simpler tool for **new products**, where the data is entered well.
It generates a deterministic, unique, cross-shop-stable SKU from the **"good"
columns only** — `Vendor` + `Type` + `Options` — with **no** reliance on title,
handle, supplier codes, or collision hashing.

It must stay **SKU-compatible** with this repo's generator: for a product on the
generated (no-supplier-code) path, both tools must produce the **same** SKU.

---

## 1. Core idea

> **`Vendor` + `Type` + `Options` must uniquely identify each distinct product.**

If that holds, the SKU is deterministic, unique, and identical across shops —
because it's a pure function of those normalized values. This tool **enforces**
that contract instead of papering over violations.

The legacy generator (this repo) exists for *messy/existing* data: it adds a
handle hash when products collide, infers `Type` from the title when blank, and
anchors on a supplier code when present. **The new tool deliberately drops all
three** and instead treats those situations as **data errors to fix at the
source**.

---

## 2. SKU format (identical to the legacy generated path)

```
VENDOR_id - TYPE_id - <segment> - <segment> ...
```

- `VENDOR_id` — from `vendor_mapping_canonical.csv` (raw `Vendor` → id).
- `TYPE_id` — from `type_mapping_canonical.csv` (raw `Type` → id).
- one **segment per filled option**, in slot order (Option1 → 2 → 3):
  `CONCEPT_id _ NORMALIZED_VALUE`
  - `CONCEPT_id` from `option_names_canonical.csv` (raw option **name** → concept id).
  - `NORMALIZED_VALUE` from `option_values_linked_canonical.csv`
    (`(concept_id, raw value)` → normalized), falling back to `value.upper()`.
  - the `Title` / `Default Title` placeholder option contributes **no** segment.

No `HASH6`, no `HASH4`, no handle, no title. A single-variant product with no real
options yields just `VENDOR_id-TYPE_id` — allowed **only if that is unique**.

---

## 3. Inputs

Per variant (the "good" columns):
- `Vendor`, `Type`
- `Option1 Name`/`Value`, `Option2 Name`/`Value`, `Option3 Name`/`Value`

Reference files (the **same** curated files this repo uses — reuse them verbatim
so IDs and value normalization match):
- `vendor_mapping_canonical.csv`, `type_mapping_canonical.csv`
- `option_names_canonical.csv`, `option_values_linked_canonical.csv`

> `Variant Price` is **not** part of the SKU (volatile, shop-specific). `Handle`
> and `Title` are **not** inputs to the SKU value.

---

## 4. Algorithm

For each product/variant:
1. `VENDOR_id = VENDOR[raw_vendor]` — **error** if unknown.
2. `TYPE_id = TYPE[raw_type]` — **error** if blank or unknown. (No title inference.)
3. For each option slot with both name and value: resolve concept + normalized
   value, skip the `TITLE` placeholder, emit `CONCEPT_id_VALUE`. An option **name**
   not in the reference → **error**.
4. `SKU = VENDOR_id-TYPE_id` joined with the segments.
5. **Uniqueness check** (see §5).

Everything is a pure lookup + join — no free-text parsing, no randomness.

---

## 5. The uniqueness contract (the key difference)

After generating, verify **no two distinct products produce the same SKU**:
- within the batch being processed, **and**
- against a **registry of already-issued SKUs** (existing catalog), so a new
  product never reuses an existing product's SKU.

On a collision → **reject with a clear error**, e.g.:

> `PC-SU-HED_BOWL_HEAD-FEA_MULTI_RAIL…` is produced by two different products
> (`Long 364C`, `Short 362C`). Add an option that distinguishes them
> (e.g. `Length: Long/Short` or `Model: 364C/362C`).

This is the whole point: a collision means `Vendor+Type+Options` is **not**
distinguishing, which for a new product is a fixable data gap — add the missing
option. The tool must **not** silently disambiguate (no handle hash), because that
reintroduces the shop-specific instability the legacy tool suffers from.

---

## 6. What it deliberately does NOT do

- ❌ No **title** inference — `Type` is required.
- ❌ No **handle** in the SKU value — collisions are errors, not hashed.
- ❌ No **supplier-code** anchoring — cross-shop stability comes from consistent
  `Vendor+Type+Options`, not from a supplier code. (Supplier codes remain the
  legacy tool's mechanism for messy existing data.)
- ❌ No **price** in the SKU.

---

## 7. Required data discipline (enforced, not assumed)

For every new product, to guarantee a good SKU:
1. **`Vendor`** — must map to a known vendor id.
2. **`Type`** — must be filled and map to a known type id. Keep it **consistent
   across shops** (a differing `Type` changes the prefix → different SKU).
3. **Options** — enough option name/value pairs (all in the reference dictionaries)
   that the product's `Vendor+Type+Options` is **unique among all products**. If two
   real products would otherwise match, add a distinguishing option.

Enter these **consistently across shops** and the same product gets the same SKU
everywhere — no supplier code, no handle, no title needed.

---

## 8. Determinism

- Same inputs + same reference files → identical SKU, every time.
- No randomness, timestamps, locale, or free-text dependence.
- Reference files are the source of truth.

---

## 9. Relationship to this repo's generator

| | Legacy generator (this repo) | New-product tool |
|---|---|---|
| Target data | messy / existing exports | new, well-entered products |
| Blank `Type` | title inference (flagged) | **error** |
| Supplier code | anchors (`HASH6`), carried in `Variant Barcode` | not used |
| Core collision | `-HASH4(handle)` | **error** (add an option) |
| Segment logic | `VENDOR-TYPE-CONCEPT_VALUE…` | **identical** (reuse it) |

Because the segment logic is shared, a product that would take the legacy tool's
*generated* path gets the **same** SKU from the new tool — the new tool just
refuses the ambiguous cases the legacy tool masks.

---

## 10. Open decisions to confirm

1. **Reference mapping vs pre-normalized input** — assumed here the new tool reuses
   the reference files (for SKU parity). Confirm, or does it receive already-resolved
   IDs/values?
2. **Collision handling** — hard error (assumed) vs flag-and-continue for review?
3. **SKU registry** — where does the "already-issued SKUs" list live (a file, a DB,
   the Shopify/Odoo export)? Needed for the cross-batch uniqueness check.
