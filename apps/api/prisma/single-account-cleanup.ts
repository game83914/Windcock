import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const retainedPhone = '0911111111';

function json(value: unknown) {
  return JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2);
}

async function summary() {
  const retained = await prisma.user.findUnique({ where: { phoneNumber: retainedPhone }, select: { id: true, role: true, status: true, isPhoneVerified: true } });
  if (!retained) throw new Error(`Retained account ${retainedPhone} does not exist`);
  const removed = { not: retained.id };
  const [users, topics, stances, posts, comments, memes, topicApplications, stanceApplications, votes, likes, signals, reports, memeReports, collections, profiles, pointTransactions] = await Promise.all([
    prisma.user.count(),
    prisma.topic.count({ where: { creatorId: removed } }),
    prisma.topicStance.count({ where: { creatorId: removed } }),
    prisma.post.count({ where: { authorId: removed } }),
    prisma.comment.count({ where: { authorId: removed } }),
    prisma.meme.count({ where: { creatorId: removed } }),
    prisma.topicApplication.count({ where: { submitterId: removed } }),
    prisma.stanceApplication.count({ where: { submitterId: removed } }),
    prisma.vote.count({ where: { userId: removed } }),
    prisma.like.count({ where: { userId: removed } }),
    prisma.topicStanceSignal.count({ where: { userId: removed } }),
    prisma.topicStanceReport.count({ where: { reporterId: removed } }),
    prisma.memeReport.count({ where: { reporterId: removed } }),
    prisma.memeCollection.count({ where: { userId: removed } }),
    prisma.userDemographicProfile.count({ where: { userId: removed } }),
    prisma.pointTransaction.count({ where: { userId: removed } }),
  ]);
  return {
    retained,
    users: { total: users, remove: users - 1 },
    transfer: { topics, stances, posts, comments, memes, topicApplications, stanceApplications },
    remove: { votes, likes, signals, reports, memeReports, collections, profiles, pointTransactions },
  };
}

