import { describe, expect, it } from "vitest";
import {
  PLAN_CONFIGS,
  SELECTABLE_PLAN_LIST,
  TRIAL_CLIENT_LIMIT,
  TRIAL_ORDER_LIMIT,
  addOneCalendarMonthLome,
  clientLimitMessage,
  isClientLimitReached,
  orderLimitMessage,
  readOnlyMessage,
  resolveSubscriptionAccess,
} from "@/lib/plans";
import { isFreeOrderLimitReached } from "@/lib/garments";

describe("formules, essai gratuit 1 mois et plafonds", () => {
  it("définit les tarifs, clients et comptes membres attendus pour Simple, Pro et Gold", () => {
    expect(PLAN_CONFIGS.free).toMatchObject({ priceFcfa: 0, clientLimit: 10, orderLimit: 5, memberLimit: 1 });
    expect(PLAN_CONFIGS.simple).toMatchObject({ priceFcfa: 2500, clientLimit: 100, orderLimit: null, memberLimit: 5, recommended: false });
    expect(PLAN_CONFIGS.pro).toMatchObject({ priceFcfa: 5000, clientLimit: 200, orderLimit: null, memberLimit: 10, recommended: true });
    expect(PLAN_CONFIGS.gold).toMatchObject({ priceFcfa: 7500, clientLimit: 500, orderLimit: null, memberLimit: 30, recommended: false });
    expect(SELECTABLE_PLAN_LIST.map((p) => p.id)).toEqual(["simple", "pro", "gold"]);
    expect(TRIAL_CLIENT_LIMIT).toBe(100);
    expect(TRIAL_ORDER_LIMIT).toBe(100);
  });

  it("calcule la fin d'essai à 1 mois calendaire dans Africa/Lome (y compris fin de mois)", () => {
    expect(addOneCalendarMonthLome(new Date("2026-11-22T17:35:00Z")).toISOString()).toBe("2026-12-22T17:35:00.000Z");
    expect(addOneCalendarMonthLome(new Date("2026-01-31T10:00:00Z")).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addOneCalendarMonthLome(new Date("2024-01-31T10:00:00Z")).toISOString()).toBe("2024-02-29T10:00:00.000Z");
    expect(addOneCalendarMonthLome(new Date("2026-03-31T08:15:30Z")).toISOString()).toBe("2026-04-30T08:15:30.000Z");
  });

  it("applique 100 clients et 100 commandes max pendant l'essai gratuit 1 mois, puis les plafonds payants après confirmation", () => {
    const now = new Date("2026-11-22T12:00:00Z");
    const free = resolveSubscriptionAccess({
      plan: "free",
      status: "active",
      starts_at: "2026-11-01T00:00:00Z",
      ends_at: null,
      payment_confirmed: false,
    }, now);
    expect(free.canManage).toBe(true);
    expect(isClientLimitReached(9, free.clientLimit)).toBe(false);
    expect(isClientLimitReached(10, free.clientLimit)).toBe(true);
    expect(isFreeOrderLimitReached(4, free.orderLimit)).toBe(false);
    expect(isFreeOrderLimitReached(5, free.orderLimit)).toBe(true);

    // Pendant l'essai gratuit de 1 mois, Simple, Pro et Gold ont tous 100 clients et 100 commandes max.
    for (const plan of ["simple", "pro", "gold"] as const) {
      const trial = resolveSubscriptionAccess({
        plan,
        status: "trial",
        starts_at: "2026-11-01T00:00:00Z",
        ends_at: "2026-12-01T00:00:00Z",
        payment_confirmed: false,
      }, now);
      expect(trial).toMatchObject({
        effectivePlan: plan,
        clientLimit: 100,
        orderLimit: 100,
        isTrial: true,
        trialExpired: false,
        isConfirmedPaid: false,
        canManage: true,
      });
      expect(isClientLimitReached(99, trial.clientLimit)).toBe(false);
      expect(isClientLimitReached(100, trial.clientLimit)).toBe(true);
      expect(isFreeOrderLimitReached(99, trial.orderLimit)).toBe(false);
      expect(isFreeOrderLimitReached(100, trial.orderLimit)).toBe(true);
    }

    // Une fois confirmé payé, Simple/Pro/Gold conservent 100/200/500 clients et aucune limite de commandes.
    const proConfirmed = resolveSubscriptionAccess({
      plan: "pro",
      status: "active",
      starts_at: "2026-11-01T00:00:00Z",
      ends_at: "2026-12-01T00:00:00Z",
      payment_confirmed: true,
    }, now);
    expect(proConfirmed).toMatchObject({ effectivePlan: "pro", clientLimit: 200, orderLimit: null, memberLimit: 10, isTrial: false, isConfirmedPaid: true, canManage: true });
    expect(isClientLimitReached(199, proConfirmed.clientLimit)).toBe(false);
    expect(isClientLimitReached(200, proConfirmed.clientLimit)).toBe(true);
    expect(isFreeOrderLimitReached(500, proConfirmed.orderLimit)).toBe(false);

    const goldConfirmed = resolveSubscriptionAccess({
      plan: "gold",
      status: "active",
      starts_at: "2026-11-01T00:00:00Z",
      ends_at: "2026-12-01T00:00:00Z",
      payment_confirmed: true,
    }, now);
    expect(goldConfirmed).toMatchObject({ effectivePlan: "gold", clientLimit: 500, orderLimit: null, memberLimit: 30, isTrial: false, isConfirmedPaid: true, canManage: true });
    expect(isClientLimitReached(499, goldConfirmed.clientLimit)).toBe(false);
    expect(isClientLimitReached(500, goldConfirmed.clientLimit)).toBe(true);
  });

  it("ne considère jamais une formule payante comme réglée ni gérable sans confirmation de paiement", () => {
    const now = new Date("2026-11-22T12:00:00Z");
    const unconfirmedActive = resolveSubscriptionAccess({
      plan: "pro",
      status: "active",
      starts_at: "2026-11-01T00:00:00Z",
      ends_at: "2026-12-01T00:00:00Z",
      payment_confirmed: false,
    }, now);
    expect(unconfirmedActive.isConfirmedPaid).toBe(false);
    expect(unconfirmedActive.canManage).toBe(false);
    expect(readOnlyMessage(unconfirmedActive)).toContain("lecture seule");
  });

  it("bloque les fonctions de gestion en lecture seule à la fin du mois d'essai sans paiement confirmé", () => {
    const expired = resolveSubscriptionAccess({
      plan: "pro",
      status: "trial",
      starts_at: "2026-10-22T12:00:00Z",
      ends_at: "2026-11-22T12:00:00Z",
      payment_confirmed: false,
    }, new Date("2026-11-22T12:00:00Z"));
    expect(expired).toMatchObject({
      effectivePlan: "pro",
      clientLimit: 100,
      orderLimit: 100,
      isTrial: false,
      trialExpired: true,
      isConfirmedPaid: false,
      canManage: false,
    });
    expect(clientLimitMessage(expired)).toContain("lecture seule");
    expect(orderLimitMessage(expired)).toContain("lecture seule");
    expect(readOnlyMessage(expired)).toContain("paiement en ligne n’est pas encore configuré");
  });
});
