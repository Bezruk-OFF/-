/**
 * Публичный скрипт - SPA логика для сайта кондитера
 */

(() => {
	// Данные из API
	let siteData = null;

	// ============ ИНИЦИАЛИЗАЦИЯ ============
	async function init() {
		try {
			const response = await fetch("/api/data");
			siteData = await response.json();

			// Инициализация компонентов
			initCatalogTabs();
			initPromoCarousel();
			initReviewsCarousel();
			initFAQ();
			initLightbox();
			initModal();
			initScrollTop();
			initRouting();
			initContactTracking();
			initContactPopover();
			initMobileMenu();
			initStatsTracking();
			initPortfolio();
			initPromoGallery();

			// Начальный рендер
			if (siteData.catalog && siteData.catalog.length) {
				showCategory(siteData.catalog[0].id);
			}

			// Качество визита (с задержкой для отсеивания ботов)
			setTimeout(sendQualityVisit, 3000);
		} catch (err) {
			console.error("Init error:", err);
		}
	}

	function initPromoGallery() {
		const gallery = document.querySelector(".promo-gallery");
		if (!gallery) return;
		let photos;
		try { photos = JSON.parse(gallery.dataset.photos || "[]"); } catch { photos = []; }
		if (!photos.length) return;
		const mainImage = gallery.querySelector("#promo-main-image");
		const thumbnails = [...gallery.querySelectorAll(".promo-thumbnail")];
		let activeIndex = 0;
		const show = (index) => {
			activeIndex = (index + photos.length) % photos.length;
			mainImage.src = photos[activeIndex];
			thumbnails.forEach((thumb, i) => {
				thumb.classList.toggle("active", i === activeIndex);
				if (i === activeIndex) thumb.scrollIntoView({ block: "nearest", inline: "nearest" });
			});
		};
		gallery.addEventListener("promo-lightbox-change", (event) => show(event.detail.index));
		thumbnails.forEach((thumb) => thumb.addEventListener("click", () => show(Number(thumb.dataset.index))));
		gallery.querySelector(".promo-gallery-main")?.addEventListener("click", () => window.openLightbox?.(photos, activeIndex));
		let startX = 0;
		gallery.addEventListener("touchstart", (event) => { startX = event.changedTouches[0].screenX; }, { passive: true });
		gallery.addEventListener("touchend", (event) => {
			const delta = startX - event.changedTouches[0].screenX;
			if (Math.abs(delta) > 45) show(activeIndex + (delta > 0 ? 1 : -1));
		}, { passive: true });
	}

	// ============ ТАБЫ КАТАЛОГА ============
	function initCatalogTabs() {
		const tabs = document.querySelectorAll(".catalog-tabs .tab-btn");
		tabs.forEach((tab) => {
			tab.addEventListener("click", () => {
				const categoryId = tab.dataset.category;
				showCategory(categoryId);
			});
		});
	}

	function showCategory(categoryId) {
		// Обновляем табы
		document.querySelectorAll(".catalog-tabs .tab-btn").forEach((btn) => {
			btn.classList.toggle("active", btn.dataset.category === categoryId);
		});

		// Показываем нужную категорию
		document.querySelectorAll(".category-section").forEach((section) => {
			section.style.display =
				section.dataset.category === categoryId ? "grid" : "none";
		});

		// Отправляем статистику просмотра каталога
		sendStats("/api/stats/catalog-view");
	}

	// ============ КАРУСЕЛЬ ПРОМО ============
	function initPromoCarousel() {
		const carousel = document.querySelector(
			".promo .carousel-track, .promo .reviews-track",
		);
		if (!carousel) return;

		const prevBtn = document.querySelector(".promo .carousel-prev");
		const nextBtn = document.querySelector(".promo .carousel-next");

		if (prevBtn) {
			prevBtn.addEventListener("click", () => {
				carousel.scrollBy({ left: -carousel.offsetWidth, behavior: "smooth" });
			});
		}
		if (nextBtn) {
			nextBtn.addEventListener("click", () => {
				carousel.scrollBy({ left: carousel.offsetWidth, behavior: "smooth" });
			});
		}
	}

	// ============ КАРУСЕЛЬ ОТЗЫВОВ ============
	function initReviewsCarousel() {
		const carousel = document.querySelector(".reviews .reviews-track");
		if (!carousel) return;

		const prevBtn = document.querySelector(".reviews .carousel-prev");
		const nextBtn = document.querySelector(".reviews .carousel-next");
		const cards = [...carousel.querySelectorAll(".review-card")];

		cards.forEach((card) => {
			const wrap = card.querySelector(".review-text-wrap");
			const preview = card.querySelector(".review-text-preview");
			const full = card.querySelector(".review-text-full");
			const button = card.querySelector(".review-read-more");
			if (!wrap || !preview || !full || !button) return;

			const scrollBox = card.querySelector(".review-text-scroll");

			const layoutPreview = () => {
				if (card.classList.contains("review-expanded")) return;
				if (!scrollBox) return;

				// Кнопка занимает место в потоке — резервируем её, чтобы
				// текст обрезался ровно по высоте свободной области
				button.hidden = false;
				const available = scrollBox.clientHeight;
				if (!available) return;

				const styles = getComputedStyle(preview);
				const lineHeight =
					parseFloat(styles.lineHeight) ||
					parseFloat(styles.fontSize) * 1.6 ||
					20;

				// Полная высота текста без ограничения по числу строк
				preview.style.setProperty("-webkit-line-clamp", "none");
				const fullHeight = preview.scrollHeight;
				const lines = Math.max(1, Math.floor(available / lineHeight));

				// Текст не помещается — показываем многоточие и кнопку
				const truncated = fullHeight > available + 1;
				button.hidden = !truncated;
				preview.style.setProperty(
					"-webkit-line-clamp",
					truncated ? String(lines) : "none",
				);
			};

			layoutPreview();
			if ("ResizeObserver" in window) {
				new ResizeObserver(layoutPreview).observe(wrap);
			}

			button.addEventListener("click", () => {
				const expanded = card.classList.toggle("review-expanded");
				preview.hidden = expanded;
				full.hidden = !expanded;
				button.textContent = expanded ? "Свернуть" : "Читать далее";
				if (scrollBox) scrollBox.scrollTop = 0;
				if (!expanded) layoutPreview();
			});
		});

		function scrollOneCard(direction) {
			const first = cards[0];
			if (!first) return;
			const step = cards[1]
				? cards[1].offsetLeft - first.offsetLeft
				: first.offsetWidth;
			carousel.scrollBy({ left: direction * step, behavior: "smooth" });
		}

		if (prevBtn) {
			prevBtn.addEventListener("click", () => scrollOneCard(-1));
		}
		if (nextBtn) {
			nextBtn.addEventListener("click", () => {
				scrollOneCard(1);
				sendStats("/api/stats/reviews/view");
			});
		}
	}

	// ============ FAQ АККОРДЕОН ============
	function initFAQ() {
		const faqItems = document.querySelectorAll(".faq-item");
		faqItems.forEach((item) => {
			const question = item.querySelector(".faq-question");
			const answer = item.querySelector(".faq-answer");

			question?.addEventListener("click", () => {
				const isOpen = item.classList.contains("open");

				// Закрываем все
				faqItems.forEach((i) => {
					i.classList.remove("open");
					const a = i.querySelector(".faq-answer");
					if (a) a.style.maxHeight = null;
				});

				// Открываем текущий
				if (!isOpen) {
					item.classList.add("open");
					if (answer) {
						answer.style.maxHeight = answer.scrollHeight + "px";
					}

					// Отправляем статистику
					const faqId = question.dataset.id;
					sendStats("/api/stats/faq-click", { questionId: faqId });
				}
			});
		});
	}

	// ============ ЛАЙТБОКС ============
	function initLightbox() {
		const lightbox = document.getElementById("lightbox");
		if (!lightbox) return;

		const lightboxImg = lightbox.querySelector(".lightbox-image");
		const closeBtn = lightbox.querySelector(".lightbox-close");
		const prevBtn = lightbox.querySelector(".lightbox-prev");
		const nextBtn = lightbox.querySelector(".lightbox-next");

		let images = [];
		let currentIndex = 0;
		let touchStartX = 0;
		let touchEndX = 0;

		// Функция открытия лайтбокса с набором фото
		window.openLightbox = (imgArray, startIndex = 0) => {
			images = imgArray;
			currentIndex = startIndex;
			showLightboxImage();
			lightbox.classList.add("active");
		};

		function showLightboxImage() {
			if (lightboxImg && images[currentIndex]) {
				lightboxImg.src = images[currentIndex];
				const promoGallery = document.querySelector(".promo-gallery");
				if (promoGallery && promoGallery.dataset.photos === JSON.stringify(images)) {
					promoGallery.dispatchEvent(new CustomEvent("promo-lightbox-change", { detail: { index: currentIndex } }));
				}
			}
		}

		function nextImage() {
			currentIndex = (currentIndex + 1) % images.length;
			showLightboxImage();
		}

		function prevImage() {
			currentIndex = (currentIndex - 1 + images.length) % images.length;
			showLightboxImage();
		}

		closeBtn?.addEventListener("click", () => {
			lightbox.classList.remove("active");
		});

		prevBtn?.addEventListener("click", prevImage);
		nextBtn?.addEventListener("click", nextImage);

		// Тач-свайпы для мобильных
		lightbox.addEventListener(
			"touchstart",
			(e) => {
				touchStartX = e.changedTouches[0].screenX;
			},
			{ passive: true },
		);

		lightbox.addEventListener(
			"touchend",
			(e) => {
				touchEndX = e.changedTouches[0].screenX;
				handleSwipe();
			},
			{ passive: true },
		);

		function handleSwipe() {
			const diff = touchStartX - touchEndX;
			if (Math.abs(diff) > 50) {
				if (diff > 0) {
					nextImage();
				} else {
					prevImage();
				}
			}
		}

		lightbox.addEventListener("click", (e) => {
			if (e.target === lightbox) {
				lightbox.classList.remove("active");
			}
		});

		document.addEventListener("keydown", (e) => {
			if (!lightbox.classList.contains("active")) return;
			if (e.key === "Escape") lightbox.classList.remove("active");
			if (e.key === "ArrowLeft") prevImage();
			if (e.key === "ArrowRight") nextImage();
		});
	}

	// ============ ПОРТФОЛИО ============
	function initPortfolio() {
		const catButtons = document.querySelectorAll(".portfolio-cat-btn");
		const categories = document.querySelectorAll(".portfolio-category");
		const lightbox = document.getElementById("portfolio-lightbox");
		const closeCategoryBtn = document.getElementById("portfolio-category-close");
		const hidePhotosTopBtn = document.getElementById("portfolio-category-close-top");
		const portfolioSection = document.getElementById("portfolio");

		if (!catButtons.length) return;

		// Загрузка фотографий категории по требованию
		function loadCategoryPhotos(categoryEl) {
			if (categoryEl.dataset.loaded === "true") return;
			let photos = [];
			try { photos = JSON.parse(categoryEl.dataset.photos || "[]"); } catch { photos = []; }
			categoryEl.innerHTML = photos
				.map(
					(photo, index) => `
					<div class="portfolio-item" data-src="${photo}" data-index="${index}">
						<img src="${photo}" alt="Фото работы ${index + 1}" loading="lazy">
					</div>`,
				)
				.join("");
			categoryEl.dataset.loaded = "true";
			bindPortfolioItems(categoryEl);
		}

		function bindPortfolioItems(categoryEl) {
			categoryEl.querySelectorAll(".portfolio-item").forEach((item) => {
				item.addEventListener("click", () => {
					const allItems = categoryEl.querySelectorAll(".portfolio-item");
					portfolioImages = Array.from(allItems).map((el) => el.dataset.src);
					portfolioIndex = parseInt(item.dataset.index) || 0;
					showPortfolioImage();
					portfolioLightbox?.classList.add("active");
				});
			});
		}

		let portfolioImages = [];
		let portfolioIndex = 0;
		let portfolioLightbox = lightbox;
		const portfolioLightboxImage = lightbox?.querySelector(".lightbox-image");

		function showPortfolioImage() {
			if (portfolioLightboxImage && portfolioImages[portfolioIndex]) {
				portfolioLightboxImage.src = portfolioImages[portfolioIndex];
				portfolioLightboxImage.alt = `Фото ${portfolioIndex + 1} из ${portfolioImages.length}`;
			}
		}

		// Переключение категорий
		catButtons.forEach((btn) => {
			btn.addEventListener("click", () => {
				const categoryId = btn.dataset.category;

				// Активируем кнопку
				catButtons.forEach((b) => b.classList.remove("active"));
				btn.classList.add("active");

				// Показываем нужную категорию и подгружаем её фото
				categories.forEach((cat) => {
					const isActive = cat.dataset.category === categoryId;
					cat.style.display = isActive ? "block" : "none";
					if (isActive) loadCategoryPhotos(cat);
				});

				setHideButtonsVisible(true);
			});
		});

		// Закрыть категорию - убрать фото, показать только карточки категорий
		function setHideButtonsVisible(isVisible) {
			if (closeCategoryBtn) closeCategoryBtn.hidden = !isVisible;
			if (hidePhotosTopBtn) hidePhotosTopBtn.hidden = !isVisible;
		}

		function hideCategoryPhotos() {
			categories.forEach((cat) => {
				cat.style.display = "none";
				cat.innerHTML = "";
				cat.dataset.loaded = "false";
			});
			catButtons.forEach((b) => b.classList.remove("active"));
			setHideButtonsVisible(false);
			portfolioSection?.scrollIntoView({ behavior: "smooth", block: "start" });
		}

		closeCategoryBtn?.addEventListener("click", hideCategoryPhotos);
		hidePhotosTopBtn?.addEventListener("click", () => {
			hideCategoryPhotos();
		});

		// Лайтбокс для фотографий
		if (lightbox) {
			const closeBtn = lightbox.querySelector(".lightbox-close");
			const prevBtn = lightbox.querySelector(".lightbox-prev");
			const nextBtn = lightbox.querySelector(".lightbox-next");

			let touchStartX = 0;
			let touchEndX = 0;

			function nextImage() {
				portfolioIndex = (portfolioIndex + 1) % portfolioImages.length;
				showPortfolioImage();
			}

			function prevImage() {
				portfolioIndex = (portfolioIndex - 1 + portfolioImages.length) % portfolioImages.length;
				showPortfolioImage();
			}

			// Кнопки навигации
			closeBtn?.addEventListener("click", () =>
				lightbox.classList.remove("active"),
			);
			prevBtn?.addEventListener("click", prevImage);
			nextBtn?.addEventListener("click", nextImage);

			// Закрытие по клику вне изображения
			lightbox.addEventListener("click", (e) => {
				if (e.target === lightbox) {
					lightbox.classList.remove("active");
				}
			});

			// Тач-свайпы
			lightbox.addEventListener(
				"touchstart",
				(e) => {
					touchStartX = e.changedTouches[0].screenX;
				},
				{ passive: true },
			);

			lightbox.addEventListener(
				"touchend",
				(e) => {
					touchEndX = e.changedTouches[0].screenX;
					const diff = touchStartX - touchEndX;
					if (Math.abs(diff) > 50) {
						if (diff > 0) nextImage();
						else prevImage();
					}
				},
				{ passive: true },
			);

			// Клавиатура
			document.addEventListener("keydown", (e) => {
				if (!lightbox.classList.contains("active")) return;
				if (e.key === "Escape") lightbox.classList.remove("active");
				if (e.key === "ArrowLeft") prevImage();
				if (e.key === "ArrowRight") nextImage();
			});
		}
	}

	// ============ МОДАЛЬНОЕ ОКНО ДЕСЕРТА ============
	function initModal() {
		const modal = document.getElementById("dessert-modal");
		if (!modal) return;

		const modalBody = modal.querySelector(".modal-body");
		const closeBtn = modal.querySelector(".modal-close");

		// Состояние для отслеживания текущего активного фото
		let currentActivePhotoIndex = 0;
		let currentDessertPhotos = [];

		// Открытие модалки по клику на карточку
		document.querySelectorAll(".dessert-card").forEach((card) => {
			card.addEventListener("click", (e) => {
				// Если кликнули на кнопку заказа - открываем поповер, не модалку
				if (e.target.closest('[data-action="order"]')) {
					openContactPopover(e);
					return;
				}

				const dessertId = card.dataset.id;
				const dessert = findDessert(dessertId);
				if (!dessert) return;

				sendStats(`/api/stats/dessert/${dessertId}/view`);
				openDessertModal(dessert);
			});
		});

		function openDessertModal(dessert) {
			currentActivePhotoIndex = 0;
			currentDessertPhotos = dessert.photos || [];

			// Формируем HTML модалки
			const photos = dessert.photos || [];
			const mainPhoto = photos[0] || dessert.image || "";

			// Миниатюры - показываем всегда, если есть хотя бы одно фото
			const thumbnailsHtml =
				photos.length > 0
					? photos
							.map(
								(p, i) => `
				<div class="modal-thumbnail ${i === 0 ? "active" : ""}" data-index="${i}" data-src="${p}">
					<img src="${p}" alt="${dessert.name}">
				</div>
			`,
							)
							.join("")
					: "";

			// Цена
			let priceHtml = `<span class="current-price">${dessert.price}${dessert.unit ? " " + dessert.unit : ""}</span>`;
			if (dessert.oldPrice) {
				priceHtml =
					`<span class="old-price">${dessert.oldPrice}</span> ` +
					priceHtml;
			}

			modalBody.innerHTML = `
				<div class="modal-dessert">
					<div class="modal-gallery">
						<div class="modal-main-image" id="modal-main-image">
							${mainPhoto ? `<img src="${mainPhoto}" alt="${dessert.name}" id="modal-main-img">` : ""}
						</div>
						${thumbnailsHtml ? `<div class="modal-thumbnails">${thumbnailsHtml}</div>` : ""}
					</div>
					<h2>${dessert.name}</h2>
					<div class="modal-price">${priceHtml}</div>
					${dessert.priceNote ? `<div class="price-note">${dessert.priceNote}</div>` : ""}
					<div class="modal-description">${dessert.fullDescription || dessert.shortDescription || dessert.description || ""}</div>
					<button type="button" class="btn btn-primary btn-order" data-action="order">
						${siteData.settings.orderButtonText || "Заказать"}
					</button>
				</div>
			`;

			// Обработчики
			initModalHandlers();

			modal.classList.add("active");
		}

		function initModalHandlers() {
			// Клик по главному фото - открываем лайтбокс
			const mainImg = document.getElementById("modal-main-img");
			mainImg?.addEventListener("click", () => {
				if (currentDessertPhotos.length > 0) {
					openLightbox(currentDessertPhotos, currentActivePhotoIndex);
				}
			});

			// Клик по миниатюрам
			document.querySelectorAll(".modal-thumbnail").forEach((thumb) => {
				thumb.addEventListener("click", () => {
					const index = parseInt(thumb.dataset.index);
					const src = thumb.dataset.src;

					// Обновляем главное фото
					const mainImg = document.getElementById("modal-main-img");
					if (mainImg) mainImg.src = src;

					// Обновляем активную миниатюру
					document
						.querySelectorAll(".modal-thumbnail")
						.forEach((t) => t.classList.remove("active"));
					thumb.classList.add("active");

					currentActivePhotoIndex = index;
				});
			});

			// Кнопка заказа - сначала закрываем модалку, потом открываем поповер
			document
				.querySelector(".modal-dessert .btn-order")
				?.addEventListener("click", (e) => {
					e.preventDefault();
					e.stopPropagation();
					// Сначала закрываем модалку
					closeDessertModal();
					// Затем открываем поповер с небольшой задержкой
					setTimeout(() => {
						openContactPopoverDirect();
					}, 50);
				});
		}

		// Закрытие модального окна - сбрасываем состояние
		function closeDessertModal() {
			modal.classList.remove("active");
			currentActivePhotoIndex = 0;
			currentDessertPhotos = [];
		}

		closeBtn?.addEventListener("click", closeDessertModal);

		modal.addEventListener("click", (e) => {
			if (e.target === modal) {
				closeDessertModal();
			}
		});

		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && modal.classList.contains("active")) {
				closeDessertModal();
			}
		});
	}

	function findDessert(id) {
		if (!siteData?.catalog) return null;
		for (const cat of siteData.catalog) {
			const dessert = cat.desserts?.find((d) => d.id === id);
			if (dessert) return dessert;
		}
		return null;
	}

	function openContactPopover(e) {
		const contactPopover = document.getElementById("contact-popover");
		if (!contactPopover) return;
		if (e) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
		}
		// Используем setTimeout чтобы глобальный обработчик не закрыл поповер сразу
		setTimeout(() => {
			contactPopover.classList.add("active");
		}, 10);
	}

	// Прямое открытие поповера (без event propagation)
	function openContactPopoverDirect() {
		const contactPopover = document.getElementById("contact-popover");
		if (contactPopover) {
			contactPopover.classList.add("active");
		}
	}

	// ============ КНОПКА НАВЕРХ ============
	function initScrollTop() {
		const btn = document.querySelector(".scroll-top");
		if (!btn) return;

		window.addEventListener("scroll", () => {
			btn.classList.toggle("visible", window.scrollY > 500);
		});

		btn.addEventListener("click", () => {
			window.scrollTo({ top: 0, behavior: "smooth" });
		});
	}

	// ============ РОУТИНГ (SPA) ============
	function initRouting() {
		// History API - обновление URL при открытии модалки
		window.addEventListener("popstate", (e) => {
			if (e.state?.dessertId) {
				const card = document.querySelector(
					`.dessert-card[data-id="${e.state.dessertId}"]`,
				);
				if (card) {
					card.scrollIntoView({ behavior: "smooth", block: "center" });
				}
			}
		});
	}

	// ============ ТРЕКИНГ КЛИКОВ ПО СВЯЗИ ============
	function initContactTracking() {
		// WhatsApp
		document.querySelectorAll('[data-stats*="whatsapp"]').forEach((btn) => {
			btn.addEventListener("click", () => {
				sendStats("/api/stats/click", { type: "chat", target: "whatsapp" });
			});
		});

		// Telegram
		document.querySelectorAll('[data-stats*="telegram"]').forEach((btn) => {
			btn.addEventListener("click", () => {
				sendStats("/api/stats/click", { type: "chat", target: "telegram" });
			});
		});

		// VK
		document.querySelectorAll('[data-stats*="vk"]').forEach((btn) => {
			btn.addEventListener("click", () => {
				sendStats("/api/stats/click", { type: "chat", target: "vk" });
			});
		});

		// Instagram
		document.querySelectorAll('[data-stats*="instagram"]').forEach((btn) => {
			btn.addEventListener("click", () => {
				sendStats("/api/stats/click", { type: "chat", target: "instagram" });
			});
		});

		// OK
		document.querySelectorAll('[data-stats*="ok"]').forEach((btn) => {
			btn.addEventListener("click", () => {
				sendStats("/api/stats/click", { type: "chat", target: "ok" });
			});
		});

		// MAX
		document.querySelectorAll('[data-stats*="max"]').forEach((btn) => {
			btn.addEventListener("click", () => {
				sendStats("/api/stats/click", { type: "chat", target: "max" });
			});
		});

		// Телефон
		document.querySelectorAll('[data-stats*="phone"]').forEach((btn) => {
			btn.addEventListener("click", () => {
				const target = btn.dataset.stats.includes("footer")
					? "footer"
					: "popover";
				sendStats("/api/stats/click", { type: "phone", target });
			});
		});

		// Промо
		document.querySelectorAll('[data-stats="promo-click"]').forEach((btn) => {
			btn.addEventListener("click", () => {
				sendStats("/api/stats/promo-click");
			});
		});

		// Заказ (клик по кнопке)
		document.querySelectorAll('[data-action="order"]').forEach((btn) => {
			btn.addEventListener("click", () => {
				sendStats("/api/stats/order-click");
			});
		});
	}

	// ============ ПОПОВЕР КОНТАКТОВ ============
	function initContactPopover() {
		const contactBtn = document.getElementById("contact-btn");
		const contactPopover = document.getElementById("contact-popover");
		const closeBtn = document.getElementById("contact-popover-close");

		if (!contactBtn || !contactPopover) return;

		// Открытие поповера
		contactBtn.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			contactPopover.classList.toggle("active");
			sendStats("/api/stats/click", { type: "phone", target: "popover" });
		});

		// Закрытие поповера
		closeBtn?.addEventListener("click", () => {
			contactPopover.classList.remove("active");
		});

		// Закрытие при клике вне поповера
		document.addEventListener("click", (e) => {
			// Игнорируем клики по кнопкам открытия поповера
			if (e.target.closest('[data-action="order"]')) return;
			if (
				!contactPopover.contains(e.target) &&
				!contactBtn.contains(e.target)
			) {
				contactPopover.classList.remove("active");
			}
		});

		// Закрытие по Escape
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && contactPopover.classList.contains("active")) {
				contactPopover.classList.remove("active");
			}
		});
	}

	function initMobileMenu() {
		const toggle = document.getElementById("mobile-menu-toggle");
		const nav = document.getElementById("site-nav");
		if (!toggle || !nav) return;

		const closeMenu = () => {
			nav.classList.remove("open");
			toggle.setAttribute("aria-expanded", "false");
			toggle.setAttribute("aria-label", "Открыть меню");
		};

		toggle.addEventListener("click", () => {
			const isOpen = nav.classList.toggle("open");
			toggle.setAttribute("aria-expanded", String(isOpen));
			toggle.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Открыть меню");
		});
		nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
		document.addEventListener("click", (event) => {
			if (!nav.contains(event.target) && !toggle.contains(event.target)) closeMenu();
		});
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape") closeMenu();
		});
	}

	// ============ ТРЕКИНГ СТАТИСТИКИ ============
	function initStatsTracking() {
		// Отправка событий scroll (для аналитики глубины просмотра)
		let scrollDepth = 0;
		window.addEventListener(
			"scroll",
			throttle(() => {
				const newDepth = Math.floor(
					window.scrollY / (document.body.offsetHeight / 4),
				);
				if (newDepth > scrollDepth) {
					scrollDepth = newDepth;
				}
			}, 1000),
		);
	}

	function sendQualityVisit() {
		sendStats("/api/stats/quality-visit", {
			referer: document.referrer || "direct",
		});
	}

	// ============ УТИЛИТЫ ============
	async function sendStats(url, data = {}) {
		try {
			await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
		} catch (err) {
			// Silently fail
		}
	}

	function throttle(fn, delay) {
		let lastCall = 0;
		return function (...args) {
			const now = Date.now();
			if (now - lastCall >= delay) {
				lastCall = now;
				fn.apply(this, args);
			}
		};
	}

	// ============ ЗАПУСК ============
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
