/**
 * Analytics Engine Module for Svitlo-Starkon
 * Simple event logger for user engagement tracking.
 */

export class AnalyticsEngine {
    constructor(userService) {
        this.userService = userService;
    }

    async logEvent(action, metadata = {}) {
        const { user } = this.userService.getUserData();
        if (!user) return; // Only log for registered users as per plan

        try {
            const { error } = await this.userService.supabase
                .from('engagement_logs')
                .insert({
                    user_id: user.id,
                    event_name: action,
                    metadata: metadata
                });
            
            if (error) throw error;
        } catch (err) {
            console.warn('Analytics logging failed:', err.message);
        }
    }

    // High-level tracking helpers
    async trackShare() {
        return this.logEvent('share_click', { url: window.location.href });
    }

    async trackDNDToggle(state) {
        return this.logEvent('dnd_toggle', { active: state });
    }

    async trackSlotSetup(group) {
        return this.logEvent('slot_setup', { group: group });
    }
}
