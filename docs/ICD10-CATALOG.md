# ICD-10 diagnosis catalog

The clinical catalog endpoint reads `icd10_codes` and the doctor must choose a code; the application never infers one from free-text diagnosis. A small starter set is seeded only because the configured table was empty. It is not a complete clinical coding reference:

| Code | WHO ICD-10 title |
| --- | --- |
| I10 | Essential (primary) hypertension |
| L23 | Allergic contact dermatitis |

Source: WHO [ICD-10 Version 2019 browser](https://icd.who.int/browse10/2019/en/) and the official [WHO ICD-10 Volume 2, 2019](https://icd.who.int/browse10/Content/statichtml/ICD10Volume2_en_2019.pdf). The application stores the selected code in `appointment_records.icd10_code`; the diagnosis text remains the doctor's separately entered final diagnosis.

Migration `009_seed_icd10_starter_catalog.js` uses `INSERT IGNORE`, so it adds missing starter rows without overwriting existing descriptions or diagnosis records. For a new database, `schema.sql` includes the same initial catalog rows. Extend the catalog only from an authoritative, appropriately licensed ICD-10 data source and review translated titles before importing them.

The prescription editor no longer asks for frequency or dosage-time checkboxes. Existing `prescriptions.frequency`, `prescription_times`, and `dosage_times` are retained and read when viewing old records. Empty meal relation means “Không chỉ định”; the explicit “Không phụ thuộc bữa ăn” choice is added by migration `010_add_meal_independent_option.js`.

**Important:** the backend currently runs every pending migration during startup. Back up and test migrations against a separate database before starting the backend against a populated clinic database.
