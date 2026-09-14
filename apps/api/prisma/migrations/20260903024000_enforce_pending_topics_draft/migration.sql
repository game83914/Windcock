-- Pending topics created under the previous publish-first policy must follow the review-first workflow.
UPDATE "topics"
SET "status" = 'DRAFT', "vote_end_at" = NULL
WHERE "moderation_status" = 'PENDING_REVIEW';
