# Настройка Telegram бота для авторизации

## 📋 Требования

Для работы системы авторизации через Telegram вам потребуется:

1. **Telegram бот** - создается через [@BotFather](https://t.me/BotFather)
2. **ID администратора** - ваш Telegram ID для получения запросов на одобрение
3. **Vercel аккаунт** - для настройки переменных окружения

## 🤖 Создание Telegram бота

### Шаг 1: Создание бота

1. Откройте Telegram и найдите [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Введите имя для вашего бота (например: `TranslateAI Auth Bot`)
4. Введите username для бота (например: `translateai_auth_bot`)
5. Сохраните полученный **BOT TOKEN**

### Шаг 2: Настройка бота

1. Отправьте `/setdescription` и введите описание:
   ```
   Бот для авторизации в системе TranslateAI. Отправьте код авторизации с сайта для получения доступа.
   ```

2. Отправьте `/setcommands` и введите команды:
   ```
   start - Начать работу с ботом
   ```

3. Отправьте `/setprivacy` и выберите `Disable` для получения всех сообщений

## 🆔 Получение вашего Telegram ID

### Способ 1: Через специального бота
1. Найдите бота [@userinfobot](https://t.me/userinfobot)
2. Отправьте `/start`
3. Сохраните ваш **User ID**

### Способ 2: Через веб-версию
1. Откройте [web.telegram.org](https://web.telegram.org)
2. В URL адрес будет содержать ваш ID: `https://web.telegram.org/k/#123456789`

## ⚙️ Настройка переменных окружения в Vercel

1. Откройте ваш проект в [Vercel Dashboard](https://vercel.com/dashboard)
2. Перейдите в `Settings` → `Environment Variables`
3. Добавьте следующие переменные:

| Название | Значение | Описание |
|----------|----------|----------|
| `TELEGRAM_BOT_TOKEN` | `your_bot_token_here` | Токен вашего бота от @BotFather |
| `TELEGRAM_ADMIN_CHAT_ID` | `your_telegram_id_here` | Ваш Telegram ID для одобрения пользователей |
| `TELEGRAM_WEBHOOK_SECRET` | `random_secret_string` | Произвольная строка для безопасности |

### Пример значений:
```
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_CHAT_ID=123456789
TELEGRAM_WEBHOOK_SECRET=my_super_secret_webhook_key_2024
```

## 🔗 Настройка webhook

После развертывания на Vercel, настройте webhook для бота:

1. Замените `YOUR_BOT_TOKEN` и `YOUR_DOMAIN` в URL:
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://YOUR_DOMAIN.vercel.app/api/auth?action=webhook
   ```

2. Откройте этот URL в браузере

3. Должен появиться ответ:
   ```json
   {"ok":true,"result":true,"description":"Webhook was set"}
   ```

### Пример:
```
https://api.telegram.org/bot1234567890:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook?url=https://translateai-app.vercel.app/api/auth?action=webhook
```

## 📱 Тестирование системы

1. Откройте ваш сайт
2. Должно появиться модальное окно авторизации
3. Нажмите "Получить код авторизации"
4. Откройте бота в Telegram
5. Отправьте `/start`, затем полученный код
6. Админ (вы) получите запрос на одобрение
7. Нажмите "✅ Разрешить" или "❌ Отклонить"

## 🐛 Решение проблем

### Бот не отвечает
- Проверьте правильность BOT_TOKEN
- Убедитесь, что webhook настроен правильно
- Проверьте логи в Vercel Dashboard

### Админ не получает запросы
- Проверьте правильность TELEGRAM_ADMIN_CHAT_ID
- Убедитесь, что вы начали диалог с ботом

### Переменные окружения не работают
- Убедитесь, что переменные добавлены в Vercel
- После изменения переменных нужно заново развернуть проект

## 🔄 Обновление кода бота

В файле `script.js` найдите строку:
```javascript
botUsername: 'your_bot_username', // Замените на имя вашего бота
```

Замените `'your_bot_username'` на username вашего бота без символа @.

## ✅ Готово!

После выполнения всех шагов система авторизации будет полностью функциональна:

- 🔐 Пользователи будут авторизовываться через Telegram
- 👨‍💼 Админ будет получать запросы на одобрение
- ✅ Одобренные пользователи получат доступ к сервису
- 🔄 Автоматическое управление сессиями и безопасность

