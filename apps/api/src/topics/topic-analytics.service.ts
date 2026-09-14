import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DemographicDimension,
  TopicType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEMOGRAPHIC_CONSENT_VERSION, LEGACY_ANALYTICS_CONSENT_VERSION } from '../profiles/demographic-profiles.service';
import { PolicyService } from '../identity/policy.service';
import { NodeView, StancesService } from './stances.service';

const ANALYTICS_MODULES = ['RESULT_TRENDS', 'DEMOGRAPHICS', 'STANCE_INSIGHTS'] as const;
type AnalyticsModule = typeof ANALYTICS_MODULES[number];
const DEMOGRAPHIC_TOTAL_MIN = privacyThreshold('DEMOGRAPHIC_MIN_TOTAL', 30);
const DEMOGRAPHIC_COHORT_MIN = privacyThreshold('DEMOGRAPHIC_MIN_COHORT', 10);
const DISTRICT_TOTAL_MIN = privacyThreshold('DEMOGRAPHIC_DISTRICT_MIN_TOTAL', 100);
const DISTRICT_COHORT_MIN = privacyThreshold('DEMOGRAPHIC_DISTRICT_MIN_COHORT', 20);
const STANCE_COHORT_MIN = privacyThreshold('STANCE_ANALYTICS_MIN_COHORT', 10);

type AnalyticsTopic = Awaited<ReturnType<TopicAnalyticsService['requireTopic']>>;

