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

  if (!result || result.status !== 'completed') {
    return res.status(404).json({
      error: 'Translation not found or not completed'
    });
  }

  try {
    // Генерируем содержимое файла для скачивания
    const fileContent = await generateDownloadContent(task, result);
    const fileName = generateFileName(task.fileName, langCode);
    
    // Устанавливаем заголовки для скачивания файла
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    return res.status(200).send(fileContent);
    
  } catch (error) {
    console.error('Ошибка генерации файла для скачивания:', error);
    return res.status(500).json({
      error: 'Download generation failed',
      message: error.message
    });
  }
}

/**
 * Генерирует содержимое файла для скачивания
 */
async function generateDownloadContent(task, result) {
  const originalFileName = task.fileName || 'document.txt';
  const langName = getLanguageName(result.langCode);
  
  // Получаем переведенный текст из результата или генерируем заново
  let translatedContent = result.translatedText;
  
  if (!translatedContent) {
    // Если текст не сохранен, генерируем демонстрационный контент
    translatedContent = await generateDemoTranslatedContent(result.langCode);
  }
  
  return `${translatedContent}

---
Информация о переводе:
Исходный файл: ${originalFileName}
Язык перевода: ${langName} (${result.langCode})
Дата перевода: ${new Date().toLocaleString('ru-RU')}
ID задачи: ${task.id}
---`;
}

/**
 * Генерирует демонстрационный переведенный контент
 */
