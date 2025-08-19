/**
 * Document Processing API
 * Обрабатывает загрузку и перевод документов
 * 
 * @author crosser.software
 * @version 1.0.0
 */

// Поддерживаемые типы файлов
const SUPPORTED_TYPES = {
  'text/plain': 'txt',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf'
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 МБ

// Хранилище задач обработки (в production следует использовать базу данных)
const processingTasks = new Map();

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
      case 'upload':
        return handleFileUpload(req, res);
      case 'process':
        return handleDocumentProcessing(req, res);
      case 'status':
        return handleTaskStatus(req, res);
      case 'download':
        return handleDownload(req, res);
      default:
        return res.status(400).json({
          error: 'Invalid action',
          message: 'Supported actions: upload, process, status, download'
        });
    }
  } catch (error) {
    console.error('Document API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Обрабатывает загрузку файлов
 */
async function handleFileUpload(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // В реальном приложении здесь бы была обработка multipart/form-data
  // Пока возвращаем mock данные для клиентской части
  const mockFileId = 'file_' + Math.random().toString(36).substr(2, 16);
  
  return res.status(200).json({
    success: true,
    fileId: mockFileId,
    message: 'File uploaded successfully'
  });
}

/**
 * Обрабатывает перевод документов
 */
async function handleDocumentProcessing(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileId, sourceLang, targetLangs, fileName, fileSize } = req.body;

  if (!fileId || !targetLangs || !Array.isArray(targetLangs)) {
    return res.status(400).json({
      error: 'Missing required parameters',
      message: 'fileId and targetLangs are required'
    });
  }

  // Создаем задачу обработки
  const taskId = 'task_' + Math.random().toString(36).substr(2, 16);
  const task = {
    id: taskId,
    fileId,
    fileName: fileName || 'document.txt',
    fileSize: fileSize || 0,
    sourceLang: sourceLang || 'AUTO',
    targetLangs,
    status: 'pending',
    progress: 0,
    createdAt: Date.now(),
    results: []
  };

  processingTasks.set(taskId, task);

  // Запускаем обработку асинхронно
  processDocumentAsync(taskId);

  console.log(`🔄 Создана задача обработки: ${taskId}`);

  return res.status(200).json({
    success: true,
    taskId,
    message: 'Document processing started'
  });
}

/**
 * Возвращает статус задачи обработки
 */
async function handleTaskStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { taskId } = req.query;

  if (!taskId) {
    return res.status(400).json({
      error: 'Missing taskId parameter'
    });
  }

  const task = processingTasks.get(taskId);

  if (!task) {
    return res.status(404).json({
      error: 'Task not found'
    });
  }

  return res.status(200).json({
    success: true,
    task: {
      id: task.id,
      fileName: task.fileName,
      status: task.status,
      progress: task.progress,
      targetLangs: task.targetLangs,
      results: task.results,
      error: task.error
    }
  });
}

/**
 * Обрабатывает скачивание переведенных документов
 */
async function handleDownload(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { taskId, langCode } = req.query;

  if (!taskId || !langCode) {
    return res.status(400).json({
      error: 'Missing required parameters',
      message: 'taskId and langCode are required'
    });
  }

  const task = processingTasks.get(taskId);

  if (!task) {
    return res.status(404).json({
      error: 'Task not found'
    });
  }

  const result = task.results.find(r => r.langCode === langCode);

  if (!result) {
    return res.status(404).json({
      error: 'Translation not found'
    });
  }

  // В реальном приложении здесь был бы возврат файла
  // Пока возвращаем mock данные
  return res.status(200).json({
    success: true,
    downloadUrl: `mock://download/${taskId}/${langCode}`,
    message: 'Download ready'
  });
}

/**
 * Асинхронная обработка документа
 */