@Injectable()
export class TopicAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stances: StancesService,
    private readonly policy: PolicyService,
  ) {}

  async access(topicId: bigint, userId: bigint | null) {
    const topic = await this.requireTopic(topicId);
    await this.assertAnalyticsAccess(userId, topicId);
    const demographicSamples = await this.prisma.voteDemographicSnapshot.count({
      where: { vote: { topicId }, consentVersion: { in: [LEGACY_ANALYTICS_CONSENT_VERSION, DEMOGRAPHIC_CONSENT_VERSION] } },
    });

    return {
      topicId: topic.id.toString(),
      totalVotes: topic.totalVotes.toString(),
      modules: ANALYTICS_MODULES.map((module) => ({
        module,
        available: module !== 'DEMOGRAPHICS' || demographicSamples >= DEMOGRAPHIC_TOTAL_MIN,
      })),
      demographicSamples,
      generatedAt: new Date().toISOString(),
    };
  }

  async trends(topicId: bigint, userId: bigint | null) {
    const topic = await this.requireModule(topicId, userId, 'RESULT_TRENDS');
    const votes = await this.prisma.vote.findMany({
      where: { topicId },
      orderBy: { createdAt: 'asc' },
      select: { optionId: true, spectrumValue: true, createdAt: true },
    });
    const now = Date.now();
    const last24Hours = votes.filter((vote) => vote.createdAt.getTime() > now - 86_400_000).length;
    const previous24Hours = votes.filter((vote) => vote.createdAt.getTime() > now - 172_800_000 && vote.createdAt.getTime() <= now - 86_400_000).length;
    const recentVotes = votes.filter((vote) => vote.createdAt.getTime() > now - 86_400_000);
    const previousVotes = votes.filter((vote) => vote.createdAt.getTime() > now - 172_800_000 && vote.createdAt.getTime() <= now - 86_400_000);
    const timeline = this.timeline(topic, votes);
    const options = topic.options.map((option) => {
      const count = votes.filter((vote) => vote.optionId === option.id).length;
      return { optionId: option.id.toString(), label: option.label, count, percentage: percentage(count, votes.length) };
    });
    const ranked = [...options].sort((a, b) => b.count - a.count);
    const spectrumValues = votes.map((vote) => vote.spectrumValue).filter((value): value is number => value !== null).sort((a, b) => a - b);
    const optionMomentum = topic.options.map((option) => {
      const recentCount = recentVotes.filter((vote) => vote.optionId === option.id).length;
      const previousCount = previousVotes.filter((vote) => vote.optionId === option.id).length;
      const recentShare = percentage(recentCount, recentVotes.length);
      const previousShare = percentage(previousCount, previousVotes.length);
      return {
        optionId: option.id.toString(),
        label: option.label,
        last24Hours: recentCount,
        previous24Hours: previousCount,
        shareChange: round1(recentShare - previousShare),
      };
    });
    const fastestGrowing = recentVotes.length
      ? [...optionMomentum].sort((a, b) => b.shareChange - a.shareChange || b.last24Hours - a.last24Hours)[0] ?? null
      : null;
    const peakDay = timeline.length
      ? timeline.reduce((peak, item) => item.votes > peak.votes ? item : peak)
      : null;

    return {
      topicId: topic.id.toString(),
      topicType: topic.topicType,
      totalVotes: votes.length,
      options,
      leadMargin: ranked.length > 1 ? round1(ranked[0].percentage - ranked[1].percentage) : 0,
      velocity: { last24Hours, previous24Hours, changePercent: previous24Hours ? Math.round((last24Hours - previous24Hours) / previous24Hours * 100) : null },
      optionMomentum,
      fastestGrowingOptionId: fastestGrowing?.optionId ?? null,
      latestCrossover: latestCrossover(timeline),
      peakDay: peakDay ? { date: peakDay.date, votes: peakDay.votes } : null,
      timeline,
      spectrum: topic.topicType === 'SPECTRUM' ? spectrumSummary(spectrumValues) : null,
      generatedAt: new Date().toISOString(),
      methodology: '趨勢依平台內已驗證會員的實際投票時間彙整，不代表全體人口或隨機抽樣民意。',
    };
  }

  async demographics(topicId: bigint, userId: bigint | null, dimension: DemographicDimension) {
    const topic = await this.requireModule(topicId, userId, 'DEMOGRAPHICS');
    await this.prisma.demographicAnalysisAudit.create({ data: { adminId: userId!, topicId, dimension } });
    const field = demographicField(dimension);
    const thresholds = demographicThresholds(dimension);
    const snapshots = await this.prisma.voteDemographicSnapshot.findMany({
      where: { vote: { topicId }, consentVersion: { in: consentVersions(dimension) } },
      include: { vote: { select: { optionId: true, spectrumValue: true } } },
    });
    const values = snapshots.filter((item) => item[field] !== null);
    const base = {
      topicId: topic.id.toString(),
      topicType: topic.topicType,
      dimension,
      totalVotes: Number(topic.totalVotes),
      dimensionVotes: values.length,
      coveragePercent: Number(topic.totalVotes) ? Math.round(values.length / Number(topic.totalVotes) * 100) : 0,
      thresholds,
      methodology: '資料為會員投票當下的選填自陳快照；後續修改不影響既有投票。僅呈現單一維度，未經人口加權，不代表全體人口；人格類型不是心理診斷，星座與生肖僅供趣味觀察。',
      generatedAt: new Date().toISOString(),
    };
    if (values.length < thresholds.total) return { ...base, available: false, suppressed: values.length > 0, baseline: null, groups: [], insights: [] };

    const grouped = new Map<string, typeof values>();
    for (const item of values) {
      const key = String(item[field]);
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    const hiddenKeys = [...grouped.entries()].filter(([, items]) => items.length < thresholds.cohort).map(([key]) => key);
    const visibleEntries = [...grouped.entries()].filter(([, items]) => items.length >= thresholds.cohort);
    // Hide one additional small visible cohort when only one category is suppressed, preventing subtraction attacks.
    if (hiddenKeys.length === 1 && visibleEntries.length > 0) {
      visibleEntries.sort((a, b) => a[1].length - b[1].length).shift();
    }
    const baseline = this.demographicGroup(topic, 'BASELINE', values);
    const groups = visibleEntries.map(([key, items]) => this.demographicGroup(topic, key, items));
    const insights = topic.topicType === 'SPECTRUM'
      ? groups
          .filter((group) => group.median !== null && baseline.median !== null)
          .map((group) => ({ group: group.key, metric: 'MEDIAN_GAP', value: round1(Number(group.median) - Number(baseline.median)) }))
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3)
      : groups.flatMap((group) => (group.options ?? []).map((option) => {
          const baseOption = baseline.options?.find((item) => item.optionId === option.optionId);
          return { group: group.key, optionId: option.optionId, optionLabel: option.label, metric: 'PERCENTAGE_POINT_GAP', value: round1(option.percentage - (baseOption?.percentage ?? 0)) };
        })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
    return { ...base, available: groups.length > 0, suppressed: hiddenKeys.length > 0 || groups.length < grouped.size, baseline, groups, insights };
  }

  async stanceInsights(topicId: bigint, userId: bigint | null) {
    const topic = await this.requireModule(topicId, userId, 'STANCE_INSIGHTS');
    const tree = await this.stances.list(topicId, null, true);
    const optionTotals = new Map(topic.options.map((option) => [option.id.toString(), Number(option.voteCount)]));
    const nodes = flattenStances(tree.roots).map((node) => {
      const camps = node.camps?.map((camp) => ({
        ...camp,
        voterCount: optionTotals.get(camp.optionId) ?? 0,
        supportPercent: percentage(camp.count, optionTotals.get(camp.optionId) ?? 0),
      })) ?? null;
      const campsVisible = camps === null || camps.every((camp) => camp.voterCount >= STANCE_COHORT_MIN && camp.count >= STANCE_COHORT_MIN);
      const signalsVisible = node.agreed + node.disagreed >= STANCE_COHORT_MIN;
      return {
        id: node.id,
        parentId: node.parentId,
        title: node.title,
        agreed: signalsVisible ? node.agreed : null,
        disagreed: signalsVisible ? node.disagreed : null,
        discussionCount: node.discussionCount,
        commonGround: campsVisible && node.commonGround,
        unvotedAgree: signalsVisible && node.unvotedAgree >= STANCE_COHORT_MIN ? node.unvotedAgree : null,
        camps: campsVisible ? camps : null,
        suppressed: !signalsVisible || !campsVisible,
      };
    });
    const commonGroundCount = nodes.filter((node) => node.commonGround).length;
    return {
      topicId: topic.id.toString(),
      topicType: topic.topicType,
      stanceCount: tree.count,
      directStanceCount: tree.roots.length,
      commonGroundCount,
      thresholds: { cohort: STANCE_COHORT_MIN },
      nodes,
      generatedAt: new Date().toISOString(),
      methodology: '陣營支持率為該選項投票者中，對指定立場表達認同的比例；小樣本立場與陣營數據依匿名門檻隱藏，只描述平台參與者行為。',
    };
  }

  async comparisonAccess(userId: bigint) {
    const canCompare = await this.canViewAnalytics(userId);
    return {
      canCompare,
      organizationId: null,
      expiresAt: null,
    };
  }

  async comparison(userId: bigint, topicIds: bigint[], dimension: DemographicDimension) {
    const uniqueIds = [...new Set(topicIds.map(String))].map(BigInt);
    if (uniqueIds.length < 2 || uniqueIds.length > 5) throw new BadRequestException('請選擇 2 到 5 個不同議題');
    await this.assertAnalyticsAccess(userId);
    const topics = await this.prisma.topic.findMany({
      where: { id: { in: uniqueIds }, moderationStatus: 'APPROVED', status: { in: ['OPEN', 'LOCKED', 'SETTLED'] } },
      include: { options: { orderBy: { id: 'asc' } }, _count: { select: { stances: { where: { status: 'ACTIVE' } }, posts: true } } },
    });
    if (topics.length !== uniqueIds.length) throw new NotFoundException('部分議題不存在或尚未公開');
    await Promise.all(uniqueIds.map((topicId) => this.assertAnalyticsAccess(userId, topicId)));
    const items = await Promise.all(topics.map(async (topic) => {
      const activeStart = topic.reviewedAt?.getTime() ?? topic.createdAt.getTime();
      const activeEnd = Math.min(topic.voteEndAt?.getTime() ?? Date.now(), Date.now());
      const durationDays = Math.max(1, Math.ceil((activeEnd - activeStart) / 86_400_000));
      const optionCounts = topic.options.map((option) => ({ optionId: option.id.toString(), label: option.label, count: Number(option.voteCount), percentage: percentage(Number(option.voteCount), Number(topic.totalVotes)) }));
      const ranked = [...optionCounts].sort((a, b) => b.count - a.count);
      const field = demographicField(dimension);
      const demographicSamples = await this.prisma.voteDemographicSnapshot.count({
        where: {
          vote: { topicId: topic.id },
          consentVersion: { in: consentVersions(dimension) },
          [field]: { not: null },
        },
      });
      const stanceAnalytics = await this.stanceInsights(topic.id, userId);
      const demographic = demographicSamples >= demographicThresholds(dimension).total ? await this.demographics(topic.id, userId, dimension) : null;
      return {
        id: topic.id.toString(),
        title: topic.title,
        category: topic.category,
        topicType: topic.topicType,
        totalVotes: Number(topic.totalVotes),
        votesPerDay: round1(Number(topic.totalVotes) / durationDays),
        leadMargin: ranked.length > 1 ? round1(ranked[0].percentage - ranked[1].percentage) : 0,
        options: optionCounts,
        profileCoveragePercent: Number(topic.totalVotes) ? Math.round(demographicSamples / Number(topic.totalVotes) * 100) : 0,
        stanceCount: topic._count.stances,
        commonGroundCount: stanceAnalytics.commonGroundCount,
        commonGroundRate: stanceAnalytics.stanceCount ? round1(stanceAnalytics.commonGroundCount / stanceAnalytics.stanceCount * 100) : 0,
        discussionCount: topic._count.posts,
        discussionsPer100Votes: Number(topic.totalVotes) ? round1(topic._count.posts / Number(topic.totalVotes) * 100) : 0,
        spectrum: topic.topicType === 'SPECTRUM' ? {
          median: topic.spectrumMedian === null ? null : Number(topic.spectrumMedian),
          stddev: topic.spectrumStddev === null ? null : Number(topic.spectrumStddev),
        } : null,
        demographic,
      };
    }));
    return { dimension, items, generatedAt: new Date().toISOString() };
  }

  private async requireModule(topicId: bigint, userId: bigint | null, module: AnalyticsModule) {
    const topic = await this.requireTopic(topicId);
    void module;
    await this.assertAnalyticsAccess(userId, topicId);
    return topic;
  }

  private async assertAnalyticsAccess(userId: bigint | null, topicId?: bigint) {
    if (!userId || !(topicId ? await this.policy.canViewTopicAnalytics(userId, topicId) : await this.canViewAnalytics(userId))) {
      throw new ForbiddenException('目前身份無法查看分析資料');
    }
  }

  private async canViewAnalytics(userId: bigint) {
    return this.policy.canViewAnalytics(userId);
  }

  private async requireTopic(topicId: bigint) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId }, include: { options: { orderBy: { id: 'asc' } } } });
    if (!topic || topic.moderationStatus !== 'APPROVED' || !['OPEN', 'LOCKED', 'SETTLED'].includes(topic.status)) throw new NotFoundException('議題不存在或尚未公開');
    return topic;
  }

  private timeline(topic: AnalyticsTopic, votes: Array<{ optionId: bigint | null; spectrumValue: number | null; createdAt: Date }>) {
    const buckets = new Map<string, typeof votes>();
    for (const vote of votes) {
      const key = taipeiDate(vote.createdAt);
      buckets.set(key, [...(buckets.get(key) ?? []), vote]);
    }
    const cumulative = new Map<string, number>();
    let cumulativeTotal = 0;
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => {
      cumulativeTotal += items.length;
      for (const item of items) {
        const key = item.optionId?.toString() ?? 'SPECTRUM';
        cumulative.set(key, (cumulative.get(key) ?? 0) + 1);
      }
      return {
        date,
        votes: items.length,
        cumulativeVotes: cumulativeTotal,
        options: topic.options.map((option) => ({ optionId: option.id.toString(), label: option.label, count: cumulative.get(option.id.toString()) ?? 0, percentage: percentage(cumulative.get(option.id.toString()) ?? 0, cumulativeTotal) })),
      };
    });
  }

  private demographicGroup(topic: AnalyticsTopic, key: string, values: Array<{ vote: { optionId: bigint | null; spectrumValue: number | null } }>) {
    if (topic.topicType === 'SPECTRUM') {
      const scores = values.map((item) => item.vote.spectrumValue).filter((value): value is number => value !== null).sort((a, b) => a - b);
      return { key, count: values.length, median: median(scores), options: null };
    }
    return {
      key,
      count: values.length,
      median: null,
      options: topic.options.map((option) => {
        const count = values.filter((item) => item.vote.optionId === option.id).length;
        return { optionId: option.id.toString(), label: option.label, count, percentage: percentage(count, values.length) };
      }),
    };
  }
}

