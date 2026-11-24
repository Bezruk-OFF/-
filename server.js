const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const QRCode = require("qrcode");
const cookieParser = require("cookie-parser");
const cron = require("node-cron");
const archiver = require("archiver");
const ejs = require("ejs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const config = require("./config");
const { convertToWebP } = require("./utils/imageConverter");
const { renderIndex } = require("./utils/renderer");
const { slugify } = require("./utils/slugify");

const app = express();

// ============ MIDDLEWARE ============
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

// Функция проверки бота
function isBot(req) {
	const ua = (req.headers["user-agent"] || "").toLowerCase();
	return /bot|crawler|spider|google|yandex|bing|mail|slurp|duckduck/i.test(ua);
}

// ============ УТИЛИТЫ ============
const DATA_PATH = path.join(__dirname, config.paths.data, "database.json");

// Читать базу данных
function readDB() {
	return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

// Сохранить базу данных
function saveDB(data) {
	fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

// Безопасное удаление файла (не вызывает ошибку если файла нет)
function safeDeleteFile(relativePath) {
	if (!relativePath) return;
	const fullPath = path.join(__dirname, "public", relativePath);
	if (fs.existsSync(fullPath)) {
		fs.unlinkSync(fullPath);
	}
}

// Получить абсолютный путь из относительного
function getFullPath(relativePath) {
	return path.join(__dirname, "public", relativePath);
}

// Проверка авторизации
function checkAuth(req) {
	return req.cookies && req.cookies.admin_session === "authenticated";
}

// Создание папок при запуске
function ensureDirs() {
	const dirs = [
		config.paths.data,
		config.paths.uploads,
		path.join(config.paths.uploads, "desserts"),
		path.join(config.paths.uploads, "portfolio"),
		path.join(config.paths.uploads, "reviews"),
		path.join(config.paths.uploads, "about"),
		path.join(config.paths.uploads, "logo"),
		config.paths.qr,
		config.paths.backups,
		"public/admin",
	];
	dirs.forEach((dir) => {
		const fullPath = path.join(__dirname, dir);
		if (!fs.existsSync(fullPath)) {
			fs.mkdirSync(fullPath, { recursive: true });
		}
	});
}

ensureDirs();

// ============ AUTH ============
// POST /api/login
app.post("/api/login", (req, res) => {
	const { password } = req.body;
	if (password === config.adminPassword) {
		res.cookie("admin_session", "authenticated", {
			httpOnly: true,
			maxAge: 24 * 60 * 60 * 1000,
		});
		res.json({ success: true });
	} else {
		res.status(401).json({ success: false, error: "Неверный пароль" });
	}
});

// POST /api/logout
app.post("/api/logout", (req, res) => {
	res.clearCookie("admin_session");
	res.json({ success: true });
});

// GET /api/check-auth
app.get("/api/check-auth", (req, res) => {
	res.json({ authenticated: checkAuth(req) });
});

// ============ PUBLIC DATA ============
// GET /api/data
app.get("/api/data", (req, res) => {
	const db = readDB();

	// Фильтрация архивных элементов
	const data = {
		...db,
		catalog: db.catalog.map((cat) => ({
			...cat,
			desserts: cat.desserts.filter((d) => !d.isArchived),
		})),
		portfolio: {
			...db.portfolio,
			categories: db.portfolio.categories
				.filter((c) => c.isVisible !== false && !c.isArchived)
				.sort((a, b) => a.order - b.order),
		},
		isPreview: false,
	};

	res.json(data);
});

// ============ ADMIN DATA ============
// GET /api/admin/data
app.get("/api/admin/data", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}
	res.json(readDB());
});

// ============ ADMIN UPDATE ENDPOINTS ============
// Generic update handler
function createUpdateHandler(key) {
	return (req, res) => {
		if (!checkAuth(req)) {
			return res.status(401).json({ error: "Не авторизован" });
		}
		const db = readDB();
		db[key] = req.body;
		saveDB(db);
		renderIndex(db)
			.then(() => {
				res.json({ success: true, [key]: db[key] });
			})
			.catch((err) => {
				res.status(500).json({ error: err.message });
			});
	};
}

app.put("/api/admin/settings", createUpdateHandler("settings"));
app.put("/api/admin/hero", createUpdateHandler("hero"));
app.put("/api/admin/about", createUpdateHandler("about"));

app.put("/api/admin/about-settings", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}
	const db = readDB();
	db.aboutTitle = req.body.aboutTitle || "Обо мне";
	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true, aboutTitle: db.aboutTitle });
	});
});

