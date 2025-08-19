/**
 * Telegram Bot Authentication API
 * Обрабатывает авторизацию пользователей через Telegram бота
 * 
 * @author crosser.software
 * @version 2.0.0
 */

// Конфигурация
const CONFIG = {
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID,
  WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 часа
};

// Хранилище сессий (в production следует использовать базу данных)
const sessions = new Map();
const pendingApprovals = new Map();

/**
 * Основная функция обработки запросов
 */
export default async function handler(req, res) {
  // Устанавливаем CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'start':
        return handleAuthStart(req, res);
      case 'check':
        return handleAuthCheck(req, res);
      case 'webhook':
        return handleTelegramWebhook(req, res);
      default:
        return res.status(400).json({
          error: 'Invalid action',
          message: 'Supported actions: start, check, webhook'
        });
    }
  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Начинает процесс авторизации
 */
async function handleAuthStart(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Генерируем уникальный код для сессии
  const sessionId = generateSessionId();
  const authCode = generateAuthCode();
  
  // Сохраняем сессию
  sessions.set(sessionId, {
    authCode,
    status: 'pending',
    createdAt: Date.now(),
    userInfo: null
  });

  // Очищаем старые сессии
  cleanupExpiredSessions();

  console.log(`🔑 Новая сессия авторизации: ${sessionId}, код: ${authCode}`);

  return res.status(200).json({
    sessionId,
    authCode,
    botUsername: 'crosserdeepl_bot', // Замените на имя вашего бота
    message: 'Отправьте код боту для авторизации'
  });
}

/**
 * Проверяет статус авторизации
 */
async function handleAuthCheck(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({
      error: 'Missing sessionId',
      message: 'sessionId параметр обязателен'
    });
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      error: 'Session not found',
      message: 'Сессия не найдена или истекла'
    });
  }

  // Проверяем не истекла ли сессия
  if (Date.now() - session.createdAt > CONFIG.SESSION_TIMEOUT) {
    sessions.delete(sessionId);
    return res.status(410).json({
      error: 'Session expired',
      message: 'Сессия истекла'
    });
  }

  return res.status(200).json({
    status: session.status,
    userInfo: session.userInfo,
    message: getStatusMessage(session.status)
  });
}

/**
 * Обрабатывает вебхуки от Telegram бота
 */
async function handleTelegramWebhook(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const update = req.body;

  // Обрабатываем callback queries (нажатия на inline кнопки)
  if (update.callback_query) {
    return handleCallbackQuery(update.callback_query, res);
  }

  if (!update.message) {
    return res.status(200).json({ ok: true });
  }

  const message = update.message;
  const chatId = message.chat.id;
  const text = message.text;
  const user = message.from;

  console.log(`📱 Получено сообщение от ${user.first_name} (${user.id}): ${text}`);

  // Обрабатываем команды
  if (text === '/start') {
    await sendTelegramMessage(chatId, 
      'Привет! 👋\n\n' +
      'Отправьте мне код авторизации с сайта TranslateAI для подтверждения доступа.\n\n' +
      'Код выглядит примерно так: ABC123'
    );
    return res.status(200).json({ ok: true });
  }

  // Проверяем, является ли сообщение кодом авторизации
  const authCode = text.trim().toUpperCase();
  const session = findSessionByAuthCode(authCode);

  if (session) {
    const sessionId = [...sessions.entries()]
      .find(([, s]) => s.authCode === authCode)?.[0];

    if (sessionId) {
      // Обновляем сессию с информацией о пользователе
      session.userInfo = {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username
      };
      session.status = 'pending_approval';

      console.log(`✅ Пользователь ${user.first_name} подтвердил код ${authCode}`);

      // Отправляем сообщение пользователю
      await sendTelegramMessage(chatId,
        '✅ Код подтвержден!\n\n' +
        'Ваш запрос отправлен администратору на одобрение. ' +
        'Вы получите уведомление, когда доступ будет предоставлен.'
      );

      // Отправляем запрос админу на одобрение
      await sendAdminApprovalRequest(sessionId, session);

      return res.status(200).json({ ok: true });
    }
  }

  // Если код не найден
  await sendTelegramMessage(chatId,
    '❌ Код не найден или уже использован.\n\n' +
    'Убедитесь, что вы правильно ввели код авторизации с сайта.'
  );

  return res.status(200).json({ ok: true });
}

/**
 * Отправляет сообщение в Telegram
 */
async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  if (!CONFIG.BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не настроен');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`);
    }

    console.log(`📤 Сообщение отправлено в чат ${chatId}`);
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error);
  }
}

/**
 * Обрабатывает callback queries от inline кнопок
 */
