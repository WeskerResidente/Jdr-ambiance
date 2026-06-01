import { LocalUser, SubscriptionActivation, SubscriptionTier } from "../types/audio";

export function canUseFolders(user: LocalUser | null, tier: SubscriptionTier) {
  return Boolean(user && tier === "premium");
}

export function activatePremiumMock(currentPremiumSince?: string | null): SubscriptionActivation {
  return {
    tier: "premium",
    premiumSince: currentPremiumSince ?? new Date().toISOString()
  };
}
