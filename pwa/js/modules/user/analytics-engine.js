/**
 * Analytics Engine Module for Svitlo-Starkon
 * Simple event logger for user engagement tracking.
 */

export class AnalyticsEngine {
    constructor(userService) {
        this.userService = userService;
    }

    async logEvent(action, metadata = {}) {
        // Supabase logging removed. 
        // In the future, this can be moved to a local log or a new cloud service.
        console.log(`[Analytics] Event: ${action}`, metadata);
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
