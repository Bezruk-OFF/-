/**
 * Админ-панель - JavaScript
 */

(() => {
	// ============ СОСТОЯНИЕ ============
	let isAuthenticated = false;
	let data = null;
	let currentSection = "settings";

	// ============ ИНИЦИАЛИЗАЦИЯ ============
	async function init() {
		await checkAuth();
		initTheme();
		initEventListeners();

		if (isAuthenticated) {
			await loadData();
			showAdmin();
			await renderSection("settings");
		}
	}

	async function checkAuth() {
		try {
			const res = await fetch("/api/check-auth");
			const json = await res.json();
			isAuthenticated = json.authenticated;
		} catch {
			isAuthenticated = false;
		}
	}

	async function loadData() {
		try {
			const res = await fetch("/api/admin/data");
			if (res.status === 401) {
				showLogin();
				return;
			}
			data = await res.json();
		} catch (err) {
			showToast("Ошибка загрузки данных", "error");
		}
	}

	// ============ ТЕМА ============
	function initTheme() {
		const saved = localStorage.getItem("theme") || "light";
		document.documentElement.setAttribute("data-theme", saved);
		updateThemeIcon(saved);
	}

	function toggleTheme() {
		const current = document.documentElement.getAttribute("data-theme");
		const next = current === "dark" ? "light" : "dark";
		document.documentElement.setAttribute("data-theme", next);
		localStorage.setItem("theme", next);
		updateThemeIcon(next);
	}

	function updateThemeIcon(theme) {
		const icon = document.querySelector(".theme-icon");
		if (icon) icon.textContent = theme === "dark" ? "☀️" : "🌙";
	}

	// ============ СОБЫТИЯ ============
	function initEventListeners() {
		// Login
		document
			.getElementById("login-form")
			?.addEventListener("submit", handleLogin);

		// Theme
		document
			.getElementById("theme-toggle")
			?.addEventListener("click", toggleTheme);

		// Menu toggle
		document.getElementById("menu-toggle")?.addEventListener("click", () => {
			document.getElementById("sidebar")?.classList.toggle("open");
		});

		// Navigation
		document.querySelectorAll(".nav-item").forEach((btn) => {
			btn.addEventListener("click", async () => {
				const section = btn.dataset.section;
				document
					.querySelectorAll(".nav-item")
					.forEach((b) => b.classList.remove("active"));
				btn.classList.add("active");
				await renderSection(section);
				document.getElementById("sidebar")?.classList.remove("open");
			});
		});

		document.getElementById("content")?.addEventListener("click", (event) => {
			if (event.target.closest("#about-crop-save")) saveAboutPhotoCrop();
			if (event.target.closest("#about-crop-cancel")) closeAboutPhotoCrop();
		});

		// Logout
		document
			.getElementById("logout-btn")
			?.addEventListener("click", handleLogout);

		// Delegation for forms and buttons
		document
			.getElementById("content")
			?.addEventListener("click", handleDelegatedClick);
		document
			.getElementById("content")
			?.addEventListener("change", handleDelegatedChange);
		document
			.getElementById("content")
			?.addEventListener("submit", handleDelegatedSubmit);
	}

	// ============ АВТОРИЗАЦИЯ ============
	async function handleLogin(e) {
		e.preventDefault();
		const password = document.getElementById("password").value;
		const errorEl = document.getElementById("login-error");

		try {
			const res = await fetch("/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password }),
			});
			const json = await res.json();

			if (json.success) {
				isAuthenticated = true;
				await loadData();
				showAdmin();
				await renderSection("settings");
			} else {
				errorEl.style.display = "block";
			}
		} catch {
			errorEl.style.display = "block";
		}
	}

	async function handleLogout() {
		await fetch("/api/logout", { method: "POST" });
		isAuthenticated = false;
		data = null;
		showLogin();
	}

	function showLogin() {
		document.getElementById("login-screen").style.display = "flex";
		document.getElementById("admin-app").style.display = "none";
	}

	function showAdmin() {
		document.getElementById("login-screen").style.display = "none";
		document.getElementById("admin-app").style.display = "flex";
	}

	// ============ РЕНДЕРИНГ СЕКЦИЙ ============
	async function renderSection(section) {
		currentSection = section;
		const content = document.getElementById("content");
		if (!content) return;

		const templates = {
			settings: renderSettings,
			hero: renderHero,
			catalog: renderCatalog,
			promo: renderPromo,
			portfolio: renderPortfolio,
			faq: renderFAQ,
			reviews: renderReviews,
			about: renderAbout,
			sections: renderSections,
			analytics: renderAnalytics,
			backups: renderBackups,
		};

		const template = templates[section];
		if (template) {
			try {
				// await корректно работает и с синхронными функциями (вернёт строку),
				// и с асинхронными (дождётся Promise)
				const htmlContent = await template();
				content.innerHTML = `<div class="section active"><h2 class="section-title">${getSectionTitle(section)}</h2>${htmlContent}</div>`;

				// Инициализация Sortable после рендера
				if (
					["catalog", "portfolio", "sections", "faq", "reviews", "promo"].includes(
						section,
					)
				) {
					setTimeout(initSortable, 100);
				}
			} catch (err) {
				console.error(`Ошибка при рендеринге секции ${section}:`, err);
				content.innerHTML = `<div class="section active"><h2 class="section-title">${getSectionTitle(section)}</h2><p style="color:var(--danger);padding:20px">Ошибка загрузки раздела: ${err.message}</p></div>`;
			}
		}
	}

	function getSectionTitle(section) {
		const titles = {
			settings: "Настройки",
			hero: "Hero-секция",
			catalog: "Каталог",
			promo: "Промо-акция",
			portfolio: "Портфолио",
			faq: "FAQ",
			reviews: "Отзывы",
			about: "Обо мне",
			sections: "Секции",
			analytics: "Аналитика",
			backups: "Бэкапы",
		};
		return titles[section] || section;
	}

	// ============ SETTINGS ============
	function renderSettings() {
		const s = data?.settings || {};
		const cs = s.colorScheme || {};

		// Получаем чаты и каналы (миграция с socialLinks если нужно)
		const chats = s.chats || {
			whatsapp: s.socialLinks?.whatsapp || "",
			telegram: s.socialLinks?.telegram || "",
			instagram: s.socialLinks?.instagram || "",
			vk: s.socialLinks?.vk || "",
			max: s.socialLinks?.max || "",
			ok: "",
		};
		const channels = s.channels || {
			whatsapp: "",
			telegram: "",
			instagram: "",
			vk: "",
			max: "",
			ok: "",
		};

		return `
      <div class="card">
        <h3 class="card-title">Основная информация</h3>
        <div class="form-row">
          <div class="form-group">
            <label>Название сайта</label>
            <input type="text" name="siteName" value="${s.siteName || ""}">
          </div>
          <div class="form-group">
            <label>Имя кондитера</label>
            <input type="text" name="confectionerName" value="${s.confectionerName || ""}" placeholder="Отображается в поповере контактов">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Текст кнопки заказа</label>
            <input type="text" name="orderButtonText" value="${s.orderButtonText || ""}">
          </div>
          <div class="form-group">
            <label>Текст кнопки связи</label>
            <input type="text" name="contactButtonText" value="${s.contactButtonText || "Связаться с кондитером"}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Телефон</label>
            <input type="text" name="phone" value="${s.contacts?.phone || ""}">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="email" value="${s.contacts?.email || ""}">
          </div>
        </div>
        <div class="form-group form-group-full">
          <label>Адрес</label>
          <input type="text" name="address" value="${s.contacts?.address || ""}">
        </div>
        <div class="form-group form-group-full">
          <label>Информация о доставке</label>
          <input type="text" name="deliveryInfo" value="${s.deliveryInfo || ""}">
        </div>
        <div class="form-group form-group-full">
          <label>Копирайт</label>
          <input type="text" name="copyright" value="${s.copyright || ""}">
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">💬 Чаты (ссылки для общения)</h3>
        <p style="color:var(--text-secondary);margin-bottom:15px;font-size:0.9rem">Личные чаты/аккаунты, куда клиент может написать. Отображаются в футере и поповере.</p>
        <div class="form-row">
          <div class="form-group">
            <label>WhatsApp</label>
            <input type="text" name="chat_whatsapp" value="${chats.whatsapp || ""}" placeholder="https://wa.me/...">
          </div>
          <div class="form-group">
            <label>Telegram</label>
            <input type="text" name="chat_telegram" value="${chats.telegram || ""}" placeholder="https://t.me/...">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Instagram</label>
            <input type="text" name="chat_instagram" value="${chats.instagram || ""}" placeholder="https://instagram.com/...">
          </div>
          <div class="form-group">
            <label>VK</label>
            <input type="text" name="chat_vk" value="${chats.vk || ""}" placeholder="https://vk.com/...">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>MAX</label>
            <input type="text" name="chat_max" value="${chats.max || ""}" placeholder="https://max.ru/...">
          </div>
          <div class="form-group">
            <label>OK</label>
            <input type="text" name="chat_ok" value="${chats.ok || ""}" placeholder="https://ok.ru/...">
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">📢 Каналы (ссылки для подписки)</h3>
        <p style="color:var(--text-secondary);margin-bottom:15px;font-size:0.9rem">Публичные каналы/страницы, на которые клиент может подписаться. Отображаются в блоке «Обо мне».</p>
        <div class="form-row">
          <div class="form-group">
            <label>WhatsApp</label>
            <input type="text" name="channel_whatsapp" value="${channels.whatsapp || ""}" placeholder="https://wa.me/...">
          </div>
          <div class="form-group">
            <label>Telegram</label>
            <input type="text" name="channel_telegram" value="${channels.telegram || ""}" placeholder="https://t.me/...">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Instagram</label>
            <input type="text" name="channel_instagram" value="${channels.instagram || ""}" placeholder="https://instagram.com/...">
          </div>
          <div class="form-group">
            <label>VK</label>
            <input type="text" name="channel_vk" value="${channels.vk || ""}" placeholder="https://vk.com/...">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>MAX</label>
            <input type="text" name="channel_max" value="${channels.max || ""}" placeholder="https://max.ru/...">
          </div>
          <div class="form-group">
            <label>OK</label>
            <input type="text" name="channel_ok" value="${channels.ok || ""}" placeholder="https://ok.ru/...">
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">Логотип</h3>
        <div class="image-upload">
          <img src="${s.logoImage || ""}" class="image-preview" id="logo-preview" alt="Logo">
          <div>
            <input type="hidden" name="logoImage" value="${s.logoImage || ""}">
            <input type="file" id="logo-input" accept="image/*" style="display:none">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('logo-input').click()">Загрузить логотип</button>
            <button type="button" class="btn btn-danger btn-sm" onclick="deleteImage('logoImage', 'logo-preview')">Удалить</button>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">Цветовая схема</h3>
        <div class="color-grid">
          ${(s.colorPresets || [])
						.map(
							(preset) => `
            <div class="color-preset ${cs.primary === preset.colors.primary ? "active" : ""}" 
                 onclick="applyColorPreset('${preset.name}')">
              <strong>${preset.name}</strong>
              <div class="color-preview">
                <div class="color-dot" style="background:${preset.colors.primary}"></div>
                <div class="color-dot" style="background:${preset.colors.bg}"></div>
                <div class="color-dot" style="background:${preset.colors.text}"></div>
              </div>
            </div>
          `,
						)
						.join("")}
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Основной цвет</label>
            <input type="color" name="primary" value="${cs.primary || "#E8A87C"}">
          </div>
          <div class="form-group">
            <label>Цвет при наведении</label>
            <input type="color" name="primaryHover" value="${cs.primaryHover || "#D48D5F"}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Фон</label>
            <input type="color" name="bg" value="${cs.bg || "#FFF8F5"}">
          </div>
          <div class="form-group">
            <label>Текст</label>
            <input type="color" name="text" value="${cs.text || "#333333"}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Карточки</label>
            <input type="color" name="cardBg" value="${cs.cardBg || "#FFFFFF"}">
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-primary" data-action="save" data-type="settings">💾 Сохранить</button>
      </div>
    `;
	}

	// ============ HERO ============
	function renderHero() {
		const h = data?.hero || {};

		return `
      <div class="card">
        <h3 class="card-title">Настройки Hero-секции</h3>
        <div class="form-group form-group-full">
          <label>Заголовок</label>
          <input type="text" name="heroTitle" value="${h.title || ""}">
        </div>
        <div class="form-group form-group-full">
          <label>Подзаголовок</label>
          <textarea name="heroSubtitle" rows="3" class="hero-subtitle-text">${h.subtitle || ""}</textarea>
        </div>
        <div class="form-group form-group-full">
          <label>Текст кнопки</label>
          <input type="text" name="heroButtonText" value="${h.buttonText || ""}">
        </div>
        <div class="form-group form-group-full">
          <label>Фоновое изображение</label>
          <div class="image-upload">
            <img src="${h.backgroundImage || ""}" class="image-preview" id="hero-bg-preview" alt="Background">
            <div>
              <input type="hidden" name="heroBackgroundImage" value="${h.backgroundImage || ""}">
              <input type="file" id="hero-bg-input" accept="image/*" style="display:none">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('hero-bg-input').click()">Загрузить</button>
            </div>
          </div>
        </div>
        <div class="toggle-group">
          <label class="toggle">
            <input type="checkbox" name="gradientEnabled" ${h.gradientSettings?.enabled ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
          <label>Градиент</label>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Цвет градиента (начало)</label>
            <input type="color" name="gradientStartColor" value="${h.gradientSettings?.startColor || "#000000"}">
          </div>
          <div class="form-group">
            <label>Цвет градиента (конец)</label>
            <input type="color" name="gradientEndColor" value="${h.gradientSettings?.endColor || "#000000"}">
          </div>
        </div>
        <div class="form-group">
          <label>Прозрачность градиента</label>
          <input type="range" name="gradientOpacity" min="0" max="1" step="0.1" value="${h.gradientSettings?.opacity || 0.5}">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-primary" data-action="save" data-type="hero">💾 Сохранить</button>
      </div>
    `;
	}

	// ============ CATALOG ============
	function renderCatalog() {
		const catalog = data?.catalog || [];
		const catalogTitle = data?.catalogTitle || "Каталог";

		return `
      <div class="card">
        <h3 class="card-title">Настройки раздела</h3>
        <div class="form-group form-group-full">
          <label>Заголовок</label>
          <input type="text" name="catalogTitle" value="${catalogTitle}" class="input">
        </div>
        <button type="button" class="btn btn-primary btn-sm" data-action="saveCatalogTitle" style="margin-bottom:20px">💾 Сохранить заголовок</button>
        <hr style="margin:15px 0;border:none;border-top:1px solid var(--border)">
        <h3 class="card-title">Категории и десерты</h3>
        <div id="catalog-list">
          ${catalog
						.map(
							(cat) => `
            <div class="catalog-category ${!cat.isVisible ? "category-hidden" : ""}" data-category-id="${cat.id}">
              <div class="category-header">
                <span class="drag-handle" style="cursor:grab;margin-right:10px;color:#999;font-size:18px">☰</span>
                <input type="text" name="catName_${cat.id}" value="${cat.name}" class="input" style="flex:1;margin-right:10px" placeholder="Название категории">
                <label class="toggle" style="margin:0 8px" title="Показывать на сайте">
                  <input type="checkbox" name="catVisible_${cat.id}" ${cat.isVisible !== false ? "checked" : ""} onchange="saveCategoryVisibility('${cat.id}')">
                  <span class="toggle-slider"></span>
                </label>
                <button type="button" class="btn btn-sm btn-secondary" data-action="saveCategoryName" data-id="${cat.id}" title="Сохранить название">💾</button>
                <button type="button" class="btn btn-sm btn-danger" data-action="deleteCategory" data-id="${cat.id}" title="Удалить категорию">🗑️</button>
              </div>
              <div class="desserts-list" data-category-id="${cat.id}">
                ${(cat.desserts || [])
									.sort((a, b) => (a.order || 0) - (b.order || 0))
									.map(
										(d) => `
                   <div class="dessert-item ${!d.isAvailable ? "dessert-unavailable" : ""}" data-dessert-id="${d.id}">
                     <span class="drag-handle" style="cursor:grab;margin-right:10px;color:#999;font-size:18px;align-self:center">☰</span>
                     <div class="dessert-img-wrapper">
                       ${d.image ? `<img src="${d.image}" alt="${d.name}">` : '<div class="dessert-no-image"><svg viewBox="0 0 24 24" width="32" height="32"><path fill="#999" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>'}
                     </div>
                    <div class="dessert-item-info">
                      <div class="dessert-item-name">
                        ${d.name}
                        ${!d.isAvailable ? '<span class="badge-unavailable">Недоступен</span>' : ""}
                      </div>
                      <div class="dessert-item-price">${d.price} ${d.unit || "₽"}</div>
                    </div>
                    <div class="list-item-actions">
                      <button type="button" class="btn btn-sm btn-secondary" data-action="editDessert" data-id="${d.id}" data-cat="${cat.id}">✏️</button>
                      <button type="button" class="btn btn-sm btn-danger" data-action="deleteDessert" data-id="${d.id}">🗑️</button>
                    </div>
                  </div>
                `,
									)
									.join("")}
              </div>
              <button type="button" class="btn btn-sm btn-primary" style="margin-top:10px" data-action="addDessert" data-cat="${cat.id}">+ Добавить десерт</button>
            </div>
          `,
						)
						.join("")}
        </div>
        <button type="button" class="btn btn-primary" style="margin-top:20px" data-action="addCategory">+ Добавить категорию</button>
      </div>
    `;
	}

	// ============ PROMO ============
	function renderPromo() {
		const p = data?.promo || {};

		return `
      <div class="card">
        <h3 class="card-title">Настройки раздела</h3>
        <div class="toggle-group">
          <label class="toggle">
            <input type="checkbox" name="promoEnabled" ${p.enabled ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
          <label>Включить промо-акцию</label>
        </div>
        <div class="form-group form-group-full">
          <label>Заголовок</label>
          <input type="text" name="promoTitle" value="${p.title || ""}">
        </div>
        <div class="form-group form-group-full">
          <label>Текст</label>
          <textarea name="promoText" rows="3">${p.text || ""}</textarea>
        </div>
        <div class="form-group form-group-full">
          <label>Текст кнопки</label>
          <input type="text" name="promoButtonText" value="${p.buttonText || ""}">
        </div>
        <div class="form-group form-group-full">
          <label>Фоновое изображение</label>
          <div class="image-upload">
            <img src="${p.backgroundImage || ""}" class="image-preview" id="promo-bg-preview" alt="Background">
            <div>
              <input type="hidden" name="promoBackgroundImage" value="${p.backgroundImage || ""}">
              <input type="file" id="promo-bg-input" accept="image/*" style="display:none">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('promo-bg-input').click()">Загрузить</button>
              <button type="button" class="btn btn-danger" data-action="deletePromoBackground" ${p.backgroundImage ? "" : "hidden"}>Удалить фон</button>
            </div>
          </div>
        </div>
        <div class="form-group form-group-full">
          <label for="promo-background-color">Цвет фона (если нет изображения)</label>
          <input type="color" id="promo-background-color" name="backgroundColor" value="${p.backgroundColor || "#e8a87c"}">
        </div>
        <div class="form-group form-group-full">
          <label for="promo-text-color">Цвет текста</label>
          <input type="color" id="promo-text-color" name="textColor" value="${p.textColor || "#333333"}">
        </div>
        <div class="form-group form-group-full">
          <label>Фотографии акции (первое фото — главное)</label>
          <div class="photos-grid promo-photos-sortable" id="promo-photos-grid">
            ${(p.images || []).map((photo, i) => `
              <div class="photo-item" data-photo="${encodeURIComponent(photo)}" title="Перетащите, чтобы изменить порядок">
                <img src="${photo}" alt="Фото акции ${i + 1}" style="width:80px;height:80px;object-fit:cover;border-radius:8px">
                ${i === 0 ? '<span class="cover-badge">Главное</span>' : ''}
                <button type="button" class="btn btn-xs photo-btn-top-right photo-btn-delete" data-action="deletePromoPhoto" data-index="${i}" title="Удалить фото">×</button>
              </div>`).join("")}
          </div>
          <input type="file" id="promo-photos-input" accept="image/*" multiple style="display:none">
          <button type="button" class="btn btn-secondary btn-sm" data-action="addPromoPhotos">+ Добавить фото</button>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-primary" data-action="save" data-type="promo">💾 Сохранить</button>
      </div>
    `;
	}

	// ============ PORTFOLIO ============
	function renderPortfolio() {
		const portfolio = data?.portfolio || {
			categories: [],
			subtitle: "",
			title: "Портфолио",
		};
		const categories = portfolio.categories || [];
		const MAX_VISIBLE_PHOTOS = 6;

		return `
      <div class="card">
        <h3 class="card-title">Настройки раздела</h3>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>Заголовок</label>
            <input type="text" id="portfolio-title" value="${portfolio.title || "Портфолио"}" class="input" placeholder="Название раздела">
          </div>
          <div class="form-group" style="flex:2">
            <label>Подзаголовок</label>
            <textarea id="portfolio-subtitle" rows="3" class="portfolio-subtitle-text" placeholder="Краткое описание раздела">${portfolio.subtitle || ""}</textarea>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" data-action="savePortfolioSettings" style="margin-top:10px">💾 Сохранить заголовки</button>
        <hr style="margin:20px 0;border:none;border-top:1px solid var(--border)">
        <h3 class="card-title">Категории</h3>
        <p class="hint-text">💡 Перетащите категории для изменения порядка</p>
        <div id="portfolio-list" class="sortable-list portfolio-sortable">
          ${categories
						.map(
							(cat) => `
            <div class="catalog-category portfolio-cat ${!cat.isVisible ? "category-hidden" : ""}" data-category-id="${cat.id}">
              <div class="category-header">
                <span class="drag-handle" style="cursor:grab;margin-right:10px;color:#999">☰</span>
                <input type="text" name="portCatName_${cat.id}" value="${cat.name}" class="input" style="flex:1;margin-right:10px" placeholder="Название категории">
                <label class="toggle" style="margin:0 8px" title="Показывать на сайте">
                  <input type="checkbox" name="portCatVisible_${cat.id}" ${cat.isVisible !== false ? "checked" : ""} onchange="savePortfolioCategoryVisibility('${cat.id}')">
                  <span class="toggle-slider"></span>
                </label>
                <button type="button" class="btn btn-sm btn-secondary" data-action="savePortfolioCategoryName" data-id="${cat.id}" title="Сохранить название">💾</button>
                <button type="button" class="btn btn-sm btn-danger" data-action="deletePortfolioCategory" data-id="${cat.id}" title="Удалить категорию">🗑️</button>
              </div>
              
              <div class="portfolio-photos-section" id="photos-section-${cat.id}">
                <div class="photos-row photos-sortable" id="photos-row-${cat.id}" data-category="${cat.id}">
                  ${(cat.photos || [])
										.map(
											(photo, i) => `
                     <div class="photo-thumb ${cat.coverPhoto === photo ? "photo-cover" : ""} ${i === 0 && !cat.coverPhoto ? "photo-cover" : ""}" 
                         data-index="${i}" data-photo="${encodeURIComponent(photo)}">
                      <img src="${photo}" alt="Фото ${i + 1}">
                      <button type="button" class="btn btn-xs photo-btn-top-left photo-btn-cover" data-action="setPortfolioCover" data-cat="${cat.id}" data-photo="${encodeURIComponent(photo)}" title="Сделать обложкой">★</button>
                      <button type="button" class="btn btn-xs photo-btn-top-right photo-btn-delete" data-action="deletePortfolioPhoto" data-cat="${cat.id}" data-index="${i}" title="Удалить">×</button>
                      ${cat.coverPhoto === photo || (i === 0 && !cat.coverPhoto) ? '<span class="cover-badge">Обложка</span>' : ""}
                    </div>
                  `,
										)
										.join("")}
                </div>
                ${
									(cat.photos || []).length > MAX_VISIBLE_PHOTOS
										? `
                  <button type="button" class="btn btn-sm btn-secondary" onclick="togglePhotosGrid('${cat.id}')" id="toggle-btn-${cat.id}" style="margin-top:10px">
                    Показать все ${(cat.photos || []).length} фото
                  </button>
                `
										: ""
								}
              </div>
              
              <button type="button" class="btn btn-sm btn-secondary" style="margin-top:10px" data-action="addPortfolioPhoto" data-cat="${cat.id}">+ Добавить фото</button>
            </div>
          `,
						)
						.join("")}
        </div>
        <button type="button" class="btn btn-primary" style="margin-top:20px" data-action="addPortfolioCategory">+ Добавить категорию</button>
      </div>
    `;
	}

	// Функции для работы с портфолио
	window.savePortfolioSettings = async () => {
		const title =
			document.getElementById("portfolio-title")?.value || "Портфолио";
		const subtitle = document.getElementById("portfolio-subtitle")?.value || "";
		data.portfolio = data.portfolio || { categories: [] };
		data.portfolio.title = title;
		data.portfolio.subtitle = subtitle;
		// Также сохраняем в portfolioTitle для отображения на сайте
		data.portfolioTitle = title;
		const saved = await savePortfolioData();
		if (saved) {
			showToast("Заголовки сохранены!");
		}
	};

	window.savePortfolioCategoryName = async (id) => {
		const input = document.querySelector(`[name="portCatName_${id}"]`);
		if (!input) return;
		const cat = data.portfolio?.categories?.find((c) => c.id === id);
		if (cat) {
			cat.name = input.value;
			await savePortfolioData();
			showToast("Название сохранено!");
		}
	};

	window.savePortfolioCategoryVisibility = async (id) => {
		const checkbox = document.querySelector(`[name="portCatVisible_${id}"]`);
		if (!checkbox) return;
		const cat = data.portfolio?.categories?.find((c) => c.id === id);
		if (cat) {
			cat.isVisible = checkbox.checked;
			await savePortfolioData();

			// Update visual state immediately
			const catElement = document.querySelector(
				`.portfolio-cat[data-category-id="${id}"]`,
			);
			if (catElement) {
				catElement.classList.toggle("category-hidden", !checkbox.checked);
			}
		}
	};

	window.setPortfolioCover = async (catId, photoEncoded) => {
		const photo = decodeURIComponent(photoEncoded);
		const cat = data.portfolio?.categories?.find((c) => c.id === catId);
		if (cat) {
			cat.coverPhoto = photo;
			await savePortfolioData();
			await renderSection("portfolio");
			showToast("Обложка установлена!");
		}
	};

	window.togglePhotosGrid = (catId) => {
		const row = document.getElementById(`photos-row-${catId}`);
		const btn = document.getElementById(`toggle-btn-${catId}`);
		if (!row) return;

		const isExpanded = row.classList.contains("expanded");
		row.classList.toggle("expanded");
		if (btn) {
			btn.textContent = isExpanded
				? `Показать все ${row.children.length} фото`
				: "Свернуть";
		}
	};

	async function savePortfolioData() {
		// Sync categories order from DOM before saving
		const portfolioList = document.getElementById("portfolio-list");
		if (portfolioList) {
			const items = [...portfolioList.querySelectorAll(".portfolio-cat")];
			const reorderedCats = items
				.map((el) => {
					const cat = data.portfolio?.categories?.find(
						(c) => c.id === el.dataset.categoryId,
					);
					if (cat) cat.order = items.indexOf(el);
					return cat;
				})
				.filter(Boolean);
			data.portfolio.categories = reorderedCats;
		}

		const res = await fetch("/api/admin/portfolio", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data.portfolio),
		});
		if (!res.ok) {
			showToast("Ошибка сохранения", "error");
			return false;
		}
		await loadData();
		return true;
	}

	async function savePromoImages() {
		const images = [...(data.promo?.images || [])];
		const res = await fetch("/api/admin/promo", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...data.promo, images }),
		});
		if (!res.ok) {
			showToast("Ошибка сохранения фотографий", "error");
			return false;
		}
		await loadData();
		await renderSection("promo");
		setTimeout(initPromoPhotosSortable, 100);
		return true;
	}

	async function uploadPromoPhotos(fileList) {
		const files = Array.from(fileList || []);
		if (!files.length) return;
		data.promo = data.promo || { enabled: false, images: [] };
		data.promo.images = data.promo.images || [];
		for (const file of files) {
			try {
				const formData = new FormData();
				formData.append("file", file);
				formData.append("folder", "about");
				const response = await fetch("/api/admin/upload", { method: "POST", body: formData });
				const result = await response.json();
				if (result.url) data.promo.images.push(result.url);
			} catch (error) {
				console.error("Promo photo upload failed", error);
			}
		}
		await savePromoImages();
		setTimeout(initPromoPhotosSortable, 100);
		showToast(`Загружено ${files.length} фото`);
	}

	async function deletePromoPhoto(index) {
		const photo = data.promo?.images?.[index];
		if (!photo) return;
		await deleteFileFromServer(photo);
		data.promo.images.splice(index, 1);
		await savePromoImages();
	}

	// ============ FAQ ============
	function renderFAQ() {
		const faq = data?.faq || [];
		const faqTitle = data?.faqTitle || "Частые вопросы";

		return `
      <div class="card">
        <h3 class="card-title">Настройки раздела</h3>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>Заголовок</label>
            <input type="text" id="faq-title" value="${faqTitle}" class="input" placeholder="Название раздела">
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" data-action="saveFAQSettings" style="margin-top:10px">💾 Сохранить заголовок</button>
        <hr style="margin:20px 0;border:none;border-top:1px solid var(--border)">
        <h3 class="card-title">Вопросы и ответы</h3>
        <p class="hint-text">💡 Перетащите вопросы для изменения порядка</p>
        <div id="faq-list" class="sortable-list faq-sortable">
          ${faq
						.map(
							(item, i) => `
            <div class="list-item faq-item-admin ${item.isVisible === false ? "faq-hidden" : ""}" data-faq-id="${item.id}" data-index="${i}">
              <span class="drag-handle faq-drag">☰</span>
              <div class="list-item-info">
                <strong>${item.question}</strong>
                <p style="color:var(--text-secondary);font-size:0.9rem">${item.answer?.substring(0, 50)}...</p>
              </div>
              <div class="list-item-actions">
                <label class="toggle" style="margin:0 8px" title="Показывать на сайте">
                  <input type="checkbox" ${item.isVisible !== false ? "checked" : ""} data-action="toggleFAQVisibility" data-index="${i}">
                  <span class="toggle-slider"></span>
                </label>
                <button type="button" class="btn btn-sm btn-secondary" data-action="editFAQ" data-index="${i}">✏️</button>
                <button type="button" class="btn btn-sm btn-danger" data-action="deleteFAQ" data-index="${i}">🗑️</button>
              </div>
            </div>
          `,
						)
						.join("")}
        </div>
        <button type="button" class="btn btn-primary" style="margin-top:20px" data-action="addFAQ">+ Добавить вопрос</button>
      </div>
    `;
	}

	// ============ REVIEWS ============
	function renderReviews() {
		const reviews = data?.reviews || [];
		const reviewsTitle = data?.reviewsTitle || "Отзывы";
		const reviewsVisible = data?.reviewsVisible !== false;

		return `
      <div class="card">
        <h3 class="card-title">Настройки раздела</h3>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>Заголовок</label>
            <input type="text" id="reviews-title" value="${reviewsTitle}" class="input" placeholder="Название раздела">
          </div>
          <div class="form-group">
            <label>Показывать раздел</label>
            <label class="toggle">
              <input type="checkbox" id="reviews-visible" ${reviewsVisible ? "checked" : ""}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" data-action="saveReviewsSettings" style="margin-top:10px">💾 Сохранить</button>
        <hr style="margin:20px 0;border:none;border-top:1px solid var(--border)">
        <h3 class="card-title">Список отзывов</h3>
        <p class="hint-text">💡 Перетащите отзывы для изменения порядка</p>
        <p class="hint-text">📌 В отзыве можно указать текст или загрузить скриншот.</p>
			<div id="reviews-list" class="sortable-list">
			  ${reviews
					.map(
						(item, i) => `
            <div class="list-item review-item-admin ${item.isVisible === false ? "review-hidden" : ""}" data-review-id="${item.id}" data-index="${i}">
              <span class="drag-handle" style="cursor:grab;margin-right:10px;color:#999;font-size:18px">☰</span>
              <div class="list-item-info">
                <strong>${item.clientName}</strong>
                <p style="color:var(--text-secondary);font-size:0.9rem">${item.screenshot ? "🖼️ Скриншот" : `"${(item.text || "").substring(0, 50)}..."`}</p>
              </div>
              <div class="list-item-actions">
                <label class="toggle" style="margin:0 8px" title="Показывать на сайте">
                  <input type="checkbox" ${item.isVisible !== false ? "checked" : ""} onchange="toggleReviewVisibility('${i}')">
                  <span class="toggle-slider"></span>
                </label>
                <button type="button" class="btn btn-sm btn-secondary" data-action="editReview" data-index="${i}">✏️</button>
                <button type="button" class="btn btn-sm btn-danger" data-action="deleteReview" data-index="${i}">🗑️</button>
              </div>
            </div>
          `,
					)
					.join("")}
        </div>
        <button type="button" class="btn btn-primary" style="margin-top:20px" data-action="addReview">+ Добавить отзыв</button>
      </div>
    `;
	}

	// ============ ABOUT ============
	function renderAbout() {
		const a = data?.about || {};
		const aboutTitle = data?.aboutTitle || "Обо мне";

		return `
      <div class="card">
        <h3 class="card-title">Настройки раздела</h3>
        <div class="form-group form-group-full">
          <label>Заголовок</label>
          <input type="text" name="aboutTitle" value="${aboutTitle}" class="input">
        </div>
        <div class="form-group form-group-full">
          <label>Текст о себе</label>
          <textarea name="aboutText" rows="6">${a.text || ""}</textarea>
        </div>
        <div class="form-group form-group-full">
          <label>Подпись канала</label>
          <input type="text" name="channelCaption" value="${a.channelCaption || ""}">
        </div>
        <div class="form-group form-group-full">
          <label>Фото</label>
		  <p class="hint-text">Перед загрузкой выберите область фото для сайта. Сохраняется формат 3:4.</p>
          <div class="image-upload">
		    <img src="${a.photo || ""}" class="image-preview about-image-preview ${a.photo ? "" : "hidden"}" id="about-photo-preview" alt="Фото обо мне">
            <div>
              <input type="hidden" name="aboutPhoto" value="${a.photo || ""}">
              <input type="file" id="about-photo-input" accept="image/*" style="display:none">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('about-photo-input').click()">Загрузить</button>
              <button type="button" class="btn btn-danger btn-sm" onclick="deleteImage('aboutPhoto', 'about-photo-preview')">Удалить</button>
            </div>
          </div>
		  <div id="about-crop-modal" class="crop-modal" hidden>
		    <div class="crop-modal-content">
		      <h3>Обрезка фото</h3>
		      <p class="hint-text">Перемещайте и масштабируйте фото, чтобы выбрать область 3:4.</p>
		      <div class="about-crop-stage"><img id="about-crop-image" alt="Выбор области фото"></div>
		      <div class="form-actions">
		        <button type="button" class="btn btn-primary" id="about-crop-save">Обрезать и сохранить</button>
		        <button type="button" class="btn btn-secondary" id="about-crop-cancel">Отмена</button>
		      </div>
		    </div>
		  </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-primary" data-action="save" data-type="about">💾 Сохранить</button>
      </div>
    `;
	}

	// ============ SECTIONS ============
	function renderSections() {
		const sections = data?.sections || [];
		const allSections = [
			"catalog",
			"promo",
			"portfolio",
			"faq",
			"reviews",
			"about",
		];
		const titles = {
			catalog: "🧁 Каталог",
			promo: "🎁 Промо",
			portfolio: "📸 Портфолио",
			faq: "❓ FAQ",
			reviews: "⭐ Отзывы",
			about: "👩‍🍳 Обо мне",
		};

		return `
      <div class="card">
        <h3 class="card-title">Порядок секций (перетащите для изменения)</h3>
        <ul id="sections-sortable" class="list-item" style="flex-direction:column;gap:10px">
          ${sections
						.filter((s) => allSections.includes(s))
						.map(
							(s) => `
            <li class="list-item" data-section="${s}" style="cursor:move">
              <span>☰</span>
              <span style="flex:1;margin-left:10px">${titles[s] || s}</span>
            </li>
          `,
						)
						.join("")}
        </ul>
        <p style="margin-top:15px;color:var(--text-secondary)">Перетащите секции, чтобы изменить их порядок на сайте.</p>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-primary" data-action="saveSections">💾 Сохранить порядок</button>
      </div>
    `;
	}

	// ============ ANALYTICS ============
	async function renderAnalytics() {
		let stats = null;
		try {
			const res = await fetch("/api/admin/stats");
			stats = await res.json();
		} catch (err) {
			console.error("Ошибка загрузки статистики:", err);
			return `<div class="card"><p style="color:var(--danger);padding:20px">Не удалось загрузить аналитику: ${err.message}</p></div>`;
		}

		const funnel = stats?.stats?.funnel || {};
		const clicks = stats?.stats?.clicks?.chat?.total || {};
		const portfolioViews = stats?.stats?.portfolioViews?.total || 0;
		const reviewsViews = stats?.stats?.reviewsViews?.total || 0;

		return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${funnel.catalogViews?.total || 0}</div>
          <div class="stat-label">Просмотры каталога</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${funnel.orderClicks?.total || 0}</div>
          <div class="stat-label">Клики на заказ</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${clicks.whatsapp || 0}</div>
          <div class="stat-label">WhatsApp</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${clicks.telegram || 0}</div>
          <div class="stat-label">Telegram</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${portfolioViews}</div>
          <div class="stat-label">Просмотры портфолио</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${reviewsViews}</div>
          <div class="stat-label">Просмотры отзывов</div>
        </div>
      </div>

      <div class="chart-container">
        <h3 class="chart-title">Воронка</h3>
        <canvas id="funnel-chart"></canvas>
      </div>

      <div class="chart-container">
        <h3 class="chart-title">Канал (последние 7 дней)</h3>
        <canvas id="channel-chart"></canvas>
      </div>

      <div style="margin-top:20px">
        <button class="btn btn-danger" data-action="resetStats">🔄 Сбросить статистику</button>
        <a href="/api/analytics/export" class="btn btn-secondary" style="margin-left:10px">📥 Экспорт CSV</a>
      </div>
    `;
	}

	// ============ BACKUPS ============
	async function renderBackups() {
		let backups = [];
		try {
			const res = await fetch("/api/backup/list");
			backups = await res.json();
		} catch (err) {
			console.error("Ошибка загрузки списка бэкапов:", err);
			return `<div class="card"><p style="color:var(--danger);padding:20px">Не удалось загрузить список бэкапов: ${err.message}</p></div>`;
		}

		return `
      <div class="card">
        <h3 class="card-title">Резервное копирование</h3>
        <p style="color: var(--text-secondary); margin-bottom: 15px;">Автоматический бэкап: каждое воскресенье в 3:00. Хранится до 4 последних копий.</p>
        <button class="btn btn-primary" style="margin-bottom:20px" data-action="createBackup">💾 Создать бэкап</button>
        
        <div id="backups-list">
          ${backups.length === 0 ? '<p style="color:var(--text-secondary)">Нет сохранённых бэкапов</p>' : ""}
          ${backups
						.map(
							(b) => `
            <div class="backup-item">
              <div class="backup-info">
                <span class="backup-name">${b.name}</span>
                <span class="backup-size">${(b.size / (1024 * 1024)).toFixed(2)} MB</span>
                <span class="backup-date">${new Date(b.date).toLocaleString()}</span>
              </div>
              <div class="list-item-actions">
                <a href="/api/backup/download/${b.name}" class="btn btn-sm btn-secondary">Скачать</a>
              </div>
            </div>
          `,
						)
						.join("")}
        </div>
      </div>
    `;
	}

	// ============ ОБРАБОТКА СОБЫТИЙ ============
	async function handleDelegatedClick(e) {
		const action = e.target.dataset.action;
		if (!action) return;

		switch (action) {
			case "save":
				await saveData(e.target.dataset.type);
				break;
			case "deletePromoBackground":
				await deleteImage("promoBackgroundImage", "promo-bg-preview");
				e.target.hidden = true;
				break;
			case "addPromoPhotos":
				document.getElementById("promo-photos-input")?.click();
				break;
			case "deletePromoPhoto":
				await deletePromoPhoto(Number(e.target.dataset.index));
				break;
			case "saveSections":
				await saveSectionsOrder();
				break;
			case "addCategory":
				await addCategory();
				break;
			case "saveCategoryName":
				await saveCategoryName(e.target.dataset.id);
				break;
			case "deleteCategory":
				await deleteCategory(e.target.dataset.id);
				break;
			case "addDessert":
				showDessertModal(null, e.target.dataset.cat);
				break;
			case "editDessert": {
				const dessert = findDessert(e.target.dataset.id);
				if (dessert) showDessertModal(dessert, e.target.dataset.cat);
				break;
			}
			case "deleteDessert":
				await deleteDessert(e.target.dataset.id);
				break;
			case "addPortfolioCategory":
				await addPortfolioCategory();
				break;
			case "deletePortfolioCategory":
				await deletePortfolioCategory(e.target.dataset.id);
				break;
			case "addPortfolioPhoto": {
				document.getElementById("portfolio-photo-input")?.remove();
				const inp = document.createElement("input");
				inp.type = "file";
				inp.id = "portfolio-photo-input";
				inp.accept = "image/*";
				inp.multiple = true;
				inp.dataset.cat = e.target.dataset.cat;
				inp.onchange = () => uploadPortfolioPhoto(inp);
				inp.click();
				break;
			}
			case "deletePortfolioPhoto":
				await deletePortfolioPhoto(
					e.target.dataset.cat,
					parseInt(e.target.dataset.index),
				);
				break;
			case "setPortfolioCover":
				await setPortfolioCover(e.target.dataset.cat, e.target.dataset.photo);
				break;
			case "togglePhotosGrid":
				togglePhotosGrid(e.target.dataset.cat);
				break;
			case "savePortfolioSettings":
				await savePortfolioSettings();
				break;
			case "savePortfolioCategoryName":
				await savePortfolioCategoryName(e.target.dataset.id);
				break;
			case "addFAQ":
				showFAQModal(null);
				break;
			case "editFAQ":
				showFAQModal(data.faq[e.target.dataset.index], e.target.dataset.index);
				break;
			case "toggleFAQVisibility":
				await toggleFAQVisibility(e.target.dataset.index);
				break;
			case "saveFAQSettings":
				await saveFAQSettings();
				break;
			case "deleteFAQ":
				await deleteFAQ(e.target.dataset.index);
				break;
			case "addReview":
				showReviewModal(null);
				break;
			case "editReview":
				showReviewModal(
					data.reviews[e.target.dataset.index],
					e.target.dataset.index,
				);
				break;
			case "saveReviewsSettings":
				await saveReviewsSettings();
				break;
			case "saveCatalogTitle":
				await saveSectionTitle("catalogTitle");
				break;
			case "savePromoTitle":
				await saveSectionTitle("promoTitle");
				break;
			case "deleteReview":
				await deleteReview(e.target.dataset.index);
				break;
			case "createBackup":
				await createBackup();
				break;
			case "resetStats":
				if (confirm("Сбросить всю статистику?")) {
					await resetStats();
				}
				break;
		}
	}

	function handleDelegatedChange(e) {
		// Обработка загрузки изображений
		const inputs = {
			"logo-input": { field: "logoImage", preview: "logo-preview" },
			"hero-bg-input": {
				field: "heroBackgroundImage",
				preview: "hero-bg-preview",
			},
			"promo-bg-input": {
				field: "promoBackgroundImage",
				preview: "promo-bg-preview",
			},
			"about-photo-input": {
				field: "aboutPhoto",
				preview: "about-photo-preview",
			},
		};

		const config = inputs[e.target.id];
		if (config) {
			if (e.target.id === "about-photo-input") {
				openAboutPhotoCrop(e.target.files[0]);
				e.target.value = "";
			} else {
				uploadImage(e.target.files[0], config.field, config.preview);
			}
		}
		if (e.target.id === "promo-photos-input") uploadPromoPhotos(e.target.files);
	}

	let aboutPhotoCropper = null;
	let aboutPhotoCropObjectUrl = null;

	function openAboutPhotoCrop(file) {
		if (!file) return;
		if (!window.Cropper) {
			showToast("Не удалось загрузить инструмент обрезки. Обновите страницу и попробуйте снова.", "error");
			return;
		}

		const modal = document.getElementById("about-crop-modal");
		const image = document.getElementById("about-crop-image");
		if (!modal || !image) return;

		if (aboutPhotoCropper) aboutPhotoCropper.destroy();
		if (aboutPhotoCropObjectUrl) URL.revokeObjectURL(aboutPhotoCropObjectUrl);
		aboutPhotoCropObjectUrl = URL.createObjectURL(file);
		image.src = aboutPhotoCropObjectUrl;
		modal.hidden = false;

		image.onload = () => {
			aboutPhotoCropper = new Cropper(image, {
				aspectRatio: 3 / 4,
				viewMode: 1,
				autoCropArea: 0.9,
				responsive: true,
				background: false,
				movable: true,
				zoomable: true,
				rotatable: false,
				scalable: false,
			});
		};
	}

	function closeAboutPhotoCrop() {
		const modal = document.getElementById("about-crop-modal");
		if (aboutPhotoCropper) {
			aboutPhotoCropper.destroy();
			aboutPhotoCropper = null;
		}
		if (aboutPhotoCropObjectUrl) {
			URL.revokeObjectURL(aboutPhotoCropObjectUrl);
			aboutPhotoCropObjectUrl = null;
		}
		if (modal) modal.hidden = true;
	}

	async function saveAboutPhotoCrop() {
		if (!aboutPhotoCropper) return;
		const canvas = aboutPhotoCropper.getCroppedCanvas({
			width: 900,
			height: 1200,
			imageSmoothingEnabled: true,
			imageSmoothingQuality: "high",
		});
		if (!canvas) {
			showToast("Не удалось обрезать фото", "error");
			return;
		}

		const file = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
		if (!file) {
			showToast("Не удалось подготовить фото", "error");
			return;
		}
		const preview = document.getElementById("about-photo-preview");
		const oldPath = document.querySelector('[name="aboutPhoto"]')?.value;
		const formData = new FormData();
		formData.append("file", file, "about-photo.jpg");
		formData.append("folder", "about");
		if (oldPath) formData.append("oldPath", oldPath);

		try {
			const response = await fetch("/api/admin/upload", { method: "POST", body: formData });
			const result = await response.json();
			if (!response.ok || !result.url) throw new Error(result.error || "upload failed");
			document.querySelector('[name="aboutPhoto"]').value = result.url;
			if (preview) {
				preview.src = result.url;
				preview.classList.remove("hidden");
			}
			closeAboutPhotoCrop();
			showToast("Фото обрезано и загружено");
		} catch (error) {
			console.error("About photo upload failed:", error);
			showToast("Ошибка загрузки фото", "error");
		}
	}

	async function handleDelegatedSubmit(e) {
		e.preventDefault();
	}

	// ============ FAQ HELPERS ============
	async function saveFAQSettings() {
		const title =
			document.getElementById("faq-title")?.value || "Частые вопросы";
		data.faqTitle = title;

		const res = await fetch("/api/admin/faq-settings", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ faqTitle: title }),
		});
		if (res.ok) {
			await loadData();
			showToast("Настройки сохранены!");
		} else {
			showToast("Ошибка сохранения", "error");
		}
	}

	async function toggleFAQVisibility(index) {
		const item = data.faq[index];
		if (!item) return;

		item.isVisible = item.isVisible === false ? true : false;

		const res = await fetch("/api/admin/faq", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data.faq),
		});

		if (res.ok) {
			// Update UI without full re-render
			const itemEl = document.querySelector(
				`.faq-item-admin[data-index="${index}"]`,
			);
			if (itemEl) {
				itemEl.classList.toggle("faq-hidden", item.isVisible === false);
			}
		} else {
			showToast("Ошибка сохранения", "error");
		}
	}

	// ============ SECTION TITLES ============
	async function saveSectionTitle(fieldName) {
		const input = document.querySelector(`[name='${fieldName}']`);
		if (!input) return;

		const title = input.value || fieldName;
		data[fieldName] = title;

		const res = await fetch("/api/admin/section-titles", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ [fieldName]: title }),
		});

		if (res.ok) {
			await loadData();
			showToast("Заголовок сохранён!");
		} else {
			showToast("Ошибка сохранения", "error");
		}
	}

	// ============ REVIEWS HELPERS ============
	async function saveReviewsSettings() {
		const title = document.getElementById("reviews-title")?.value || "Отзывы";
		const visible = document.getElementById("reviews-visible")?.checked ?? true;
		data.reviewsTitle = title;
		data.reviewsVisible = visible;

		const res = await fetch("/api/admin/reviews-settings", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ reviewsTitle: title, reviewsVisible: visible }),
		});
		if (res.ok) {
			await loadData();
			showToast("Настройки сохранены!");
		} else {
			showToast("Ошибка сохранения", "error");
		}
	}

	window.toggleReviewVisibility = async (index) => {
		const item = data.reviews[index];
		if (!item) return;

		const checkbox = document.querySelector(
			`.review-item-admin[data-index="${index}"] input[type="checkbox"]`,
		);
		if (!checkbox) return;

		item.isVisible = checkbox.checked;

		const res = await fetch("/api/admin/reviews", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data.reviews),
		});

		if (res.ok) {
			await loadData();
			await renderSection("reviews");
		} else {
			showToast("Ошибка сохранения", "error");
		}
	};

	// ============ СОХРАНЕНИЕ ============
	async function saveData(type) {
		const content = document.getElementById("content");
		let payload = {};

		switch (type) {
			case "settings":
				payload = {
					siteName: content.querySelector('[name="siteName"]')?.value,
					confectionerName: content.querySelector('[name="confectionerName"]')
						?.value,
					orderButtonText: content.querySelector('[name="orderButtonText"]')
						?.value,
					contactButtonText: content.querySelector('[name="contactButtonText"]')
						?.value,
					contacts: {
						phone: content.querySelector('[name="phone"]')?.value,
						email: content.querySelector('[name="email"]')?.value,
						address: content.querySelector('[name="address"]')?.value,
					},
					socialLinks: {
						whatsapp: content.querySelector('[name="chat_whatsapp"]')?.value,
						telegram: content.querySelector('[name="chat_telegram"]')?.value,
						instagram: content.querySelector('[name="chat_instagram"]')?.value,
						vk: content.querySelector('[name="chat_vk"]')?.value,
						max: content.querySelector('[name="chat_max"]')?.value,
					},
					chats: {
						whatsapp: content.querySelector('[name="chat_whatsapp"]')?.value,
						telegram: content.querySelector('[name="chat_telegram"]')?.value,
						instagram: content.querySelector('[name="chat_instagram"]')?.value,
						vk: content.querySelector('[name="chat_vk"]')?.value,
						max: content.querySelector('[name="chat_max"]')?.value,
						ok: content.querySelector('[name="chat_ok"]')?.value,
					},
					channels: {
						whatsapp: content.querySelector('[name="channel_whatsapp"]')?.value,
						telegram: content.querySelector('[name="channel_telegram"]')?.value,
						instagram: content.querySelector('[name="channel_instagram"]')
							?.value,
						vk: content.querySelector('[name="channel_vk"]')?.value,
						max: content.querySelector('[name="channel_max"]')?.value,
						ok: content.querySelector('[name="channel_ok"]')?.value,
					},
					deliveryInfo: content.querySelector('[name="deliveryInfo"]')?.value,
					copyright: content.querySelector('[name="copyright"]')?.value,
					logoImage: content.querySelector('[name="logoImage"]')?.value,
					colorScheme: {
						primary: content.querySelector('[name="primary"]')?.value,
						primaryHover: content.querySelector('[name="primaryHover"]')?.value,
						bg: content.querySelector('[name="bg"]')?.value,
						text: content.querySelector('[name="text"]')?.value,
						cardBg: content.querySelector('[name="cardBg"]')?.value,
					},
				};
				break;

			case "hero":
				payload = {
					title: content.querySelector('[name="heroTitle"]')?.value,
					subtitle: content.querySelector('[name="heroSubtitle"]')?.value,
					buttonText: content.querySelector('[name="heroButtonText"]')?.value,
					backgroundImage: content.querySelector('[name="heroBackgroundImage"]')
						?.value,
					gradientSettings: {
						enabled: content.querySelector('[name="gradientEnabled"]')?.checked,
						startColor: content.querySelector('[name="gradientStartColor"]')
							?.value,
						endColor: content.querySelector('[name="gradientEndColor"]')?.value,
						opacity:
							parseFloat(
								content.querySelector('[name="gradientOpacity"]')?.value,
							) || 0.5,
					},
				};
				break;

			case "promo":
				payload = {
					enabled: content.querySelector('[name="promoEnabled"]')?.checked,
					title: content.querySelector('[name="promoTitle"]')?.value,
					text: content.querySelector('[name="promoText"]')?.value,
					buttonText: content.querySelector('[name="promoButtonText"]')?.value,
					backgroundImage: content.querySelector(
						'[name="promoBackgroundImage"]',
					)?.value,
					backgroundColor: content.querySelector('[name="backgroundColor"]')?.value || "#e8a87c",
					textColor: content.querySelector('[name="textColor"]')?.value || "#333333",
					images: [...(data.promo?.images || [])],
				};
				break;

			case "about": {
				const aboutTitle =
					content.querySelector('[name="aboutTitle"]')?.value || "Обо мне";
				payload = {
					text: content.querySelector('[name="aboutText"]')?.value,
					channelCaption: content.querySelector('[name="channelCaption"]')
						?.value,
					photo: content.querySelector('[name="aboutPhoto"]')?.value,
				};
				// Сохраняем aboutTitle отдельным запросом
				await fetch("/api/admin/about-settings", {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ aboutTitle }),
				});
				break;
			}
		}

		try {
			const res = await fetch(`/api/admin/${type}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (res.ok) {
				showToast("Сохранено!");
				await loadData();
			} else {
				showToast("Ошибка сохранения", "error");
			}
		} catch {
			showToast("Ошибка сохранения", "error");
		}
	}

	// ============ CATALOG CRUD ============
	async function addCategory() {
		const name = prompt("Название категории:");
		if (!name) return;

		const newCat = {
			id: "cat" + Date.now(),
			name,
			order: data.catalog.length,
			isVisible: true,
			desserts: [],
		};

		data.catalog.push(newCat);
		await saveAndRender();
	}

	async function saveCategoryName(id) {
		const input = document.querySelector(`[name="catName_${id}"]`);
		if (!input) return;
		const cat = data.catalog.find((c) => c.id === id);
		if (cat) {
			cat.name = input.value;
			await saveAndRender();
			showToast("Название сохранено!");
		}
	}

	window.saveCategoryVisibility = async (id) => {
		const checkbox = document.querySelector(`[name="catVisible_${id}"]`);
		if (!checkbox) return;
		const cat = data.catalog.find((c) => c.id === id);
		if (cat) {
			cat.isVisible = checkbox.checked;
			await saveCatalogOnly();
		}
	};

	async function saveCatalogOnly() {
		const res = await fetch("/api/admin/catalog", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data.catalog),
		});

		if (!res.ok) {
			console.error("Save catalog error:", res.status);
			showToast("Ошибка сохранения", "error");
			return;
		}

		await loadData();
		await renderSection("catalog");
		setTimeout(initSortable, 100);
	}

	async function deleteCategory(id) {
		if (!confirm("Удалить категорию со всеми десертами и фотографиями?"))
			return;
		const cat = data.catalog.find((c) => c.id === id);
		if (cat) {
			// Удаляем все фотографии десертов с диска
			for (const dessert of cat.desserts || []) {
				if (dessert.image) {
					await deleteFileFromDisk(dessert.image);
				}
				for (const photo of dessert.photos || []) {
					await deleteFileFromDisk(photo);
				}
			}
		}
		data.catalog = data.catalog.filter((c) => c.id !== id);
		await saveAndRender();
	}

	async function deleteFileFromDisk(path) {
		if (!path) return;
		try {
			await fetch("/api/admin/file", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path }),
			});
		} catch (err) {
			console.error("Error deleting file:", err);
		}
	}

	function findDessert(id) {
		for (const cat of data.catalog) {
			const d = cat.desserts.find((d) => d.id === id);
			if (d) return d;
		}
		return null;
	}

	// Глобальное состояние для текущего редактируемого десерта
	let currentDessertPhotos = [];
	let originalDessert = null; // Ссылка на оригинальный десерт для сохранения order и других полей

	function showDessertModal(dessert = null, catId) {
		const isEdit = !!dessert;
		// Инициализируем глобальное состояние
		currentDessertPhotos = Array.isArray(dessert?.photos)
			? [...dessert.photos]
			: [];
		originalDessert = dessert || null;

		const photosJson = JSON.stringify(currentDessertPhotos);
		const dessertId = dessert?.id || "";

		const html = `
      <div class="modal-overlay active" id="dessert-modal">
        <div class="modal-content" style="max-width:600px;max-height:90vh;overflow-y:auto">
          <div class="modal-header">
            <h3 class="modal-title">${isEdit ? "Редактировать" : "Новый"} десерт</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <form id="dessert-form">
            <div class="form-group">
              <label>Название</label>
              <input type="text" name="name" value="${dessert?.name || ""}" required>
            </div>
            <div class="form-group">
              <label>Краткое описание</label>
              <textarea name="shortDescription" rows="2" placeholder="Показывается в карточке товара">${dessert?.shortDescription || ""}</textarea>
            </div>
            <div class="form-group">
              <label>Полное описание</label>
              <textarea name="fullDescription" rows="3" placeholder="Показывается при раскрытии товара">${dessert?.fullDescription || dessert?.description || ""}</textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Цена</label>
                <input type="number" name="price" value="${dessert?.price || 0}" required>
              </div>
              <div class="form-group">
                <label>Ед. измерения</label>
                <input type="text" name="unit" value="${dessert?.unit || ""}" placeholder="₽/кг, ₽/шт">
              </div>
              <div class="form-group">
                <label>Старая цена</label>
                <input type="number" name="oldPrice" value="${dessert?.oldPrice || ""}">
              </div>
            </div>
            <div class="form-group">
              <label>Примечание к цене</label>
              <input type="text" name="priceNote" value="${dessert?.priceNote || ""}" placeholder="например: Цена за 1 кг">
            </div>
            <div class="form-group">
              <label>Доступен</label>
              <div class="toggle-group">
                <label class="toggle">
                  <input type="checkbox" name="isAvailable" ${dessert?.isAvailable !== false ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
			<div class="form-group">
				<label>Фотографии (главное фото — первое)</label>
				<div id="dessert-photos-grid" class="photos-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:10px;margin-bottom:10px">
					${
						currentDessertPhotos.length > 0
							? currentDessertPhotos
									.map(
										(photo, i) => `
                  <div class="photo-item" data-index="${i}" data-photo="${encodeURIComponent(photo)}" style="position:relative">
                    <img src="${photo}" style="width:80px;height:80px;object-fit:cover;border-radius:8px">
                    <button type="button" class="btn btn-danger btn-sm" style="position:absolute;top:2px;right:2px;padding:2px 6px" onclick="deleteDessertPhoto('${catId}', '${dessertId}', ${i})">×</button>
                    ${i === 0 ? '<span style="position:absolute;bottom:2px;left:2px;font-size:10px;background:rgba(0,0,0,0.6);color:#fff;padding:1px 4px;border-radius:3px">👑</span>' : ""}
                  </div>
                `,
									)
									.join("")
							: '<div style="color:#888;font-size:12px;padding:10px">Нет фотографий</div>'
					}
              </div>
              <input type="file" id="dessert-photos-input" accept="image/*" multiple style="display:none">
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('dessert-photos-input').click()">+ Добавить фото</button>
              <span style="font-size:12px;color:#888;margin-left:10px">Можно выбрать несколько</span>
              <input type="hidden" name="photos" id="dessert-photos-field" value="${photosJson}">
              <input type="hidden" name="originalPhotos" value="${photosJson}">
            </div>
            <input type="hidden" name="catId" value="${catId}">
            <input type="hidden" name="id" value="${dessertId}">
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">💾 Сохранить</button>
              <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            </div>
          </form>
        </div>
      </div>
    `;

		document.body.insertAdjacentHTML("beforeend", html);

		// Множественная загрузка фотографий
		document
			.getElementById("dessert-photos-input")
			?.addEventListener("change", async (e) => {
				const files = Array.from(e.target.files);
				if (!files.length) return;

				const currentPhotos = getCurrentPhotos();

				for (const file of files) {
					try {
						const formData = new FormData();
						formData.append("file", file);
						formData.append("folder", "desserts");

						const res = await fetch("/api/admin/upload", {
							method: "POST",
							body: formData,
						});
						const json = await res.json();

						if (json.url) {
							currentPhotos.push(json.url);
						}
					} catch (err) {
						console.error("Upload error:", err);
					}
				}

				// Обновляем скрытое поле и UI
				setCurrentPhotos(currentPhotos);
				renderDessertPhotos(currentPhotos);
				initPhotosSortable();
			});

		// Инициализация перетаскивания фотографий
		initPhotosSortable();

		// Вспомогательные функции для работы с фотографиями
		// Используем currentDessertPhotos как источник истины
		function getCurrentPhotos() {
			// Всегда возвращаем копию глобальной переменной как источник истины
			const result = [...currentDessertPhotos];

			// Опционально синхронизируем с DOM если поле существует и валидно
			try {
				const field = document.getElementById("dessert-photos-field");
				const val = field?.value;
				if (val && typeof val === "string" && val.trim().length >= 2) {
					const parsed = JSON.parse(val);
					if (Array.isArray(parsed)) {
						// Если DOM содержит валидный массив, используем его и синхронизируем
						currentDessertPhotos = [...parsed];
						return [...parsed];
					}
				}
			} catch {
				// Игнорируем ошибки парсинга, используем глобальную переменную
			}

			return result;
		}

		function setCurrentPhotos(photos) {
			// Обновляем глобальную переменную
			currentDessertPhotos = [...photos];
			// Обновляем DOM поле - ВСЕГДА записываем валидный JSON
			const field = document.getElementById("dessert-photos-field");
			if (field) {
				field.value = JSON.stringify([...photos]);
			}
		}

		function initPhotosSortable() {
			const grid = document.getElementById("dessert-photos-grid");
			if (!grid || typeof Sortable === "undefined") return;

			// Удаляем предыдущий экземпляр Sortable если есть
			if (grid._sortable) {
				grid._sortable.destroy();
			}

			grid._sortable = new Sortable(grid, {
				animation: 150,
				ghostClass: "sortable-ghost",
				draggable: ".photo-item",
				onEnd: () => {
					const items = [...grid.querySelectorAll(".photo-item")];

					// Получаем фото из data-photo атрибутов
					const reordered = items
						.map((item) => {
							const encoded = item.dataset.photo;
							return encoded ? decodeURIComponent(encoded) : null;
						})
						.filter(Boolean);

					setCurrentPhotos(reordered);
					renderDessertPhotos(reordered);
					initPhotosSortable(); // Пересоздаём после рендера
				},
			});
		}

		document
			.getElementById("dessert-form")
			.addEventListener("submit", async (e) => {
				e.preventDefault();
				const fd = new FormData(e.target);
				const id = fd.get("id");
				const catId = fd.get("catId");

				// Используем getCurrentPhotos как надёжный источник
				const photos = getCurrentPhotos();

				const payload = {
					name: fd.get("name"),
					shortDescription: fd.get("shortDescription"),
					fullDescription: fd.get("fullDescription"),
					price: parseInt(fd.get("price")),
					oldPrice: fd.get("oldPrice") ? parseInt(fd.get("oldPrice")) : null,
					unit: fd.get("unit"),
					priceNote: fd.get("priceNote"),
					image: photos[0] || "",
					isAvailable: e.target.querySelector('[name="isAvailable"]').checked,
					photos: photos,
					categoryId: catId,
					slug: slugify(fd.get("name")),
					isArchived: false,
					order: originalDessert?.order || 0,
				};

				const cat = data.catalog.find((c) => c.id === catId);
				if (!cat) {
					showToast("Категория не найдена", "error");
					return;
				}

				if (id && !id.startsWith("temp_")) {
					// Update existing dessert
					const idx = cat.desserts.findIndex((d) => d.id === id);
					if (idx !== -1) {
						cat.desserts[idx] = { ...cat.desserts[idx], ...payload };
					} else {
						showToast("Десерт не найден", "error");
						return;
					}
				} else {
					// Add new dessert
					payload.id = "des" + Date.now();
					cat.desserts.push(payload);
				}

				await saveAndRender();
				closeModal();
			});
	}

	function renderDessertPhotos(photos) {
		const grid = document.getElementById("dessert-photos-grid");
		if (!grid) return;

		grid.innerHTML = photos
			.map(
				(photo, i) => `
      <div class="photo-item" data-index="${i}" data-photo="${encodeURIComponent(photo)}" style="position:relative">
        <img src="${photo}" style="width:80px;height:80px;object-fit:cover;border-radius:8px">
        <button type="button" class="btn btn-danger btn-sm" style="position:absolute;top:2px;right:2px;padding:2px 6px" onclick="deleteCurrentDessertPhoto(${i})">×</button>
        ${i === 0 ? '<span style="position:absolute;bottom:2px;left:2px;font-size:10px;background:rgba(0,0,0,0.6);color:#fff;padding:1px 4px;border-radius:3px">👑</span>' : ""}
      </div>
    `,
			)
			.join("");
	}

	window.deleteCurrentDessertPhoto = (index) => {
		const photos = getCurrentPhotos();
		const removed = photos.splice(index, 1)[0];
		setCurrentPhotos(photos);
		renderDessertPhotos(photos);
		initPhotosSortable();

		// Удаляем файл с диска
		if (removed) {
			deleteFileFromDisk(removed);
		}
	};

	window.deleteDessertPhoto = async (catId, dessertId, index) => {
		const cat = data.catalog.find((c) => c.id === catId);
		if (!cat) return;

		const dessert = cat.desserts.find((d) => d.id === dessertId);
		if (!dessert) return;

		const removed = dessert.photos.splice(index, 1)[0];
		dessert.image = dessert.photos[0] || "";

		// Удаляем файл с диска
		if (removed) {
			await deleteFileFromDisk(removed);
		}

		// Сохраняем без перерендера секции, просто закрываем и переоткрываем модалку
		closeModal();

		// Сохраняем на сервер
		await fetch("/api/admin/catalog", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data.catalog),
		});

		// Перезагружаем данные
		await loadData();

		// Открываем модалку заново
		showDessertModal(
			data.catalog
				.find((c) => c.id === catId)
				?.desserts.find((d) => d.id === dessertId),
			catId,
		);
	};

	async function deleteDessert(id) {
		if (!confirm("Удалить десерт со всеми фотографиями?")) return;

		for (const cat of data.catalog) {
			const dessert = cat.desserts.find((d) => d.id === id);
			if (dessert) {
				// Удаляем все фотографии с диска
				if (dessert.image) {
					await deleteFileFromDisk(dessert.image);
				}
				for (const photo of dessert.photos || []) {
					await deleteFileFromDisk(photo);
				}
			}
			cat.desserts = cat.desserts.filter((d) => d.id !== id);
		}

		await saveAndRender();
	}

	// ============ PORTFOLIO CRUD ============
	async function addPortfolioCategory() {
		const name = prompt("Название категории:");
		if (!name) return;

		data.portfolio = data.portfolio || { categories: [], subtitle: "" };
		const newCat = {
			id: "port" + Date.now(),
			name,
			isVisible: true,
			coverPhoto: "",
			photos: [],
			order: data.portfolio.categories.length,
		};

		data.portfolio.categories.push(newCat);
		await saveAndRender();
	}

	async function deletePortfolioCategory(id) {
		if (!confirm("Удалить категорию со всеми фотографиями?")) return;

		const cat = data.portfolio?.categories?.find((c) => c.id === id);
		if (cat) {
			// Удаляем фотографии с диска
			for (const photo of cat.photos || []) {
				if (photo) await deleteFileFromServer(photo);
			}
		}

		data.portfolio.categories = data.portfolio.categories.filter(
			(c) => c.id !== id,
		);
		await saveAndRender();
	}

	async function uploadPortfolioPhoto(input) {
		const catId = input.dataset.cat;
		const files = Array.from(input.files);
		if (!files.length) return;

		data.portfolio = data.portfolio || { categories: [], subtitle: "" };
		const cat = data.portfolio.categories.find((c) => c.id === catId);
		if (!cat) return;

		for (const file of files) {
			try {
				const formData = new FormData();
				formData.append("file", file);
				formData.append("folder", "portfolio");

				const res = await fetch("/api/admin/upload", {
					method: "POST",
					body: formData,
				});
				const json = await res.json();

				if (json.url) {
					// Добавляем в начало списка
					cat.photos.unshift(json.url);
				}
			} catch {
				console.error("Upload error:", err);
			}
		}

		await savePortfolioData();
		await renderSection("portfolio");
		showToast(`Загружено ${files.length} фото`);
	}

	async function deletePortfolioPhoto(catId, index) {
		const cat = data.portfolio?.categories?.find((c) => c.id === catId);
		if (!cat) return;

		const photo = cat.photos[index];
		if (photo) {
			await deleteFileFromServer(photo);
		}

		cat.photos.splice(index, 1);

		// Если удалили обложку, сбрасываем
		if (cat.coverPhoto === photo) {
			cat.coverPhoto = cat.photos[0] || "";
		}

		await savePortfolioData();
		await renderSection("portfolio");
	}

	async function deleteFileFromServer(path) {
		if (!path) return;
		try {
			await fetch("/api/admin/file", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path }),
			});
		} catch (err) {
			console.error("Error deleting file:", err);
		}
	}

	// ============ FAQ CRUD ============
	function showFAQModal(item = null, index = null) {
		const html = `
      <div class="modal-overlay active" id="faq-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">${item ? "Редактировать" : "Новый"} вопрос</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <form id="faq-form">
            <div class="form-group">
              <label>Вопрос</label>
              <input type="text" name="question" value="${item?.question || ""}" required>
            </div>
            <div class="form-group">
              <label>Ответ</label>
              <textarea name="answer" rows="4" required>${item?.answer || ""}</textarea>
            </div>
            <input type="hidden" name="index" value="${index ?? ""}">
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">💾 Сохранить</button>
              <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            </div>
          </form>
        </div>
      </div>
    `;

		document.body.insertAdjacentHTML("beforeend", html);

		document
			.getElementById("faq-form")
			.addEventListener("submit", async (e) => {
				e.preventDefault();
				const fd = new FormData(e.target);
				const idx = fd.get("index");

				const payload = {
					id: item?.id || "faq" + Date.now(),
					question: fd.get("question"),
					answer: fd.get("answer"),
				};

				if (idx !== "") {
					data.faq[parseInt(idx)] = payload;
				} else {
					data.faq.push(payload);
				}

				await saveAndRender();
				closeModal();
			});
	}

	async function deleteFAQ(index) {
		if (!confirm("Удалить вопрос?")) return;
		data.faq.splice(index, 1);
		await saveAndRender();
	}

	// ============ REVIEWS CRUD ============
	function showReviewModal(item = null, index = null) {
		const currentScreenshot = item?.screenshot || "";
		const html = `
      <div class="modal-overlay active" id="review-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">${item ? "Редактировать" : "Новый"} отзыв</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <form id="review-form">
            <p class="hint-text">📌 Отзыв — это либо текст, либо скриншот. Нельзя использовать оба варианта сразу: при загрузке скриншота текст вводить нельзя, а если написан текст — скриншот загрузить нельзя.</p>
            <div class="form-group">
              <label>Имя клиента</label>
              <input type="text" name="clientName" value="${item?.clientName || ""}" required>
            </div>
            <div class="form-group">
              <label>Текст отзыва</label>
              <textarea name="text" id="review-text-field" rows="4" ${currentScreenshot ? "disabled" : "required"}>${item?.text || ""}</textarea>
            </div>
            <div class="form-group">
              <label>Дата</label>
              <input type="date" name="date" value="${item?.date || new Date().toISOString().split("T")[0]}">
            </div>
            <div class="form-group">
              <label>Скриншот</label>
              <div class="image-upload" id="review-image-upload">
                <input type="hidden" name="screenshot" value="${currentScreenshot}" id="review-screenshot-field">
                <input type="hidden" name="oldScreenshot" value="${currentScreenshot}" id="review-old-screenshot">
                <img src="${currentScreenshot}" class="image-preview review-image-preview ${currentScreenshot ? "" : "hidden"}" id="review-img-preview">
                <div class="image-upload-buttons">
                  <input type="file" id="review-img-input" accept="image/*" style="display:none">
                  <button type="button" class="btn btn-secondary" onclick="document.getElementById('review-img-input').click()">📷 Загрузить</button>
                  ${currentScreenshot ? '<button type="button" class="btn btn-danger btn-sm" id="review-delete-img">🗑️ Удалить</button>' : ""}
                </div>
              </div>
            </div>
            <input type="hidden" name="index" value="${index ?? ""}">
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">💾 Сохранить</button>
              <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            </div>
          </form>
        </div>
      </div>
    `;

		document.body.insertAdjacentHTML("beforeend", html);

		const reviewTextField = document.getElementById("review-text-field");
		const reviewImgInput = document.getElementById("review-img-input");
		const reviewScreenshotField = document.getElementById("review-screenshot-field");

		function syncReviewTextState() {
			const hasScreenshot = Boolean(reviewScreenshotField?.value);
			if (reviewTextField) {
				reviewTextField.disabled = hasScreenshot;
				if (hasScreenshot) {
					reviewTextField.removeAttribute("required");
				} else {
					reviewTextField.setAttribute("required", "");
				}
			}
		}
		syncReviewTextState();

		reviewTextField?.addEventListener("input", () => {
			if ((reviewTextField.value || "").trim() && reviewScreenshotField?.value) {
				showToast("Нельзя совмещать текст и скриншот: сначала удалите скриншот", "error");
				reviewTextField.value = "";
			}
		});

		document
			.getElementById("review-img-input")
			?.addEventListener("change", (e) => {
				if ((reviewTextField?.value || "").trim()) {
					showToast("Нельзя совмещать текст и скриншот: сначала очистите текст отзыва", "error");
					e.target.value = "";
					return;
				}
				uploadImage(
					e.target.files[0],
					"screenshot",
					"review-img-preview",
					() => {
						// After new image upload, remove old screenshot file
						const oldScreenshot = document.getElementById(
							"review-old-screenshot",
						)?.value;
						if (oldScreenshot) {
							deleteFileFromServer(oldScreenshot);
							document.getElementById("review-old-screenshot").value = "";
						}
						// Show delete button after upload
						const uploadDiv = document.getElementById("review-image-upload");
						const buttonsDiv = uploadDiv?.querySelector(
							".image-upload-buttons",
						);
						if (buttonsDiv && !buttonsDiv.querySelector("#review-delete-img")) {
							const btn = document.createElement("button");
							btn.type = "button";
							btn.className = "btn btn-danger btn-sm";
							btn.id = "review-delete-img";
							btn.textContent = "🗑️ Удалить";
							btn.onclick = deleteReviewImage;
							buttonsDiv.appendChild(btn);
						}
						syncReviewTextState();
					},
				);
			});

		// Delete image button handler
		document
			.getElementById("review-delete-img")
			?.addEventListener("click", deleteReviewImage);

		function deleteReviewImage() {
			const screenshot = document.getElementById(
				"review-screenshot-field",
			)?.value;
			if (screenshot) {
				deleteFileFromServer(screenshot);
			}
			document.getElementById("review-screenshot-field").value = "";
			document.getElementById("review-img-preview").classList.add("hidden");
			document.getElementById("review-img-preview").src = "";
			const deleteBtn = document.getElementById("review-delete-img");
			if (deleteBtn) deleteBtn.remove();
			syncReviewTextState();
		}

		document
			.getElementById("review-form")
			.addEventListener("submit", async (e) => {
				e.preventDefault();
				const fd = new FormData(e.target);
				const idx = fd.get("index");
				const text = (fd.get("text") || "").toString().trim();
				const screenshot = (fd.get("screenshot") || "").toString().trim();

				if (text && screenshot) {
					showToast("Выберите что-то одно: либо текст, либо скриншот", "error");
					return;
				}
				if (!text && !screenshot) {
					showToast("Заполните текст отзыва или загрузите скриншот", "error");
					return;
				}

				const payload = {
					id: item?.id || "rev" + Date.now(),
					clientName: fd.get("clientName"),
					text: screenshot ? "" : text,
					date: fd.get("date"),
					screenshot: screenshot,
					isVisible: item?.isVisible !== false,
				};

				if (idx !== "") {
					data.reviews[parseInt(idx)] = payload;
				} else {
					data.reviews.push(payload);
				}

				await saveAndRender();
				closeModal();
			});
	}

	async function deleteReview(index) {
		if (!confirm("Удалить отзыв?")) return;
		const review = data.reviews[index];
		if (review?.screenshot) {
			await deleteFileFromServer(review.screenshot);
		}
		data.reviews.splice(index, 1);
		await saveAndRender();
	}

	// ============ SECTIONS ============
	async function saveSectionsOrder() {
		const list = document.getElementById("sections-sortable");
		if (!list) return;

		const order = [];
		list.querySelectorAll("[data-section]").forEach((el) => {
			order.push(el.dataset.section);
		});

		data.sections = order;

		// Сохраняем порядок секций на сервер
		const res = await fetch("/api/admin/sections", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(order),
		});

		if (res.ok) {
			showToast("Порядок секций сохранён!");
			// Перерисовываем текущую секцию без перезагрузки данных
			await renderSection("sections");
			setTimeout(initSortable, 100);
		} else {
			showToast("Ошибка сохранения", "error");
		}
	}

	function initSortable() {
		if (typeof Sortable === "undefined") return;

		const catalogList = document.getElementById("catalog-list");
		if (catalogList && currentSection === "catalog") {
			// Сортировка категорий
			new Sortable(catalogList, {
				animation: 150,
				ghostClass: "sortable-ghost",
				draggable: ".catalog-category",
				handle: ".drag-handle",
				onEnd: async () => {
					const items = [...catalogList.querySelectorAll(".catalog-category")];
					data.catalog = items
						.map((el, i) => {
							const cat = data.catalog.find(
								(c) => c.id === el.dataset.categoryId,
							);
							if (cat) cat.order = i;
							return cat;
						})
						.filter(Boolean);
					await saveAndRender();
				},
			});

			// Сортировка десертов внутри категорий
			catalogList.querySelectorAll(".desserts-list").forEach((list) => {
				new Sortable(list, {
					animation: 150,
					ghostClass: "sortable-ghost",
					draggable: ".dessert-item",
					handle: ".drag-handle",
					onEnd: async () => {
						const catId = list.dataset.categoryId;
						const cat = data.catalog.find((c) => c.id === catId);
						if (!cat) return;

						const items = [...list.querySelectorAll(".dessert-item")];
						const newOrder = items.map((el) => el.dataset.dessertId);

						// Пересортируем десерты
						cat.desserts = newOrder
							.map((id, i) => {
								const d = cat.desserts.find((dessert) => dessert.id === id);
								if (d) d.order = i;
								return d;
							})
							.filter(Boolean);

						await saveCatalogOnly();
					},
				});
			});
		}

		const sectionsList = document.getElementById("sections-sortable");
		if (sectionsList && currentSection === "sections") {
			new Sortable(sectionsList, {
				animation: 150,
				ghostClass: "sortable-ghost",
			});
		}

		// FAQ sorting
		const faqList = document.getElementById("faq-list");
		if (faqList && currentSection === "faq") {
			if (faqList.sortable) {
				faqList.sortable.destroy();
			}
			new Sortable(faqList, {
				animation: 200,
				ghostClass: "sortable-ghost",
				chosenClass: "sortable-chosen",
				draggable: ".faq-item-admin",
				handle: ".faq-drag",
				touchStartThreshold: 5,
				delay: 150,
				delayOnTouchOnly: true,
				onEnd: async () => {
					const items = [...faqList.querySelectorAll(".faq-item-admin")];
					const newOrder = items
						.map((el) => {
							const idx = parseInt(el.dataset.index);
							return data.faq[idx];
						})
						.filter(Boolean);
					data.faq = newOrder;
					const res = await fetch("/api/admin/faq", {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(data.faq),
					});
					if (res.ok) {
						await loadData();
						await renderSection("faq");
					}
				},
			});
		}

		// Reviews sorting
		const reviewsList = document.getElementById("reviews-list");
		if (reviewsList && currentSection === "reviews") {
			if (reviewsList.sortable) {
				reviewsList.sortable.destroy();
			}
			new Sortable(reviewsList, {
				animation: 200,
				ghostClass: "sortable-ghost",
				chosenClass: "sortable-chosen",
				draggable: ".review-item-admin",
				handle: ".drag-handle",
				touchStartThreshold: 5,
				delay: 150,
				delayOnTouchOnly: true,
				onEnd: async () => {
					const items = [...reviewsList.querySelectorAll(".review-item-admin")];
					const newOrder = items
						.map((el) => {
							const idx = parseInt(el.dataset.index);
							return data.reviews[idx];
						})
						.filter(Boolean);
					data.reviews = newOrder;
					const res = await fetch("/api/admin/reviews", {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(data.reviews),
					});
					if (res.ok) {
						await loadData();
						await renderSection("reviews");
					}
				},
			});
		}

		// Portfolio categories sorting
		const portfolioList = document.getElementById("portfolio-list");
		if (portfolioList && currentSection === "portfolio") {
			// Destroy existing sortable instances before creating new ones
			if (portfolioList.sortable) {
				portfolioList.sortable.destroy();
			}
			portfolioList.querySelectorAll(".photos-sortable").forEach((list) => {
				if (list.sortable) {
					list.sortable.destroy();
				}
			});

			new Sortable(portfolioList, {
				animation: 200,
				ghostClass: "sortable-ghost",
				chosenClass: "sortable-chosen",
				draggable: ".portfolio-cat",
				handle: ".drag-handle",
				touchStartThreshold: 5,
				onEnd: async () => {
					const items = [...portfolioList.querySelectorAll(".portfolio-cat")];
					// Rebuild categories array in DOM order
					const reorderedCats = items
						.map((el) => {
							const cat = data.portfolio?.categories?.find(
								(c) => c.id === el.dataset.categoryId,
							);
							if (cat) cat.order = items.indexOf(el);
							return cat;
						})
						.filter(Boolean);
					data.portfolio.categories = reorderedCats;
					await savePortfolioData();
				},
			});

			// Photos sorting within each category
			portfolioList.querySelectorAll(".photos-sortable").forEach((list) => {
				new Sortable(list, {
					animation: 200,
					ghostClass: "sortable-ghost",
					chosenClass: "sortable-chosen",
					draggable: ".photo-thumb",
					delay: 150,
					delayOnTouchOnly: true,
					touchStartThreshold: 3,
					forceFallback: true,
					onEnd: async () => {
						const catId = list.dataset.category;
						const cat = data.portfolio?.categories?.find((c) => c.id === catId);
						if (!cat) return;

						const items = [...list.querySelectorAll(".photo-thumb")];
						const newPhotos = items
							.map((el) => decodeURIComponent(el.dataset.photo))
							.filter(Boolean);

						// Update cover if needed
						if (cat.coverPhoto && !newPhotos.includes(cat.coverPhoto)) {
							cat.coverPhoto = newPhotos[0] || "";
						}

						cat.photos = newPhotos;
						await savePortfolioData();
						await renderSection("portfolio");
					},
				});
			});
		}
	}

	// ============ BACKUPS ============
	async function createBackup() {
		try {
			const res = await fetch("/api/backup/create", { method: "POST" });
			const json = await res.json();
			if (json.success) {
				showToast("Бэкап создан!");
				await renderSection("backups");
			}
		} catch {
			showToast("Ошибка создания бэкапа", "error");
		}
	}

	// ============ STATS ============
	async function resetStats() {
		try {
			await fetch("/api/stats/reset", { method: "POST" });
			showToast("Статистика сброшена");
			await renderSection("analytics");
		} catch {
			showToast("Ошибка", "error");
		}
	}

	// ============ УТИЛИТЫ ============
	async function saveAndRender() {
		// Сохраняем весь каталог, портфолио, faq, reviews
		const results = await Promise.allSettled([
			fetch("/api/admin/catalog", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data.catalog),
			}),
			fetch("/api/admin/portfolio", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data.portfolio),
			}),
			fetch("/api/admin/faq", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data.faq),
			}),
			fetch("/api/admin/reviews", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data.reviews),
			}),
		]);

		// Проверяем ошибки
		const errors = results.filter(
			(r) => r.status === "rejected" || !r.value.ok,
		);
		if (errors.length > 0) {
			console.error("Save errors:", errors);
			showToast("Ошибка сохранения", "error");
		}

		await loadData();
		await renderSection(currentSection);

		// Инициализируем сортировку после рендера
		if (currentSection === "catalog") {
			setTimeout(initSortable, 100);
		}
		if (currentSection === "promo") setTimeout(initPromoPhotosSortable, 100);

		showToast("Сохранено!");
	}

	function initPromoPhotosSortable() {
		const grid = document.getElementById("promo-photos-grid");
		if (!grid || typeof Sortable === "undefined") return;
		if (grid.sortable) grid.sortable.destroy();
		grid.sortable = new Sortable(grid, {
			animation: 200,
			ghostClass: "sortable-ghost",
			chosenClass: "sortable-chosen",
			draggable: ".photo-item",
			delay: 150,
			delayOnTouchOnly: true,
			touchStartThreshold: 3,
			forceFallback: true,
			onEnd: async () => {
				data.promo.images = [...grid.querySelectorAll(".photo-item")]
					.map((item) => decodeURIComponent(item.dataset.photo)).filter(Boolean);
					await savePromoImages();
			},
		});
	}

	async function uploadImage(file, fieldName, previewId, onSuccess) {
		if (!file) return;

		const formData = new FormData();
		formData.append("file", file);
		formData.append("folder", "logo");

		// Определяем папку по имени поля
		const folderMap = {
			logoImage: "logo",
			heroBackgroundImage: "about",
			promoBackgroundImage: "about",
			aboutPhoto: "about",
			image: "desserts",
			screenshot: "reviews",
		};
		formData.set("folder", folderMap[fieldName] || "about");

		// Передаём oldPath для удаления старого файла
		const oldPathInput = document.querySelector(`[name="${fieldName}"]`);
		const oldPath = oldPathInput?.value;
		if (oldPath) {
			formData.append("oldPath", oldPath);
		}

		try {
			const res = await fetch("/api/admin/upload", {
				method: "POST",
				body: formData,
			});
			const json = await res.json();

			if (json.url) {
				document.querySelector(`[name="${fieldName}"]`).value = json.url;
				const preview = document.getElementById(previewId);
				if (preview) preview.src = json.url;
				if (fieldName === "promoBackgroundImage") {
					const deleteButton = document.querySelector('[data-action="deletePromoBackground"]');
					if (deleteButton) deleteButton.hidden = false;
				}
				if (typeof onSuccess === "function") {
					onSuccess(json.url);
				}
			}
		} catch {
			showToast("Ошибка загрузки", "error");
		}
	}

	window.deleteImage = async (fieldName, previewId) => {
		const input = document.querySelector(`[name="${fieldName}"]`);
		const preview = document.getElementById(previewId);

		// Получаем актуальный путь из скрытого input (может быть обновлён после загрузки)
		const currentPath = input?.value;

		// Удаляем файл с диска
		if (currentPath) {
			try {
				await fetch("/api/admin/file", {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ path: currentPath }),
				});
			} catch (err) {
				console.error("Error deleting file:", err);
			}
		}

		if (input) input.value = "";
		if (preview) {
			preview.src = "";
			preview.removeAttribute("src");
		}
	};

	window.applyColorPreset = (name) => {
		const preset = data.settings.colorPresets.find((p) => p.name === name);
		if (preset) {
			const content = document.getElementById("content");
			content.querySelector('[name="primary"]').value = preset.colors.primary;
			content.querySelector('[name="primaryHover"]').value =
				preset.colors.primaryHover;
			content.querySelector('[name="bg"]').value = preset.colors.bg;
			content.querySelector('[name="text"]').value = preset.colors.text;
			content.querySelector('[name="cardBg"]').value = preset.colors.cardBg;

			document
				.querySelectorAll(".color-preset")
				.forEach((el) => el.classList.remove("active"));
			document
				.querySelector(`.color-preset[onclick*="${name}"]`)
				?.classList.add("active");
		}
	};

	window.closeModal = () => {
		document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());
	};

	function slugify(text) {
		return text
			.toString()
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^a-zа-яё0-9-]/g, "")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "");
	}

	function showToast(message, type = "success") {
		const toast = document.getElementById("toast");
		toast.textContent = message;
		toast.className = `toast ${type} show`;
		setTimeout(() => toast.classList.remove("show"), 3000);
	}

	// ============ ЗАПУСК ============
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