async function handleCallbackQuery(callbackQuery, res) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;

  console.log(`🔘 Получен callback: ${data} от чата ${chatId}`);

  try {
    if (data.startsWith('approve_')) {
      const sessionId = data.replace('approve_', '');
      await handleApproval(sessionId, true, chatId, messageId);
    } else if (data.startsWith('reject_')) {
      const sessionId = data.replace('reject_', '');
      await handleApproval(sessionId, false, chatId, messageId);
    }

    // Подтверждаем получение callback
    await answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    console.error('Ошибка обработки callback:', error);
    await answerCallbackQuery(callbackQuery.id, 'Произошла ошибка');
  }

  return res.status(200).json({ ok: true });
}

/**
 * Обрабатывает одобрение или отклонение пользователя
 */
async function handleApproval(sessionId, approved, chatId, messageId) {
  const session = sessions.get(sessionId);
  
  if (!session) {
    console.log(`❌ Сессия ${sessionId} не найдена`);
    return;
  }

  session.status = approved ? 'approved' : 'rejected';
  
  const user = session.userInfo;
  const statusText = approved ? '✅ ОДОБРЕН' : '❌ ОТКЛОНЕН';
  const statusEmoji = approved ? '✅' : '❌';

  // Обновляем сообщение админа
  const updatedText = 
    `🔐 <b>Запрос на доступ к TranslateAI</b> - <b>${statusText}</b>\n\n` +
    `👤 <b>Пользователь:</b> ${user.firstName} ${user.lastName || ''}\n` +
    `🆔 <b>ID:</b> ${user.id}\n` +
    `📱 <b>Username:</b> @${user.username || 'не указан'}\n\n` +
    `${statusEmoji} <b>Статус:</b> ${statusText}`;

  await editTelegramMessage(chatId, messageId, updatedText);

  // Уведомляем пользователя
  if (approved) {
    await sendTelegramMessage(user.id,
      '🎉 <b>Доступ предоставлен!</b>\n\n' +
      'Добро пожаловать в TranslateAI! Теперь вы можете пользоваться сервисом перевода.\n\n' +
      'Обновите страницу в браузере, чтобы начать работу.'
    );
    console.log(`✅ Пользователь ${user.firstName} (${user.id}) одобрен`);
  } else {
    await sendTelegramMessage(user.id,
      '❌ <b>Доступ отклонен</b>\n\n' +
      'К сожалению, ваш запрос на доступ к TranslateAI был отклонен администратором.\n\n' +
      'Если у вас есть вопросы, обратитесь к администратору.'
    );
    console.log(`❌ Пользователь ${user.firstName} (${user.id}) отклонен`);
  }
}

/**
 * Отвечает на callback query
 */
async function answerCallbackQuery(callbackQueryId, text = '') {
  if (!CONFIG.BOT_TOKEN) return;

  try {
    const url = `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/answerCallbackQuery`;
    const payload = {
      callback_query_id: callbackQueryId,
      text: text
    };

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Ошибка ответа на callback:', error);
  }
}

/**
 * Редактирует сообщение в Telegram
 */
async function editTelegramMessage(chatId, messageId, text) {
  if (!CONFIG.BOT_TOKEN) return;

  try {
    const url = `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/editMessageText`;
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML'
    };

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Ошибка редактирования сообщения:', error);
  }
}

/**
 * Отправляет запрос админу на одобрение пользователя
 */
async function sendAdminApprovalRequest(sessionId, session) {
  if (!CONFIG.ADMIN_CHAT_ID) {
    console.error('❌ TELEGRAM_ADMIN_CHAT_ID не настроен');
    return;
  }

  const user = session.userInfo;
  const text = 
    `🔐 <b>Новый запрос на доступ к TranslateAI</b>\n\n` +
    `👤 <b>Пользователь:</b> ${user.firstName} ${user.lastName || ''}\n` +
    `🆔 <b>ID:</b> ${user.id}\n` +
    `📱 <b>Username:</b> @${user.username || 'не указан'}\n\n` +
    `Предоставить доступ?`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Разрешить', callback_data: `approve_${sessionId}` },
        { text: '❌ Отклонить', callback_data: `reject_${sessionId}` }
      ]
    ]
  };

  await sendTelegramMessage(CONFIG.ADMIN_CHAT_ID, text, keyboard);
}

/**
 * Вспомогательные функции
 */
function generateSessionId() {
  return 'sess_' + Math.random().toString(36).substr(2, 16);
}

function generateAuthCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function findSessionByAuthCode(authCode) {
  for (const session of sessions.values()) {
    if (session.authCode === authCode && session.status === 'pending') {
      return session;
    }
  }
  return null;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > CONFIG.SESSION_TIMEOUT) {
      sessions.delete(sessionId);
    }
  }
}

function getStatusMessage(status) {
  switch (status) {
    case 'pending':
      return 'Ожидается подтверждение в Telegram боте';
    case 'pending_approval':
      return 'Ожидается одобрение администратора';
    case 'approved':
      return 'Доступ предоставлен';
    case 'rejected':
      return 'Доступ отклонен';
    default:
      return 'Неизвестный статус';
  }
}
