const DATA_URL = './data/unified_schedules.json';

// Fetch the full JSON schedule and map it by date
export async function fetchScheduleData() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error('Data not found');
        
        const fullData = await response.json();
        const scheduleData = {};
        
        fullData.forEach(entry => {
            const d = entry.target_date;
            if (d) scheduleData[d] = entry;
        });

        return scheduleData;
    } catch (error) {
        console.error('Fetch error:', error);
        return null; // Return null to trigger fallback in the UI controllers
    }
}

// Attach to window for non-module usage
window.fetchScheduleData = fetchScheduleData;
