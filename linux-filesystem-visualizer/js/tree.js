function getIcon(path) {
  const icons = {
    "/": "🌳",
    "/bin": "🧰",
    "/boot": "🚀",
    "/dev": "🔌",
    "/etc": "⚙️",
    "/home": "🏠",
    "/lib": "📚",
    "/opt": "📦",
    "/proc": "🧠",
    "/root": "👑",
    "/sbin": "🛠️",
    "/tmp": "⏱️",
    "/usr": "🧑‍💻",
    "/var": "📝"
  };

  return icons[path] || "📁";
}

export function renderTree({ items, activePath, container, onSelect }) {
  container.innerHTML = "";

  items.forEach((item) => {
    const button = document.createElement("button");
    button.className = `tree-item${item.path === activePath ? " active" : ""}`;
    button.innerHTML = `<span class="tree-icon">${getIcon(item.path)}</span><span>${item.path} — ${item.title}</span>`;
    button.addEventListener("click", () => onSelect(item.path));
    container.appendChild(button);
  });
}

export function filterTreeItems(items, search) {
  const term = search.trim().toLowerCase();
  if (!term) return items;

  return items.filter((item) => {
    return (
      item.path.toLowerCase().includes(term) ||
      item.title.toLowerCase().includes(term) ||
      item.what.toLowerCase().includes(term)
    );
  });
}
