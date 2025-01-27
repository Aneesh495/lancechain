import { Router, Request, Response } from "express";
import { Database } from "@lancechain/indexer";

export function createReputationRouter(db: Database): Router {
  const router = Router();

  router.get("/:address", async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const scoreRows = await db.query<{
        account: string;
        total_projects: number;
        completed_count: number;
        disputed_count: number;
        timeout_count: number;
        refund_count: number;
        rating_count: number;
        total_rating_stars: string;
        last_updated_block: number;
      }>(
        `SELECT * FROM projections_reputation WHERE LOWER(account) = LOWER($1);`,
        [address]
      );

      const ratings = await db.query(
        `SELECT project_id, rater, ratee, score, feedback_hash, block_number, created_at
         FROM projections_ratings
         WHERE LOWER(ratee) = LOWER($1)
         ORDER BY created_at DESC LIMIT 50;`,
        [address]
      );

      const score = scoreRows.length > 0 ? scoreRows[0] : null;
      const ratingCount = score ? Number(score.rating_count) : 0;
      const totalStars = score ? Number(score.total_rating_stars) : 0;
      const averageRating = ratingCount > 0 ? totalStars / ratingCount : 0;

      res.json({
        account: address.toLowerCase(),
        score: score
          ? {
              totalProjects: Number(score.total_projects),
              completedCount: Number(score.completed_count),
              disputedCount: Number(score.disputed_count),
              timeoutCount: Number(score.timeout_count),
              refundCount: Number(score.refund_count),
              ratingCount,
              totalRatingStars: totalStars,
              averageRating: Number(averageRating.toFixed(2)),
            }
          : {
              totalProjects: 0,
              completedCount: 0,
              disputedCount: 0,
              timeoutCount: 0,
              refundCount: 0,
              ratingCount: 0,
              totalRatingStars: 0,
              averageRating: 0,
            },
        ratings,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
