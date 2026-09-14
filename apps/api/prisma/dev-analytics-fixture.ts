import { PrismaClient } from '@prisma/client';
import { DEMOGRAPHIC_CONSENT_VERSION } from '../src/profiles/demographic-profiles.service';

const prisma = new PrismaClient();

const profiles = [
  {
    ageBand: 'AGE_25_34', gender: 'FEMALE', occupation: 'TECHNOLOGY', region: '臺北市', district: '臺北市中正區',
    personalityType: 'INTJ', employmentStatus: 'FULL_TIME', industry: 'TECHNOLOGY', annualIncome: 'TWD_500K_799K',
    education: 'BACHELOR', relationship: 'SINGLE', livingArrangement: 'WITH_PARENTS_RELATIVES', parentingStage: 'NO_CHILDREN',
    housingStatus: 'RENT', westernZodiac: 'VIRGO', chineseZodiac: 'DRAGON', isMinor: false,
  },
  {
    ageBand: 'AGE_35_44', gender: 'MALE', occupation: 'PUBLIC_SERVICE', region: '新北市', district: '新北市板橋區',
    personalityType: 'ENFP', employmentStatus: 'SELF_EMPLOYED', industry: 'EDUCATION', annualIncome: 'TWD_1200K_1999K',
    education: 'MASTER', relationship: 'MARRIED', livingArrangement: 'WITH_PARTNER', parentingStage: 'PRIMARY_SCHOOL',
    housingStatus: 'MORTGAGE', westernZodiac: 'AQUARIUS', chineseZodiac: 'HORSE', isMinor: false,
  },
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Development analytics fixtures are disabled in production');
  if (process.env.DEV_IDENTITY_SWITCHER_ENABLED === 'false') throw new Error('DEV_IDENTITY_SWITCHER_ENABLED must not be false');
  if (process.env.ALLOW_DEV_ANALYTICS_FIXTURE !== 'true') throw new Error('Set ALLOW_DEV_ANALYTICS_FIXTURE=true to execute');

  const user = await prisma.user.findUnique({ where: { phoneNumber: '0911111111' }, select: { id: true, role: true } });
  if (!user || user.role !== 'ADMIN') throw new Error('The retained administrator does not exist');
  if (await prisma.user.count() !== 1) throw new Error('Development analytics fixtures require a single-account database');
  const votes = await prisma.vote.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' }, take: profiles.length, select: { id: true } });
  if (votes.length < profiles.length) throw new Error(`At least ${profiles.length} retained votes are required`);

  await prisma.$transaction(votes.map((vote, index) => prisma.voteDemographicSnapshot.upsert({
    where: { voteId: vote.id },
    create: { voteId: vote.id, ...profiles[index], consentVersion: DEMOGRAPHIC_CONSENT_VERSION },
    update: { ...profiles[index], consentVersion: DEMOGRAPHIC_CONSENT_VERSION },
  })));
  console.log(`Created ${votes.length} development-only demographic snapshots for user ${user.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
