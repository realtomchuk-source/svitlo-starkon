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
        const { user } = this.userService.getUserData();
        const pendingRef = localStorage.getItem('sssk_pending_ref');
        
        if (user && pendingRef && !localStorage.getItem('sssk_referral_synced')) {
            try {
                // Find inviter by ref code
                const { data: inviter, error: invError } = await this.userService.supabase
                    .from('user_profiles')
                    .select('id')
                    .eq('referral_code', pendingRef)
                    .single();

                if (inviter) {
                    const { error: refError } = await this.userService.supabase
                        .from('referrals')
                        .insert({
                            inviter_id: inviter.id,
                            invited_id: user.id,
                            status: 'registered'
                        });

                    if (!refError) {
                        localStorage.setItem('sssk_referral_synced', 'true');
                        localStorage.removeItem('sssk_pending_ref');
                        console.log('Referral successfully linked!');
                    }
                }
            } catch (err) {
                console.error('Error syncing referral:', err);
            }
        }
    }
}
