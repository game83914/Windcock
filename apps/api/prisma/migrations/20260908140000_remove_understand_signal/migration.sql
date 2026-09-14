DELETE FROM "topic_stance_signals" WHERE "signal" = 'UNDERSTAND';
ALTER TABLE "topic_stances" DROP COLUMN "understanding_count";

DROP INDEX "topic_stance_signals_stance_id_user_id_signal_key";
DROP INDEX "topic_stance_signals_one_polar_signal_per_user";
ALTER TABLE "topic_stance_signals" ALTER COLUMN "signal" TYPE TEXT USING "signal"::text;
DROP TYPE "TopicStanceSignalType";
CREATE TYPE "TopicStanceSignalType" AS ENUM ('AGREE', 'DISAGREE');
ALTER TABLE "topic_stance_signals" ALTER COLUMN "signal" TYPE "TopicStanceSignalType" USING ("signal"::text::"TopicStanceSignalType");
CREATE UNIQUE INDEX "topic_stance_signals_stance_id_user_id_signal_key" ON "topic_stance_signals"("stance_id", "user_id", "signal");
CREATE UNIQUE INDEX "topic_stance_signals_one_polar_signal_per_user" ON "topic_stance_signals"("stance_id", "user_id");
