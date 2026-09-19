import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const demoTopicTitles = [
  '你支持核四重啟嗎？',
  '你對 AI 取代工作的擔憂程度？',
  '你支持將投票年齡全面降至 18 歲嗎？',
  '市區主要道路應全面降低速限至 30 公里嗎？',
  '新聞網站留言是否應採實名驗證？',
  '你支持台灣企業試辦週休三日嗎？',
  '外送平台尖峰時段加價，你可以接受嗎？',
  'AI 生成的新聞與影音是否應強制標示？',
  '串流平台一次上架全集，還是每週更新比較好？',
  '演唱會實名制能有效改善黃牛問題嗎？',
];

const demoMemeTitles = ['點頭同意', '熱烈鼓掌', '驚訝一下', '謝謝支持'];

async function main() {
  const apply = process.env.CONFIRM_REMOVE_DEMO_CONTENT === 'yes';

  const topics = await prisma.topic.findMany({
    where: { title: { in: demoTopicTitles }, creatorId: null, kind: 'FORMAL' },
    select: { id: true, title: true },
  });
  const topicIds = topics.map(({ id }) => id);
  const memes = await prisma.meme.findMany({
    where: { origin: 'OFFICIAL', title: { in: demoMemeTitles } },
    select: { id: true, title: true, storageKey: true },
  });
  const memeIds = memes.map(({ id }) => id);
  const demoOrganization = await prisma.organization.findUnique({
    where: { slug: 'demo-partner' },
    select: { id: true, _count: { select: { topicApplications: true } } },
  });

  // 依賴預檢：demo 議題若已有真實投票／貼文／立場，硬刪會破壞使用者資料，
  // 直接拒絕並回報，請改用下架而非刪除。
  const blockers = topicIds.length
    ? await Promise.all(
        topics.map(async (topic) => {
          const [votes, posts, stances] = await Promise.all([
            prisma.vote.count({ where: { topicId: topic.id } }),
            prisma.post.count({ where: { topicId: topic.id } }),
            prisma.topicStance.count({ where: { topicId: topic.id } }),
          ]);
          return { title: topic.title, votes, posts, stances };
        }),
      )
    : [];
  const blocked = blockers.filter((item) => item.votes + item.posts + item.stances > 0);
  if (blocked.length) {
    console.error(
      'Refusing to delete demo topics with real activity. Take them down instead of deleting:',
    );
    for (const item of blocked) {
      console.error(
        ` - ${item.title}: ${item.votes} votes, ${item.posts} posts, ${item.stances} stances`,
      );
    }
    process.exit(1);
  }

  const removableOrganization =
    demoOrganization && demoOrganization._count.topicApplications === 0
      ? demoOrganization.id
      : null;

  console.log(
    `Demo content matched: ${topics.length} topics, ${memes.length} memes, ` +
      `${removableOrganization ? 1 : 0} organizations` +
      (demoOrganization && !removableOrganization ? ' (demo-partner has applications, kept)' : ''),
  );
  for (const meme of memes) {
    console.log(` - meme: ${meme.title} (storageKey ${meme.storageKey})`);
  }

  if (!apply) {
    console.log('DRY RUN — nothing deleted. Set CONFIRM_REMOVE_DEMO_CONTENT=yes to apply.');
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    if (memeIds.length) {
      await tx.memeUsageEvent.deleteMany({ where: { memeId: { in: memeIds } } });
      await tx.memeReport.deleteMany({ where: { memeId: { in: memeIds } } });
      await tx.postMemeAttachment.deleteMany({ where: { memeId: { in: memeIds } } });
      await tx.commentMemeAttachment.deleteMany({ where: { memeId: { in: memeIds } } });
      await tx.memeCollection.deleteMany({ where: { memeId: { in: memeIds } } });
    }

    const deletedMemes = await tx.meme.deleteMany({ where: { id: { in: memeIds } } });
    const deletedTopics = await tx.topic.deleteMany({ where: { id: { in: topicIds } } });
    let deletedOrganizations = 0;
    if (removableOrganization) {
      await tx.roleAssignment.deleteMany({ where: { organizationId: removableOrganization } });
      await tx.organizationMembership.deleteMany({ where: { organizationId: removableOrganization } });
      deletedOrganizations = (
        await tx.organization.deleteMany({ where: { id: removableOrganization } })
      ).count;
    }
    return {
      topics: deletedTopics.count,
      memes: deletedMemes.count,
      organizations: deletedOrganizations,
    };
  });

  console.log(
    `Removed demo content: ${result.topics} topics, ${result.memes} memes, ${result.organizations} organizations. ` +
      'Meme files are reclaimed by the API orphan cleanup within an hour while the API is running.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
