# Краткая инструкция по запуску проекта **SvitloSk**

> **Цель** – быстро подготовить рабочее окружение, перенести код из `SSSK/pwa` и запустить приложение локально. Все шаги рассчитаны на бесплатные сервисы (GitHub Pages, GitHub Actions).

## 1. Подготовка папки и репозитория
1. Откройте терминал в каталоге `c:/Users/АТом/Desktop/Antigravity/`.
2. Создайте новую папку и перейдите в неё:
   ```bash
   mkdir SvitloSk && cd SvitloSk
   ```
3. Инициализируйте Git‑репозиторий и сделайте первый коммит:
   ```bash
   git init
   git checkout -b main
   ```
4. Создайте пустой репозиторий на GitHub (назовите его `SvitloSk`).
5. Добавьте удалённый репозиторий и запушьте первый коммит:
   ```bash
   git remote add origin https://github.com/<YOUR_USERNAME>/SvitloSk.git
   git add .
   git commit -m "Initial commit – placeholder"
   git push -u origin main
   ```

## 2. Инициализация проекта Vite + React + TypeScript
```bash
npm init vite@latest . -- --template vanilla-ts   # создаёт Vite‑проект с TypeScript
npm i -D @vitejs/plugin-react
```
Отредактируйте `vite.config.ts` (см. `plans/SvitloSk_Detailed_Plan.md`) – добавьте React‑плагин, alias‑ы и `vite-plugin-pwa`.

## 3. Установка зависимостей
```bash
npm i -D \
  tailwindcss postcss autoprefixer \
  eslint eslint-config-prettier prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  jest ts-jest @testing-library/react @testing-library/jest-dom playwright \
  idb zod vite-plugin-pwa vite-imagetools husky lint-staged

npm i react react-dom react-router-dom
```

## 4. Копирование статических ресурсов
```bash
# из текущего проекта SSSK
cp -r ../SSSK/pwa/public ./public
cp -r ../SSSK/pwa/assets ./src/assets
```
Проверьте `public/manifest.json` – при необходимости дополните поля (см. пункт 25 в детальном плане).

## 5. Структура каталогов `src/`
Создайте необходимые подпапки:
```bash
mkdir -p src/{app,pages,components,services,schemas,styles,admin,tests}
```
* `app/` – точка входа (`main.tsx`).
* `pages/` – React‑страницы (Cabinet, Home, Tomorrow).
* `components/` – UI‑компоненты (Card, Toast, Header, Footer).
* `services/` – `db.ts`, `DataManager.ts`, `NotificationService.ts`, `UserService.ts`.
* `schemas/` – Zod‑схемы.
* `styles/` – `index.css` (Tailwind + PostCSS).

## 6. Быстрый запуск
1. Добавьте базовый роутер (`src/app/router.tsx`) и точку входа (`src/main.tsx`).
2. Запустите dev‑сервер:
   ```bash
   npm run dev
   ```
   Откроется `http://localhost:5173` – приложение должно отобразиться.

## 7. Первичная проверка и коммит
```bash
git add .
git commit -m "Setup Vite + React + Tailwind skeleton"
git push
```

## 8. CI/CD (GitHub Actions)
1. Скопируйте шаблон workflow из `plans/SvitloSk_Detailed_Plan.md` в `.github/workflows/ci.yml`.
2. Закоммитьте файл – GitHub автоматически запустит линт, тесты и сборку, а затем задеплоит артефакт на GitHub Pages.

## 9. Дальнейшие шаги (по порядку из детального плана)
* Перенести и переписать модули из `pwa/js/modules/*` в `src/services/*`.
* Реализовать `IndexedDB`‑обёртку, `DataManager`, Service Worker, UI‑Notification и т.д.
* Добавить тесты, настроить линт‑стейдж, обновить `README.md`.

---

**Готово!** Следуя этим 9 пунктам, вы получите полностью работающий каркас проекта, после чего сможете последовательно выполнять оставшиеся задачи из детального плана.