async function execute(backupSchema: string) {
  if (process.env.NODE_ENV === 'production') throw new Error('Single-account cleanup is disabled in production');
  if (process.env.ALLOW_SINGLE_ACCOUNT_CLEANUP !== 'true') throw new Error('Set ALLOW_SINGLE_ACCOUNT_CLEANUP=true to execute');
  if (!/^backup_[a-zA-Z0-9_]+$/.test(backupSchema)) throw new Error('A valid --backup-schema=backup_* argument is required');

  const [backupTable] = await prisma.$queryRaw<Array<{ name: string | null }>>`SELECT to_regclass(${`${backupSchema}.users`})::text AS name`;
  if (!backupTable?.name) throw new Error(`Backup schema ${backupSchema} does not contain users`);
  const [backupUsers] = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*) AS count FROM "${backupSchema}"."users"`);
  const currentUsers = await prisma.user.count();
  if ((currentUsers > 1 && Number(backupUsers.count) !== currentUsers) || Number(backupUsers.count) < currentUsers) {
    throw new Error(`Backup has ${backupUsers.count} users but public has ${currentUsers}`);
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('windcock-database-maintenance'))::text AS locked`;
    const retained = await tx.user.findUnique({ where: { phoneNumber: retainedPhone } });
    if (!retained || retained.role !== 'ADMIN' || retained.status !== 'ACTIVE' || !retained.isPhoneVerified) {
      throw new Error('Retained account must be an active, verified administrator');
    }
    const removedUsers = await tx.user.findMany({ where: { id: { not: retained.id } }, select: { id: true, phoneNumber: true } });
    const removedIds = removedUsers.map((user) => user.id);
    if (!removedIds.length) {
      await verifyConsistency(tx, retained.id);
      return { retainedUserId: retained.id, removedUsers: 0, alreadyClean: true };
    }

    const retainedLedger = await tx.pointTransaction.aggregate({ where: { userId: retained.id }, _sum: { amount: true } });
    const openingBalance = retained.pointsBalance - (retainedLedger._sum.amount ?? 0n);
    const removedWhere = { in: removedIds };

    const usageEvents = await tx.memeUsageEvent.findMany({
      where: { OR: [{ actorUserId: removedWhere }, { creatorId: removedWhere }] },
      select: { pointTransactionId: true },
    });
    const dependentPointIds = usageEvents.flatMap((item) => item.pointTransactionId ? [item.pointTransactionId] : []);

    await tx.demographicAnalysisAudit.deleteMany();
    await tx.memeUsageEvent.deleteMany({ where: { OR: [{ actorUserId: removedWhere }, { creatorId: removedWhere }] } });
    await tx.topicStanceReport.deleteMany({ where: { reporterId: removedWhere } });
    await tx.memeReport.deleteMany({ where: { reporterId: removedWhere } });
    await tx.voteDemographicSnapshot.deleteMany({ where: { vote: { userId: removedWhere } } });
    await tx.vote.deleteMany({ where: { userId: removedWhere } });
    await tx.like.deleteMany({ where: { userId: removedWhere } });
    await tx.topicFollow.deleteMany({ where: { userId: removedWhere } });
    await tx.topicStanceSignal.deleteMany({ where: { userId: removedWhere } });
    await tx.memeCollection.deleteMany({ where: { userId: removedWhere } });
    await tx.notification.deleteMany({ where: { userId: removedWhere } });
    await tx.userDemographicProfile.deleteMany({ where: { userId: removedWhere } });
    await tx.organizationMembership.deleteMany({ where: { userId: removedWhere } });
    await tx.roleAssignment.deleteMany({ where: { userId: removedWhere } });
    await tx.pointTransaction.deleteMany({ where: { OR: [{ userId: removedWhere }, ...(dependentPointIds.length ? [{ id: { in: dependentPointIds } }] : [])] } });

    await tx.topic.updateMany({ where: { reviewedById: removedWhere }, data: { reviewedById: null } });
    await tx.topicStance.updateMany({ where: { takenDownById: removedWhere }, data: { takenDownById: null } });
    await tx.meme.updateMany({ where: { reviewedById: removedWhere }, data: { reviewedById: null } });
    await tx.meme.updateMany({ where: { takenDownById: removedWhere }, data: { takenDownById: null } });
    await tx.topicApplicationRevision.updateMany({ where: { reviewedById: removedWhere }, data: { reviewedById: null } });
    await tx.stanceApplication.updateMany({ where: { reviewedById: removedWhere }, data: { reviewedById: null } });
    await tx.stanceApplicationRevision.updateMany({ where: { reviewedById: removedWhere }, data: { reviewedById: null } });
    await tx.roleAssignment.updateMany({ where: { grantedById: removedWhere }, data: { grantedById: null } });

    const transferred = {
      topics: (await tx.topic.updateMany({ where: { creatorId: removedWhere }, data: { creatorId: retained.id } })).count,
      stances: (await tx.topicStance.updateMany({ where: { creatorId: removedWhere }, data: { creatorId: retained.id } })).count,
      posts: (await tx.post.updateMany({ where: { authorId: removedWhere }, data: { authorId: retained.id } })).count,
      comments: (await tx.comment.updateMany({ where: { authorId: removedWhere }, data: { authorId: retained.id } })).count,
      memes: (await tx.meme.updateMany({ where: { creatorId: removedWhere }, data: { creatorId: retained.id } })).count,
      topicApplications: (await tx.topicApplication.updateMany({ where: { submitterId: removedWhere }, data: { submitterId: retained.id } })).count,
      stanceApplications: (await tx.stanceApplication.updateMany({ where: { submitterId: removedWhere }, data: { submitterId: retained.id } })).count,
    };

    const partner = await tx.organization.findUnique({ where: { slug: 'demo-partner' }, select: { id: true } });
    if (partner) {
      await tx.organizationMembership.upsert({
        where: { organizationId_userId: { organizationId: partner.id, userId: retained.id } },
        create: { organizationId: partner.id, userId: retained.id, role: 'OWNER', status: 'ACTIVE' },
        update: { role: 'OWNER', status: 'ACTIVE' },
      });
    }

    await tx.user.deleteMany({ where: { id: removedWhere } });

    await tx.$executeRaw`UPDATE topic_options AS option SET vote_count = (SELECT COUNT(*) FROM votes WHERE option_id = option.id)`;
    await tx.$executeRaw`UPDATE topics AS topic SET total_votes = (SELECT COUNT(*) FROM votes WHERE topic_id = topic.id), voter_count = (SELECT COUNT(DISTINCT user_id) FROM votes WHERE topic_id = topic.id)`;
    await tx.$executeRaw`UPDATE topics AS topic SET spectrum_median = (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY spectrum_value) FROM votes WHERE topic_id = topic.id AND spectrum_value IS NOT NULL), spectrum_stddev = (SELECT stddev(spectrum_value) FROM votes WHERE topic_id = topic.id AND spectrum_value IS NOT NULL)`;
    await tx.$executeRaw`UPDATE posts AS post SET like_count = (SELECT COUNT(*) FROM likes WHERE target_type = 'post' AND target_id = post.id)`;
    await tx.$executeRaw`UPDATE topic_stances AS stance SET agreement_count = (SELECT COUNT(*) FROM topic_stance_signals WHERE stance_id = stance.id AND signal = 'AGREE'), disagreement_count = (SELECT COUNT(*) FROM topic_stance_signals WHERE stance_id = stance.id AND signal = 'DISAGREE')`;
    await tx.$executeRaw`UPDATE memes AS meme SET collection_count = (SELECT COUNT(*) FROM meme_collections WHERE meme_id = meme.id), usage_count = (SELECT COUNT(*) FROM meme_usage_events WHERE meme_id = meme.id), rewarded_use_count = (SELECT COUNT(*) FROM meme_usage_events WHERE meme_id = meme.id AND reward_status = 'REWARDED')`;

    let balance = openingBalance;
    const survivingTransactions = await tx.pointTransaction.findMany({ where: { userId: retained.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    for (const transaction of survivingTransactions) {
      const next = balance + transaction.amount;
      await tx.pointTransaction.update({ where: { id: transaction.id }, data: { balanceBefore: balance, balanceAfter: next } });
      balance = next;
    }
    await tx.user.update({
      where: { id: retained.id },
      data: { nickname: '最高管理員', role: 'ADMIN', membershipTier: 'SENIOR', status: 'ACTIVE', isPhoneVerified: true, pointsBalance: balance },
    });

    const remainingUsers = await tx.user.count();
    if (remainingUsers !== 1) throw new Error(`Cleanup assertion failed: ${remainingUsers} users remain`);
    await verifyConsistency(tx, retained.id);
    return { retainedUserId: retained.id, removedUsers: removedUsers.length, transferred, pointsBalance: balance, backupSchema };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
}

async function verifyConsistency(tx: Prisma.TransactionClient, retainedUserId: bigint) {
  const mismatches = await tx.$queryRaw<Array<{ check_name: string }>>`
    SELECT 'topic_vote_counts' AS check_name FROM topics AS topic
    WHERE topic.total_votes <> (SELECT COUNT(*) FROM votes WHERE topic_id = topic.id)
       OR topic.voter_count <> (SELECT COUNT(DISTINCT user_id) FROM votes WHERE topic_id = topic.id)
    UNION ALL
    SELECT 'option_vote_counts' FROM topic_options AS option
    WHERE option.vote_count <> (SELECT COUNT(*) FROM votes WHERE option_id = option.id)
    UNION ALL
    SELECT 'stance_signal_counts' FROM topic_stances AS stance
    WHERE stance.agreement_count <> (SELECT COUNT(*) FROM topic_stance_signals WHERE stance_id = stance.id AND signal = 'AGREE')
       OR stance.disagreement_count <> (SELECT COUNT(*) FROM topic_stance_signals WHERE stance_id = stance.id AND signal = 'DISAGREE')
    UNION ALL
    SELECT 'post_like_counts' FROM posts AS post
    WHERE post.like_count <> (SELECT COUNT(*) FROM likes WHERE target_type = 'post' AND target_id = post.id)
    UNION ALL
    SELECT 'meme_counts' FROM memes AS meme
    WHERE meme.collection_count <> (SELECT COUNT(*) FROM meme_collections WHERE meme_id = meme.id)
       OR meme.usage_count <> (SELECT COUNT(*) FROM meme_usage_events WHERE meme_id = meme.id)
       OR meme.rewarded_use_count <> (SELECT COUNT(*) FROM meme_usage_events WHERE meme_id = meme.id AND reward_status = 'REWARDED')
  `;
  if (mismatches.length) throw new Error(`Counter verification failed: ${[...new Set(mismatches.map((item) => item.check_name))].join(', ')}`);

  const partner = await tx.organization.findUnique({ where: { slug: 'demo-partner' }, select: { id: true } });
  if (partner) {
    const membership = await tx.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: partner.id, userId: retainedUserId } } });
    if (!membership || membership.status !== 'ACTIVE') throw new Error('Retained account is missing the demo partner membership');
  }
}

async function main() {
  const dryRun = await summary();
  console.log(json({ mode: process.argv.includes('--execute') ? 'EXECUTE' : 'DRY_RUN', ...dryRun }));
  if (!process.argv.includes('--execute')) return;
  const backupSchema = process.argv.find((argument) => argument.startsWith('--backup-schema='))?.split('=')[1] || '';
  console.log(json(await execute(backupSchema)));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
