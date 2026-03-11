const fs = require("fs");
const path = require("path");

const toolDescriptions = {
  "trie-hard": "Step-by-step suffix trie explainer.",
  "yo-dawg": "Step-by-step suffix automaton explainer.",
};

function toTitleCase(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

module.exports = function () {
  const toolsRoot = path.join(__dirname, "..", "tools");

  if (!fs.existsSync(toolsRoot)) {
    return [];
  }

  return fs
    .readdirSync(toolsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const slug = entry.name;
      const htmlFile = `${slug}.html`;
      const htmlPath = path.join(toolsRoot, slug, htmlFile);

      if (!fs.existsSync(htmlPath)) {
        return null;
      }

      return {
        slug,
        title: toTitleCase(slug),
        description: toolDescriptions[slug] || "Interactive tool.",
        url: `/tools/${slug}/${htmlFile}`,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.title.localeCompare(right.title));
};