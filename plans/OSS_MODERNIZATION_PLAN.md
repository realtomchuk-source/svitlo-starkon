# План OSS модернизации проекта **SSSK** (PWA)

## Этап 1 – Автономность и инфраструктура (P1)

### 1️⃣ Перенос проекта на Vite
- Инициализировать Vite в отдельном каталоге `vite/` (`npm init vite@latest`).
- Скопировать `index.html`, `manifest.json` и базовые стили в новый проект.
- Настроить alias‑ы (`@/src`, `@/assets`) и скрипты `dev`, `build`, `preview`.
- **Миграция в два шага**: пока `pwa/` остаётся рабочей версией, постепенно переносим модули в `src/`.

### 2️⃣ Чистая архитектура (Core Structure)
- Ввести модульную структуру:
  - `src/app/` – точка входа, инициализация сервисов.
  - `src/pages/` – страницы (cabinet, home, tomorrow и т.д.).
  - `src/components/` – переиспользуемые UI‑компоненты.
  - `src/services/` – DataManager, NotificationService, заглушки Auth.
  - `src/assets/` – изображения, иконки.
- Переписать текущие скрипты из `pwa/js/` в ES‑модули с `import/export`.

### 3️⃣ Слой данных и версия схем (Local Data Foundation)
- **IndexedDB** через лёгкую обёртку `idb`.
  - Файл `src/services/db.ts` – инициализация базы, CRUD‑операции.
  - Хранить данные в объектном хранилище `data` с полями `key`, `payload`, `version`, `timestamp`.
- Реализовать **DataManager** (`src/services/DataManager.ts`), который:
  1. Сначала читает из IndexedDB (fallback‑логика).
  2. Затем делает `fetch` к `parser/data/*.json` и обновляет кэш.
  3. Проверяет `version` и при необходимости запускает миграцию схем.
- Описать JSON‑схемы в `src/schemas/` (users, cards, push_inventory).

### 4️⃣ Service Worker и offline‑first
- Обновить `src/sw.ts` (или `pwa/sw.js` после миграции) – добавить обработчики `install`, `activate`, `fetch`.
- Предзагружать статические ресурсы и кэшировать ответы JSON.
- При неудачном запросе к сети возвращать данные из IndexedDB.

### 5️⃣ UI Notification Service
- Реализовать как singleton с очередью сообщений и поддержкой toast/snackbar.
- Добавить типизацию (TypeScript) и unit‑тесты (Jest).

### 6️⃣ Кабинет – 3‑картковая модель
- Выделить компонент `Card` в `src/components/Card.tsx` (или `.js`).
- Реализовать lazy‑loading для карточки «завтра», чтобы не блокировать рендер первой части.
- Добавить валидацию формы профиля и сохранение в IndexedDB через DataManager.

### 7️⃣ Admin Console v2
- Перенести в отдельный модуль `src/admin/`.
- Добавить простую role‑based access (заглушка токена) и автосохранение в `localStorage`/`IndexedDB`.

### 8️⃣ CI/CD и тестовое покрытие
- Настроить **GitHub Actions**: lint, type‑check, unit‑tests, сборка Vite, деплой на GitHub Pages (или Netlify).
- Добавить **Jest + Testing Library** для UI‑компонентов и **Playwright** для e2e‑тестов (offline‑mode, PWA‑install).

### 9️⃣ Документация
- Автоматически генерировать API‑документацию (JSDoc/TypeDoc).
- Обновить `README.md` с инструкциями по локальному запуску Vite и работе в офлайн‑режиме.

## Этап 2 – Расширенная функциональность (P2)

- **Supabase Auth / Google Sign‑In** – интеграция аутентификации и авторизации.
- **Realtime синхронизация** с PostgreSQL через Supabase.
- **Push‑уведомления** (Firebase Cloud Messaging / Web‑Push).
- Миграция данных из IndexedDB в серверную БД, обработка конфликтов.
- Расширенный offline‑first: синхронизация изменений при восстановлении соединения.
- **Analytics** – подключение Google Analytics или Plausible.

---
*План учитывает общие рекомендации по оптимизации, технические детали (Service Worker, Manifest, типизацию, CI/CD) и распределяет задачи так, чтобы первая версия уже обеспечивала надёжную автономную работу, а второй этап фокусировался на облачной интеграции и push‑уведомлениях.*

## Дополнительные рекомендации по оптимизации плана

* **Проверка манифеста** – убедиться, что `pwa/manifest.json` содержит обязательные поля: `short_name`, `description`, набор иконок разных размеров, `scope`, `display`, `theme_color`, `background_color`.
* **Консолидация CSS** – собрать все стили в `src/styles/`, настроить PostCSS + autoprefixer в Vite‑конфиге для кросс‑браузерной совместимости.
* **Миграция к TypeScript** – новые модули писать на TypeScript, добавить проверку типизации в CI.
* **ESLint + Prettier** – включить линтер и форматтер, интегрировать их в GitHub Actions.
* **Оптимизация ассетов** – использовать Vite asset hashing, lazy‑loading изображений, конвертировать PNG в WebP где это возможно.
* **Код‑сплиттинг и динамический импорт** – разбить крупные страницы и модули на чанки, загружать их по требованию.
* **Lighthouse CI** – добавить мониторинг производительности в CI‑pipeline.
* **Security‑headers** – добавить CSP, Referrer‑Policy и другие заголовки через Service Worker или meta‑теги.
* **Тесты Service Worker** – написать unit‑тесты (Workbox testing, mock fetch) в Jest/Playwright.
* **Версионирование статических ресурсов** – реализовать стратегию `stale-while-revalidate` в Service Worker, использовать хеш‑имена файлов.
* **Обновление README** – добавить инструкции по проверке манифеста, запуску линтера, тестов, описанию offline‑стратегии и процессу миграции к TypeScript.
* **Unit‑тесты DataManager** – покрыть fallback‑логику IndexedDB и миграцию схем.
* **Проверка схем миграций** – включить type‑check JSON‑схем в CI.

