/**
 * User Service Module for Svitlo-Starkon
 * Manages Auth state and Local storage fallback.
 */

export class UserService {
    constructor() {
        // Supabase client dependency removed
        this.user = null;
        this.profile = null;
    }

    async init() {
        // Initializing in Local/Guest mode by default
        console.log('[UserService] Initialized in Local-only mode.');
        return null;
    }

    isGuest() {
        return true;
    }

    getUserData() {
        return {
            user: null,
            profile: null
        };
    }

    async updatePushSubscriptions(subs) {
        // Save exclusively to localStorage
        localStorage.setItem('sssk_subscriptions', JSON.stringify(subs));
        return null;
    }

    getPushSubscriptions() {
        const saved = localStorage.getItem('sssk_subscriptions');
        try {
            return saved ? JSON.parse(saved) : [null, null];
        } catch (e) {
            console.error('[UserService] Error parsing subscriptions:', e);
            return [null, null];
        }
    }
}
