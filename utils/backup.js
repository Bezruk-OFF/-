const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

/**
 * Создание резервной копии базы данных и загруженных файлов
 * @param {string} backupDir - Директория для бэкапов
 * @param {string} dataPath - Путь к database.json
 * @param {string} uploadsDir - Директория с загрузками
 * @param {string} qrDir - Директория с QR-кодами
 * @returns {Promise<string>} Имя созданного файла
 */
function createBackup(backupDir, dataPath, uploadsDir, qrDir) {
  return new Promise((resolve, reject) => {
    const filename = `backup-${new Date().toISOString().split('T')[0]}-${Date.now()}.zip`;
    const outputPath = path.join(backupDir, filename);
    
    // Убедимся, что директория существует
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`Backup created: ${filename} (${archive.pointer()} bytes)`);
      resolve(filename);
    });
    
    archive.on('error', (err) => {
      reject(err);
    });
    
    archive.pipe(output);
    
    // Добавляем database.json
    if (fs.existsSync(dataPath)) {
      archive.file(dataPath, { name: 'database.json' });
    }
    
    // Добавляем загрузки
    if (fs.existsSync(uploadsDir)) {
      archive.directory(uploadsDir, 'uploads');
    }
    
    // Добавляем QR-коды
    if (fs.existsSync(qrDir)) {
      archive.directory(qrDir, 'qr');
    }
    
    archive.finalize();
  });
}

module.exports = { createBackup };
