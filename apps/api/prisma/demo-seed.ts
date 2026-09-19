import { PrismaClient, TopicContentBlockType, TopicStatus, TopicType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { MemeStorageService } from '../src/memes/meme-storage.service';

const prisma = new PrismaClient();

const categories = [
  { key: 'politics', label: '政治', eyebrow: '治理與政策', color: '#9c3b3b', soft: '#f6e7e7', sortOrder: 0 },
  { key: 'society', label: '社會', eyebrow: '公共生活', color: '#37639c', soft: '#e7eff6', sortOrder: 1 },
  { key: 'life', label: '生活', eyebrow: '生活選擇', color: '#3f7a58', soft: '#e5f1e9', sortOrder: 2 },
  { key: 'technology', label: '科技', eyebrow: '科技與數位', color: '#7a5cbf', soft: '#efeafb', sortOrder: 3 },
  { key: 'entertainment', label: '娛樂', eyebrow: '娛樂與文化', color: '#b0761f', soft: '#f8f0e3', sortOrder: 4 },
  { key: 'quick', label: '快問', eyebrow: 'UGC 微投票', color: '#b0761f', soft: '#f8ecd6', sortOrder: 5 },
] as const;

interface SeedTopic {
  title: string;
  description: string;
  category: string;
  type?: TopicType;
  options?: string[];
  blocks?: Array<{
    type: TopicContentBlockType;
    title: string;
    content: string;
    sourceLabel: string;
    sourceUrl?: string;
    occurredAt?: string;
  }>;
}

const topics: SeedTopic[] = [
  {
    title: '你支持核四重啟嗎？',
    description: '針對能源政策與供電穩定的即時民調。',
    category: 'politics',
    options: ['支持', '反對', '沒意見'],
    blocks: [
      {
        type: TopicContentBlockType.CASE,
        title: '核四燃料移出與設備維護現況',
        content: '核四未投入商業運轉，廠內燃料已陸續移出。重啟評估仍須處理設備安檢、法規程序、時程與成本等問題。',
        sourceLabel: '台灣電力公司',
        sourceUrl: 'https://www.taipower.com.tw/',
      },
    ],
  },
  {
    title: '你對 AI 取代工作的擔憂程度？',
    description: '0 代表完全不擔心，100 代表非常擔憂。',
    category: 'technology',
    type: TopicType.SPECTRUM,
    blocks: [
      {
        type: TopicContentBlockType.DATA,
        title: '生成式 AI 對工作任務的影響評估',
        content: '國際勞工組織指出，生成式 AI 較可能先改變部分工作任務，而非立即取代整個職業；不同職業與地區受到的影響程度並不相同。',
        sourceLabel: '國際勞工組織（ILO）',
        sourceUrl: 'https://www.ilo.org/',
      },
    ],
  },
  {
    title: '你支持將投票年齡全面降至 18 歲嗎？',
    description: '青年公民權是否應與成年年齡同步？',
    category: 'politics',
    options: ['支持', '反對', '需要更多配套'],
    blocks: [
      {
        type: TopicContentBlockType.CASE,
        title: '2022 年公民權修憲複決',
        content: '立法院提出將選舉、罷免、創制、複決及被選舉權年齡降至 18 歲的修憲案，公民複決同意票未達法定門檻，因此修憲未通過。',
        sourceLabel: '中央選舉委員會',
        sourceUrl: 'https://www.cec.gov.tw/',
        occurredAt: '2022-11-26',
      },
    ],
  },
  {
    title: '市區主要道路應全面降低速限至 30 公里嗎？',
    description: '道路安全與通行效率之間，你會如何選擇？',
    category: 'society',
    options: ['應全面實施', '僅限特定區域', '不應降低'],
    blocks: [
      {
        type: TopicContentBlockType.DATA,
        title: '世界衛生組織建議的低速道路環境',
        content: '世界衛生組織建議，在行人與車輛頻繁混合的道路環境採用每小時 30 公里的安全速限，並搭配道路設計與執法降低碰撞風險。',
        sourceLabel: '世界衛生組織（WHO）',
        sourceUrl: 'https://www.who.int/publications/i/item/9789240015128',
      },
    ],
  },
  {
    title: '新聞網站留言是否應採實名驗證？',
    description: '降低惡意攻擊，是否值得犧牲部分匿名空間？',
    category: 'society',
    options: ['應該實名', '維持匿名', '由平台自行決定'],
  },
  {
    title: '你支持台灣企業試辦週休三日嗎？',
    description: '工時、薪資與生產力的重新平衡。',
    category: 'life',
    options: ['支持試辦', '維持現制', '視產業而定'],
  },
  {
    title: '外送平台尖峰時段加價，你可以接受嗎？',
    description: '即時便利與服務價格之間的日常選擇。',
    category: 'life',
    options: ['可以接受', '不能接受', '應設定上限'],
  },
  {
    title: 'AI 生成的新聞與影音是否應強制標示？',
    description: '面對合成內容，平台是否應負起揭露責任？',
    category: 'technology',
    options: ['全面強制', '高風險內容才需要', '不需強制'],
  },
  {
    title: '串流平台一次上架全集，還是每週更新比較好？',
    description: '追劇體驗與社群討論熱度，你偏好哪一種？',
    category: 'entertainment',
    options: ['一次上架全集', '每週固定更新', '依作品決定'],
  },
  {
    title: '演唱會實名制能有效改善黃牛問題嗎？',
    description: '購票公平與入場便利之間的取捨。',
    category: 'entertainment',
    options: ['有效，應全面採用', '效果有限', '應採其他制度'],
  },
];

const officialGifs = [
  { title: '點頭同意', background: [232, 239, 216], foreground: [63, 122, 88], pattern: 'bounce' },
  { title: '熱烈鼓掌', background: [255, 233, 202], foreground: [216, 74, 54], pattern: 'burst' },
  { title: '驚訝一下', background: [225, 232, 255], foreground: [49, 87, 213], pattern: 'pulse' },
  { title: '謝謝支持', background: [244, 222, 229], foreground: [166, 50, 89], pattern: 'heart' },
] as const;

async function createSeedGif(path: string, item: typeof officialGifs[number]) {
  const width = 128;
  const height = 128;
  const frames = 8;
  const pixels = Buffer.alloc(width * height * frames * 4);
  const paintCircle = (frame: number, cx: number, cy: number, radius: number, color: readonly number[]) => {
    for (let y = Math.max(0, cy - radius); y < Math.min(height, cy + radius); y += 1) {
      for (let x = Math.max(0, cx - radius); x < Math.min(width, cx + radius); x += 1) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) continue;
        const offset = ((frame * height + y) * width + x) * 4;
        pixels[offset] = color[0];
        pixels[offset + 1] = color[1];
        pixels[offset + 2] = color[2];
        pixels[offset + 3] = 255;
      }
    }
  };

  for (let frame = 0; frame < frames; frame += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = ((frame * height + y) * width + x) * 4;
        pixels[offset] = item.background[0];
        pixels[offset + 1] = item.background[1];
        pixels[offset + 2] = item.background[2];
        pixels[offset + 3] = 255;
      }
    }
    const phase = frame / frames * Math.PI * 2;
    if (item.pattern === 'bounce') paintCircle(frame, 64, 62 + Math.round(Math.sin(phase) * 18), 25, item.foreground);
    if (item.pattern === 'burst') {
      const radius = 12 + (frame % 4) * 6;
      for (let point = 0; point < 8; point += 1) paintCircle(frame, 64 + Math.round(Math.cos(point * Math.PI / 4) * 38), 64 + Math.round(Math.sin(point * Math.PI / 4) * 38), radius / 3, item.foreground);
      paintCircle(frame, 64, 64, 20, item.foreground);
    }
    if (item.pattern === 'pulse') {
      paintCircle(frame, 64, 64, 24 + Math.round((Math.sin(phase) + 1) * 8), item.foreground);
      paintCircle(frame, 54, 58, 4, [255, 255, 255]);
      paintCircle(frame, 74, 58, 4, [255, 255, 255]);
    }
    if (item.pattern === 'heart') {
      const scale = 1 + Math.sin(phase) * 0.12;
      for (let y = -42; y <= 38; y += 1) {
        for (let x = -48; x <= 48; x += 1) {
          const nx = x / (38 * scale);
          const ny = -y / (38 * scale);
          if ((nx * nx + ny * ny - 1) ** 3 - nx * nx * ny ** 3 <= 0) paintCircle(frame, 64 + x, 62 + y, 1, item.foreground);
        }
      }
    }
  }

  await sharp(pixels, { raw: { width, height: height * frames, channels: 4, pageHeight: height } })
    .gif({ delay: Array(frames).fill(110), loop: 0, colours: 64, effort: 3 })
    .toFile(path);
}

