module.exports = {
  port: 3002,
  adminPassword: 'admin123',
  paths: {
    data: './data',
    public: './public',
    uploads: './public/img/uploads',
    qr: './public/img/qr',
    backups: './backups'
  },
  uploadLimits: {
    fileSize: 15 * 1024 * 1024,
    maxFiles: 50
  }
};
