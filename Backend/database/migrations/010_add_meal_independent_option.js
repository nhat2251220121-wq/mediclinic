// Keep this as an explicit catalog choice; NULL continues to mean not specified.
exports.up = async (connection) => {
  await connection.query(
    `INSERT IGNORE INTO meal_relations (name, description)
     VALUES ('Không phụ thuộc bữa ăn', 'Không yêu cầu thời điểm dùng thuốc theo bữa ăn')`
  );
};
