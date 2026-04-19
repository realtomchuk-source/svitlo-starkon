// Apps Page — Community Projects
// Loads project data from apps.json and renders premium glassmorphism cards

const ICONS = {
  launch: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  github: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0z"/></svg>`,
  share: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`
};

function getStatusBadge(status) {
  if (status === 'active') {
    return `<span class="app-badge app-badge--active">✅ Активний</span>`;
  }
  return `<span class="app-badge app-badge--dev">🔧 В розробці</span>`;
}

function renderCard(project, index) {
  const linksHTML = project.links.map(link => `
    <a href="${link.url}" class="app-link-btn" onclick="return false;" title="${link.label}">
      ${ICONS[link.icon] || ''}
      <span>${link.label}</span>
    </a>
  `).join('');

  return `
    <article class="app-card glass-card fade-in" style="animation-delay: ${index * 0.12}s;">
      <div class="app-card__header-row">
        <div class="app-card__thumb-wrap">
          <img
            src="${project.image}"
            alt="${project.name}"
            class="app-card__thumb"
            onerror="this.style.display='none'; this.parentElement.classList.add('app-card__thumb-wrap--error');"
          />
        </div>
        <div class="app-card__title-area">
          <h2 class="app-card__title">${project.name}</h2>
          ${getStatusBadge(project.status)}
        </div>
      </div>
      
      <div class="app-card__desc-row">
        <p class="app-card__desc body-neutral">${project.description}</p>
      </div>
      
      <div class="app-card__footer">
        ${linksHTML}
      </div>
    </article>
  `;
}


const APPS_DATA = [
  {
    id: "svitlo-starkon",
    name: "Світло-Старкон",
    description: "PWA-додаток для моніторингу графіків відключень електроенергії у Старокостянтинові. Показує поточний стан, зворотній відлік та розклад на завтра.",
    status: "active",
    image: "assets/app_starkon.png",
    order: 1,
    links: [
      { label: "Відкрити", icon: "launch", url: "#" },
      { label: "GitHub", icon: "github", url: "#" },
      { label: "Поділитись", icon: "share", url: "#" }
    ]
  },
  {
    id: "zzsk-lost-found",
    name: "Загубив / Знайшов",
    description: "Telegram-платформа для пошуку загублених і знайдених речей у Старокостянтинівській громаді. Два боти з модерацією та автопублікацією.",
    status: "active",
    image: "assets/app_zzsk.png",
    order: 2,
    links: [
      { label: "Telegram-канал", icon: "launch", url: "#" },
      { label: "GitHub", icon: "github", url: "#" },
      { label: "Поділитись", icon: "share", url: "#" }
    ]
  },
  {
    id: "interactive-map",
    name: "Інтерактивна карта Громади",
    description: "Цифрова карта інфраструктури, сервісів та подій Старокостянтинівської міської громади. Дозволить швидко знаходити заклади та маршрути.",
    status: "development",
    image: "assets/app_map.png",
    order: 3,
    links: [
      { label: "Переглянути", icon: "launch", url: "#" },
      { label: "GitHub", icon: "github", url: "#" },
      { label: "Поділитись", icon: "share", url: "#" }
    ]
  }
];

function initAppsPage() {
  const container = document.getElementById('apps-container');
  if (!container) return;

  const sorted = [...APPS_DATA].sort((a, b) => a.order - b.order);
  container.innerHTML = sorted.map((p, i) => renderCard(p, i)).join('');
}

document.addEventListener('DOMContentLoaded', initAppsPage);

