module.exports = {
  layout: "layouts/idiot-post.njk",
  tags: ["blog"],
  permalink: (data) => `/blog/${data.page.fileSlug}/`,
};