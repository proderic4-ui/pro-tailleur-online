import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const LOME_TIME_ZONE = "Africa/Lome";

export type SelectablePlanId = "simple" | "pro" | "gold";
export type PlanId = "free" | SelectablePlanId;
export type StoredPlanId = PlanId | "monthly" | "annual";

export type PlanConfig = {
  id: PlanId;
  name: string;
  priceFcfa: number;
  priceLabel: string;
  period: string;
  clientLimit: number;
  orderLimit: number | null;
  memberLimit: number;
  recommended: boolean;
  trialEligible: boolean;
};

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Gratuite",
    priceFcfa: 0,
    priceLabel: "0",
    period: "FCFA",
    clientLimit: 10,
    orderLimit: 5,
    memberLimit: 1,
    recommended: false,
    trialEligible: false,
  },
  simple: {
    id: "simple",
    name: "Simple",
    priceFcfa: 2500,
    priceLabel: "2 500",
    period: "FCFA / mois",
    clientLimit: 100,
    orderLimit: null,
    memberLimit: 5,
    recommended: false,
    trialEligible: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceFcfa: 5000,
    priceLabel: "5 000",
    period: "FCFA / mois",
    clientLimit: 200,
    orderLimit: null,
    memberLimit: 10,
    recommended: true,
    trialEligible: true,
  },
  gold: {
    id: "gold",
    name: "Gold",
    priceFcfa: 7500,
    priceLabel: "7 500",
    period: "FCFA / mois",
    clientLimit: 500,
    orderLimit: null,
    memberLimit: 30,
    recommended: false,
    trialEligible: true,
  },
};

export const SELECTABLE_PLAN_LIST: PlanConfig[] = [
  PLAN_CONFIGS.simple,
  PLAN_CONFIGS.pro,
  PLAN_CONFIGS.gold,
];

export const PLAN_LIST: PlanConfig[] = SELECTABLE_PLAN_LIST;

export type SubscriptionRecord = {
  plan: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  payment_confirmed?: boolean | null;
};

export const TRIAL_CLIENT_LIMIT = 100;
export const TRIAL_ORDER_LIMIT = 100;

export type ResolvedSubscriptionAccess = {
  effectivePlan: StoredPlanId;
  subscribedPlan: string;
  planName: string;
  clientLimit: number | null;
  orderLimit: number | null;
  memberLimit: number | null;
  isTrial: boolean;
  trialExpired: boolean;
  isConfirmedPaid: boolean;
  canManage: boolean;
  endsAt: string | null;
};

function lomeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LOME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === 24 ? 0 : get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Adds one calendar month in Africa/Lome (UTC+0, no DST).
 * Clamps end-of-month dates (e.g. Jan 31 -> Feb 28/29) matching PostgreSQL `+ interval '1 month'`.
 */
export function addOneCalendarMonthLome(startDate: Date): Date {
  const { year, month, day, hour, minute, second } = lomeParts(startDate);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const daysInTargetMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const targetDay = Math.min(day, daysInTargetMonth);
  return new Date(Date.UTC(nextYear, nextMonth - 1, targetDay, hour, minute, second, startDate.getUTCMilliseconds()));
}

