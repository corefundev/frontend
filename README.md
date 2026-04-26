# SKU Forecasting — Frontend

Web-клиент платформы прогнозирования спроса. React 18 + Vite + TypeScript + Tailwind, общается с backend (`api.testcore.ru`) через REST.

## Стек

- **React 18** + **React Router** + **Zustand** (state) + **TanStack Query** (server cache)
- **Vite** dev/build, **TypeScript**, **Tailwind CSS**
- **Recharts** — графики прогнозов
- **axios** + **react-hot-toast** для запросов и нотификаций
- Editorial design: Fraunces (serif) + IBM Plex Sans

## Запуск локально

```bash
npm install
cp .env.example .env.local         # выставить VITE_API_BASE_URL
npm run dev                        # http://localhost:5173
```

Доступные команды:

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер с HMR |
| `npm run build` | production-сборка в `dist/` |
| `npm run preview` | предпросмотр прод-сборки локально |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Production

Прод-домен: `https://skusystem.ru`. Сборка билдится на CI и деплоится за nginx (см. `docker-compose.prod.yml` и `Dockerfile` в этом же репо).

## Связь с backend

Бэкенд: `https://api.testcore.ru` (репо: [corefundev/backend](https://github.com/corefundev/backend)).
Авторизация: JWT + per-client API-ключ или OAuth (Google / Yandex). См. backend `/docs`.

## Лицензия

[MIT](./LICENSE).
