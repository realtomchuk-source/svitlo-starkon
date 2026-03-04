# SSSK Parser (Блок Парсингу) ⚙️

Цей модуль відповідає за автоматичний збір та обробку даних про графіки відключень.

## ✅ Функціонал
- **Dual-Source парсинг:** Два незалежних джерела — сайт [hoe.com.ua](https://hoe.com.ua/page/pogodinni-vidkljuchennja) та Telegram-канал обленерго.
- **Автоматичне виявлення змін:** Хеш-порівняння зображень графіків.
- **OCR-розпізнавання:** Tesseract OCR з українською мовною моделлю.
- **Адаптивний розклад:** Два режими моніторингу (стандартний/тимчасовий).
- **Telegram-алерти:** Сповіщення про оновлення.
- **Data Lake:** Збереження сирих зображень у `parser/data/`.

## 🏗 Структура даних
Дані зберігаються у форматі JSON у папці `parser/data/`:
- `state.json` — Стан парсера (хеші, мітки часу).
- `unified_schedules.json` — Журнал виявлених графіків.
- `raw_site/` — Зображення з сайту.
- `raw_telegram/` — Зображення з Telegram.

## 🛠 Технологічний стек
- **Мова:** Python 3.10
- **Бібліотеки:** Requests, BeautifulSoup4, PIL/Pillow, Pytesseract
- **OCR:** Tesseract OCR + ukr.traineddata

## ⚙️ Налаштування
Для роботи потрібні такі змінні середовища (GitHub Secrets):
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

---
*Частина проекту Svitlo Starkon.*