export function formatLomeDate(date: string | Date | null): string {
  if (!date) return "—";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: LOME_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

export function isNewPaidPlan(plan: string): plan is "simple" | "pro" | "gold" {
  return plan === "simple" || plan === "pro" || plan === "gold";
}

export function resolveSubscriptionAccess(
  record: SubscriptionRecord | null | undefined,
  now = new Date(),
): ResolvedSubscriptionAccess {
  const nowMs = now.getTime();
  if (!record) {
    return {
      effectivePlan: "free",
      subscribedPlan: "free",
      planName: PLAN_CONFIGS.free.name,
      clientLimit: PLAN_CONFIGS.free.clientLimit,
      orderLimit: PLAN_CONFIGS.free.orderLimit,
      memberLimit: PLAN_CONFIGS.free.memberLimit,
      isTrial: false,
      trialExpired: false,
      isConfirmedPaid: false,
      canManage: true,
      endsAt: null,
    };
  }

  const startsMs = Date.parse(record.starts_at);
  const endsMs = record.ends_at ? Date.parse(record.ends_at) : Number.NaN;
  const withinWindow = !Number.isNaN(startsMs) && startsMs <= nowMs && !Number.isNaN(endsMs) && endsMs > nowMs;

  if (isNewPaidPlan(record.plan)) {
    const config = PLAN_CONFIGS[record.plan];
    const isTrial = record.status === "trial" && record.payment_confirmed !== true && withinWindow;
    const isConfirmedPaid = record.status === "active" && record.payment_confirmed === true && withinWindow;

    if (isTrial) {
      return {
        effectivePlan: config.id,
        subscribedPlan: record.plan,
        planName: config.name,
        clientLimit: TRIAL_CLIENT_LIMIT,
        orderLimit: TRIAL_ORDER_LIMIT,
        memberLimit: config.memberLimit,
        isTrial: true,
        trialExpired: false,
        isConfirmedPaid: false,
        canManage: true,
        endsAt: record.ends_at,
      };
    }

    if (isConfirmedPaid) {
      return {
        effectivePlan: config.id,
        subscribedPlan: record.plan,
        planName: config.name,
        clientLimit: config.clientLimit,
        orderLimit: config.orderLimit,
        memberLimit: config.memberLimit,
        isTrial: false,
        trialExpired: false,
        isConfirmedPaid: true,
        canManage: true,
        endsAt: record.ends_at,
      };
    }

    const trialExpired =
      (record.status === "trial" || record.status === "expired") &&
      record.payment_confirmed !== true &&
      (Number.isNaN(endsMs) || endsMs <= nowMs);

    return {
      effectivePlan: config.id,
      subscribedPlan: record.plan,
      planName: config.name,
      clientLimit: trialExpired ? TRIAL_CLIENT_LIMIT : config.clientLimit,
      orderLimit: trialExpired ? TRIAL_ORDER_LIMIT : config.orderLimit,
      memberLimit: config.memberLimit,
      isTrial: false,
      trialExpired,
      isConfirmedPaid: false,
      canManage: false,
      endsAt: record.ends_at,
    };
  }

  // Preserve compatibility for any existing pre-migration monthly/annual rows without silently altering them.
  if ((record.plan === "monthly" || record.plan === "annual") && record.status === "active" && withinWindow) {
    return {
      effectivePlan: record.plan,
      subscribedPlan: record.plan,
      planName: record.plan === "annual" ? "Annuelle (historique)" : "Mensuelle (historique)",
      clientLimit: null,
      orderLimit: null,
      memberLimit: null,
      isTrial: false,
      trialExpired: false,
      isConfirmedPaid: true,
      canManage: true,
      endsAt: record.ends_at,
    };
  }

  // Preserve existing legacy free accounts without deleting data or revoking their existing access.
  return {
    effectivePlan: "free",
    subscribedPlan: record.plan,
    planName: PLAN_CONFIGS.free.name,
    clientLimit: PLAN_CONFIGS.free.clientLimit,
    orderLimit: PLAN_CONFIGS.free.orderLimit,
    memberLimit: PLAN_CONFIGS.free.memberLimit,
    isTrial: false,
    trialExpired: false,
    isConfirmedPaid: false,
    canManage: true,
    endsAt: record.ends_at,
  };
}

export function readOnlyMessage(access: ResolvedSubscriptionAccess): string {
  if (access.trialExpired) {
    return "Votre essai gratuit de 1 mois est terminé sans paiement confirmé. Vos données sont conservées en lecture seule (aucun nouvel essai gratuit n’est accordé). Choisissez Simple (2 500 FCFA / mois), Pro (5 000 FCFA / mois) ou Gold (7 500 FCFA / mois) pour réactiver la gestion ; le paiement en ligne n’est pas encore configuré.";
  }
  return "Votre abonnement n’est pas actif ou le paiement n’est pas confirmé. Vos données restent accessibles en lecture seule ; activez Simple, Pro ou Gold pour modifier votre atelier (paiement en ligne non encore configuré).";
}

export function clientLimitMessage(access: ResolvedSubscriptionAccess): string {
  if (!access.canManage) {
    return readOnlyMessage(access);
  }
  if (access.isTrial) {
    return "Vous avez atteint le plafond de 100 clients enregistrés pendant l’essai gratuit — 1 mois. Activez un abonnement payant Simple (100 clients), Pro (200 clients) ou Gold (500 clients) après l’essai ; le paiement en ligne n’est pas encore configuré.";
  }
  if (access.effectivePlan === "simple" || access.effectivePlan === "pro" || access.effectivePlan === "gold") {
    return `Vous avez atteint le plafond de ${access.clientLimit} clients enregistrés de la formule ${access.planName}. Choisissez une formule supérieure pour enregistrer davantage de clients.`;
  }
  return "Vous avez atteint la limite de 10 clients de la formule gratuite. Passez à la formule Simple (2 500 FCFA / mois), Pro (5 000 FCFA / mois) ou Gold (7 500 FCFA / mois) pour augmenter votre plafond.";
}

export function orderLimitMessage(access: ResolvedSubscriptionAccess): string {
  if (!access.canManage) {
    return readOnlyMessage(access);
  }
  if (access.isTrial) {
    return "Vous avez atteint le plafond de 100 commandes enregistrées pendant l’essai gratuit — 1 mois. Choisissez une formule Simple (2 500 FCFA / mois), Pro (5 000 FCFA / mois) ou Gold (7 500 FCFA / mois) pour enregistrer des commandes sans limite ; le paiement en ligne n’est pas encore configuré.";
  }
  return "Vous avez atteint la limite de 5 commandes de la formule gratuite. Passez à la formule Simple (2 500 FCFA / mois), Pro (5 000 FCFA / mois) ou Gold (7 500 FCFA / mois) pour continuer à enregistrer des commandes.";
}

export function isClientLimitReached(clientCount: number, limit: number | null): boolean {
  return limit !== null && clientCount >= limit;
}

export async function fetchWorkshopSubscription(
  supabase: SupabaseClient<Database>,
  workshopId: string,
): Promise<{ data: SubscriptionRecord | null; error: { code?: string; message?: string } | null }> {
  const full = await supabase
    .from("subscriptions")
    .select("plan, status, starts_at, ends_at, payment_confirmed")
    .eq("workshop_id", workshopId)
    .single();
  if (!full.error) return { data: full.data, error: null };

  const msg = full.error.message ?? "";
  if (full.error.code === "42703" || msg.includes("payment_confirmed")) {
    const fallback = await supabase
      .from("subscriptions")
      .select("plan, status, starts_at, ends_at")
      .eq("workshop_id", workshopId)
      .single();
    if (fallback.error || !fallback.data) {
      return { data: null, error: fallback.error };
    }
    return {
      data: { ...fallback.data, payment_confirmed: false },
      error: null,
    };
  }
  return { data: null, error: full.error };
}