async function ensureOfficialGifs(userId: bigint) {
  const storage = new MemeStorageService(prisma as never);
  await storage.onModuleInit();
  try {
    for (const item of officialGifs) {
      const existing = await prisma.meme.findFirst({ where: { creatorId: userId, origin: 'OFFICIAL', title: item.title } });
      if (existing) continue;
      const uploadPath = join(MemeStorageService.quarantineDirectory(), `seed-${item.pattern}-${Date.now()}.gif`);
      await createSeedGif(uploadPath, item);
      const processed = await storage.processUpload(uploadPath);
      try {
        await prisma.meme.create({
          data: {
            creatorId: userId,
            title: item.title,
            origin: 'OFFICIAL',
            ...processed,
            rightsAttestedAt: new Date(),
            status: 'APPROVED',
            reviewedById: userId,
            reviewedAt: new Date(),
          },
        });
      } catch (error) {
        await storage.remove(processed.storageKey);
        throw error;
      }
    }
  } finally {
    storage.onModuleDestroy();
  }
}

async function ensureTopic(seed: SeedTopic) {
  const existing = await prisma.topic.findFirst({ where: { title: seed.title } });
  if (existing) {
    const blockCount = await prisma.topicContentBlock.count({ where: { topicId: existing.id } });
    if (blockCount === 0 && seed.blocks?.length) {
      await prisma.topicContentBlock.createMany({
        data: seed.blocks.map((item, index) => ({
          topicId: existing.id,
          type: item.type,
          title: item.title,
          content: item.content,
          sourceLabel: item.sourceLabel,
          sourceUrl: item.sourceUrl,
          occurredAt: item.occurredAt ? new Date(item.occurredAt) : null,
          sortOrder: index,
        })),
      });
    } else if (seed.blocks?.length) {
      await Promise.all(
        seed.blocks.map((item) =>
          prisma.topicContentBlock.updateMany({
            where: { topicId: existing.id, title: item.title },
            data: { type: item.type },
          }),
        ),
      );
    }
    return existing;
  }

  return prisma.topic.create({
    data: {
      title: seed.title,
      description: seed.description,
      category: seed.category,
      topicType: seed.type ?? TopicType.BINARY,
      status: TopicStatus.OPEN,
      voteEndAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      options: seed.options
        ? { create: seed.options.map((label) => ({ label })) }
        : undefined,
      contentBlocks: seed.blocks
        ? {
            create: seed.blocks.map((item, index) => ({
              type: item.type,
              title: item.title,
              content: item.content,
              sourceLabel: item.sourceLabel,
              sourceUrl: item.sourceUrl,
              occurredAt: item.occurredAt ? new Date(item.occurredAt) : null,
              sortOrder: index,
            })),
          }
        : undefined,
    },
  });
}