// Unified section titles API
app.put("/api/admin/section-titles", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}
	const db = readDB();
	const {
		catalogTitle,
		promoTitle,
		portfolioTitle,
		faqTitle,
		reviewsTitle,
		aboutTitle,
	} = req.body;

	if (catalogTitle !== undefined) db.catalogTitle = catalogTitle;
	if (promoTitle !== undefined) db.promoTitle = promoTitle;
	if (portfolioTitle !== undefined) {
		db.portfolioTitle = portfolioTitle;
		if (db.portfolio) db.portfolio.title = portfolioTitle;
	}
	if (faqTitle !== undefined) db.faqTitle = faqTitle;
	if (reviewsTitle !== undefined) db.reviewsTitle = reviewsTitle;
	if (aboutTitle !== undefined) db.aboutTitle = aboutTitle;

	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true });
	});
});

app.put("/api/admin/promo", createUpdateHandler("promo"));
app.put("/api/admin/faq", createUpdateHandler("faq"));

app.put("/api/admin/faq-settings", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}
	const db = readDB();
	db.faqTitle = req.body.faqTitle || "Частые вопросы";
	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true, faqTitle: db.faqTitle });
	});
});

app.put("/api/admin/reviews", createUpdateHandler("reviews"));

app.put("/api/admin/reviews-settings", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}
	const db = readDB();
	db.reviewsTitle = req.body.reviewsTitle || "Отзывы";
	db.reviewsVisible = req.body.reviewsVisible !== false;
	saveDB(db);
	renderIndex(db).then(() => {
		res.json({
			success: true,
			reviewsTitle: db.reviewsTitle,
			reviewsVisible: db.reviewsVisible,
		});
	});
});

app.put("/api/admin/catalog", createUpdateHandler("catalog"));
app.put("/api/admin/portfolio", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}
	const db = readDB();
	db.portfolio = req.body;
	// Синхронизируем portfolioTitle с portfolio.title
	if (db.portfolio && db.portfolio.title) {
		db.portfolioTitle = db.portfolio.title;
	}
	saveDB(db);
	renderIndex(db)
		.then(() => {
			res.json({ success: true, portfolio: db.portfolio });
		})
		.catch((err) => {
			res.status(500).json({ error: err.message });
		});
});
app.put("/api/admin/sections", createUpdateHandler("sections"));

app.put("/api/admin/color-preset", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}
	const db = readDB();
	const { presetName, colors } = req.body;

	if (presetName) {
		const preset = db.settings.colorPresets.find((p) => p.name === presetName);
		if (preset) {
			db.settings.colorScheme = { ...preset.colors };
		}
	} else if (colors) {
		db.settings.colorScheme = { ...colors };
	}

	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true, colorScheme: db.settings.colorScheme });
	});
});

// ============ UPLOADS ============
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: config.uploadLimits.fileSize },
});

const validFolders = ["desserts", "portfolio", "reviews", "about", "logo"];

