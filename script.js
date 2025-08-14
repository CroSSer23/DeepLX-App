/**
 * TranslateAI - AI-Powered Translation App
 * A modern web app for AI translation supporting up to 1 million characters
 *
 * Features:
 * - Auto-translation with configurable delay
 * - Large text support (up to 1M characters) with chunking
 * - Translation history with local storage
 * - RTL/LTR text direction support
 * - Responsive design with modern UI
 * - Keyboard shortcuts and accessibility
 *
 * @author crosser.software
 * @version 2.0.0
 * @license MIT
 */

document.addEventListener("DOMContentLoaded", () => {
  // Configuration constants
  const CONFIG = {
    MAX_CHARS: 1000000, // Поддержка до 1 миллиона символов
    CHUNK_SIZE: 500, // Размер части для разделения больших текстов
    DEFAULT_API_URL: "/api/translate", // Использование serverless API Vercel
    FALLBACK_API_URL: "https://dplx.xi-xu.me/translate", // Запасной API endpoint
    DEFAULT_DELAY: 1000,
    MAX_HISTORY_ITEMS: 50,
    USE_SERVERLESS: true, // Флаг для использования serverless API
    PARALLEL_CHUNKS: 3, // Количество параллельных запросов для частей
  };

  // Supported languages list - DeepL API compatible language codes
  const languages = {
    AR: "Arabic",
    BG: "Bulgarian",
    CS: "Czech",
    DA: "Danish",
    DE: "German",
    EL: "Greek",
    EN: "English",
    ES: "Spanish",
    ET: "Estonian",
    FI: "Finnish",
    FR: "French",
    HU: "Hungarian",
    ID: "Indonesian",
    IT: "Italian",
    JA: "Japanese",
    KO: "Korean",
    LT: "Lithuanian",
    LV: "Latvian",
    NB: "Norwegian (bokmål)",
    NL: "Dutch",
    PL: "Polish",
    PT: "Portuguese",
    RO: "Romanian",
    RU: "Russian",
    SK: "Slovak",
    SL: "Slovenian",
    SV: "Swedish",
    TR: "Turkish",
    UK: "Ukrainian",
    ZH: "Chinese",
  };

  // Get DOM elements
  // DOM element references - cached for performance
  const elements = {
    sourceLangSelect: document.getElementById("sourceLang"),
    targetLangSelect: document.getElementById("targetLang"),
    inputText: document.getElementById("inputText"),
    outputText: document.getElementById("outputText"),
    swapButton: document.getElementById("swapButton"),
    copyButton: document.getElementById("copyButton"),
    loadingSpinner: document.getElementById("loadingSpinner"),
    statusMessage: document.getElementById("statusMessage"),
    apiUrlInput: document.getElementById("apiUrlInput"),
    historyButton: document.getElementById("historyButton"),
    settingsButton: document.getElementById("settingsButton"),
    historyPanel: document.getElementById("historyPanel"),
    settingsPanel: document.getElementById("settingsPanel"),
    closeHistoryButton: document.getElementById("closeHistoryButton"),
    closeSettingsButton: document.getElementById("closeSettingsButton"),
    historyList: document.getElementById("historyList"),
    historyCount: document.getElementById("historyCount"),
    clearHistoryButton: document.getElementById("clearHistoryButton"),
    delayInput: document.getElementById("delayInput"),
    autoTranslateToggle: document.getElementById("autoTranslateToggle"),
    charCount: document.getElementById("charCount"),
  };

  // App state
  let translateTimeout;
  let translationHistory = [];
  let isTranslating = false;
  let currentTranslationId = 0;

  // Function to detect Arabic text
  /**
   * Utility Functions
   */

  /**
   * Detects if text contains Arabic characters
   * @param {string} text - Text to analyze
   * @returns {boolean} True if text contains Arabic characters
   */
  function isArabicText(text) {
    const arabicRegex =
      /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return arabicRegex.test(text);
  }

  /**
   * Splits large text into smaller chunks for translation
   * @param {string} text - Text to split
   * @param {number} chunkSize - Size of each chunk
   * @returns {Array<string>} Array of text chunks
   */
  function splitTextIntoChunks(text, chunkSize = CONFIG.CHUNK_SIZE) {
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
      let endIndex = currentIndex + chunkSize;
      
      // Если не последний кусок, ищем ближайший разделитель
      if (endIndex < text.length) {
        const searchStart = Math.max(currentIndex, endIndex - 50);
        const searchText = text.substring(searchStart, endIndex + 50);
        
        // Ищем разделители в порядке приоритета
        const separators = ['\n\n', '. ', '.\n', '! ', '!\n', '? ', '?\n', '\n', ' '];
        let bestSeparatorIndex = -1;
        
        for (const separator of separators) {
          const sepIndex = searchText.lastIndexOf(separator);
          if (sepIndex !== -1) {
            bestSeparatorIndex = searchStart + sepIndex + separator.length;
            break;
          }
        }
        
        if (bestSeparatorIndex !== -1 && bestSeparatorIndex > currentIndex) {
          endIndex = bestSeparatorIndex;
        }
      }

      chunks.push(text.substring(currentIndex, endIndex).trim());
      currentIndex = endIndex;
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * Translates a single chunk of text with retry logic
   * @param {string} chunk - Text chunk to translate
   * @param {string} sourceLang - Source language
   * @param {string} targetLang - Target language
   * @param {string} apiUrl - API URL to use (всегда /api/translate)
   * @param {string} customApiUrl - Custom API URL для проксирования
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} chunkIndex - Index of chunk for logging
   * @returns {Promise<string>} Translated text
   */
  async function translateChunk(chunk, sourceLang, targetLang, apiUrl, customApiUrl = null, maxRetries = 3, chunkIndex = 0) {
    const payload = {
      text: chunk,
      source_lang: sourceLang === "AUTO" ? undefined : sourceLang,
      target_lang: targetLang,
    };

    // Добавляем api_url в payload для проксирования через serverless функцию
    if (customApiUrl && customApiUrl !== CONFIG.DEFAULT_API_URL) {
      payload.api_url = customApiUrl;
    }

    console.log(`🔄 Перевод части ${chunkIndex + 1}: ${chunk.length} символов`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📡 Попытка ${attempt}/${maxRetries} для части ${chunkIndex + 1}`);
        
        const response = await fetch(apiUrl, {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Неизвестная ошибка');
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();

        if (result.code === 200 && result.data) {
          console.log(`✅ Часть ${chunkIndex + 1} переведена успешно (попытка ${attempt})`);
          return result.data;
        } else {
          throw new Error(`API Error: ${result.message || result.error || "Неизвестная ошибка"}`);
        }

      } catch (error) {
        console.error(`❌ Ошибка части ${chunkIndex + 1}, попытка ${attempt}:`, error.message);
        
        if (attempt === maxRetries) {
          console.error(`🚫 Все попытки исчерпаны для части ${chunkIndex + 1}`);
          throw new Error(`Не удалось перевести часть ${chunkIndex + 1} после ${maxRetries} попыток: ${error.message}`);
        }
        
        // Пауза перед повтором с экспоненциальной задержкой
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Ожидание ${delay}мс перед повтором...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Applies appropriate text direction (RTL/LTR) based on text content
   * @param {HTMLElement} element - Element to apply direction to
   * @param {string} text - Text content to analyze
   */
  function applyTextDirection(element, text) {
    if (isArabicText(text)) {
      element.classList.add("rtl-text");
      element.classList.remove("ltr-text");
    } else {
      element.classList.add("ltr-text");
      element.classList.remove("rtl-text");
    }
  }

  // Character counter function
  /**
   * UI Update Functions
   */

  /**
   * Updates character counter and input field styling
   * Handles RTL/LTR text direction and placeholder updates
   */
  function updateCharCount() {
    const count = elements.inputText.value.length;
    elements.charCount.textContent = count.toLocaleString();

    // Apply RTL/LTR direction based on input text
    applyTextDirection(elements.inputText, elements.inputText.value);

    // Update color based on character count
    elements.charCount.className = "transition-colors duration-200";
    if (count > 900000) {
      elements.charCount.classList.add("char-danger");
    } else if (count > 800000) {
      elements.charCount.classList.add("char-warning");
    }

    // Update placeholder based on auto-translate status
    if (elements.autoTranslateToggle.checked) {
      elements.inputText.placeholder =
        count === 0
          ? "Введите текст для перевода... (До 1 млн символов, автоперевод включен)"
          : "Автоперевод запустится после остановки печати...";
    } else {
      elements.inputText.placeholder =
        "Введите текст для перевода... (До 1 млн символов, автоперевод отключен)";
    }
  }

  // Populate language dropdown menus
  /**
   * Language Management Functions
   */

  /**
   * Populates language dropdown menus with sorted language options
   * Restores saved language selections or uses defaults
   */
  function populateLanguages() {
    elements.sourceLangSelect.innerHTML =
      '<option value="AUTO">Detect language</option>';

    // Sort languages alphabetically by name for better UX
    const sortedLanguages = Object.entries(languages).sort(([, a], [, b]) =>
      a.localeCompare(b)
    );

    sortedLanguages.forEach(([code, name]) => {
      elements.sourceLangSelect.add(new Option(name, code));
    });

    elements.targetLangSelect.innerHTML = "";
    sortedLanguages.forEach(([code, name]) => {
      elements.targetLangSelect.add(new Option(name, code));
    });

    // Restore saved language selections or use defaults
    const savedSourceLang = localStorage.getItem("deeplxSourceLang") || "AUTO";
    const savedTargetLang = localStorage.getItem("deeplxTargetLang") || "EN";

    elements.sourceLangSelect.value = savedSourceLang;
    elements.targetLangSelect.value = savedTargetLang;
  }

  // Load and save settings
  /**
   * Settings Management Functions
   */

  /**
   * Initializes app settings from localStorage
   * Sets up event listeners for settings changes
   */
  function setupSettings() {
    // Load saved settings with fallback defaults
    const savedUrl = localStorage.getItem("deeplxApiUrl");
    const savedDelay =
      localStorage.getItem("autoTranslateDelay") ||
      CONFIG.DEFAULT_DELAY.toString();
    const savedAutoTranslate =
      localStorage.getItem("autoTranslateEnabled") !== "false";

    elements.apiUrlInput.value = savedUrl || "";
    elements.delayInput.value = savedDelay;
    elements.autoTranslateToggle.checked = savedAutoTranslate;

    // Set up event listeners for settings persistence
    elements.apiUrlInput.addEventListener("input", () => {
      const urlToSave = elements.apiUrlInput.value.trim();
      if (urlToSave) {
        localStorage.setItem("deeplxApiUrl", urlToSave);
        showStatus("API endpoint сохранен.", "success");
      }
    });

    elements.delayInput.addEventListener("input", () => {
      const delay = elements.delayInput.value;
      localStorage.setItem("autoTranslateDelay", delay);
              showStatus("Настройка задержки сохранена.", "success");
    });

    elements.autoTranslateToggle.addEventListener("change", () => {
      localStorage.setItem(
        "autoTranslateEnabled",
        elements.autoTranslateToggle.checked
      );
      showStatus(
        `Автоперевод ${
          elements.autoTranslateToggle.checked ? "включен" : "отключен"
        }.`,
        "success"
      );
      updateCharCount(); // Update placeholder when toggle changes
    });
  }

  // Load translation history
  /**
   * History Management Functions
   */

  /**
   * Loads translation history from localStorage
   */
  function loadHistory() {
    const saved = localStorage.getItem("translationHistory");
    if (saved) {
      translationHistory = JSON.parse(saved);
    }
    updateHistoryDisplay();
  }

  /**
   * Saves translation history to localStorage
   */
  function saveHistory() {
    localStorage.setItem(
      "translationHistory",
      JSON.stringify(translationHistory)
    );
  }

  /**
   * Adds a new translation to history
   * @param {string} sourceText - Original text
   * @param {string} targetText - Translated text
   * @param {string} sourceLang - Source language code
   * @param {string} targetLang - Target language code
   */
  function addToHistory(sourceText, targetText, sourceLang, targetLang) {
    const historyItem = {
      id: Date.now(),
      sourceText,
      targetText,
      sourceLang,
      targetLang,
      timestamp: new Date().toISOString(),
    };

    // Remove duplicate if exists
    translationHistory = translationHistory.filter(
      (item) =>
        item.sourceText !== sourceText ||
        item.sourceLang !== sourceLang ||
        item.targetLang !== targetLang
    );

    // Add to beginning of array
    translationHistory.unshift(historyItem);

    // Keep only last items as per config
    if (translationHistory.length > CONFIG.MAX_HISTORY_ITEMS) {
      translationHistory = translationHistory.slice(
        0,
        CONFIG.MAX_HISTORY_ITEMS
      );
    }

    saveHistory();
    updateHistoryDisplay();
  }

  /**
   * Updates the history display panel
   */
  function updateHistoryDisplay() {
    elements.historyCount.textContent = `${translationHistory.length} records`;
    elements.historyList.innerHTML = "";

    translationHistory.forEach((item) => {
      const historyItem = document.createElement("div");
      historyItem.className = "history-item";

      const sourceTextClass = isArabicText(item.sourceText)
        ? "source-text rtl-text"
        : "source-text";
      const targetTextClass = isArabicText(item.targetText)
        ? "target-text rtl-text"
        : "target-text";

      historyItem.innerHTML = `
        <div class="${sourceTextClass}">${item.sourceText.substring(0, 100)}${
        item.sourceText.length > 100 ? "..." : ""
      }</div>
        <div class="${targetTextClass}">${item.targetText.substring(0, 100)}${
        item.targetText.length > 100 ? "..." : ""
      }</div>
        <div class="lang-info">${
          item.sourceLang === "AUTO"
            ? "Auto-detected"
            : languages[item.sourceLang] || item.sourceLang
        } → ${languages[item.targetLang] || item.targetLang}</div>
      `;

      historyItem.addEventListener("click", () => {
        elements.inputText.value = item.sourceText;
        elements.outputText.value = item.targetText;
        elements.sourceLangSelect.value = item.sourceLang;
        elements.targetLangSelect.value = item.targetLang;

        // Apply text direction for loaded history items
        applyTextDirection(elements.inputText, item.sourceText);
        applyTextDirection(elements.outputText, item.targetText);

        elements.historyPanel.classList.add("hidden");
        showStatus("History item loaded.", "success");
      });

      elements.historyList.appendChild(historyItem);
    });
  }

  // Display status message with enhanced animation
  /**
   * Status and Feedback Functions
   */

  /**
   * Displays status message with enhanced animation
   * @param {string} message - Message to display
   * @param {string} type - Message type ('error', 'success', 'info', 'progress')
   * @param {boolean} persistent - Whether message should auto-hide
   */
  function showStatus(message, type = "error", persistent = false) {
    elements.statusMessage.textContent = message;
    
    // Убираем старые классы анимации
    elements.statusMessage.classList.remove("progress-counter", "updating", "completion-animation");
    
    let className = "text-sm h-5 text-right transition-all duration-300 ";
    
    switch (type) {
      case "error":
        className += "text-red-400";
        break;
      case "success":
        className += "text-green-400";
        break;
      case "progress":
        className += "text-blue-400 progress-counter";
        break;
      case "info":
        className += "text-yellow-400";
        break;
      default:
        className += "text-green-400";
    }
    
    elements.statusMessage.className = className;

    // Добавляем анимацию обновления для progress
    if (type === "progress") {
      elements.statusMessage.classList.add("updating");
      setTimeout(() => {
        elements.statusMessage.classList.remove("updating");
      }, 600);
    }

    // Add fade-in animation
    elements.statusMessage.style.opacity = "0";
    elements.statusMessage.style.transform = "translateY(10px)";

    setTimeout(() => {
      elements.statusMessage.style.opacity = "1";
      elements.statusMessage.style.transform = "translateY(0)";
    }, 50);

    // Auto-hide message after time based on type
    if (message && !persistent) {
      const hideDelay = type === "progress" ? 2000 : type === "success" ? 5000 : 4000;
      setTimeout(() => {
        elements.statusMessage.style.opacity = "0";
        setTimeout(() => {
          elements.statusMessage.textContent = "";
          elements.statusMessage.style.opacity = "1";
          elements.statusMessage.classList.remove("progress-counter", "updating", "completion-animation");
        }, 300);
      }, hideDelay);
    }
  }

  /**
   * Shows completion animation and message
   * @param {string} message - Completion message
   */
  function showCompletionStatus(message) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = "text-sm h-5 text-right text-green-400 completion-animation";
    
    // Keep the completion message visible longer
    setTimeout(() => {
      elements.statusMessage.style.opacity = "0";
      setTimeout(() => {
        elements.statusMessage.textContent = "";
        elements.statusMessage.style.opacity = "1";
        elements.statusMessage.classList.remove("completion-animation");
      }, 300);
    }, 6000);
  }

  // Translation function
  /**
   * Translation Functions
   */

  /**
   * Main translation function that handles API requests
   * Supports large texts up to 1 million characters with chunking
   * @param {boolean} isAutoTranslate - Whether this is an automatic translation
   */
  async function translateText(isAutoTranslate = false) {
    const text = elements.inputText.value.trim();
    if (!text) {
      if (!isAutoTranslate) {
        showStatus("Введите текст для перевода.");
      }
      elements.outputText.value = "";
      return;
    }

    // Prevent concurrent translations
    if (isTranslating) {
      showStatus("Перевод уже выполняется, пожалуйста, подождите...");
      return;
    }

    isTranslating = true;
    currentTranslationId++;
    const thisTranslationId = currentTranslationId;

    setLoading(true);
    showStatus("", "success"); // Clear status

    try {
      // ВСЕГДА используем нашу serverless API функцию
      const apiUrl = CONFIG.DEFAULT_API_URL; // /api/translate
      const customApiUrl = elements.apiUrlInput.value.trim();

      const sourceLang = elements.sourceLangSelect.value;
      const targetLang = elements.targetLangSelect.value;

      // Проверяем размер текста и разделяем на части если необходимо
      if (text.length <= CONFIG.CHUNK_SIZE) {
        // Небольшой текст - обычный перевод
        console.log(`📝 Начинаем перевод небольшого текста (${text.length} символов)`);
        showStatus("Переводим текст...", "progress");
        
        const translatedText = await translateChunk(text, sourceLang, targetLang, apiUrl, customApiUrl, 3, 0);
        
        // Проверяем, что это всё ещё актуальный перевод
        if (thisTranslationId !== currentTranslationId) return;
        
        elements.outputText.value = translatedText;
        applyTextDirection(elements.outputText, translatedText);
        
        console.log(`🎉 Перевод завершен успешно!`);
        showCompletionStatus(`🎉 Перевод завершен! Переведено ${text.length} символов`);

        // Add to history
        addToHistory(text, translatedText, sourceLang, targetLang);
        
      } else {
        // Большой текст - разделяем на части
        const chunks = splitTextIntoChunks(text, CONFIG.CHUNK_SIZE);
        const totalChunks = chunks.length;
        
        console.log(`📚 Начинаем перевод большого текста: ${text.length} символов, ${totalChunks} частей`);
        showStatus(`Разделяем текст на ${totalChunks} частей для перевода...`, "info");
        
        // Переводим части параллельно (по несколько одновременно)
        const translatedChunks = [];
        let completedChunks = 0;
        let totalErrors = 0;
        
        for (let i = 0; i < chunks.length; i += CONFIG.PARALLEL_CHUNKS) {
          // Проверяем, что это всё ещё актуальный перевод
          if (thisTranslationId !== currentTranslationId) return;
          
          const batch = chunks.slice(i, i + CONFIG.PARALLEL_CHUNKS);
          const batchStartIndex = i;
          const batchPromises = batch.map((chunk, localIndex) => 
            translateChunk(chunk, sourceLang, targetLang, apiUrl, customApiUrl, 3, batchStartIndex + localIndex)
          );
          
          try {
            console.log(`🔄 Обрабатываем пакет ${Math.floor(i / CONFIG.PARALLEL_CHUNKS) + 1} (части ${i + 1}-${Math.min(i + batch.length, totalChunks)})`);
            
            const batchResults = await Promise.all(batchPromises);
            translatedChunks.push(...batchResults);
            
            completedChunks += batch.length;
            const progress = Math.round((completedChunks / totalChunks) * 100);
            console.log(`✅ Пакет завершен. Прогресс: ${completedChunks}/${totalChunks} (${progress}%)`);
            showStatus(`Переведено ${completedChunks}/${totalChunks} частей (${progress}%)`, "progress");
            
            // Обновляем результат по мере перевода
            const currentResult = translatedChunks.join(' ');
            elements.outputText.value = currentResult;
            applyTextDirection(elements.outputText, currentResult);
            
          } catch (error) {
            console.error('❌ Ошибка в пакете:', error);
            totalErrors++;
            
            // Обрабатываем каждую часть в пакете индивидуально
            showStatus(`⚠️ Ошибка в пакете, обрабатываем части индивидуально...`, "info");
            
            for (let j = 0; j < batch.length; j++) {
              const chunkIndex = i + j;
              try {
                console.log(`🔄 Индивидуальная обработка части ${chunkIndex + 1}/${totalChunks}`);
                const retryResult = await translateChunk(batch[j], sourceLang, targetLang, apiUrl, customApiUrl, 3, chunkIndex);
                translatedChunks.push(retryResult);
                completedChunks++;
                
                const progress = Math.round((completedChunks / totalChunks) * 100);
                showStatus(`Переведено ${completedChunks}/${totalChunks} частей (${progress}%)`, "progress");
                
              } catch (retryError) {
                console.error(`🚫 Критическая ошибка части ${chunkIndex + 1}:`, retryError);
                totalErrors++;
                const errorText = `[❌ Ошибка части ${chunkIndex + 1}: ${retryError.message}]`;
                translatedChunks.push(errorText);
                completedChunks++;
                
                showStatus(`⚠️ Часть ${chunkIndex + 1} пропущена из-за ошибки`, "error");
              }
              
              // Обновляем результат после каждой части
              const currentResult = translatedChunks.join(' ');
              elements.outputText.value = currentResult;
              applyTextDirection(elements.outputText, currentResult);
            }
          }
        }
        
        // Финальная проверка актуальности
        if (thisTranslationId !== currentTranslationId) return;
        
        const finalResult = translatedChunks.join(' ');
        elements.outputText.value = finalResult;
        applyTextDirection(elements.outputText, finalResult);
        
        // Подробная статистика завершения
        const successfulChunks = totalChunks - totalErrors;
        const originalLength = text.length;
        const translatedLength = finalResult.length;
        
        console.log(`🎉 ПЕРЕВОД ЗАВЕРШЕН!`);
        console.log(`📊 Статистика:`);
        console.log(`   - Исходный текст: ${originalLength.toLocaleString()} символов`);
        console.log(`   - Переведенный текст: ${translatedLength.toLocaleString()} символов`);
        console.log(`   - Обработано частей: ${totalChunks}`);
        console.log(`   - Успешно: ${successfulChunks}`);
        console.log(`   - Ошибок: ${totalErrors}`);
        
        if (totalErrors === 0) {
          showCompletionStatus(`🎉 Перевод завершен идеально! ${originalLength.toLocaleString()} символов, ${totalChunks} частей`);
        } else if (successfulChunks > totalErrors) {
          showCompletionStatus(`✅ Перевод завершен с частичными ошибками: ${successfulChunks}/${totalChunks} частей переведено`);
        } else {
          showStatus(`⚠️ Перевод завершен с множественными ошибками: ${totalErrors} из ${totalChunks} частей`, "error");
        }

        // Add to history (для больших текстов сохраняем только первые 1000 символов)
        const historyText = text.length > 1000 ? text.substring(0, 1000) + '...' : text;
        const historyResult = finalResult.length > 1000 ? finalResult.substring(0, 1000) + '...' : finalResult;
        addToHistory(historyText, historyResult, sourceLang, targetLang);
      }

    } catch (error) {
      // Проверяем актуальность перевода
      if (thisTranslationId !== currentTranslationId) return;
      
      console.error("🚫 КРИТИЧЕСКАЯ ОШИБКА ПЕРЕВОДА:", error);
      let errorMessage = `❌ Критическая ошибка: ${error.message}`;
      
      if (error instanceof TypeError) {
        errorMessage = "🌐 Ошибка сети: Не удалось выполнить запрос. Проверьте интернет-соединение.";
        console.error("🌐 Проблема с сетевым подключением");
      } else if (error.message.includes("AbortError")) {
        errorMessage = "⏱️ Превышено время ожидания. Попробуйте разделить текст на меньшие части.";
        console.error("⏱️ Таймаут операции");
      }
      
      showStatus(errorMessage, "error", true);
      elements.outputText.value = "";
      
      console.log("📋 Рекомендации:");
      console.log("   - Проверьте интернет-соединение");
      console.log("   - Попробуйте меньший объем текста");
      console.log("   - Проверьте настройки API");
      
    } finally {
      // Проверяем актуальность перед завершением
      if (thisTranslationId === currentTranslationId) {
        isTranslating = false;
        setLoading(false);
        console.log("🔄 Перевод завершен, ресурсы освобождены");
      }
    }
  }

  // Auto-translate with debounce
  /**
   * Auto-translation Functions
   */

  /**
   * Schedules auto-translation with debounce
   */
  function scheduleAutoTranslate() {
    if (!elements.autoTranslateToggle.checked) return;

    clearTimeout(translateTimeout);
    const delay = parseInt(elements.delayInput.value) || CONFIG.DEFAULT_DELAY;

    translateTimeout = setTimeout(() => {
      translateText(true);
    }, delay);
  }

  /**
   * UI State Management Functions
   */

  /**
   * Sets loading state for the app
   * @param {boolean} isLoading - Whether app is in loading state
   */
  function setLoading(isLoading) {
    elements.loadingSpinner.classList.toggle("hidden", !isLoading);
  }

  /**
   * Language Management Functions
   */

  /**
   * Swaps source and target languages
   */
  function swapLanguages() {
    const source = elements.sourceLangSelect.value;
    const target = elements.targetLangSelect.value;

    // Don't swap if source is auto-detect
    if (source === "AUTO") {
      return;
    }

    elements.sourceLangSelect.value = target;
    elements.targetLangSelect.value = source;

    const inputTextValue = elements.inputText.value;
    elements.inputText.value = elements.outputText.value;
    elements.outputText.value = inputTextValue;

    // Apply text direction after swapping
    applyTextDirection(elements.inputText, elements.inputText.value);
    applyTextDirection(elements.outputText, elements.outputText.value);

    showStatus("", "success");
  }

  /**
   * Updates swap button state based on source language selection
   */
  function updateSwapButtonState() {
    const isAutoDetect = elements.sourceLangSelect.value === "AUTO";
    elements.swapButton.disabled = isAutoDetect;

    if (isAutoDetect) {
      elements.swapButton.classList.add("opacity-50", "cursor-not-allowed");
      elements.swapButton.classList.remove("hover:bg-gray-600");
      elements.swapButton.title = "Cannot swap when using Auto Detect";
    } else {
      elements.swapButton.classList.remove("opacity-50", "cursor-not-allowed");
      elements.swapButton.classList.add("hover:bg-gray-600");
      elements.swapButton.title = "Swap languages";
    }
  }

  /**
   * Clipboard and UI Interaction Functions
   */

  /**
   * Copies translation result to clipboard with visual feedback
   */
  function copyToClipboard() {
    if (!elements.outputText.value) {
      showStatus("No content to copy.");
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = elements.outputText.value;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      showStatus("Copied to clipboard!", "success");

      // Add pulse animation to copy button
      elements.copyButton.classList.add("copy-success");
      setTimeout(() => {
        elements.copyButton.classList.remove("copy-success");
      }, 300);
    } catch (err) {
      showStatus("Copy failed.");
      console.error("Copy failed:", err);
    }
    document.body.removeChild(textarea);
  }

  /**
   * Panel Management Functions
   */

  /**
   * Shows the history panel
   */
  function showHistoryPanel() {
    elements.historyPanel.classList.remove("hidden");
    updateHistoryDisplay();
  }

  /**
   * Hides the history panel
   */
  function hideHistoryPanel() {
    elements.historyPanel.classList.add("hidden");
  }

  /**
   * Shows the settings panel
   */
  function showSettingsPanel() {
    elements.settingsPanel.classList.remove("hidden");
  }

  /**
   * Hides the settings panel
   */
  function hideSettingsPanel() {
    elements.settingsPanel.classList.add("hidden");
  }

  /**
   * Clears all translation history after confirmation
   */
  function clearHistory() {
    if (confirm("Are you sure you want to clear all translation history?")) {
      translationHistory = [];
      saveHistory();
      updateHistoryDisplay();
      showStatus("History cleared.", "success");
    }
  }

  /**
   * Animation and Visual Feedback Functions
   */

  /**
   * Adds visual feedback for successful operations
   * @param {HTMLElement} element - Element to animate
   */
  function addSuccessFeedback(element) {
    element.style.transform = "scale(1.05)";
    element.style.transition = "transform 0.2s ease";
    setTimeout(() => {
      element.style.transform = "scale(1)";
    }, 200);
  }

  /**
   * Enhanced swap function with animation
   */
  function swapLanguagesWithAnimation() {
    addSuccessFeedback(elements.swapButton);
    swapLanguages();
  }

  // Initialize
  /**
   * App Initialization
   */

  // Initialize core app components
  populateLanguages();
  setupSettings();
  loadHistory();
  updateCharCount(); // Initialize character counter
  updateSwapButtonState(); // Initialize swap button state
  lucide.createIcons(); // Initialize Lucide icons

  // Initial auto-translate if there's existing text
  if (elements.inputText.value.trim()) {
    scheduleAutoTranslate();
  }

  /**
   * Event Listeners Setup
   */

  // Button event listeners
  elements.swapButton.addEventListener("click", swapLanguagesWithAnimation);
  elements.copyButton.addEventListener("click", copyToClipboard);
  elements.historyButton.addEventListener("click", showHistoryPanel);
  elements.settingsButton.addEventListener("click", showSettingsPanel);
  elements.closeHistoryButton.addEventListener("click", hideHistoryPanel);
  elements.closeSettingsButton.addEventListener("click", hideSettingsPanel);
  elements.clearHistoryButton.addEventListener("click", clearHistory);

  // Auto-translate triggers
  elements.inputText.addEventListener("input", () => {
    updateCharCount();
    scheduleAutoTranslate();
  });
  elements.sourceLangSelect.addEventListener("change", () => {
    updateSwapButtonState();
    scheduleAutoTranslate();
    // Save source language selection
    localStorage.setItem("deeplxSourceLang", elements.sourceLangSelect.value);
  });
  elements.targetLangSelect.addEventListener("change", () => {
    scheduleAutoTranslate();
    // Save target language selection
    localStorage.setItem("deeplxTargetLang", elements.targetLangSelect.value);
  });

  // Panel management - close when clicking outside
  elements.historyPanel.addEventListener("click", (e) => {
    if (e.target === elements.historyPanel) {
      hideHistoryPanel();
    }
  });

  elements.settingsPanel.addEventListener("click", (e) => {
    if (e.target === elements.settingsPanel) {
      hideSettingsPanel();
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      translateText();
    }
    if (e.key === "Escape") {
      hideHistoryPanel();
      hideSettingsPanel();
    }
  });
});
