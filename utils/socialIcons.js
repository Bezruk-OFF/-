const fs = require("fs");
const path = require("path");

const files = {
  whatsapp: "whatsapp.svg",
  telegram: "telegram.svg",
  max: "max.svg",
  instagram: "instagram.svg",
  vk: "vk.svg",
  ok: "odnoklassniki.svg",
};

/**
 * Градиентные иконки ссылаются на общий SVG-спрайт в template.html,
 * поэтому в них нет собственных <defs> и нет дублирующихся id.
 */
const gradientIcons = {
  max: {
    canvas: "M0 0h500v500H0z",
    svgClass: "icon-max",
    layers: [
      { className: "icon-max__bg icon-max__bg--main", fill: "url(#mx-main)" },
      { className: "icon-max__bg icon-max__bg--glow", fill: "url(#mx-glow)" },
    ],
  },
  instagram: {
    canvas: "M0 0h32v32H0z",
    svgClass: "icon-instagram",
    layers: [
      { className: "icon-instagram__bg icon-instagram__bg--main", fill: "url(#ig-main)" },
      { className: "icon-instagram__bg icon-instagram__bg--glow", fill: "url(#ig-glow)" },
    ],
  },
};

function renderSocialIcon(platform) {
  const filename = files[platform];
  if (!filename) return "";
  let svg = fs.readFileSync(path.join(__dirname, "..", "public", "images", "social", filename), "utf8");

  if (gradientIcons[platform]) {
    const { canvas, svgClass, layers } = gradientIcons[platform];
    // Убираем локальные <defs>: градиенты живут в общем спрайте страницы.
    svg = svg.replace(/<defs>[\s\S]*?<\/defs>/g, "");
    let layerIndex = 0;
    svg = svg.replace(/<path\b([^>]*)\/>/g, (match, attrs) => {
      if (!attrs.includes(`d="${canvas}"`)) return match;
      const layer = layers[layerIndex++];
      if (!layer) return match;
      const cleanedAttrs = attrs
        .replace(/\sfill="[^"]*"/, "")
        .replace(/\sclass="[^"]*"/, "")
        .replace(/\sstyle="[^"]*"/, "");
      return `<path class="${layer.className}"${cleanedAttrs} fill="${layer.fill}"/>`;
    });
    svg = svg.replace(/<svg\b([^>]*)>/, (_match, attrs) => {
      const viewBox = attrs.match(/\bviewBox="([^"]+)"/)?.[1] || "0 0 32 32";
      return `<svg class="social-icon ${svgClass}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">`;
    });
    return svg;
  }

  let backgroundNumber = 0;
  svg = svg.replace(/<path\b[^>]*?d="M0 0h(?:248|32|44)v(?:248|32|44)H0z"[^>]*\/>/g, match => {
    const className = backgroundNumber++ === 0
      ? "social-icon__background"
      : "social-icon__background social-icon__background--overlay";
    return match.replace("<path", `<path class="${className}"`);
  });
  svg = svg.replace(/<svg\b([^>]*)>/, (_match, attrs) => {
    const viewBox = attrs.match(/\bviewBox="([^"]+)"/)?.[1] || "0 0 32 32";
    return `<svg class="social-icon" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">`;
  });
  return svg;
}

module.exports = { renderSocialIcon };