// POST /api/admin/upload
app.post("/api/admin/upload", upload.single("file"), async (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const folder = req.body.folder;
	if (!validFolders.includes(folder)) {
		return res.status(400).json({ error: "Неверная папка" });
	}

	if (!req.file) {
		return res.status(400).json({ error: "Файл не загружен" });
	}

	// Проверяем и удаляем старый файл если есть
	const oldPath = req.body.oldPath;
	if (oldPath) {
		safeDeleteFile(oldPath);
	}

	const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
	const outputPath = path.join(
		__dirname,
		config.paths.uploads,
		folder,
		filename,
	);

	try {
		await sharp(req.file.buffer)
			.resize(2000, null, { withoutEnlargement: true, fit: "inside" })
			.webp({ quality: 85, effort: 4 })
			.toFile(outputPath);

		res.json({ url: `/img/uploads/${folder}/${filename}` });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /api/admin/upload-qr
app.post("/api/admin/upload-qr", upload.single("file"), async (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const type = req.body.type;
	if (!type || !["telegram", "max"].includes(type)) {
		return res.status(400).json({ error: "Неверный тип QR" });
	}

	if (!req.file) {
		return res.status(400).json({ error: "Файл не загружен" });
	}

	const ext =
		path.extname(req.file.originalname).toLowerCase() === ".png"
			? ".png"
			: ".webp";
	const filename = `${type}-qr${ext}`;
	const outputPath = path.join(__dirname, config.paths.qr, filename);

	try {
		if (ext === ".png") {
			fs.writeFileSync(outputPath, req.file.buffer);
		} else {
			await sharp(req.file.buffer)
				.resize(500, 500, { fit: "inside" })
				.webp({ quality: 90 })
				.toFile(outputPath);
		}

		res.json({ url: `/img/qr/${filename}` });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ============ DELETE ENDPOINTS ============
// DELETE /api/admin/file
app.delete("/api/admin/file", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const { path: filePath } = req.body;
	if (!filePath) {
		return res.status(400).json({ error: "Путь не указан" });
	}

	const fullPath = path.join(__dirname, "public", filePath);
	if (fs.existsSync(fullPath)) {
		fs.unlinkSync(fullPath);
	}

	// Удалить ссылки из базы
	const db = readDB();
	const removeRefs = (obj, prefix = "") => {
		if (typeof obj !== "object" || obj === null) return;
		for (const key of Object.keys(obj)) {
			const value = obj[key];
			if (typeof value === "string" && value.includes(filePath)) {
				obj[key] = "";
			} else if (Array.isArray(value)) {
				value.forEach((item) => removeRefs(item, `${prefix}.${key}`));
			} else if (typeof value === "object") {
				removeRefs(value, `${prefix}.${key}`);
			}
		}
	};
	removeRefs(db);
	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true });
	});
});

// DELETE /api/admin/desserts/:id
app.delete("/api/admin/desserts/:id", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const db = readDB();
	const dessertId = req.params.id;

	// Найти и удалить фото
	db.catalog.forEach((cat) => {
		const dessert = cat.desserts.find((d) => d.id === dessertId);
		if (dessert) {
			[dessert.image, ...dessert.photos].forEach((img) => {
				if (img) {
					const fullPath = path.join(__dirname, "public", img);
					if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
				}
			});
		}
		cat.desserts = cat.desserts.filter((d) => d.id !== dessertId);
	});

	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true });
	});
});

// DELETE /api/admin/desserts/:id/photos/:photoIndex
app.delete("/api/admin/desserts/:id/photos/:photoIndex", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const db = readDB();
	const dessertId = req.params.id;
	const photoIndex = parseInt(req.params.photoIndex);

	db.catalog.forEach((cat) => {
		const dessert = cat.desserts.find((d) => d.id === dessertId);
		if (dessert && dessert.photos[photoIndex]) {
			const fullPath = path.join(
				__dirname,
				"public",
				dessert.photos[photoIndex],
			);
			if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
			dessert.photos.splice(photoIndex, 1);
		}
	});

	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true });
	});
});

// DELETE /api/admin/portfolio/:catId
app.delete("/api/admin/portfolio/:catId", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const db = readDB();
	const catId = req.params.catId;

	db.portfolio.categories = db.portfolio.categories.filter(
		(c) => c.id !== catId,
	);

	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true });
	});
});

// DELETE /api/admin/reviews/:id
app.delete("/api/admin/reviews/:id", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const db = readDB();
	db.reviews = db.reviews.filter((r) => r.id !== req.params.id);

	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true });
	});
});

// DELETE /api/settings/logo-image
app.delete("/api/settings/logo-image", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const db = readDB();
	if (db.settings.logoImage) {
		safeDeleteFile(db.settings.logoImage);
		db.settings.logoImage = "";
	}

	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true });
	});
});

// DELETE /api/settings/about-photo
app.delete("/api/settings/about-photo", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const db = readDB();
	if (db.about.photo) {
		safeDeleteFile(db.about.photo);
		db.about.photo = "";
	}

	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true });
	});
});