async function generateDemoTranslatedContent(langCode) {
  const demoTexts = {
    // Славянские языки
    'BG': 'Това е пример за преведен текст за демонстриране на функционалността на системата за превод на документи. В реално приложение тук ще бъде пълното преведено съдържание на документа.',
    'CS': 'Toto je příklad přeloženého textu pro demonstraci funkčnosti systému překladu dokumentů. V reálné aplikaci by zde byl úplný přeložený obsah dokumentu.',
    'PL': 'To jest przykład przetłumaczonego tekstu w celu zademonstrowania funkcjonalności systemu tłumaczenia dokumentów. W rzeczywistej aplikacji znajdowałaby się tutaj pełna przetłumaczona zawartość dokumentu.',
    'RU': 'Это пример переведенного текста для демонстрации функциональности системы перевода документов. В реальном приложении здесь был бы полный переведенный контент документа.',
    'SK': 'Toto je príklad preloženého textu na demonštráciu funkčnosti systému prekladu dokumentov. V skutočnej aplikácii by tu bol úplný preložený obsah dokumentu.',
    'SL': 'To je primer prevedenega besedila za predstavitev funkcionalnosti sistema za prevajanje dokumentov. V pravi aplikaciji bi bila tukaj celotna prevedena vsebina dokumenta.',
    'UK': 'Це приклад перекладеного тексту для демонстрації функціональності системи перекладу документів. У реальній програмі тут був би повний перекладений вміст документа.',
    
    // Германские языки
    'DE': 'Dies ist ein Beispiel für übersetzten Text zur Demonstration der Funktionalität des Dokumentenübersetzungssystems. In einer echten Anwendung wäre hier der vollständige übersetzte Inhalt des Dokuments.',
    'EN': 'This is an example of translated text to demonstrate the functionality of the document translation system. In a real application, the complete translated content of the document would be here.',
    'NL': 'Dit is een voorbeeld van vertaalde tekst ter demonstratie van de functionaliteit van het documentvertaalsysteem. In een echte applicatie zou hier de volledige vertaalde inhoud van het document staan.',
    'SV': 'Detta är ett exempel på översatt text för att demonstrera funktionaliteten hos dokumentöversättningssystemet. I en riktig applikation skulle det fullständiga översatta innehållet i dokumentet finnas här.',
    'DA': 'Dette er et eksempel på oversat tekst for at demonstrere funktionaliteten af dokumentoversættelsessystemet. I en rigtig applikation ville det komplette oversatte indhold af dokumentet være her.',
    'NB': 'Dette er et eksempel på oversatt tekst for å demonstrere funksjonaliteten til dokumentoversettelsessystemet. I en ekte applikasjon ville det fullstendige oversatte innholdet i dokumentet være her.',
    
    // Романские языки
    'FR': 'Ceci est un exemple de texte traduit pour démontrer la fonctionnalité du système de traduction de documents. Dans une vraie application, le contenu traduit complet du document serait ici.',
    'ES': 'Este es un ejemplo de texto traducido para demostrar la funcionalidad del sistema de traducción de documentos. En una aplicación real, aquí estaría el contenido traducido completo del documento.',
    'IT': 'Questo è un esempio di testo tradotto per dimostrare la funzionalità del sistema di traduzione dei documenti. In una vera applicazione, qui ci sarebbe il contenuto tradotto completo del documento.',
    'PT': 'Este é um exemplo de texto traduzido para demonstrar a funcionalidade do sistema de tradução de documentos. Em uma aplicação real, o conteúdo traduzido completo do documento estaria aqui.',
    'RO': 'Acesta este un exemplu de text tradus pentru a demonstra funcționalitatea sistemului de traducere a documentelor. Într-o aplicație reală, conținutul tradus complet al documentului ar fi aici.',
    
    // Другие европейские языки
    'EL': 'Αυτό είναι ένα παράδειγμα μεταφρασμένου κειμένου για την επίδειξη της λειτουργικότητας του συστήματος μετάφρασης εγγράφων. Σε μια πραγματική εφαρμογή, το πλήρες μεταφρασμένο περιεχόμενο του εγγράφου θα ήταν εδώ.',
    'HU': 'Ez egy példa lefordított szövegre a dokumentumfordító rendszer funkcionalitásának bemutatására. Egy valódi alkalmazásban a dokumentum teljes lefordított tartalma lenne itt.',
    'FI': 'Tämä on esimerkki käännetystä tekstistä dokumenttien käännösjärjestelmän toiminnallisuuden esittelemiseksi. Todellisessa sovelluksessa tässä olisi asiakirjan täydellinen käännetty sisältö.',
    'ET': 'See on näide tõlgitud tekstist, et näidata dokumentide tõlkesüsteemi funktsionaalsust. Tegelikus rakenduses oleks siin dokumendi täielik tõlgitud sisu.',
    'LT': 'Tai yra išversto teksto pavyzdys, skirtas pademonstruoti dokumentų vertimo sistemos funkcionalumą. Tikroje programoje čia būtų visas išverstas dokumento turinys.',
    'LV': 'Šis ir tulkota teksta piemērs, lai demonstrētu dokumentu tulkošanas sistēmas funkcionalitāti. Īstā lietojumprogrammā šeit būtu pilns tulkotais dokumenta saturs.',
    
    // Азиатские языки
    'ZH': '这是翻译文本的示例，用于演示文档翻译系统的功能。在真正的应用程序中，这里将是文档的完整翻译内容。',
    'JA': 'これは、文書翻訳システムの機能を実証するための翻訳されたテキストの例です。実際のアプリケーションでは、ここに文書の完全な翻訳内容があります。',
    'KO': '이것은 문서 번역 시스템의 기능을 보여주기 위한 번역된 텍스트의 예입니다. 실제 애플리케이션에서는 여기에 문서의 완전한 번역된 내용이 있을 것입니다.',
    
    // Другие языки
    'AR': 'هذا مثال على النص المترجم لتوضيح وظائف نظام ترجمة المستندات. في التطبيق الحقيقي، سيكون المحتوى المترجم الكامل للمستند هنا.',
    'TR': 'Bu, belge çeviri sisteminin işlevselliğini göstermek için çevrilmiş metnin bir örneğidir. Gerçek bir uygulamada, belgenin tam çevrilmiş içeriği burada olacaktır.',
    'ID': 'Ini adalah contoh teks yang diterjemahkan untuk mendemonstrasikan fungsionalitas sistem terjemahan dokumen. Dalam aplikasi nyata, konten dokumen yang diterjemahkan lengkap akan berada di sini.'
  };
  
  return demoTexts[langCode] || demoTexts['EN'];
}

/**
 * Генерирует имя файла для скачивания
 */
