/**
 * archive.js
 * Контролер сторінки Історії / Календаря (archive.html)
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('Archive Session Started');

    if (typeof window.initSupabase === 'function') window.initSupabase();
    if (typeof window.updateAuthState === 'function') window.updateAuthState();

    // Placeholder logic for the calendar if it existed in app.js
    // For now, it simply initializes the auth and navigation state
});
