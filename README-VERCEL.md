# Развертывание на Vercel

Этот проект настроен для автоматического развертывания на Vercel в режиме serverless.

## 🚀 Быстрое развертывание

### Шаг 1: Подключение репозитория

1. Войдите в [Vercel Dashboard](https://vercel.com/dashboard)
2. Нажмите "New Project"
3. Импортируйте ваш GitHub репозиторий
4. Vercel автоматически определит настройки

### Шаг 2: Конфигурация проекта

Настройки проекта автоматически применятся из `vercel.json`:

- **Build Command**: `npm run build` (автоматически)
- **Output Directory**: `./` (корневая папка)
- **Node.js Version**: 18.x
- **Serverless Functions**: Включены в папке `/api`

### Шаг 3: Переменные окружения (опционально)

В настройках проекта на Vercel можете добавить:

```
DEEPLX_API_URL=https://your-custom-deeplx-api.com/translate
```

## 📁 Структура проекта

```
DeepLX-App/
├── api/
│   └── translate.js          # Serverless функция для API
├── index.html               # Главная страница
├── script.js                # Frontend логика
├── styles.css               # Стили
├── package.json             # Зависимости Node.js
├── vercel.json              # Конфигурация Vercel
└── README-VERCEL.md         # Эта инструкция
```

## ⚙️ Как работает serverless

1. **Frontend**: Статические файлы (HTML, CSS, JS) раздаются через Vercel CDN
2. **API**: `/api/translate` - serverless функция Node.js, которая:
   - Принимает POST запросы с текстом для перевода
   - Проксирует запросы к DeepLX API
   - Обрабатывает CORS и ошибки
   - Возвращает переведенный текст

## 🔧 Локальная разработка

```bash
# Установка зависимостей
npm install

# Запуск локального сервера Vercel
npm run dev
# или
vercel dev
```

Локальный сервер будет доступен на `http://localhost:3000`

## 🌐 Serverless функция API

**Endpoint**: `/api/translate`

**Метод**: POST

**Тело запроса**:
```json
{
  "text": "Hello, world!",
  "source_lang": "EN",
  "target_lang": "RU",
  "api_url": "https://custom-api.com/translate" // опционально
}
```

**Ответ**:
```json
{
  "code": 200,
  "data": "Привет, мир!",
  "source_lang": "EN",
  "target_lang": "RU",
  "message": "Перевод выполнен успешно"
}
```

## 🔒 Безопасность

- CORS настроен для всех доменов (`*`)
- Таймаут запросов: 25 секунд
- Максимальная длина текста: 5000 символов
- Валидация входных данных

## 📊 Мониторинг

В Vercel Dashboard доступны:

- Логи serverless функций
- Метрики производительности
- Статистика использования
- Мониторинг ошибок

## 🔄 Автоматические обновления

При каждом push в основную ветку GitHub:

1. Vercel автоматически запускает новое развертывание
2. Выполняется сборка проекта
3. Новая версия становится доступной по URL

## 🐛 Отладка

### Проверка логов serverless функции:

1. Откройте Vercel Dashboard
2. Выберите ваш проект
3. Перейдите в раздел "Functions"
4. Просмотрите логи `/api/translate`

### Локальная отладка:

```bash
# Запуск с детальными логами
vercel dev --debug
```

## 📝 Дополнительные настройки

### Кастомный домен

1. В Vercel Dashboard → Settings → Domains
2. Добавьте ваш домен
3. Настройте DNS записи

### Environment Variables

1. В Vercel Dashboard → Settings → Environment Variables
2. Добавьте необходимые переменные
3. Пересоберите проект

## 🆘 Решение проблем

### Ошибка 500 в API функции
- Проверьте логи в Vercel Dashboard
- Убедитесь, что DeepLX API доступен
- Проверьте формат JSON в запросе

### CORS ошибки
- Убедитесь, что в `vercel.json` настроены CORS заголовки
- Проверьте, что API вызывается с правильным Content-Type

### Таймауты
- По умолчанию таймаут 25 секунд
- Для более длительных операций увеличьте `maxDuration` в `vercel.json`

---

**Made with ❤️ by [crosser.software](https://crosser.software)**

**Готово к развертыванию! 🎉**