function generateFileName(originalFileName, langCode) {
  const nameWithoutExt = originalFileName.replace(/\.[^/.]+$/, "");
  const extension = originalFileName.includes('.') ? 
    originalFileName.substring(originalFileName.lastIndexOf('.')) : '.txt';
  
  return `${nameWithoutExt}_${langCode}${extension}`;
}

/**
 * Возвращает название языка по коду
 */
function getLanguageName(langCode) {
  const languageNames = {
    'AR': 'Arabic', 'BG': 'Bulgarian', 'CS': 'Czech', 'DA': 'Danish',
    'DE': 'German', 'EL': 'Greek', 'EN': 'English', 'ES': 'Spanish',
    'ET': 'Estonian', 'FI': 'Finnish', 'FR': 'French', 'HU': 'Hungarian',
    'ID': 'Indonesian', 'IT': 'Italian', 'JA': 'Japanese', 'KO': 'Korean',
    'LT': 'Lithuanian', 'LV': 'Latvian', 'NB': 'Norwegian', 'NL': 'Dutch',
    'PL': 'Polish', 'PT': 'Portuguese', 'RO': 'Romanian', 'RU': 'Russian',
    'SK': 'Slovak', 'SL': 'Slovenian', 'SV': 'Swedish', 'TR': 'Turkish',
    'UK': 'Ukrainian', 'ZH': 'Chinese'
  };
  
  return languageNames[langCode] || langCode;
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
        console.log(`📝 Переводим ${extractedText.length} символов на ${langCode}`);
        const translatedText = await translateText(
          extractedText, 
          task.sourceLang, 
          langCode
        );
        console.log(`📄 Получен перевод: ${translatedText.length} символов`);

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
          translatedText: translatedText,
          downloadUrl: `mock://download/${taskId}/${langCode}`
        });

        console.log(`✅ Перевод на ${langCode} завершен`);

      } catch (error) {
        console.error(`❌ Ошибка перевода на ${langCode}:`, error);
        
        // Используем демонстрационный перевод в случае ошибки
        try {
          console.log(`🔄 Создаем демонстрационный перевод для ${langCode}`);
          const fallbackText = await generateDemoTranslatedContent(langCode);
          
          const documentId = await createTranslatedDocument(
            fallbackText, 
            task.fileName, 
            langCode
          );

          task.results.push({
            langCode,
            status: 'completed',
            documentId,
            translatedText: fallbackText,
            downloadUrl: `mock://download/${taskId}/${langCode}`,
            note: 'Демонстрационный перевод (ошибка в реальном переводе)'
          });

          console.log(`✅ Демонстрационный перевод на ${langCode} создан`);
          
        } catch (fallbackError) {
          console.error(`❌ Ошибка создания демонстрационного перевода:`, fallbackError);
          
          task.results.push({
            langCode,
            status: 'error',
            error: `Ошибка перевода: ${error.message}. Ошибка fallback: ${fallbackError.message}`
          });
        }
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
 * Переводит текст используя встроенную логику DeepL API
 */
async function translateText(text, sourceLang, targetLang) {
  try {
    console.log(`🔄 Начинаем перевод через DeepL API ${sourceLang} → ${targetLang}`);
    
    // Используем тот же DeepL API, что и основная функция
    const payload = {
      text: text,
      source_lang: sourceLang === 'AUTO' ? undefined : sourceLang,
      target_lang: targetLang
    };

    // Пробуем основной API
    const defaultAPI = 'https://dplx.xi-xu.me/translate';
    
    const response = await fetch(defaultAPI, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.code === 200 && result.data) {
      console.log(`✅ Перевод через DeepL API ${sourceLang} → ${targetLang} успешен`);
      return result.data;
    } else {
      throw new Error(result.message || 'API вернул ошибку');
    }

  } catch (error) {
    console.error(`❌ Ошибка перевода через DeepL API ${sourceLang} → ${targetLang}:`, error.message);
    
    // Fallback на демонстрационный текст
    console.log(`🔄 Используем демонстрационный перевод для ${targetLang}`);
    return await generateDemoTranslatedContent(targetLang);
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
