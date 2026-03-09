// Supabase Infrastructure for Svitlo-Starkon
// Placeholder for real credentials

const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY";

// Note: In production, use environment variables or a secure vault.
// For the PWA client, the anon key is safe for public use with RLS enabled.

let supabaseClient = null;

function initSupabase() {
    if (SUPABASE_URL === "YOUR_SUPABASE_URL") {
        console.warn("Supabase not configured. Auth will not work.");
        return null;
    }
    // Supabase JS library will be loaded via CDN in index.html/cabinet.html
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return supabaseClient;
    }
    return null;
}

// Exported Auth Functions
async function signInWithGoogle() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/SSSK/pwa/cabinet.html'
        }
    });
    if (error) console.error("Login error:", error.message);
}

async function signOut() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    window.location.reload();
}

async function getUserProfile() {
    if (!supabaseClient) return null;
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}
