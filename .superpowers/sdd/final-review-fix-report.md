# Final Review Fixes

## Files Changed

- `backend/tender_display.py`
- `backend/test_tender_display.py`
- `frontend/src/lib/displayValues.ts`
- `frontend/src/lib/tenderGuidance.ts`
- `frontend/src/lib/types.ts`
- `frontend/src/pages/TenderDetail.tsx`
- `frontend/src/components/Navbar.tsx`
- `frontend/src/assets/logo-full.svg`
- `frontend/src/assets/logo-full-reversed.svg`
- `frontend/src/assets/logo-mark.svg`
- `frontend/src/assets/logo-wordmark.svg`
- `.superpowers/sdd/final-review-fix-report.md`

## Verification

Command:

```text
cd backend && .venv/bin/python -m unittest test_tender_display test_tender_routes test_v1_api_surface -v
```

Exact output:

```text
test_base_tender_only_returns_missing_signal_states (test_tender_display.TenderDisplayTest.test_base_tender_only_returns_missing_signal_states) ... ok
test_buyer_prefers_fuller_equivalent_base_value (test_tender_display.TenderDisplayTest.test_buyer_prefers_fuller_equivalent_base_value) ... ok
test_candidate_count_requires_explicit_competition_label (test_tender_display.TenderDisplayTest.test_candidate_count_requires_explicit_competition_label) ... ok
test_clean_text_collapses_whitespace_and_trims_punctuation (test_tender_display.TenderDisplayTest.test_clean_text_collapses_whitespace_and_trims_punctuation) ... ok
test_display_fields_preserve_original_selected_source_values (test_tender_display.TenderDisplayTest.test_display_fields_preserve_original_selected_source_values) ... ok
test_location_uses_cautious_title_fallback_when_no_raw_location_exists (test_tender_display.TenderDisplayTest.test_location_uses_cautious_title_fallback_when_no_raw_location_exists) ... ok
test_market_price_requires_explicit_currency_for_labeled_text (test_tender_display.TenderDisplayTest.test_market_price_requires_explicit_currency_for_labeled_text) ... ok
test_nonnumeric_primary_estimation_retries_labeled_stored_text (test_tender_display.TenderDisplayTest.test_nonnumeric_primary_estimation_retries_labeled_stored_text) ... ok
test_parse_money_supports_moroccan_formats (test_tender_display.TenderDisplayTest.test_parse_money_supports_moroccan_formats) ... ok
test_title_preserves_non_matching_commune_suffix (test_tender_display.TenderDisplayTest.test_title_preserves_non_matching_commune_suffix) ... ok
test_title_removes_trailing_duplicate_commune_when_location_matches (test_tender_display.TenderDisplayTest.test_title_removes_trailing_duplicate_commune_when_location_matches) ... ok
test_whitespace_detail_estimation_uses_base_source (test_tender_display.TenderDisplayTest.test_whitespace_detail_estimation_uses_base_source) ... ok
test_zero_estimation_is_missing_but_zero_plan_price_is_detected (test_tender_display.TenderDisplayTest.test_zero_estimation_is_missing_but_zero_plan_price_is_detected) ... ok
test_get_tender_base_only_still_returns_display_and_signals (test_tender_routes.TenderDetailApiTest.test_get_tender_base_only_still_returns_display_and_signals) ... ok
test_get_tender_uses_stored_details_without_scraping (test_tender_routes.TenderDetailApiTest.test_get_tender_uses_stored_details_without_scraping) ... ok
test_slash_bearing_tender_ids_match_detail_and_download_routes (test_tender_routes.TenderRouteTest.test_slash_bearing_tender_ids_match_detail_and_download_routes) ... ok
test_admin_surface_is_reachable_but_gated (test_v1_api_surface.V1ApiSurfaceTest.test_admin_surface_is_reachable_but_gated) ... ok
test_auth_entry_points_are_public (test_v1_api_surface.V1ApiSurfaceTest.test_auth_entry_points_are_public) ... ok
test_catalog_requires_authentication (test_v1_api_surface.V1ApiSurfaceTest.test_catalog_requires_authentication) ... ok
test_retired_public_routes_are_not_accessible (test_v1_api_surface.V1ApiSurfaceTest.test_retired_public_routes_are_not_accessible) ... ok

----------------------------------------------------------------------
Ran 20 tests in 0.021s

OK
```

Command:

```text
cd frontend && npm run build
```

Exact output:

```text
> frontend@0.0.0 build
> tsc -b && vite build

vite v8.1.0 building client environment for production...
transforming.../*! 🌼 daisyUI 5.6.3 */
✓ 142 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.96 kB | gzip:   0.54 kB
dist/assets/index-DmgTxK5Y.css    108.08 kB | gzip:  18.20 kB
dist/assets/AdminApp-C2_sO4sN.js   57.21 kB | gzip:  12.94 kB
dist/assets/index-DUgJnSyF.js     336.19 kB | gzip: 101.20 kB

✓ built in 292ms
```

## Second Final Re-review Fixes

### Files Changed

