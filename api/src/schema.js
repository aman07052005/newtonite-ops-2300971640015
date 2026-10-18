const { pool } = require('./db');
const bcrypt = require('bcryptjs');
async function init() {
  await pool.query(`
  CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,name TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS teams(id SERIAL PRIMARY KEY,name TEXT UNIQUE NOT NULL);
  CREATE TABLE IF NOT EXISTS memberships(user_id INT REFERENCES users(id) ON DELETE CASCADE,team_id INT REFERENCES teams(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('VIEWER','MEMBER','LEAD','ADMIN')),PRIMARY KEY(user_id,team_id));
  CREATE TABLE IF NOT EXISTS work_items(id BIGSERIAL PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',type TEXT NOT NULL CHECK(type IN ('INCIDENT','CUSTOMER_ISSUE','PAYMENT','COMPLIANCE','TASK')),priority TEXT NOT NULL CHECK(priority IN ('LOW','MEDIUM','HIGH','URGENT')),status TEXT NOT NULL CHECK(status IN ('OPEN','IN_PROGRESS','AWAITING_APPROVAL','RESOLVED','CLOSED')),team_id INT NOT NULL REFERENCES teams(id),assignee_id INT REFERENCES users(id),created_by INT NOT NULL REFERENCES users(id),due_at TIMESTAMPTZ,version INT NOT NULL DEFAULT 1,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS activity_events(id BIGSERIAL PRIMARY KEY,item_id BIGINT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,actor_id INT NOT NULL REFERENCES users(id),event_type TEXT NOT NULL,details JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS comments(id BIGSERIAL PRIMARY KEY,item_id BIGINT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,author_id INT NOT NULL REFERENCES users(id),body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS idempotency_keys(key TEXT PRIMARY KEY,user_id INT NOT NULL REFERENCES users(id),response JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS outbox_jobs(id BIGSERIAL PRIMARY KEY,job_key TEXT UNIQUE NOT NULL,kind TEXT NOT NULL,payload JSONB NOT NULL,attempts INT NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','DONE','FAILED')),available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),last_error TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE INDEX IF NOT EXISTS items_team_created_idx ON work_items(team_id,created_at DESC,id DESC);
  CREATE INDEX IF NOT EXISTS items_status_priority_idx ON work_items(status,priority);
  CREATE INDEX IF NOT EXISTS items_assignee_idx ON work_items(assignee_id,status);
  CREATE INDEX IF NOT EXISTS activity_item_created_idx ON activity_events(item_id,created_at,id);
  CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox_jobs(status,available_at);
  `);
  const hash = await bcrypt.hash('demo12345', 10);
  const users = [
    ['maya.member@newtonite.local','Maya Member'],['liam.lead@newtonite.local','Liam Lead'],
    ['ava.viewer@newtonite.local','Ava Viewer'],['noah.member@newtonite.local','Noah Member'],
    ['root.admin@newtonite.local','Riley Admin']
  ];
  for (const [email,name] of users) await pool.query('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING',[email,hash,name]);
  for (const name of ['Platform','Payments','Compliance']) await pool.query('INSERT INTO teams(name) VALUES($1) ON CONFLICT(name) DO NOTHING',[name]);
  const ids = await pool.query('SELECT id,email FROM users');
  const teams = await pool.query('SELECT id,name FROM teams');
  const u = Object.fromEntries(ids.rows.map(x=>[x.email,x.id])), t=Object.fromEntries(teams.rows.map(x=>[x.name,x.id]));
  const memberships = [
    [u['maya.member@newtonite.local'],t.Platform,'MEMBER'],[u['liam.lead@newtonite.local'],t.Platform,'LEAD'],
    [u['ava.viewer@newtonite.local'],t.Platform,'VIEWER'],[u['noah.member@newtonite.local'],t.Payments,'MEMBER'],
    [u['root.admin@newtonite.local'],t.Platform,'ADMIN'],[u['root.admin@newtonite.local'],t.Payments,'ADMIN'],[u['root.admin@newtonite.local'],t.Compliance,'ADMIN'],
    [u['liam.lead@newtonite.local'],t.Payments,'LEAD']
  ];
  for (const m of memberships) await pool.query('INSERT INTO memberships(user_id,team_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',m);
  const count = await pool.query('SELECT COUNT(*)::int n FROM work_items');
  if (!count.rows[0].n) {
    const examples = [
      ['Investigate elevated API latency','P95 latency exceeded the service target.','INCIDENT','URGENT','OPEN','Platform',null],
      ['Review failed settlement batch','Reconcile failed payments before the daily close.','PAYMENT','HIGH','IN_PROGRESS','Payments','noah.member@newtonite.local'],
      ['Approve customer data correction','Validate the proposed correction and audit trail.','CUSTOMER_ISSUE','MEDIUM','AWAITING_APPROVAL','Platform','maya.member@newtonite.local'],
      ['Rotate integration credentials','Coordinate a safe credential rotation.','COMPLIANCE','HIGH','OPEN','Compliance',null],
      ['Update runbook for deploy rollback','Document verified rollback steps.','TASK','LOW','RESOLVED','Platform','maya.member@newtonite.local']
    ];
    for (const [title,description,type,priority,status,team,assignee] of examples) {
      const r=await pool.query('INSERT INTO work_items(title,description,type,priority,status,team_id,assignee_id,created_by,due_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()+INTERVAL \'2 days\') RETURNING id',[title,description,type,priority,status,t[team],assignee?u[assignee]:null,u['liam.lead@newtonite.local']]);
      await pool.query('INSERT INTO activity_events(item_id,actor_id,event_type,details) VALUES($1,$2,\'ITEM_CREATED\',$3)',[r.rows[0].id,u['liam.lead@newtonite.local'],JSON.stringify({title,seeded:true})]);
    }
  }
}
module.exports = { init };