// DELETE /api/admin/settings/qr/:type
app.delete("/api/admin/settings/qr/:type", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const db = readDB();
	const type = req.params.type;

	// Удаляем QR файл
	safeDeleteFile(`/img/qr/${type}-qr.webp`);
	safeDeleteFile(`/img/qr/${type}-qr.png`);

	// Удаляем ссылки из социальных сетей
	if (db.settings.socialLinks && db.settings.socialLinks[type]) {
		db.settings.socialLinks[type] = "";
	}

	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true });
	});
});

// ============ REORDER & BULK ============
// POST /api/desserts/reorder
app.post("/api/desserts/reorder", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const db = readDB();
	const { categoryId, orderedIds } = req.body;

	db.catalog.forEach((cat) => {
		if (cat.id === categoryId) {
			orderedIds.forEach((id, index) => {
				const dessert = cat.desserts.find((d) => d.id === id);
				if (dessert) dessert.order = index;
			});
		}
	});

	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true });
	});
});

// POST /api/desserts/bulk-update
app.post("/api/desserts/bulk-update", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const db = readDB();
	const { ids, action } = req.body;

	db.catalog.forEach((cat) => {
		cat.desserts.forEach((dessert) => {
			if (ids.includes(dessert.id)) {
				switch (action) {
					case "archive":
						dessert.isArchived = true;
						break;
					case "unarchive":
						dessert.isArchived = false;
						break;
					case "hide":
						dessert.isAvailable = false;
						break;
					case "show":
						dessert.isAvailable = true;
						break;
				}
			}
		});
	});

	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true });
	});
});

// POST /api/portfolio/categories/reorder
app.post("/api/portfolio/categories/reorder", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const db = readDB();
	const { orderedIds } = req.body;

	orderedIds.forEach((id, index) => {
		const cat = db.portfolio.categories.find((c) => c.id === id);
		if (cat) cat.order = index;
	});

	saveDB(db);
	renderIndex(db).then(() => {
		res.json({ success: true });
	});
});

// ============ ANALYTICS ============
// Helper: get today
function getToday() {
	return new Date().toISOString().split("T")[0];
}

// POST /api/stats/dessert/:id/view
app.post("/api/stats/dessert/:id/view", (req, res) => {
	if (isBot(req)) return res.json({});

	const db = readDB();
	const id = req.params.id;

	if (!db.stats.desserts[id]) {
		db.stats.desserts[id] = { views: 0, dailyViews: {} };
	}
	db.stats.desserts[id].views++;
	db.stats.desserts[id].dailyViews[getToday()] =
		(db.stats.desserts[id].dailyViews[getToday()] || 0) + 1;

	saveDB(db);
	res.json({});
});

// POST /api/stats/click
app.post("/api/stats/click", (req, res) => {
	if (isBot(req)) return res.json({});

	const db = readDB();
	const { type, target } = req.body;
	const today = getToday();

	if (type === "chat" && target) {
		db.stats.clicks.chat.total[target]++;
		db.stats.clicks.chat.daily[today] = db.stats.clicks.chat.daily[today] || {};
		db.stats.clicks.chat.daily[today][target] =
			(db.stats.clicks.chat.daily[today][target] || 0) + 1;
	} else if (type === "channel" && target) {
		db.stats.clicks.channel.total[target]++;
		db.stats.clicks.channel.daily[today] =
			db.stats.clicks.channel.daily[today] || {};
		db.stats.clicks.channel.daily[today][target] =
			(db.stats.clicks.channel.daily[today][target] || 0) + 1;
	} else if (type === "phone" && target) {
		db.stats.clicks.phone.total[target]++;
		db.stats.clicks.phone.daily[today] =
			db.stats.clicks.phone.daily[today] || {};
		db.stats.clicks.phone.daily[today][target] =
			(db.stats.clicks.phone.daily[today][target] || 0) + 1;
	}

	saveDB(db);
	res.json({});
});

// POST /api/stats/portfolio/:id/view
app.post("/api/stats/portfolio/:id/view", (req, res) => {
	if (isBot(req)) return res.json({});

	const db = readDB();
	const today = getToday();

	db.stats.portfolioViews.total++;
	db.stats.portfolioViews.daily[today] =
		(db.stats.portfolioViews.daily[today] || 0) + 1;

	saveDB(db);
	res.json({});
});

