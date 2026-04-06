import { createClient } from '@libsql/client'

const url = process.env.TURSO_DATABASE_URL ?? 'file:./local.db'
const authToken = process.env.TURSO_AUTH_TOKEN

const client = createClient(
  authToken ? { url, authToken } : { url }
)
export default client

export async function initDb() {
  try {
    await client.execute('PRAGMA foreign_keys = ON')
  } catch {
    /* remote/libsql 환경에서는 지원되지 않을 수 있으므로 무시 */
  }

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS projects (
      id              TEXT PRIMARY KEY,
      vessel_name     TEXT NOT NULL DEFAULT '신규 선박',
      hull_no         TEXT NOT NULL DEFAULT '',
      project_no      TEXT NOT NULL DEFAULT '',
      class_code      TEXT NOT NULL DEFAULT 'KR',
      ac_voltage      REAL NOT NULL DEFAULT 220,
      frequency       INTEGER NOT NULL DEFAULT 60,
      -- 전원 구성 (복수 선택)
      has_dg          INTEGER NOT NULL DEFAULT 1,
      has_eg          INTEGER NOT NULL DEFAULT 0,
      has_ess         INTEGER NOT NULL DEFAULT 0,
      has_fc          INTEGER NOT NULL DEFAULT 0,
      has_pv          INTEGER NOT NULL DEFAULT 0,
      has_shore       INTEGER NOT NULL DEFAULT 0,
      has_dc          INTEGER NOT NULL DEFAULT 0,
      -- 발전기
      dg_count        INTEGER NOT NULL DEFAULT 1,
      dg_pf           REAL NOT NULL DEFAULT 0.8,
      design_margin   REAL NOT NULL DEFAULT 0.25,
      dg_xd           REAL NOT NULL DEFAULT 0.15,
      -- ESS
      ess_backup_h       REAL NOT NULL DEFAULT 0.5,
      ess_margin         REAL NOT NULL DEFAULT 0.20,
      ess_peak_thresh_pct REAL NOT NULL DEFAULT 75,
      ess_peak_dur_min   REAL NOT NULL DEFAULT 15,
      ess_spin_reserve   INTEGER NOT NULL DEFAULT 0,
      -- DC/추진
      dc_voltage      REAL NOT NULL DEFAULT 650,
      motor_count     INTEGER NOT NULL DEFAULT 2,
      motor_kw        REAL NOT NULL DEFAULT 150,
      iso_kva         REAL NOT NULL DEFAULT 200,
      prop_pf         REAL NOT NULL DEFAULT 0.95,
      -- 운항
      operation_hours REAL NOT NULL DEFAULT 8,
      charge_hours    REAL NOT NULL DEFAULT 6,
      -- FC
      fc_stack_kw     REAL NOT NULL DEFAULT 0,
      -- PV
      pv_kwp          REAL NOT NULL DEFAULT 0,
      pv_sun_hours    REAL NOT NULL DEFAULT 4,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS buses (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL,
      tag         TEXT NOT NULL,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'PANEL',
      voltage     REAL NOT NULL DEFAULT 220,
      parent_tag  TEXT NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS loads (
      id            TEXT PRIMARY KEY,
      project_id    TEXT NOT NULL,
      circuit_no    TEXT NOT NULL DEFAULT '',
      name          TEXT NOT NULL DEFAULT '',
      from_bus      TEXT NOT NULL DEFAULT 'MSB',
      to_tag        TEXT NOT NULL DEFAULT '',
      kw            REAL NOT NULL DEFAULT 0,
      pf            REAL NOT NULL DEFAULT 0.85,
      efficiency    REAL NOT NULL DEFAULT 0.88,
      priority      TEXT NOT NULL DEFAULT 'IMPORTANT',
      start_type    TEXT NOT NULL DEFAULT 'DOL',
      demand_factor REAL NOT NULL DEFAULT 0.8,
      df_sea        REAL NOT NULL DEFAULT 0.8,
      df_work       REAL NOT NULL DEFAULT 0.5,
      df_emg        REAL NOT NULL DEFAULT 0.0,
      phase         TEXT NOT NULL DEFAULT '3P',
      is_emergency  INTEGER NOT NULL DEFAULT 0,
      is_battery    INTEGER NOT NULL DEFAULT 0,
      cable_length  REAL NOT NULL DEFAULT 0,
      location      TEXT NOT NULL DEFAULT '',
      notes         TEXT NOT NULL DEFAULT '',
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calc_results (
      id            TEXT PRIMARY KEY,
      project_id    TEXT NOT NULL,
      result_json   TEXT NOT NULL,
      sld_xml       TEXT NOT NULL DEFAULT '',
      calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_buses_proj ON buses(project_id);
    CREATE INDEX IF NOT EXISTS idx_loads_proj ON loads(project_id);
    CREATE INDEX IF NOT EXISTS idx_results_proj ON calc_results(project_id);
  `)

  // 기존 DB 마이그레이션 (컬럼이 없으면 추가, 있으면 무시)
  const migrations = [
    `ALTER TABLE loads ADD COLUMN is_battery INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE loads ADD COLUMN df_sea REAL NOT NULL DEFAULT 0.8`,
    `ALTER TABLE loads ADD COLUMN df_work REAL NOT NULL DEFAULT 0.5`,
    `ALTER TABLE loads ADD COLUMN df_emg REAL NOT NULL DEFAULT 0.0`,
    `ALTER TABLE loads ADD COLUMN cable_length REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE loads ADD COLUMN priority TEXT NOT NULL DEFAULT 'IMPORTANT'`,
    `ALTER TABLE projects ADD COLUMN has_dg INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE projects ADD COLUMN has_fc INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE projects ADD COLUMN has_pv INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE projects ADD COLUMN dg_xd REAL NOT NULL DEFAULT 0.15`,
    `ALTER TABLE projects ADD COLUMN prop_pf REAL NOT NULL DEFAULT 0.95`,
    `ALTER TABLE projects ADD COLUMN power_type TEXT NOT NULL DEFAULT 'DG'`,
    `ALTER TABLE projects ADD COLUMN operation_hours REAL NOT NULL DEFAULT 8`,
    `ALTER TABLE projects ADD COLUMN charge_hours REAL NOT NULL DEFAULT 6`,
    `ALTER TABLE projects ADD COLUMN fc_stack_kw REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE projects ADD COLUMN pv_kwp REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE projects ADD COLUMN pv_sun_hours REAL NOT NULL DEFAULT 4`,
    `ALTER TABLE projects ADD COLUMN ess_peak_thresh_pct REAL NOT NULL DEFAULT 75`,
    `ALTER TABLE projects ADD COLUMN ess_peak_dur_min REAL NOT NULL DEFAULT 15`,
    `ALTER TABLE projects ADD COLUMN ess_spin_reserve INTEGER NOT NULL DEFAULT 0`,
  ]
  for(const sql of migrations) {
    try { await client.execute(sql) } catch { /* 이미 존재 시 무시 */ }
  }
}
