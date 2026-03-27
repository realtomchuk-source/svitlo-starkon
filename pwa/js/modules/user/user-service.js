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
}
