const fs = require('fs');
const path = require('path');

const dir = __dirname;
const htmlFiles = ['index.html', 'archive.html', 'cabinet.html', 'community.html', 'full_schedule.html', 'tomorrow.html'];

const svgHome = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
const svgGraph = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>`;
const svgApp = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`;
const svgUser = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

const getNavHTML = (activePage) => {
    return `<nav class="glass-nav">
            <button class="nav-item \${activePage === 'index.html' ? 'active' : ''} focus-ring" onclick="window.location.href='index.html'">
                <span class="icon">\${svgHome}</span>
                <span class="nav-text">Home</span>
            </button>
            <button class="nav-item \${activePage === 'full_schedule.html' || activePage === 'archive.html' ? 'active' : ''} focus-ring" onclick="window.location.href='full_schedule.html'">
                <span class="icon">\${svgGraph}</span>
                <span class="nav-text">Graph</span>
            </button>
            <button class="nav-item \${activePage === 'app.html' || activePage === 'tomorrow.html' ? 'active' : ''} focus-ring" onclick="window.location.href='javascript:void(0)'">
                <span class="icon">\${svgApp}</span>
                <span class="nav-text">App</span>
            </button>
            <button class="nav-item \${activePage === 'cabinet.html' ? 'active' : ''} focus-ring" onclick="window.location.href='cabinet.html'">
                <span class="icon">\${svgUser}</span>
                <span class="nav-text">Profile</span>
            </button>
        </nav>`;
};

function replaceNav(filePath) {
    if(!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace everything between <nav class="glass-nav"> and </nav>
    const regex = /<nav class="glass-nav">[\\s\\S]*?<\\/nav>/;
    
    const basename = path.basename(filePath);
    const newNav = getNavHTML(basename);

    if (content.match(regex)) {
        content = content.replace(regex, newNav);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated ' + filePath);
    } else {
        console.log('No nav found in ' + filePath);
    }
}

htmlFiles.forEach(f => replaceNav(path.join(dir, f)));
