// I piani in abbonamento: i crediti del mese e il prezzo. 1 credito = 1 centesimo di dollaro di costo reale (vedi la
// migration credits), quindi gli esempi (16 post + 3 video con Start) sono medie, non prezzi fissi.
export const SUBSCRIPTION_PLANS = {
  start: { name: 'Start', monthlyCredits: 2_500, priceEur: 149 },
  pro: { name: 'Pro', monthlyCredits: 6_000, priceEur: 299 },
  ultra: { name: 'Ultra', monthlyCredits: 15_000, priceEur: 599 },
} as const;

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;

// I piani come si mostrano, dal più piccolo.
export const SUBSCRIPTION_PLAN_IDS: SubscriptionPlanId[] = ['start', 'pro', 'ultra'];

// La ricarica quando i crediti del mese finiscono: con Ultra costa meno.
export const CREDIT_TOPUP = { credits: 1_000, priceEur: 50, ultraPriceEur: 40 } as const;

// Finché non ci sono i pagamenti, ogni account conta i crediti come se avesse il piano medio.
export const DEFAULT_SUBSCRIPTION_PLAN: SubscriptionPlanId = 'pro';
