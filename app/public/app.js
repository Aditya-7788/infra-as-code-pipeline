const taskList = document.querySelector("#task-list");
const taskInput = document.querySelector("#task-input");
const addTaskForm = document.querySelector("#add-task-form");
const formError = document.querySelector("#form-error");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search-input");
const clearCompletedButton = document.querySelector("#clear-completed");

let tasks = [];
let selectedFilter = "all";

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

async function request(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `Request failed (${response.status}).`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function makeIcon(markup) {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = `task-item${task.completed ? " is-complete" : ""}`;

  const checkButton = document.createElement("button");
  checkButton.className = "task-check";
  checkButton.type = "button";
  checkButton.setAttribute("aria-label", task.completed ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`);
  checkButton.setAttribute("aria-pressed", String(task.completed));
  if (task.completed) {
    checkButton.append(makeIcon('<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8 3 3 6-6"/></svg>'));
  }
  checkButton.addEventListener("click", () => updateTask(task.id, { completed: !task.completed }));

  const copy = document.createElement("div");
  copy.className = "task-copy";
  const title = document.createElement("p");
  title.className = "task-title";
  title.textContent = task.title;
  const created = document.createElement("div");
  created.className = "task-created";
  created.textContent = `Added ${formatDate(new Date(task.createdAt))}`;
  copy.append(title, created);

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-task";
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", `Delete ${task.title}`);
  deleteButton.append(makeIcon('<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 6h11M8 6V4.5h4V6m-6 0 .7 9.5h6.6L14 6m-5 3v4m2-4v4"/></svg>'));
  deleteButton.addEventListener("click", () => deleteTask(task.id));

  item.append(checkButton, copy, deleteButton);
  return item;
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleTasks = tasks.filter((task) => {
    const matchesFilter = selectedFilter === "all"
      || (selectedFilter === "active" && !task.completed)
      || (selectedFilter === "completed" && task.completed);
    return matchesFilter && task.title.toLocaleLowerCase().includes(query);
  });
  const activeCount = tasks.filter((task) => !task.completed).length;
  const completedCount = tasks.length - activeCount;
  const percentage = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  taskList.replaceChildren(...visibleTasks.map(createTaskElement));
  taskList.setAttribute("aria-busy", "false");
  document.querySelector("#all-count").textContent = String(tasks.length);
  document.querySelector("#active-count").textContent = String(activeCount);
  document.querySelector("#filter-all-count").textContent = String(tasks.length);
  document.querySelector("#filter-active-count").textContent = String(activeCount);
  document.querySelector("#task-total").textContent = String(tasks.length);
  document.querySelector("#progress-count").innerHTML = `${completedCount} <span>/ ${tasks.length}</span>`;
  document.querySelector("#progress-percent").textContent = `${percentage}%`;
  document.querySelector("#progress-fill").style.width = `${percentage}%`;
  document.querySelector("#progress-bar").setAttribute("aria-valuenow", String(percentage));
  document.querySelector("#progress-message").textContent = tasks.length === 0
    ? "Your next small win is waiting."
    : completedCount === tasks.length
      ? "Everything is done. Take a well-earned breath."
      : `${activeCount} ${activeCount === 1 ? "task" : "tasks"} to go. You're doing great.`;
  clearCompletedButton.hidden = completedCount === 0;

  const isSearching = query.length > 0;
  emptyState.hidden = visibleTasks.length > 0;
  if (visibleTasks.length === 0) {
    document.querySelector("#empty-title").textContent = isSearching
      ? "No tasks found."
      : selectedFilter === "completed"
        ? "Nothing checked off just yet."
        : tasks.length > 0
          ? "All caught up."
          : "A little breathing room.";
    document.querySelector("#empty-copy").textContent = isSearching
      ? "Try a different search."
      : selectedFilter === "completed"
        ? "Your finished tasks will show up here."
        : tasks.length > 0
          ? "Everything on your list is done."
          : "Add a task above and make today yours.";
  }

  document.querySelectorAll("[data-filter]").forEach((button) => {
    const isSelected = button.dataset.filter === selectedFilter;
    button.classList.toggle("is-selected", isSelected);
    button.classList.toggle("is-active", button.classList.contains("nav-item") && isSelected);
    if (button.classList.contains("filter-tab")) {
      button.setAttribute("aria-pressed", String(isSelected));
    }
  });
}

async function loadTasks() {
  try {
    tasks = await request("/api/tasks");
    render();
  } catch (error) {
    taskList.setAttribute("aria-busy", "false");
    showError(`Couldn't load your tasks: ${error.message}`);
  }
}

async function addTask(title) {
  const task = await request("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  tasks.unshift(task);
  selectedFilter = "all";
  render();
}

async function updateTask(id, changes) {
  try {
    const updatedTask = await request(`/api/tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    tasks = tasks.map((task) => task.id === id ? updatedTask : task);
    render();
  } catch (error) {
    showError(`Couldn't update the task: ${error.message}`);
  }
}

async function deleteTask(id) {
  try {
    await request(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
    tasks = tasks.filter((task) => task.id !== id);
    render();
  } catch (error) {
    showError(`Couldn't delete the task: ${error.message}`);
  }
}

addTaskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) {
    showError("Write a task before adding it.");
    taskInput.focus();
    return;
  }
  formError.hidden = true;
  try {
    await addTask(title);
    taskInput.value = "";
    taskInput.focus();
  } catch (error) {
    showError(`Couldn't add the task: ${error.message}`);
  }
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedFilter = button.dataset.filter;
    render();
  });
});

searchInput.addEventListener("input", render);
clearCompletedButton.addEventListener("click", async () => {
  const completedTasks = tasks.filter((task) => task.completed);
  clearCompletedButton.disabled = true;
  try {
    await Promise.all(completedTasks.map((task) => request(`/api/tasks/${encodeURIComponent(task.id)}`, { method: "DELETE" })));
    tasks = tasks.filter((task) => !task.completed);
    render();
  } catch (error) {
    showError(`Couldn't clear completed tasks: ${error.message}`);
    await loadTasks();
  } finally {
    clearCompletedButton.disabled = false;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});

document.querySelector("#today-date").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
}).format(new Date());
loadTasks();
