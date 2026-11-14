const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../database/migrations/015_service_search_keywords');
const seedKeywordsMigration = require('../database/migrations/016_seed_service_search_keywords');
const expandKeywordsMigration = require('../database/migrations/017_expand_service_search_keywords');

test('legacy service keyword column migration remains idempotent for existing installations', async () => {
  const executed = [];
  const connection = { query: async (sql) => {
    executed.push(sql);
    if (sql.includes('information_schema.COLUMNS')) return [[{ found: 0 }]];
    return [[]];
  } };
  await migration.up(connection);
  assert.equal(executed.filter((sql) => sql.startsWith('ALTER TABLE')).length, 1);
  assert.match(executed.find((sql) => sql.startsWith('ALTER TABLE')), /ADD COLUMN `search_keywords` TEXT NULL/);

  const existing = [];
  await migration.up({ query: async (sql) => { existing.push(sql); return [[{ found: 1 }]]; } });
  assert.equal(existing.some((sql) => sql.startsWith('ALTER TABLE')), false);
});

test('initial keyword migration fills only active, empty service keyword rows from specialty groups', async () => {
  const writes = [];
  const connection = { query: async (sql) => {
    if (sql.includes('SELECT svc.id')) return [[
      { id: 3, name: 'Khám răng-hàm-mặt', specialty_name: 'Răng' },
      { id: 4, name: 'Khám Tai Mũi Họng', specialty_name: 'Tai Mũi Họng' },
      { id: 5, name: 'Khám da liễu', specialty_name: 'Da liễu' },
      { id: 6, name: 'Khám tổng quát', specialty_name: 'Khoa chưa cấu hình' }
    ]];
    writes.push(sql);
    return [{ affectedRows: 1 }];
  } };

  await seedKeywordsMigration.up(connection);
  assert.equal(writes.length, 3);
  assert.ok(writes.every((sql) => /search_keywords IS NULL OR TRIM\(search_keywords\) = ''/.test(sql)));

  const values = [];
  const parameterConnection = { query: async (sql, params) => {
    if (sql.includes('SELECT svc.id')) return [[{ id: 3, name: 'Khám răng-hàm-mặt', specialty_name: 'Răng Hàm Mặt' }]];
    values.push(params);
    return [{ affectedRows: 1 }];
  } };
  await seedKeywordsMigration.up(parameterConnection);
  assert.equal(values[0][0], 'răng, đau răng, nhức răng, ê buốt, răng khôn, nướu, lợi');
  assert.equal(values[0][1], 3);
});

test('expanded keyword migration preserves existing terms and adds only missing approved phrases', async () => {
  const updates = [];
  const connection = { query: async (sql) => {
    if (sql.includes('SELECT svc.id')) return [[
      { id: 3, specialty_id: 6, name: 'Khám răng-hàm-mặt', specialty_name: 'răng', search_keywords: 'đau răng, từ khóa riêng đã có' },
      { id: 4, specialty_id: 9, name: 'Khám da liễu', specialty_name: 'Da liễu', search_keywords: null }
    ]];
    updates.push(sql);
    return [{ affectedRows: 1 }];
  } };
  const values = [];
  const wrapped = { query: async (sql, params) => {
    if (sql.includes('SELECT svc.id')) return connection.query(sql, params);
    values.push(params);
    return connection.query(sql, params);
  } };

  await expandKeywordsMigration.up(wrapped);
  assert.equal(updates.length, 2);
  assert.ok(values[0][0].includes('từ khóa riêng đã có'));
  assert.equal(values[0][0].split(',').filter((term) => term.trim() === 'đau răng').length, 1);
  assert.ok(values[0][0].includes('chảy máu lợi'));
  assert.ok(values[1][0].includes('mụn trứng cá'));
  assert.ok(updates.every((sql) => /WHERE id = \? AND specialty_id = \? AND is_active = TRUE/.test(sql)));
});