// POST /api/stats/reviews/view
app.post("/api/stats/reviews/view", (req, res) => {
	if (isBot(req)) return res.json({});

	const db = readDB();
	const today = getToday();

	db.stats.reviewsViews.total++;
	db.stats.reviewsViews.daily[today] =
		(db.stats.reviewsViews.daily[today] || 0) + 1;

	saveDB(db);
	res.json({});
});

// POST /api/stats/catalog-view
app.post("/api/stats/catalog-view", (req, res) => {
	if (isBot(req)) return res.json({});

	const db = readDB();
	const today = getToday();

	db.stats.funnel.catalogViews.total++;
	db.stats.funnel.catalogViews.daily[today] =
		(db.stats.funnel.catalogViews.daily[today] || 0) + 1;

	saveDB(db);
	res.json({});
});

// POST /api/stats/order-click
app.post("/api/stats/order-click", (req, res) => {
	if (isBot(req)) return res.json({});

	const db = readDB();
	const today = getToday();

	db.stats.funnel.orderClicks.total++;
	db.stats.funnel.orderClicks.daily[today] =
		(db.stats.funnel.orderClicks.daily[today] || 0) + 1;

	saveDB(db);
	res.json({});
});

// POST /api/stats/promo-click
app.post("/api/stats/promo-click", (req, res) => {
	if (isBot(req)) return res.json({});

	const db = readDB();
	const today = getToday();

	db.stats.promoClicks.total++;
	db.stats.promoClicks.daily[today] =
		(db.stats.promoClicks.daily[today] || 0) + 1;

	saveDB(db);
	res.json({});
});

// POST /api/stats/faq-click
app.post("/api/stats/faq-click", (req, res) => {
	if (isBot(req)) return res.json({});

	const db = readDB();
	const { questionId } = req.body;
	const today = getToday();

	if (questionId) {
		db.stats.faqClicks.items[questionId] =
			(db.stats.faqClicks.items[questionId] || 0) + 1;
		db.stats.faqClicks.daily[today] = db.stats.faqClicks.daily[today] || {};
		db.stats.faqClicks.daily[today][questionId] =
			(db.stats.faqClicks.daily[today][questionId] || 0) + 1;
	}

	saveDB(db);
	res.json({});
});

// POST /api/stats/quality-visit
app.post("/api/stats/quality-visit", (req, res) => {
	const db = readDB();
	const ua = (req.headers["user-agent"] || "").toLowerCase();
	const today = getToday();

	let device = "desktop";
	if (/iphone|ipad|android/.test(ua)) {
		device = /iphone|ipad/.test(ua) ? "ios" : "android";
	}

	db.visits.byDay[today] = db.visits.byDay[today] || {};
	db.visits.byDay[today][device] = (db.visits.byDay[today][device] || 0) + 1;

	const referer = req.body.referer || "direct";
	db.visits.byReferer[referer] = (db.visits.byReferer[referer] || 0) + 1;

	// Calculate mobile percentage
	const total = Object.values(db.visits.byDay[today]).reduce(
		(a, b) => a + b,
		0,
	);
	const mobile =
		(db.visits.byDay[today].ios || 0) + (db.visits.byDay[today].android || 0);
	db.visits.mobilePercentage =
		total > 0 ? Math.round((mobile / total) * 100) : 0;

	saveDB(db);
	res.json({});
});

// GET /api/admin/stats
app.get("/api/admin/stats", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const db = readDB();
	res.json({ stats: db.stats, visits: db.visits });
});

// Public stats endpoints
app.get("/api/stats/clicks", (req, res) => {
	const db = readDB();
	res.json(db.stats.clicks);
});

app.get("/api/stats/phone-clicks", (req, res) => {
	const db = readDB();
	res.json(db.stats.clicks.phone);
});

app.get("/api/stats/visits", (req, res) => {
	const db = readDB();
	res.json(db.visits);
});

app.get("/api/stats/desserts", (req, res) => {
	const db = readDB();
	res.json(db.stats.desserts);
});

app.get("/api/stats/portfolio", (req, res) => {
	const db = readDB();
	res.json(db.stats.portfolioViews);
});

app.get("/api/stats/reviews", (req, res) => {
	const db = readDB();
	res.json(db.stats.reviewsViews);
});

