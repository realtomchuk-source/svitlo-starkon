/**
 * Referral System Module for Svitlo-Starkon
 * Handles referral code generation and invitation tracking.
 */

export class ReferralSystem {
    constructor(userService) {
        this.userService = userService;
    }

    getReferralUrl() {
        const { profile } = this.userService.getUserData();
        if (!profile || !profile.referral_code) return window.location.origin;
        
        const url = new URL(window.location.origin);
        url.searchParams.set('ref', profile.referral_code);
        return url.toString();
    }

    async trackReferral() {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        
        if (refCode && !localStorage.getItem('sssk_referral_tracked')) {
            localStorage.setItem('sssk_pending_ref', refCode);
        }
    }

    async syncPendingReferral() {
        // Supabase sync removed. 
        // Referral tracking is currently limited to local detection.
        const pendingRef = localStorage.getItem('sssk_pending_ref');
        if (pendingRef) {
            console.log(`[Referral] Detected pending referral: ${pendingRef}. Cloud sync is disabled.`);
        }
    }
}
