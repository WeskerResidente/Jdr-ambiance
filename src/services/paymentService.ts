import { LocalUser, SubscriptionActivation } from "../types/audio";
import { activatePremiumMock } from "./subscriptionService";

export const paymentService = {
  async startPremiumCheckout(user: LocalUser, currentPremiumSince?: string | null): Promise<SubscriptionActivation> {
    if (!user.email) {
      throw new Error("Connecte-toi avant d'activer Premium.");
    }

    return activatePremiumMock(currentPremiumSince);
  }
};