app.get("/api/stats/faq-clicks", (req, res) => {
	const db = readDB();
	res.json(db.stats.faqClicks);
});

app.get("/api/stats/promo-clicks", (req, res) => {
	const db = readDB();
	res.json(db.stats.promoClicks);
});

app.get("/api/stats/funnel", (req, res) => {
	const db = readDB();
	res.json(db.stats.funnel);
});

// GET /api/analytics/export
app.get("/api/analytics/export", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const db = readDB();

	// Generate CSV
	let csv =
		"Date,Catalog Views,Order Clicks,Promo Clicks,Portfolio Views,Reviews Views\n";

	const dates = new Set([
		...Object.keys(db.stats.funnel.catalogViews.daily || {}),
		...Object.keys(db.stats.funnel.orderClicks.daily || {}),
		...Object.keys(db.stats.promoClicks.daily || {}),
		...Object.keys(db.stats.portfolioViews.daily || {}),
		...Object.keys(db.stats.reviewsViews.daily || {}),
	]);

	[...dates].sort().forEach((date) => {
		csv += `${date},`;
		csv += `${db.stats.funnel.catalogViews.daily[date] || 0},`;
		csv += `${db.stats.funnel.orderClicks.daily[date] || 0},`;
		csv += `${db.stats.promoClicks.daily[date] || 0},`;
		csv += `${db.stats.portfolioViews.daily[date] || 0},`;
		csv += `${db.stats.reviewsViews.daily[date] || 0}\n`;
	});

	res.setHeader("Content-Type", "text/csv");
	res.setHeader("Content-Disposition", "attachment; filename=analytics.csv");
	res.send(csv);
});

// POST /api/stats/reset
app.post("/api/stats/reset", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const db = readDB();
	db.stats = {
		clicks: {
			chat: { total: { whatsapp: 0, telegram: 0, max: 0 }, daily: {} },
			channel: { total: { telegram: 0, max: 0 }, daily: {} },
			phone: { total: { popover: 0, footer: 0 }, daily: {} },
		},
		portfolioViews: { total: 0, daily: {} },
		reviewsViews: { total: 0, daily: {} },
		funnel: {
			catalogViews: { total: 0, daily: {} },
			orderClicks: { total: 0, daily: {} },
		},
		promoClicks: { total: 0, daily: {} },
		faqClicks: { items: {}, daily: {} },
		desserts: {},
	};
	db.visits = { byDay: {}, byReferer: {}, mobilePercentage: 0 };

	saveDB(db);
	res.json({ success: true });
});

// ============ BACKUPS ============
// GET /api/backup/list
app.get("/api/backup/list", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const backupsPath = path.join(__dirname, config.paths.backups);
	if (!fs.existsSync(backupsPath)) {
		return res.json([]);
	}

	const files = fs
		.readdirSync(backupsPath)
		.filter((f) => f.endsWith(".zip"))
		.map((f) => ({
			name: f,
			size: fs.statSync(path.join(backupsPath, f)).size,
			date: fs.statSync(path.join(backupsPath, f)).mtime.toISOString(),
		}))
		.sort((a, b) => new Date(b.date) - new Date(a.date));

	res.json(files);
});

// Create backup function
async function createBackup() {
	const backupsPath = path.join(__dirname, config.paths.backups);
	const filename = `backup-${new Date().toISOString().split("T")[0]}-${Date.now()}.zip`;
	const outputPath = path.join(backupsPath, filename);

	return new Promise((resolve, reject) => {
		const output = fs.createWriteStream(outputPath);
		const archive = archiver("zip", { zlib: { level: 9 } });

		output.on("close", async () => {
			// Ротация: оставляем только 4 последних бэкапа
			await rotateBackups();
			resolve(filename);
		});
		archive.on("error", reject);

		archive.pipe(output);
		archive.file(DATA_PATH, { name: "database.json" });
		archive.directory(path.join(__dirname, config.paths.uploads), "uploads");
		archive.directory(path.join(__dirname, config.paths.qr), "qr");
		archive.finalize();
	});
}

// Ротация бэкапов - оставляем максимум MAX_BACKUPS
const MAX_BACKUPS = 4;

