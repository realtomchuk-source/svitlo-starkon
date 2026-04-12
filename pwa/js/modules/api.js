/**
 * SSSK API Module
 * Handles data fetching with cache-busting and error management.
 */

/**
 * Fetch today's schedule (G1)
 */
export async function fetchTodaySchedule() {
    try {
        const response = await fetch(`data/today.json?t=${Date.now()}`);
        if (!response.ok) throw new Error('Today schedule (G1) not found');
        return await response.json();
    } catch (error) {
        console.error('[API] Error fetching G1:', error);
        return null;
    }
}

/**
 * Fetch tomorrow's schedule (G2)
 */
export async function fetchTomorrowSchedule() {
    try {
        const response = await fetch(`data/tomorrow.json?t=${Date.now()}`);
        if (!response.ok) throw new Error('Tomorrow schedule (G2) not found');
        return await response.json();
    } catch (error) {
        console.error('[API] Error fetching G2:', error);
        return null;
    }
}

/**
 * Legacy wrapper for compatibility with older components
 */
export async function fetchScheduleData() {
    return await fetchTodaySchedule();
}

// Global exposure for non-module scripts
window.fetchTodaySchedule = fetchTodaySchedule;
window.fetchTomorrowSchedule = fetchTomorrowSchedule;
window.fetchScheduleData = fetchScheduleData;
