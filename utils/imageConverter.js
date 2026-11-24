const sharp = require('sharp');
const fs = require('fs');

/**
 * Конвертирует изображение в WebP формат
 * @param {string} inputPath - Путь к входному файлу
 * @param {string} outputPath - Путь для сохранения результата
 * @returns {Promise<void>}
 */
async function convertToWebP(inputPath, outputPath) {
  const ext = inputPath.toLowerCase().split('.').pop();
  
  // Если файл уже WebP, просто копируем
  if (ext === 'webp') {
    return fs.promises.copyFile(inputPath, outputPath);
  }
  
  // Конвертация в WebP через Sharp
  await sharp(inputPath)
    .resize(2000, null, {
      withoutEnlargement: true,
      fit: 'inside'
    })
    .webp({
      quality: 85,
      effort: 4
    })
    .toFile(outputPath);
}

module.exports = { convertToWebP };
