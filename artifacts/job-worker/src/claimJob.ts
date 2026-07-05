import { pool } from "@workspace/db";
import type { Job } from "@workspace/db";

/**
 * Atomically claim the highest-priority queued job from a given queue.
 * Uses SELECT ... FOR UPDATE SKIP LOCKED to prevent double-claiming.
 */
export async function claimJob(queueId: string, workerId: string): Promise<Job | null> {
  const client = await pool.connect();
  try {
    const result = await client.query<Job>(
      `UPDATE jobs
       SET status = 'claimed', worker_id = $1, claimed_at = now(), updated_at = now()
       WHERE id = (
         SELECT id FROM jobs
         WHERE queue_id = $2
           AND status = 'queued'
           AND run_at <= now()
         ORDER BY priority DESC, created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [workerId, queueId],
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}
