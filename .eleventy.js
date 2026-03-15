const pluginRss = require("@11ty/eleventy-plugin-rss");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPassthroughCopy("fonts");
  eleventyConfig.addPassthroughCopy("tools");
  eleventyConfig.addPassthroughCopy({ "idiot/assets": "assets/idiot" });

  eleventyConfig.addFilter("postDate", (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  });

  return {
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};