async function main() {
  // fail-closed：只擋 NODE_ENV 不夠（維運機通常沒設該變數），必須顯式允許。
  // 正式 DB 誤執行會建立固定帳密管理員，因此預設拒絕。
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Demo seeding is disabled. Set ALLOW_DEMO_SEED=true with NODE_ENV != production to run it.');
  }
  // Seed-only admin credentials. MUST be changed in real environments (use env-based provisioning instead).
  const adminEmail = 'admin@windcock.local';
  const adminPasswordHash = await bcrypt.hash('Admin12345', 12);
  const user = await prisma.user.upsert({
    where: { phoneNumber: '0911111111' },
    update: { email: adminEmail, passwordHash: adminPasswordHash, passwordUpdatedAt: new Date(), nickname: '最高管理員', role: 'ADMIN', membershipTier: 'SENIOR', status: 'ACTIVE', isPhoneVerified: true },
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      passwordUpdatedAt: new Date(),
      phoneNumber: '0911111111',
      nickname: '最高管理員',
      pointsBalance: 500,
      isPhoneVerified: true,
      role: 'ADMIN',
      membershipTier: 'SENIOR',
    },
  });

  const partner = await prisma.organization.upsert({
    where: { slug: 'demo-partner' },
    update: { name: '示範合作夥伴', status: 'ACTIVE', isPartner: true },
    create: { slug: 'demo-partner', name: '示範合作夥伴', status: 'ACTIVE', isPartner: true },
  });
  await prisma.organizationMembership.upsert({
    where: { organizationId_userId: { organizationId: partner.id, userId: user.id } },
    update: { role: 'OWNER', status: 'ACTIVE' },
    create: { organizationId: partner.id, userId: user.id, role: 'OWNER', status: 'ACTIVE' },
  });

  const createdTopics = await Promise.all(topics.map(ensureTopic));
  for (const category of categories) {
    await prisma.category.upsert({
      where: { key: category.key },
      update: { label: category.label, eyebrow: category.eyebrow, color: category.color, soft: category.soft, sortOrder: category.sortOrder, isActive: true },
      create: { ...category, isActive: true },
    });
  }
  await ensureOfficialGifs(user.id);

  console.log(`Seed done. ${createdTopics.length} topics and ${officialGifs.length} official GIFs available. The 0911111111 account is used for admin and virtual identity testing.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
