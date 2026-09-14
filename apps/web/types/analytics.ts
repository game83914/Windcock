import type { DemographicDimension } from './profile';

export type AnalyticsModule = 'RESULT_TRENDS' | 'DEMOGRAPHICS' | 'STANCE_INSIGHTS';

export interface AnalyticsAccess {
  topicId: string;
  totalVotes: string;
  demographicSamples: number;
  generatedAt: string;
  modules: Array<{ module: AnalyticsModule; available: boolean }>;
}

export interface TrendAnalytics {
  topicId: string;
  topicType: 'BINARY' | 'MULTIPLE' | 'SPECTRUM';
  totalVotes: number;
  options: Array<{ optionId: string; label: string; count: number; percentage: number }>;
  leadMargin: number;
  velocity: { last24Hours: number; previous24Hours: number; changePercent: number | null };
  optionMomentum: Array<{ optionId: string; label: string; last24Hours: number; previous24Hours: number; shareChange: number }>;
  fastestGrowingOptionId: string | null;
  latestCrossover: null | { date: string; fromOptionId: string; fromLabel: string; toOptionId: string; toLabel: string };
  peakDay: null | { date: string; votes: number };
  timeline: Array<{ date: string; votes: number; cumulativeVotes: number; options: Array<{ optionId: string; label: string; count: number; percentage: number }> }>;
  spectrum: null | { median: number | null; q1: number | null; q3: number | null; stddev: number; bins: Array<{ label: string; count: number }> };
  generatedAt: string;
  methodology: string;
}

export interface DemographicAnalytics {
  topicId: string;
  topicType: 'BINARY' | 'MULTIPLE' | 'SPECTRUM';
  dimension: DemographicDimension;
  totalVotes: number;
  dimensionVotes: number;
  coveragePercent: number;
  thresholds: { total: number; cohort: number };
  available: boolean;
  suppressed: boolean;
  baseline: DemographicAnalyticsGroup | null;
  groups: DemographicAnalyticsGroup[];
  insights: Array<{ group: string; optionId?: string; optionLabel?: string; metric: string; value: number }>;
  methodology: string;
  generatedAt: string;
}

export interface DemographicAnalyticsGroup {
  key: string;
  count: number;
  median: number | null;
  options: Array<{ optionId: string; label: string; count: number; percentage: number }> | null;
}

export interface StanceAnalytics {
  topicId: string;
  topicType: 'BINARY' | 'MULTIPLE' | 'SPECTRUM';
  stanceCount: number;
  directStanceCount: number;
  commonGroundCount: number;
  thresholds: { cohort: number };
  nodes: Array<{
    id: string;
    parentId: string | null;
    title: string;
    agreed: number | null;
    disagreed: number | null;
    discussionCount: number;
    commonGround: boolean;
    unvotedAgree: number | null;
    camps: Array<{ optionId: string; label: string; count: number; voterCount: number; supportPercent: number }> | null;
    suppressed: boolean;
  }>;
  methodology: string;
  generatedAt: string;
}

export interface AnalyticsComparisonAccess {
  canCompare: boolean;
  organizationId: string | null;
  expiresAt: string | null;
}

export interface AnalyticsComparison {
  dimension: DemographicDimension;
  generatedAt: string;
  items: Array<{
    id: string;
    title: string;
    category: string;
    topicType: string;
    totalVotes: number;
    votesPerDay: number;
    leadMargin: number;
    options: Array<{ optionId: string; label: string; count: number; percentage: number }>;
    profileCoveragePercent: number;
    stanceCount: number;
    commonGroundCount: number;
    commonGroundRate: number;
    discussionCount: number;
    discussionsPer100Votes: number;
    spectrum: null | { median: number | null; stddev: number | null };
    demographic: DemographicAnalytics | null;
  }>;
}
