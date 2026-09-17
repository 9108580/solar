-- Prepared migration only. Do not apply until the matching application release is approved.
-- Adds the financial settings that previously existed only in frontend business logic.
update public.admin_settings
set payload = payload || jsonb_build_object(
  'productionMeterSurcharge', coalesce(payload -> 'productionMeterSurcharge', '1000'::jsonb),
  'urbanPremiumAgorotPerKwh', coalesce(payload -> 'urbanPremiumAgorotPerKwh', '6'::jsonb),
  'urbanPremiumValidUntilYear', coalesce(payload -> 'urbanPremiumValidUntilYear', '2042'::jsonb),
  'tariffBands', coalesce(
    payload -> 'tariffBands',
    '[
      {"upToKw": 15, "agorotPerKwh": 48.00},
      {"upToKw": 100, "agorotPerKwh": 37.31},
      {"upToKw": 300, "agorotPerKwh": 34.37},
      {"upToKw": null, "agorotPerKwh": 28.44}
    ]'::jsonb
  )
), updated_at = now()
where id = 1;
