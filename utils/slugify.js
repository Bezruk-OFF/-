/**
 * Преобразует текст в slug ( URL-дружелюбную строку)
 * @param {string} text - Исходный текст
 * @returns {string} Slug
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    // Заменяем пробелы и дефисы
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    // Удаляем все небуквенно-цифровые символы (кроме дефисов)
    .replace(/[^a-zа-яё0-9-]/g, '')
    // Транслитерация русских букв
    .replace(/[а-яё]/g, (char) => {
      const map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e',
        'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'j', 'к': 'k',
        'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
        'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
        'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '',
        'э': 'e', 'ю': 'yu', 'я': 'ya'
      };
      return map[char] || char;
    });
}

module.exports = { slugify };
