/**
 * User Service Module for Svitlo-Starkon
 * Manages Auth state and Supabase profile synchronization.
 */

export class UserService {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.user = null;
        this.profile = null;
    }

    async init() {
        if (!this.supabase) return null;
        const { data: { user } } = await this.supabase.auth.getUser();
        this.user = user;
        if (user) {
            await this.syncProfile();

            // Auto-migrate local storage subscriptions to cloud if missing in user_metadata
            if (!user.user_metadata?.sssk_subscriptions) {
                const localData = localStorage.getItem('sssk_subscriptions');
                if (localData) {
                    try {
                        const parsed = JSON.parse(localData);
                        console.log('Migrating local push settings to cloud...');
                        await this.updatePushSubscriptions(parsed);
                    } catch (e) { console.error('Migration failed:', e); }
                }
            }
        }
        return user;
    }

    async syncProfile() {
        if (!this.user) return;
        const { data, error } = await this.supabase
            .from('user_profiles')
            .select('*')
            .eq('id', this.user.id)
            .single();

        if (error && error.code === 'PGRST116') {
            // Profile doesn't exist yet, trigger will handle creation but we might need to wait or force retry
            console.log('Profile loading...');
        } else {
            this.profile = data;
        }
        return this.profile;
    }

    isGuest() {
        return !this.user;
    }

    getUserData() {
        return {
            user: this.user,
            profile: this.profile
        };
    }

    async updatePushSubscriptions(subs) {
        if (!this.supabase || !this.user) return;
        
        // Save to user_metadata for reliable sync across devices
        const { data, error } = await this.supabase.auth.updateUser({
            data: { sssk_subscriptions: subs }
        });
        
        if (error) {
            console.error('Error updating subscriptions:', error);
            throw error;
        }
        
        this.user = data.user;
        return data.user;
    }

    getPushSubscriptions() {
        // Fallback to localStorage if guest, or metadata if logged in
        if (!this.user) {
            const saved = localStorage.getItem('sssk_subscriptions');
            return saved ? JSON.parse(saved) : [null, null];
        }
        return this.user.user_metadata?.sssk_subscriptions || [null, null];
    }
}
