import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const dataDir = path.resolve('data');
fs.mkdirSync(dataDir, { recursive: true, mode:0o700 });
export const db = new DatabaseSync(path.join(dataDir, 'silent-narratives.db'));
db.exec("PRAGMA journal_mode=WAL;\nPRAGMA foreign_keys=ON;\nCREATE TABLE IF NOT EXISTS competitors (id INTEGER PRIMARY KEY AUTOINCREMENT, handle TEXT NOT NULL UNIQUE, channel_id TEXT, name TEXT, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS candidates (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT NOT NULL UNIQUE, competitor_id INTEGER, title TEXT, url TEXT NOT NULL, views INTEGER DEFAULT 0, published_at TEXT, status TEXT NOT NULL DEFAULT 'new', discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, used_at TEXT, FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE SET NULL);\nCREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER, source_url TEXT, status TEXT NOT NULL DEFAULT 'draft', hook TEXT, yt_title TEXT, description TEXT, tags TEXT, raw_gemini TEXT, scene_meta TEXT, subtitle_text TEXT, scene_file TEXT, render_file TEXT, youtube_video_id TEXT, youtube_url TEXT, upload_confirmed_at TEXT, deleted_at TEXT, error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL);\nCREATE TABLE IF NOT EXISTS channel_history (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT NOT NULL UNIQUE, title TEXT, description TEXT, published_at TEXT, views INTEGER DEFAULT 0, duration TEXT, privacy TEXT, synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\nCREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
function ensureColumn(table,name,definition) {
  const cols=db.prepare('PRAGMA table_info('+table+')').all();
  if(!cols.some(c=>c.name===name)) db.exec('ALTER TABLE '+table+' ADD COLUMN '+name+' '+definition);
}
ensureColumn('candidates','duplicate_of_video_id','TEXT');
ensureColumn('candidates','duplicate_reason','TEXT');
ensureColumn('candidates','screened_at','TEXT');
ensureColumn('jobs','preview_file','TEXT');
ensureColumn('jobs','slot_date','TEXT');
ensureColumn('jobs','slot_time','TEXT');
ensureColumn('jobs','scheduled_publish_at','TEXT');
ensureColumn('jobs','youtube_publish_at','TEXT');
for (const name of ['upload_session_url','facts_verified_at','facts_evidence','scene_verified_at','scene_evidence','render_sha256','render_fingerprint','render_meta','approved_at','approved_fingerprint','operation_started_at','upload_requested_privacy','upload_requested_publish_at']) ensureColumn('jobs',name,'TEXT');
for(const name of ['facts_source_type','scene_payoff','hook_profile','editorial_profile','template_profile'])ensureColumn('jobs',name,'TEXT');

db.exec(`
CREATE TABLE IF NOT EXISTS performance_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  video_id TEXT NOT NULL,
  checkpoint TEXT NOT NULL,
  target_at TEXT NOT NULL,
  captured_at TEXT,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  privacy TEXT,
  published_at TEXT,
  error TEXT,
  UNIQUE(job_id,checkpoint),
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_performance_due
ON performance_snapshots(captured_at,target_at);
CREATE TABLE IF NOT EXISTS job_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  event TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_reserved_slot
ON jobs(slot_date,slot_time)
WHERE slot_date IS NOT NULL AND slot_time IS NOT NULL AND status!='rejected';
`);
ensureColumn('performance_snapshots','attempts','INTEGER NOT NULL DEFAULT 0');
ensureColumn('performance_snapshots','next_retry_at','TEXT');
db.exec(`CREATE TABLE IF NOT EXISTS video_analytics (
  video_id TEXT PRIMARY KEY,range_start TEXT,range_end TEXT,collected_at TEXT,
  views INTEGER,engaged_views INTEGER,average_view_duration REAL,average_view_percentage REAL,
  retention_curve TEXT,retention_collected_at TEXT
);`);
fs.chmodSync(path.join(dataDir,'silent-narratives.db'),0o600);


export function all(sql, params=[]) { return db.prepare(sql).all(...params); }
export function get(sql, params=[]) { return db.prepare(sql).get(...params); }
export function run(sql, params=[]) { return db.prepare(sql).run(...params); }
export function setting(key, fallback=null) { const row=get('SELECT value FROM app_settings WHERE key=?',[key]); return row ? row.value : fallback; }
export function setSetting(key,value) { run('INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,String(value)]); }
export function touchJob(id) { run('UPDATE jobs SET updated_at=CURRENT_TIMESTAMP WHERE id=?',[id]); }
