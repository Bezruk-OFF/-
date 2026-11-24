# 🍰 Кондитер — Сайт домашнего кондитера

Полноценный сайт-визитка для домашнего кондитера с админ-панелью для управления контентом.

## 🚀 Установка

```bash
npm install
```

## ⚙️ Настройка

Отредактируйте `config.js`:

```javascript
module.exports = {
  port: 3001,                    // Порт сервера
  adminPassword: 'admin123',     // Пароль для админки (смените!)
  paths: {
    data: './data',
    public: './public',
    uploads: './public/img/uploads',
    qr: './public/img/qr',
    backups: './backups'
  },
  uploadLimits: {
    fileSize: 15 * 1024 * 1024,  // 15MB
    maxFiles: 50
  }
};
```

## ▶️ Запуск

```bash
npm start
```

После запуска:
- **Сайт:** http://localhost:3001
- **Админка:** http://localhost:3001/admin (пароль: admin123)

## 📱 Возможности

### Публичная часть
- Адаптивный дизайн (мобильные + десктоп)
- Каталог десертов с категориями
- Портфолио с галереей
- Промо-акции
- FAQ с аккордеоном
- Отзывы клиентов
- Контакты (WhatsApp, Telegram, телефон)
- SEO-оптимизация (robots.txt, sitemap.xml)
- PWA-манифест

### Админ-панель
- **Настройки:** название, контакты, соцсети, цветовая схема
- **Hero:** заголовок, подзаголовок, фон, градиент
- **Каталог:** категории и десерты (добавление/редактирование/удаление)
- **Портфолио:** категории и фото
- **FAQ:** управление вопросами
- **Отзывы:** клиентские отзывы
- **О кондитере:** текст и фото
- **Секции:** порядок отображения на сайте
- **Аналитика:** статистика кликов, просмотров, визитов
- **Бэкапы:** создание и скачивание резервных копий

## 🌐 Деплой на VPS

### 1. Установка PM2

```bash
npm install -g pm2
```

### 2. Запуск с PM2

```bash
pm2 start server.js --name konditer
pm2 save
pm2 startup
```

### 3. Настройка Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 📂 Структура проекта

```
konditer_2/
├── config.js          # Конфигурация
├── server.js          # Express сервер
├── package.json
├── data/
│   └── database.json   # Данные сайта
├── public/
│   ├── index.html     # Скомпилированная страница
│   ├── template.html  # EJS-шаблон
│   ├── style.css
│   ├── script.js
│   ├── site.webmanifest
│   ├── img/
│   │   ├── uploads/   # Загруженные изображения
│   │   └── qr/        # QR-коды
│   └── admin/
│       ├── index.html
│       ├── admin.css
│       └── admin.js
├── utils/
│   ├── imageConverter.js  # Конвертация в WebP
│   ├── renderer.js        # Рендеринг шаблона
│   ├── slugify.js         # Генерация slug
│   └── backup.js          # Резервное копирование
└── backups/           # Папка для бэкапов
```

## 🛠 Технологии

- **Backend:** Node.js, Express
- **Frontend:** HTML5, CSS3, Vanilla JS (SPA)
- **Шаблонизатор:** EJS
- **База данных:** JSON-файл
- **Изображения:** Sharp (WebP конвертация)
- **QR-коды:** qrcode
- **Cron:** node-cron
- **Архивация:** archiver

## 📄 Лицензия

MIT
