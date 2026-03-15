(function () {
  var themeToggle = document.getElementById("themeToggle");
  if (!themeToggle) {
    return;
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeToggle.textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
    try {
      localStorage.setItem("theme", theme);
    } catch (error) {
      // Ignore storage failures and keep the in-memory theme.
    }
  }

  themeToggle.addEventListener("click", function () {
    var nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  });

  applyTheme(document.documentElement.dataset.theme || "light");
}());