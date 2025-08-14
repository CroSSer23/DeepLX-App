/**
 * Serverless API функция для перевода текста через DeepLX
 * Развертывается на Vercel как serverless функция
 * 
 * @author Xi Xu
 * @version 1.0.0
 */

// Настройка CORS заголовков
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Конфигурация API
const CONFIG = {
  DEFAULT_DEEPLX_API: 'https://dplx.xi-xu.me/translate',
  TIMEOUT: 25000, // 25 секунд таймаут
  MAX_TEXT_LENGTH: 5000
};

/**
 * Основная функция обработки запросов
 * @param {Request} req - HTTP запрос
 * @param {Response} res - HTTP ответ
 */
export default async function handler(req, res) {
  // Обработка CORS preflight запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Разрешаем только POST запросы для перевода
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Только POST запросы разрешены для этого endpoint'
    });
  }

  try {
    // Валидация входных данных
    const { text, source_lang, target_lang, api_url } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Поле "text" обязательно и должно быть строкой'
      });
    }

    if (!target_lang || typeof target_lang !== 'string') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Поле "target_lang" обязательно и должно быть строкой'
      });
    }

    // Проверка длины текста
    if (text.length > CONFIG.MAX_TEXT_LENGTH) {
      return res.status(400).json({
        error: 'Text too long',
        message: `Максимальная длина текста: ${CONFIG.MAX_TEXT_LENGTH} символов`
      });
    }

    // Определение API endpoint (можно переопределить через параметр)
    const apiEndpoint = api_url || CONFIG.DEFAULT_DEEPLX_API;

    // Подготовка данных для отправки в DeepLX API
    const translationPayload = {
      text: text.trim(),
      target_lang: target_lang.toUpperCase()
    };

    // Добавляем source_lang только если он указан и не AUTO
    if (source_lang && source_lang !== 'AUTO' && source_lang !== 'auto') {
      translationPayload.source_lang = source_lang.toUpperCase();
    }

    console.log('Отправка запроса в DeepLX API:', {
      endpoint: apiEndpoint,
      payload: translationPayload
    });

    // Создание контроллера для таймаута
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

    try {
      // Отправка запроса в DeepLX API
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DeepLX-App/1.0.0'
        },
        body: JSON.stringify(translationPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Проверка статуса ответа
      if (!response.ok) {
        console.error('DeepLX API error:', response.status, response.statusText);
        
        let errorMessage = 'Ошибка API перевода';
        
        if (response.status === 429) {
          errorMessage = 'Слишком много запросов. Попробуйте позже.';
        } else if (response.status === 500) {
          errorMessage = 'Внутренняя ошибка сервера перевода';
        } else if (response.status === 404) {
          errorMessage = 'API endpoint не найден';
        }

        return res.status(response.status).json({
          error: 'Translation API Error',
          message: errorMessage,
          status: response.status
        });
      }

      // Парсинг ответа от DeepLX
      const result = await response.json();
      console.log('Ответ от DeepLX API:', result);

      // Проверка успешности перевода
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
        console.error('Таймаут запроса к DeepLX API');
        return res.status(408).json({
          error: 'Request timeout',
          message: 'Превышено время ожидания ответа от API перевода'
        });
      }

      console.error('Ошибка при запросе к DeepLX API:', fetchError);
      return res.status(502).json({
        error: 'API connection error',
        message: 'Не удалось подключиться к сервису перевода',
        details: fetchError.message
      });
    }

  } catch (error) {
    console.error('Общая ошибка в serverless функции:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Внутренняя ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Настройка CORS для всех ответов
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
