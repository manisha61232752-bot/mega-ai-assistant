export interface PlanConfig {
  id: 'FREE' | 'GO' | 'PLUS' | 'PRO';
  name: string;
  price_display: string;
  original_price_display?: string;
  price_numeric: number;
  original_price_numeric?: number;
  billing: string;
  promotion_duration?: string;
  title: string;
  description: string;
  features: string[];
  popular?: boolean;
  badge?: string;
  promotion_details?: string;
  note?: string;
}

export interface SubscriptionInfo {
  current_plan: 'free' | 'go' | 'plus' | 'pro';
  subscription_status: 'free' | 'trialing' | 'active' | 'cancelled' | 'expired';
  billing_cycle: string;
  trial_start: string | null;
  trial_end: string | null;
  subscription_start: string | null;
  subscription_end: string | null;
  promotion_claimed: boolean;
  cancel_at_period_end?: boolean;
  cancelled_at?: string | null;
}

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  go: 1,
  plus: 2,
  pro: 3
};

export const isPlanUpgrade = (fromPlan: string, toPlan: string): boolean => {
  const fromRank = PLAN_HIERARCHY[fromPlan.toLowerCase()] ?? 0;
  const toRank = PLAN_HIERARCHY[toPlan.toLowerCase()] ?? 0;
  return toRank > fromRank;
};

export const isPlanDowngrade = (fromPlan: string, toPlan: string): boolean => {
  const fromRank = PLAN_HIERARCHY[fromPlan.toLowerCase()] ?? 0;
  const toRank = PLAN_HIERARCHY[toPlan.toLowerCase()] ?? 0;
  return toRank < fromRank;
};

export const getPlanButtonText = (
  cardPlanId: 'FREE' | 'GO' | 'PLUS' | 'PRO',
  currentPlan: 'free' | 'go' | 'plus' | 'pro',
  promotionClaimed: boolean
): string => {
  const cardPlanLower = cardPlanId.toLowerCase();
  const currentPlanLower = currentPlan.toLowerCase();

  if (cardPlanLower === currentPlanLower) {
    return 'Your current plan';
  }

  if (isPlanUpgrade(currentPlanLower, cardPlanLower)) {
    if (cardPlanLower === 'plus' && !promotionClaimed) {
      return 'Claim Free Offer';
    }
    return `Upgrade to ${cardPlanId === 'GO' ? 'Go' : cardPlanId === 'PRO' ? 'Pro' : 'Plus'}`;
  } else {
    return `Downgrade to ${cardPlanId === 'FREE' ? 'Free' : cardPlanId === 'GO' ? 'Go' : 'Plus'}`;
  }
};