function demographicField(dimension: DemographicDimension) {
  return ({
    AGE_BAND: 'ageBand',
    GENDER: 'gender',
    OCCUPATION: 'occupation',
    REGION: 'region',
    DISTRICT: 'district',
    PERSONALITY_TYPE: 'personalityType',
    EMPLOYMENT_STATUS: 'employmentStatus',
    INDUSTRY: 'industry',
    ANNUAL_INCOME: 'annualIncome',
    EDUCATION: 'education',
    RELATIONSHIP: 'relationship',
    LIVING_ARRANGEMENT: 'livingArrangement',
    PARENTING_STAGE: 'parentingStage',
    HOUSING_STATUS: 'housingStatus',
    WESTERN_ZODIAC: 'westernZodiac',
    CHINESE_ZODIAC: 'chineseZodiac',
  } as const)[dimension];
}

function demographicThresholds(dimension: DemographicDimension) {
  return dimension === 'DISTRICT'
    ? { total: DISTRICT_TOTAL_MIN, cohort: DISTRICT_COHORT_MIN }
    : { total: DEMOGRAPHIC_TOTAL_MIN, cohort: DEMOGRAPHIC_COHORT_MIN };
}

function consentVersions(dimension: DemographicDimension) {
  return ['AGE_BAND', 'GENDER', 'OCCUPATION', 'REGION', 'WESTERN_ZODIAC', 'CHINESE_ZODIAC'].includes(dimension)
    ? [LEGACY_ANALYTICS_CONSENT_VERSION, DEMOGRAPHIC_CONSENT_VERSION]
    : [DEMOGRAPHIC_CONSENT_VERSION];
}

