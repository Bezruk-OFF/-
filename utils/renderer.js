const ejs = require("ejs");
const fs = require("fs").promises;
const path = require("path");
const { renderSocialIcon } = require("./socialIcons");

/**
 * Рендерит главную страницу из шаблона
 * @param {Object} data - Данные для рендеринга
 * @returns {Promise<void>}
 */
async function renderIndex(data) {
	const {
		settings,
		hero,
		catalog,
		catalogTitle,
		promo,
		promoTitle,
		portfolio,
		portfolioTitle,
		faq,
		faqTitle,
		reviews,
		reviewsTitle,
		reviewsVisible,
		about,
		aboutTitle,
		sections,
	} = data;

	// Генерация meta-тегов
	const metaTitle = `${settings.siteName} — Домашняя кондитерская`;
	const metaDescription =
		hero.subtitle || settings.about?.text?.substring(0, 160) || "";

	const templateData = {
		settings,
		hero,
		catalog,
		catalogTitle,
		promo,
		promoTitle,
		portfolio,
		portfolioTitle,
		faq,
		faqTitle,
		reviews,
		reviewsTitle,
		reviewsVisible,
		about,
		aboutTitle,
		sections,
		metaTitle,
		metaDescription,
		renderSocialIcon,
	};

	const templatePath = path.join(__dirname, "..", "public", "template.html");
	const outputPath = path.join(__dirname, "..", "public", "index.html");

	const html = await ejs.renderFile(templatePath, templateData);
	await fs.writeFile(outputPath, html, "utf8");
}

module.exports = { renderIndex };