async function processDocumentAsync(taskId) {
  const task = processingTasks.get(taskId);
  if (!task) return;

  try {
    console.log(`📄 Начинаем обработку документа: ${task.fileName}`);
    
    // Обновляем статус
    task.status = 'processing';
    task.progress = 10;

    // Симулируем извлечение текста из документа
    await delay(1000);
    const extractedText = await extractTextFromDocument(task.fileId);
    
    task.progress = 20;
    console.log(`📝 Извлечен текст: ${extractedText.length} символов`);

    // Переводим на каждый целевой язык
    const totalLangs = task.targetLangs.length;
    
    for (let i = 0; i < totalLangs; i++) {
      const langCode = task.targetLangs[i];
      
      console.log(`🔄 Переводим на ${langCode}...`);
      
      try {
        // Вызываем API перевода
        const translatedText = await translateText(
          extractedText, 
          task.sourceLang, 
          langCode
        );

        // Создаем переведенный документ
        const documentId = await createTranslatedDocument(
          translatedText, 
          task.fileName, 
          langCode
        );

        task.results.push({
          langCode,
          status: 'completed',
          documentId,
          downloadUrl: `mock://download/${taskId}/${langCode}`
        });

        console.log(`✅ Перевод на ${langCode} завершен`);

      } catch (error) {
        console.error(`❌ Ошибка перевода на ${langCode}:`, error);
        
        task.results.push({
          langCode,
          status: 'error',
          error: error.message
        });
      }

      // Обновляем прогресс
      task.progress = 20 + (80 * (i + 1)) / totalLangs;
    }

    // Завершаем обработку
    task.status = 'completed';
    task.progress = 100;
    
    console.log(`🎉 Обработка документа завершена: ${task.fileName}`);

  } catch (error) {
    console.error(`🚫 Критическая ошибка обработки:`, error);
    
    task.status = 'error';
    task.error = error.message;
  }
}

/**
 * Извлекает текст из документа (mock)
 */
async function extractTextFromDocument(fileId) {
  await delay(500);
  
  // Mock извлечения текста
  return `Это пример текста, извлеченного из документа ${fileId}. 
Он содержит несколько предложений для демонстрации работы системы перевода документов. 
В реальной системе здесь был бы текст, извлеченный из PDF, DOC, DOCX или другого формата файла.`;
}

/**
 * Переводит текст с использованием существующего API
 */
async function translateText(text, sourceLang, targetLang) {
  // Импортируем существующую функцию перевода
  const translateModule = await import('./translate.js');
  
  // Создаем mock request для API перевода
  const mockReq = {
    method: 'POST',
    body: JSON.stringify({
      text,
      source_lang: sourceLang === 'AUTO' ? undefined : sourceLang,
      target_lang: targetLang
    })
  };

  // Создаем mock response
  let result;
  const mockRes = {
    status: (code) => ({
      json: (data) => {
        result = data;
        return { status: code };
      }
    }),
    setHeader: () => {},
    json: (data) => {
      result = data;
    }
  };

  // Вызываем API перевода
  await translateModule.default(mockReq, mockRes);
  
  if (result.code === 200) {
    return result.data;
  } else {
    throw new Error(result.message || 'Translation failed');
  }
}

/**
 * Создает переведенный документ (mock)
 */
async function createTranslatedDocument(translatedText, originalFileName, langCode) {
  await delay(200);
  
  // В реальной системе здесь была бы генерация документа в нужном формате
  const documentId = `doc_${langCode}_${Math.random().toString(36).substr(2, 12)}`;
  
  console.log(`📄 Создан документ ${documentId} для языка ${langCode}`);
  
  return documentId;
}

/**
 * Вспомогательная функция задержки
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Очищает старые задачи (можно вызывать периодически)
 */
export function cleanupOldTasks() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 часа

  for (const [taskId, task] of processingTasks.entries()) {
    if (now - task.createdAt > maxAge) {
      processingTasks.delete(taskId);
      console.log(`🧹 Удалена старая задача: ${taskId}`);
    }
  }
}
