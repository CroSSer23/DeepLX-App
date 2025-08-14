#!/usr/bin/env node

/**
 * Скрипт проверки готовности проекта к развертыванию на Vercel
 * Проверяет наличие всех необходимых файлов и конфигураций
 * 
 * @author crosser.software
 */

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'package.json',
  'vercel.json',
  'index.html',
  'script.js',
  'styles.css',
  'api/translate.js'
];

const requiredPackages = [
  // Нет обязательных зависимостей - используем встроенный fetch
];

console.log('🔍 Проверка готовности проекта к развертыванию на Vercel...\n');

// Проверяем наличие обязательных файлов
console.log('📁 Проверка файлов:');
let filesOk = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - отсутствует`);
    filesOk = false;
  }
});

// Проверяем package.json
console.log('\n📦 Проверка package.json:');
let packageOk = true;

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (requiredPackages.length > 0) {
    if (packageJson.dependencies) {
      requiredPackages.forEach(pkg => {
        if (packageJson.dependencies[pkg]) {
          console.log(`✅ Зависимость: ${pkg}`);
        } else {
          console.log(`❌ Отсутствует зависимость: ${pkg}`);
          packageOk = false;
        }
      });
    } else {
      console.log('❌ Секция dependencies не найдена');
      packageOk = false;
    }
  } else {
    console.log('✅ Нет обязательных зависимостей - используются встроенные модули');
  }

  if (packageJson.scripts && packageJson.scripts.build) {
    console.log('✅ Скрипт build найден');
  } else {
    console.log('⚠️ Рекомендуется добавить скрипт "build"');
  }

} catch (error) {
  console.log('❌ Ошибка чтения package.json:', error.message);
  packageOk = false;
}

// Проверяем vercel.json
console.log('\n⚙️ Проверка vercel.json:');
let vercelOk = true;

try {
  const vercelJson = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  
  if (vercelJson.functions) {
    console.log('✅ Конфигурация functions найдена');
    
    if (vercelJson.functions['api/translate.js'] && vercelJson.functions['api/translate.js'].runtime) {
      console.log('✅ Runtime Node.js указан');
    } else {
      console.log('⚠️ Runtime не указан, будет использован по умолчанию');
    }
  } else {
    console.log('⚠️ Конфигурация functions не найдена');
  }

  if (vercelJson.headers) {
    console.log('✅ CORS заголовки настроены');
  } else {
    console.log('⚠️ CORS заголовки не настроены');
  }

} catch (error) {
  console.log('❌ Ошибка чтения vercel.json:', error.message);
  vercelOk = false;
}

// Проверяем API функцию
console.log('\n🔧 Проверка API функции:');
let apiOk = true;

try {
  const apiContent = fs.readFileSync('api/translate.js', 'utf8');
  
  if (apiContent.includes('export default')) {
    console.log('✅ Функция экспортируется правильно');
  } else {
    console.log('❌ Отсутствует export default в API функции');
    apiOk = false;
  }

  if (apiContent.includes('Access-Control-Allow-Origin')) {
    console.log('✅ CORS заголовки в API функции');
  } else {
    console.log('⚠️ CORS заголовки не найдены в API функции');
  }

} catch (error) {
  console.log('❌ Ошибка чтения api/translate.js:', error.message);
  apiOk = false;
}

// Финальная проверка
console.log('\n🎯 Результат проверки:');

if (filesOk && packageOk && vercelOk && apiOk) {
  console.log('🎉 Проект готов к развертыванию на Vercel!');
  console.log('\n📝 Следующие шаги:');
  console.log('1. Зайдите на https://vercel.com');
  console.log('2. Подключите ваш GitHub репозиторий');
  console.log('3. Vercel автоматически развернет проект');
  process.exit(0);
} else {
  console.log('⚠️ Найдены проблемы, которые нужно исправить перед развертыванием');
  process.exit(1);
}