- `backend/tender_display.py`
- `backend/test_tender_display.py`
- `frontend/src/lib/displayValues.ts`
- `frontend/src/lib/tenderGuidance.ts`
- `frontend/src/pages/TenderDetail.tsx`
- `.superpowers/sdd/final-review-fix-report.md`

### Verification

Command:

```text
cd backend && .venv/bin/python -m unittest test_tender_display test_tender_routes test_v1_api_surface -v
```

Exact output:

```text
test_base_tender_only_returns_missing_signal_states (test_tender_display.TenderDisplayTest.test_base_tender_only_returns_missing_signal_states) ... ok
test_buyer_prefers_fuller_equivalent_base_value (test_tender_display.TenderDisplayTest.test_buyer_prefers_fuller_equivalent_base_value) ... ok
test_candidate_count_does_not_partially_parse_year_or_four_digit_number (test_tender_display.TenderDisplayTest.test_candidate_count_does_not_partially_parse_year_or_four_digit_number) ... ok
test_candidate_count_requires_explicit_competition_label (test_tender_display.TenderDisplayTest.test_candidate_count_requires_explicit_competition_label) ... ok
test_clean_text_collapses_whitespace_and_trims_punctuation (test_tender_display.TenderDisplayTest.test_clean_text_collapses_whitespace_and_trims_punctuation) ... ok
test_display_fields_preserve_original_selected_source_values (test_tender_display.TenderDisplayTest.test_display_fields_preserve_original_selected_source_values) ... ok
test_generic_detail_object_falls_back_to_descriptive_base_title (test_tender_display.TenderDisplayTest.test_generic_detail_object_falls_back_to_descriptive_base_title) ... ok
test_location_uses_cautious_title_fallback_when_no_raw_location_exists (test_tender_display.TenderDisplayTest.test_location_uses_cautious_title_fallback_when_no_raw_location_exists) ... ok
test_market_price_requires_explicit_currency_for_labeled_text (test_tender_display.TenderDisplayTest.test_market_price_requires_explicit_currency_for_labeled_text) ... ok
test_nonnumeric_primary_estimation_retries_labeled_stored_text (test_tender_display.TenderDisplayTest.test_nonnumeric_primary_estimation_retries_labeled_stored_text) ... ok
test_parse_money_supports_moroccan_formats (test_tender_display.TenderDisplayTest.test_parse_money_supports_moroccan_formats) ... ok
test_title_preserves_location_suffix_when_removal_leaves_generic_title (test_tender_display.TenderDisplayTest.test_title_preserves_location_suffix_when_removal_leaves_generic_title) ... ok
test_title_preserves_non_matching_commune_suffix (test_tender_display.TenderDisplayTest.test_title_preserves_non_matching_commune_suffix) ... ok
test_title_removes_trailing_duplicate_commune_when_location_matches (test_tender_display.TenderDisplayTest.test_title_removes_trailing_duplicate_commune_when_location_matches) ... ok
test_whitespace_detail_estimation_uses_base_source (test_tender_display.TenderDisplayTest.test_whitespace_detail_estimation_uses_base_source) ... ok
test_zero_estimation_is_missing_but_zero_plan_price_is_detected (test_tender_display.TenderDisplayTest.test_zero_estimation_is_missing_but_zero_plan_price_is_detected) ... ok
test_get_tender_base_only_still_returns_display_and_signals (test_tender_routes.TenderDetailApiTest.test_get_tender_base_only_still_returns_display_and_signals) ... ok
test_get_tender_uses_stored_details_without_scraping (test_tender_routes.TenderDetailApiTest.test_get_tender_uses_stored_details_without_scraping) ... ok
test_slash_bearing_tender_ids_match_detail_and_download_routes (test_tender_routes.TenderRouteTest.test_slash_bearing_tender_ids_match_detail_and_download_routes) ... ok
test_admin_surface_is_reachable_but_gated (test_v1_api_surface.V1ApiSurfaceTest.test_admin_surface_is_reachable_but_gated) ... ok
test_auth_entry_points_are_public (test_v1_api_surface.V1ApiSurfaceTest.test_auth_entry_points_are_public) ... ok
test_catalog_requires_authentication (test_v1_api_surface.V1ApiSurfaceTest.test_catalog_requires_authentication) ... ok
test_retired_public_routes_are_not_accessible (test_v1_api_surface.V1ApiSurfaceTest.test_retired_public_routes_are_not_accessible) ... ok

----------------------------------------------------------------------
Ran 23 tests in 0.028s

OK
```

Command:

```text
cd frontend && npm run build
```

Exact output:

```text
> frontend@0.0.0 build
> tsc -b && vite build

vite v8.1.0 building client environment for production...
transforming.../*! 🌼 daisyUI 5.6.3 */
✓ 142 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.96 kB │ gzip:   0.54 kB
dist/assets/index-DmgTxK5Y.css    108.08 kB │ gzip:  18.20 kB
dist/assets/AdminApp-ByEI5iUY.js   57.21 kB │ gzip:  12.94 kB
dist/assets/index-BYr0yVpF.js     336.30 kB │ gzip: 101.24 kB

✓ built in 390ms
```