function percentage(count: number, total: number) {
  return total ? round1(count / total * 100) : 0;
}

function privacyThreshold(name: string, productionMinimum: number) {
  const developmentDefault = !['production', 'test'].includes(process.env.NODE_ENV || '') && process.env.DEV_IDENTITY_SWITCHER_ENABLED !== 'false'
    ? 1
    : productionMinimum;
  const value = Number(process.env[name] || developmentDefault);
  if (!Number.isInteger(value) || value < 1) return productionMinimum;
  return process.env.NODE_ENV === 'production' ? Math.max(value, productionMinimum) : value;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function median(values: number[]) {
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function quantile(values: number[], percentile: number) {
  if (!values.length) return null;
  const index = (values.length - 1) * percentile;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return values[lower + 1] === undefined ? values[lower] : values[lower] + fraction * (values[lower + 1] - values[lower]);
}

function spectrumSummary(values: number[]) {
  const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const variance = values.length ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length : 0;
  return {
    median: median(values),
    q1: quantile(values, 0.25),
    q3: quantile(values, 0.75),
    stddev: round1(Math.sqrt(variance)),
    bins: Array.from({ length: 10 }, (_, index) => ({
      label: `${index * 10}–${index === 9 ? 100 : index * 10 + 9}`,
      count: values.filter((value) => value >= index * 10 && (index === 9 ? value <= 100 : value < (index + 1) * 10)).length,
    })),
  };
}

function taipeiDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function flattenStances(nodes: NodeView[]): NodeView[] {
  return nodes.flatMap((node) => [node, ...flattenStances(node.children)]);
}

function latestCrossover(timeline: Array<{ date: string; options: Array<{ optionId: string; label: string; count: number }> }>) {
  let previousLeader: { optionId: string; label: string } | null = null;
  let crossover: { date: string; fromOptionId: string; fromLabel: string; toOptionId: string; toLabel: string } | null = null;
  for (const point of timeline) {
    const ranked = [...point.options].sort((a, b) => b.count - a.count);
    const leader = ranked[0];
    if (!leader || (ranked[1] && leader.count === ranked[1].count)) continue;
    if (previousLeader && previousLeader.optionId !== leader.optionId) {
      crossover = {
        date: point.date,
        fromOptionId: previousLeader.optionId,
        fromLabel: previousLeader.label,
        toOptionId: leader.optionId,
        toLabel: leader.label,
      };
    }
    previousLeader = { optionId: leader.optionId, label: leader.label };
  }
  return crossover;
}
