/**
 * TranslateAI Serverless API функция
 * Развертывается на Vercel как serverless функция
 * 
 * @author crosser.software
 * @version 2.0.0
 */

// Конфигурация API
const CONFIG = {
  DEFAULT_DEEPLX_API: 'https://dplx.xi-xu.me/translate',
  TIMEOUT: 25000,
  MAX_TEXT_LENGTH: 1000
};

/**
 * Основная функция обработки запросов
 */
export default async function handler(req, res) {
  // Устанавливаем CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Обработка CORS preflight запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Разрешаем только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Только POST запросы разрешены'
    });
  }

  try {
    // Валидация входных данных
    const { text, source_lang, target_lang, api_url } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Поле "text" обязательно и должно быть строкой'
      });
    }

    if (!target_lang || typeof target_lang !== 'string') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Поле "target_lang" обязательно'
      });
    }

    // Проверка длины текста
    if (text.length > CONFIG.MAX_TEXT_LENGTH) {
      return res.status(400).json({
        error: 'Text too long',
        message: `Максимальная длина: ${CONFIG.MAX_TEXT_LENGTH} символов`
      });
    }

    // Определение API endpoint
    const apiEndpoint = api_url || CONFIG.DEFAULT_DEEPLX_API;

    // Подготовка данных для отправки
    const payload = {
      text: text.trim(),
      target_lang: target_lang.toUpperCase()
    };

    // Добавляем source_lang если указан и не AUTO
    if (source_lang && source_lang !== 'AUTO' && source_lang !== 'auto') {
      payload.source_lang = source_lang.toUpperCase();
    }

    console.log('Отправка запроса:', {
      endpoint: apiEndpoint,
      textLength: text.length,
      targetLang: target_lang
    });

    // Создание контроллера для таймаута
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

    try {
      // Отправка запроса
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TranslateAI/2.0.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('API error:', response.status, response.statusText);
        
        let errorMessage = 'Ошибка API перевода';
        if (response.status === 429) {
          errorMessage = 'Слишком много запросов';
        } else if (response.status === 500) {
          errorMessage = 'Ошибка сервера перевода';
        } else if (response.status === 404) {
          errorMessage = 'API endpoint не найден';
        }

        return res.status(response.status).json({
          error: 'Translation API Error',
          message: errorMessage,
          status: response.status
        });
      }

      const result = await response.json();
      console.log('Ответ API:', result);

      if (result.code === 200 && result.data) {
        return res.status(200).json({
          code: 200,
          data: result.data,
          source_lang: result.source_lang || source_lang,
          target_lang: target_lang.toUpperCase(),
          message: 'Перевод выполнен успешно'
        });
      } else {
        return res.status(400).json({
          error: 'Translation failed',
          message: result.message || 'Не удалось выполнить перевод',
          details: result
        });
      }

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('Таймаут запроса');
        return res.status(408).json({
          error: 'Request timeout',
          message: 'Превышено время ожидания'
        });
      }

      console.error('Ошибка запроса:', fetchError);
      return res.status(502).json({
        error: 'API connection error',
        message: 'Не удалось подключиться к сервису перевода',
        details: fetchError.message
      });
    }

  } catch (error) {
    console.error('Общая ошибка:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Внутренняя ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}