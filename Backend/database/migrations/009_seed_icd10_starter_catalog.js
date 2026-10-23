// Small starter set only, sourced from WHO ICD-10 Version 2019.
// INSERT IGNORE preserves any clinic-maintained descriptions already present.
exports.up = async (connection) => {
  await connection.query(
    `INSERT IGNORE INTO icd10_codes (code, description) VALUES
      ('I10', 'Essential (primary) hypertension'),
      ('L23', 'Allergic contact dermatitis')`
  );
};
