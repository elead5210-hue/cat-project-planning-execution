/*
 * Step list view.
 * Plain JavaScript: no modules, bundler or build step.
 *
 * Renders window.stepsData as a hierarchical (nested) list with a checkbox
 * for each step, and registers itself with the app as the "steps" view.
 *
 * Check-off rules:
 *   - Checking or unchecking a step does the same to all of its sub-steps.
 *   - A step with sub-steps is checked automatically when all of its
 *     sub-steps are checked, and is unchecked when any sub-step is unchecked.
 *   - A step with only some sub-steps checked shows the "partly done" state.
 *
 * This script must be loaded after app.js and steps-data.js.
 */
(function () {
  "use strict";

  // The working copy of the steps (the checked state lives here).
  var steps = null;

  // Elements for each step, by step id: { item, checkbox, step }.
  var refs = {};

  // The element that shows the overall progress.
  var progressElement = null;

  // The id of the selected leaf step, or null if no step is selected.
  var selectedId = null;

  // The prompt panel shown to the right of the list (null if it is not available).
  var panel = null;

  // The response area shown under the prompt panel (null if it is not available).
  var responseView = null;

  // The ids of the leaf steps that have a saved response: { id: true }.
  var savedIds = {};

  // Make a clean working copy so that the original data is never changed.
  function cloneSteps(list) {
    return list.map(function (step) {
      return {
        id: String(step.id),
        title: String(step.title),
        done: Boolean(step.done),
        children: Array.isArray(step.children) ? cloneSteps(step.children) : []
      };
    });
  }

  // Check or uncheck a step and all of its sub-steps.
  function setDone(step, done) {
    step.done = done;
    step.children.forEach(function (child) {
      setDone(child, done);
    });
  }

  // Make every step with sub-steps match its sub-steps.
  // Returns whether the given step is done.
  function syncStep(step) {
    if (step.children.length > 0) {
      var allDone = true;
      step.children.forEach(function (child) {
        if (!syncStep(child)) {
          allDone = false;
        }
      });
      step.done = allDone;
    }
    return step.done;
  }

  function syncAll() {
    steps.forEach(syncStep);
  }

  // Count the steps below a step: { done: number, total: number }.
  function countDescendants(step) {
    var counts = { done: 0, total: 0 };
    step.children.forEach(function (child) {
      counts.total += 1;
      if (child.done) {
        counts.done += 1;
      }
      var inner = countDescendants(child);
      counts.done += inner.done;
      counts.total += inner.total;
    });
    return counts;
  }

  // Count all steps in a list: { done: number, total: number }.
  function countAll(list) {
    var counts = { done: 0, total: 0 };
    list.forEach(function (step) {
      counts.total += 1;
      if (step.done) {
        counts.done += 1;
      }
      var inner = countDescendants(step);
      counts.done += inner.done;
      counts.total += inner.total;
    });
    return counts;
  }

  function findStep(list, id) {
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) {
        return list[i];
      }
      var found = findStep(list[i].children, id);
      if (found) {
        return found;
      }
    }
    return null;
  }

  // Find the steps from the top level down to the step with the given id.
  // Returns an array of steps, or null if the step is not found.
  function findPath(list, id) {
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) {
        return [list[i]];
      }
      var rest = findPath(list[i].children, id);
      if (rest) {
        return [list[i]].concat(rest);
      }
    }
    return null;
  }

  // Update the elements of a step (and its sub-steps) to match the data.
  function updateStepElements(step) {
    var ref = refs[step.id];
    if (ref) {
      var below = countDescendants(step);
      var partlyDone = !step.done && below.done > 0;

      ref.checkbox.checked = step.done;
      ref.checkbox.indeterminate = partlyDone;
      ref.item.classList.toggle("is-done", step.done);
      ref.item.classList.toggle("is-partly-done", partlyDone);
      ref.item.classList.toggle("is-selected", step.id === selectedId);

      // Only a leaf step has a response, so only a leaf step is marked.
      var hasSaved = step.children.length === 0 && savedIds[step.id] === true;
      ref.item.classList.toggle("has-saved-response", hasSaved);
      if (hasSaved) {
        ref.title.setAttribute("title", "A response is saved for this step");
      } else {
        ref.title.removeAttribute("title");
      }
    }
    step.children.forEach(updateStepElements);
  }

  function updateProgress() {
    if (!progressElement) {
      return;
    }
    var counts = countAll(steps);
    progressElement.textContent = counts.done + " of " + counts.total + " steps done";
  }

  function updateView() {
    steps.forEach(updateStepElements);
    updateProgress();
  }

  // Build the list item for one step, including its nested list.
  function buildItem(step) {
    var item = document.createElement("li");
    item.className = "step-item";

    var label = document.createElement("label");
    label.className = "step-label";

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "step-checkbox";
    checkbox.setAttribute("data-step-id", step.id);

    var title = document.createElement("span");
    title.className = "step-title";
    title.textContent = step.title;
    title.setAttribute("data-step-id", step.id);

    // The title of a leaf step (a step without sub-steps) can be selected.
    if (step.children.length === 0) {
      title.classList.add("is-leaf");
      title.tabIndex = 0;
      title.setAttribute("role", "button");
    }

    label.appendChild(checkbox);
    label.appendChild(title);
    item.appendChild(label);

    if (step.children.length > 0) {
      item.appendChild(buildList(step.children, true));
    }

    refs[step.id] = { item: item, checkbox: checkbox, title: title };
    return item;
  }

  function buildList(list, isNested) {
    var listElement = document.createElement("ul");
    listElement.className = isNested ? "step-list step-children" : "step-list";
    list.forEach(function (step) {
      listElement.appendChild(buildItem(step));
    });
    return listElement;
  }

  // Handle a click on any checkbox in the list.
  function handleChange(event) {
    var target = event.target;
    if (!target || !target.classList || !target.classList.contains("step-checkbox")) {
      return;
    }
    var step = findStep(steps, target.getAttribute("data-step-id"));
    if (!step) {
      return;
    }
    setDone(step, target.checked);
    syncAll();
    updateView();
  }

  // Get the leaf step for a clicked or focused title element (or null).
  function leafFromTitle(target) {
    if (!target || !target.classList || !target.classList.contains("step-title")) {
      return null;
    }
    var step = findStep(steps, target.getAttribute("data-step-id"));
    if (!step || step.children.length > 0) {
      return null;
    }
    return step;
  }

  // Show the prompt, and the response area, for the selected leaf step.
  // The response area keeps a separate response for each leaf step, so a
  // different selection shows that step's own response.
  function showPromptForSelection() {
    if (!selectedId) {
      return;
    }
    var path = findPath(steps, selectedId);
    if (!path) {
      return;
    }
    if (panel) {
      panel.show(path);
    }
    if (responseView) {
      responseView.show(path);
    }
  }

  // Select a leaf step: mark it and show its prompt.
  function selectLeaf(id) {
    selectedId = id;
    updateView();
    showPromptForSelection();
  }

  // Handle a click on the title of a step.
  function handleSelectClick(event) {
    var step = leafFromTitle(event.target);
    if (!step) {
      return;
    }
    // Selecting a leaf step does not check it off. The checkbox does that.
    event.preventDefault();
    selectLeaf(step.id);
  }

  // Let the keyboard select a leaf step with Enter or Space.
  function handleSelectKey(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    var step = leafFromTitle(event.target);
    if (!step) {
      return;
    }
    event.preventDefault();
    selectLeaf(step.id);
  }

  // Ask the store which leaf steps have a saved response, and mark them.
  // The marks are only a help: if the store cannot be used, no step is marked.
  function loadSavedMarks() {
    if (
      !window.ResponseStore ||
      typeof window.ResponseStore.list !== "function" ||
      typeof window.ResponseStore.isAvailable !== "function" ||
      !window.ResponseStore.isAvailable()
    ) {
      return;
    }

    window.ResponseStore.list().then(
      function (records) {
        records.forEach(function (record) {
          savedIds[String(record.stepId)] = true;
        });
        if (steps) {
          updateView();
        }
      },
      function () {
        // Nothing to do. The steps stay unmarked.
      }
    );
  }

  // Render the view into the given container.
  function render(container) {
    if (!Array.isArray(window.stepsData)) {
      var message = document.createElement("p");
      message.className = "muted";
      message.textContent = "There are no steps to show. Check that steps-data.js is loaded.";
      container.appendChild(message);
      return;
    }

    // Make the working copy once, so the checked state is kept if the view is shown again.
    if (!steps) {
      steps = cloneSteps(window.stepsData);
      syncAll();
    }

    refs = {};

    var heading = document.createElement("h2");
    heading.textContent = "Steps";

    progressElement = document.createElement("p");
    progressElement.className = "step-progress muted";

    var list = buildList(steps, false);
    list.addEventListener("change", handleChange);
    list.addEventListener("click", handleSelectClick);
    list.addEventListener("keydown", handleSelectKey);

    // The step list is on the left and the prompt panel is on the right.
    var layout = document.createElement("div");
    layout.className = "step-layout";

    var listColumn = document.createElement("div");
    listColumn.className = "step-list-column";
    listColumn.appendChild(heading);
    listColumn.appendChild(progressElement);
    listColumn.appendChild(list);
    layout.appendChild(listColumn);

    // The right column holds the prompt panel, with the response area under it.
    var sideColumn = document.createElement("div");
    sideColumn.className = "step-side-column";

    panel = null;
    if (window.PromptPanel && typeof window.PromptPanel.create === "function") {
      panel = window.PromptPanel.create();
      sideColumn.appendChild(panel.element);
    } else {
      console.error("prompt-panel.js must be loaded before step-list.js.");
    }

    responseView = null;
    if (window.ResponseView && typeof window.ResponseView.create === "function") {
      responseView = window.ResponseView.create({
        // A response was saved: mark its leaf step.
        onSaved: function (stepId) {
          savedIds[String(stepId)] = true;
          if (steps) {
            updateView();
          }
        }
      });
      sideColumn.appendChild(responseView.element);
    } else {
      console.error("response-view.js must be loaded before step-list.js.");
    }

    layout.appendChild(sideColumn);

    container.appendChild(layout);

    updateView();
    showPromptForSelection();
    loadSavedMarks();
  }

  if (window.App && typeof window.App.registerView === "function") {
    window.App.registerView("steps", render);
  } else {
    console.error("step-list.js must be loaded after app.js.");
  }
})();