const {pool}=require('./db');
async function processOne(){
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const r=await c.query(`SELECT * FROM outbox_jobs WHERE status='PENDING' AND available_at<=NOW() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1`);
  if(!r.rowCount){await c.query('COMMIT');return false;}
  const job=r.rows[0];
  // Demo side effect: replace with an idempotent notification adapter in a real deployment.
  console.log(`[outbox] processed ${job.kind} for item ${job.payload.itemId}`);
  await c.query("UPDATE outbox_jobs SET status='DONE',attempts=attempts+1 WHERE id=$1",[job.id]);
  await c.query('COMMIT');return true;
 }catch(e){
  await c.query('ROLLBACK').catch(()=>{});
  console.error('outbox worker error',e.message);
  return false;
 }finally{c.release();}
}
function startWorker(){let stopped=false;const tick=async()=>{if(stopped)return;await processOne();setTimeout(tick,1000);};tick();return()=>{stopped=true;};}
module.exports={processOne,startWorker};