async function rotateBackups() {
	const backupsPath = path.join(__dirname, config.paths.backups);
	if (!fs.existsSync(backupsPath)) return;

	const files = fs
		.readdirSync(backupsPath)
		.filter((f) => f.endsWith(".zip"))
		.map((f) => ({
			name: f,
			path: path.join(backupsPath, f),
			mtime: fs.statSync(path.join(backupsPath, f)).mtime,
		}))
		.sort((a, b) => b.mtime - a.mtime); // От новых к старым

	// Удаляем старые, если больше MAX_BACKUPS
	if (files.length > MAX_BACKUPS) {
		const toDelete = files.slice(MAX_BACKUPS);
		for (const file of toDelete) {
			try {
				fs.unlinkSync(file.path);
				console.log(`Удалён старый бэкап: ${file.name}`);
			} catch (err) {
				console.error(`Ошибка удаления бэкапа ${file.name}:`, err);
			}
		}
	}
}

// POST /api/backup/create
app.post("/api/backup/create", async (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	try {
		const filename = await createBackup();
		res.json({ success: true, filename });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/backup/download/:filename
app.get("/api/backup/download/:filename", (req, res) => {
	if (!checkAuth(req)) {
		return res.status(401).json({ error: "Не авторизован" });
	}

	const filename = req.params.filename;
	const filePath = path.join(__dirname, config.paths.backups, filename);

	if (!fs.existsSync(filePath)) {
		return res.status(404).json({ error: "Файл не найден" });
	}

	res.download(filePath, filename);
});

// ============ SEO ============
// GET /robots.txt
app.get("/robots.txt", (req, res) => {
	res.type("text/plain");
	res.send("User-agent: *\nAllow: /");
});

// GET /sitemap.xml
app.get("/sitemap.xml", (req, res) => {
	const db = readDB();
	const domain = req.protocol + "://" + req.get("host");

	let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
	xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

	// Home page
	xml += `  <url><loc>${domain}/</loc></url>\n`;

	// Desserts
	db.catalog.forEach((cat) => {
		cat.desserts.forEach((dessert) => {
			if (!dessert.isArchived) {
				xml += `  <url><loc>${domain}/catalog/${dessert.slug || dessert.id}</loc></url>\n`;
			}
		});
	});

	xml += "</urlset>";

	res.type("application/xml");
	res.send(xml);
});

// ============ CATALOG ROUTE ============
// GET /catalog/:slug
app.get("/catalog/:slug", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ============ CRON ============
// Еженедельный бэкап каждое воскресенье в 3:00
cron.schedule("0 3 * * 0", async () => {
	try {
		await createBackup();
		console.log("Weekly backup created");
	} catch (err) {
		console.error("Backup error:", err);
	}
});

// Каждый час (для будущих задач)
cron.schedule("0 * * * *", () => {
	// Placeholder for future tasks
});

// ============ START ============
app.listen(config.port, "0.0.0.0", () => {
	console.log(`Server running on http://localhost:${config.port}`);
	console.log(`Admin panel: http://localhost:${config.port}/admin`);

	// Initial render
	const db = readDB();

	// Миграция данных для новых полей
	if (db.catalog) {
		db.catalog.forEach((cat) => {
			// Добавляем isVisible для категорий
			if (cat.isVisible === undefined) {
				cat.isVisible = true;
			}

			// Миграция десертов
			if (cat.desserts) {
				cat.desserts.forEach((dessert) => {
					// Если есть описание, мигрируем в fullDescription
					if (dessert.description && !dessert.fullDescription) {
						dessert.fullDescription = dessert.description;
					}
					// Добавляем недостающие поля
					if (dessert.shortDescription === undefined) {
						dessert.shortDescription = "";
					}
					if (dessert.unit === undefined) {
						dessert.unit = "";
					}
					if (dessert.priceNote === undefined) {
						dessert.priceNote = "";
					}
					if (!Array.isArray(dessert.photos)) {
						dessert.photos = dessert.photos ? [dessert.photos] : [];
					}
					// Если есть image но нет photos, добавляем
					if (dessert.image && !dessert.photos.length) {
						dessert.photos = [dessert.image];
					}
				});
			}
		});
		saveDB(db);
	}

	renderIndex(db).catch((err) => console.error("Initial render error:", err));
});
