# Unique SKU Generator

A static, dependency-free website (plain HTML/CSS/JS) that generates a
deterministic SKU for a **new product** from `Vendor` + `Type` + `Options`,
following the clean-path logic in [`NEW-PRODUCT-SKU-TOOL-SPEC.md`](./NEW-PRODUCT-SKU-TOOL-SPEC.md).

Pick a Vendor, a Type and up to three option name/value pairs from the
searchable dropdowns; the SKU updates live and can be copied with one click.

## SKU format

```
VENDOR_id-TYPE_id[-CONCEPT_id_VALUE ...]
```

- `VENDOR_id` — `vendor_abv` from `vendor_mapping_canonical.csv`
- `TYPE_id` — `id` from `type_mapping_canonical.csv`
- one segment per filled option, in slot order: `CONCEPT_id_NORMALIZEDVALUE`
  (concept from `option_names_canonical.csv`; value normalized via
  `option_values_linked_canonical.csv`, falling back to `VALUE.toUpperCase()`)
- the `TITLE` / `Default Title` placeholder contributes no segment

No hashes, titles, handles, supplier codes or price. Same inputs → same SKU.

## Data

The four canonical reference files live in [`data/`](./data), copied verbatim
from `skus-generator-v2/data/`. To refresh them, re-copy those four CSVs:

```
cp ../skus-generator-v2/data/{vendor_mapping_canonical,type_mapping_canonical,option_names_canonical,option_values_linked_canonical}.csv data/
```

## Run locally

The page uses `fetch` + ES modules, so it must be served over HTTP (not opened
as a `file://` URL):

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The site is served at `https://<user>.github.io/<repo>/`. All paths are
   relative, so it works from any subpath — no config needed.

## Not included (v1)

Cross-catalog **uniqueness** (checking a generated SKU against a registry of
already-issued SKUs, per §5 of the spec) is not enforced by this interactive
tool. It produces the deterministic SKU only. A paste-in registry check can be
added later.
