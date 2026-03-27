// Supabase Infrastructure for Svitlo-Starkon
const SUPABASE_URL = "https://qmmdfkhihxhzhunttgzf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtbWRma2hpaHhoemh1bnR0Z3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzA1MzIsImV4cCI6MjA4ODc0NjUzMn0.bmilUYucAhv2vztNu1LB3hvJbNyYIJGNsInbyofIUfI";

let supabaseClient = null;

function initSupabase() {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        // Attach to window for modular services
        window.supabase = supabaseClient;
        return supabaseClient;
    }
    return null;
}

// Initialize immediately
initSupabase();

// Exported Auth Functions
window.signInWithGoogle = async function() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/SSSK/pwa/cabinet.html'
        }
    });
    if (error) console.error("Login error:", error.message);
}

window.signInWithTelegram = async function() {
    if (!supabaseClient) return;
    // Assuming Telegram provider is also configured in Supabase
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'telegram',
        options: {
            redirectTo: window.location.origin + '/SSSK/pwa/cabinet.html'
        }
    });
    if (error) {
        console.error("Telegram Login error:", error.message);
        // Fallback to bot link if OAuth fails
        window.open('https://t.me/svitlo_starkon_bot', '_blank');
    }
}

window.signOut = async function() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    window.location.reload();
}

async function getUserProfile() {
    if (!supabaseClient) return null;
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}
