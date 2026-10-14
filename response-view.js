/*
 * Response view.
 * Plain JavaScript: no modules, bundler or build step.
 *
 * The response area is where the user pastes or loads the JSON response that
 * the AI gave for the selected leaf step. It checks the response with
 * ResponseValidator (response-schema.js), shows any problems, and shows the
 * document and/or the form that the response holds.
 *
 * It defines window.ResponseView. Usage:
 *
 *   var view = ResponseView.create({ onSaved: function (stepId) {} });
 *   parentElement.appendChild(view.element);
 *   view.show(pathOfSteps);   // [top-level step, ..., selected leaf step]
 *   view.clear();             // go back to the "select a step" message
 *
 * Each leaf step keeps its own pasted text and result while the page is open,
 * so showing a different step switches to that step's own response area
 * contents, and an unused step starts empty.
 *
 * A valid response is also saved with ResponseStore (response-store.js), so it
 * is loaded again when the page is reopened. The saved response of a step is
 * loaded the first time the step is shown, unless the user has already typed
 * or loaded text for it. If the options have an onSaved function, it is called
 * with the step id each time a response has been saved. If the store cannot be
 * used, the response area still works and says that nothing is saved.
 *
 * All text from the response is put on the page as plain text, never as HTML.
 *
 * This script must be loaded after response-schema.js and response-store.js.
 */
(function () {
  "use strict";

  var PLACEHOLDER_TEXT = "Select a step in the list to paste the AI's response for it.";
  var STATUS_DURATION_MS = 4000;
  var SAVED_TEXT = "Saved on this device.";
  var STORAGE_UNAVAILABLE_TEXT =
    "This response cannot be saved on this device. It is only kept while this page is open.";

  // Whether responses can be saved and loaded with ResponseStore.
  function storeAvailable() {
    return (
      Boolean(window.ResponseStore) &&
      typeof window.ResponseStore.save === "function" &&
      typeof window.ResponseStore.load === "function" &&
      typeof window.ResponseStore.isAvailable === "function" &&
      window.ResponseStore.isAvailable()
    );
  }

  // The result to show for a response that was loaded from the store. It is
  // checked again, in case the schema has changed since it was saved.
  function resultFromRecord(record) {
    if (window.ResponseValidator && typeof window.ResponseValidator.validateText === "function") {
      return window.ResponseValidator.validateText(record.text);
    }
    return { valid: true, errors: [], value: record.value };
  }

  // Used to give each rendered form field a unique id on the page.
  var formCounter = 0;

  function createElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (typeof text === "string") {
      element.textContent = text;
    }
    return element;
  }

  function removeChildren(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  // The key that a leaf step's saved text and result are kept under.
  function stepKey(leaf) {
    if (leaf && leaf.id !== undefined && leaf.id !== null) {
      return "id:" + String(leaf.id);
    }
    return "title:" + String(leaf && leaf.title);
  }

  // ---- Rendering a document ------------------------------------------------

  function renderDocument(documentData) {
    var section = createElement("section", "response-document");
    section.setAttribute("aria-label", "Document");

    section.appendChild(createElement("h3", "response-document-title", documentData.title));

    documentData.sections.forEach(function (part) {
      var block = createElement("div", "response-section");
      block.appendChild(createElement("h4", "response-section-heading", part.heading));

      String(part.body)
        .split(/\r?\n/)
        .forEach(function (line) {
          if (line.trim() !== "") {
            block.appendChild(createElement("p", "response-section-body", line));
          }
        });

      if (Array.isArray(part.items) && part.items.length > 0) {
        var list = createElement("ul", "response-section-items");
        part.items.forEach(function (item) {
          list.appendChild(createElement("li", "", item));
        });
        block.appendChild(list);
      }

      section.appendChild(block);
    });

    return section;
  }

  // ---- Rendering a form ----------------------------------------------------

  function buildControl(field, controlId) {
    var control;

    if (field.type === "textarea") {
      control = document.createElement("textarea");
      control.rows = 4;
    } else if (field.type === "select") {
      control = document.createElement("select");
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Choose an option";
      control.appendChild(empty);
      (field.options || []).forEach(function (optionText) {
        var option = document.createElement("option");
        option.value = optionText;
        option.textContent = optionText;
        control.appendChild(option);
      });
    } else {
      control = document.createElement("input");
      control.type = field.type === "number" ? "number" : field.type === "checkbox" ? "checkbox" : "text";
    }

    control.id = controlId;
    control.name = field.id;
    control.className = "response-control";
    if (field.required === true && field.type !== "checkbox") {
      control.required = true;
    }
    return control;
  }

  function renderForm(formData) {
    formCounter += 1;
    var prefix = "response-form-" + formCounter + "-";

    var form = createElement("form", "response-form");
    form.setAttribute("aria-label", "Form");
    form.noValidate = true;
    // The form is only shown. Pressing Enter in a field must not reload the page.
    form.addEventListener("submit", function (event) {
      event.preventDefault();
    });

    form.appendChild(createElement("h3", "response-form-title", formData.title));

    if (typeof formData.description === "string" && formData.description.trim() !== "") {
      form.appendChild(createElement("p", "response-form-description muted", formData.description));
    }

    formData.fields.forEach(function (field, index) {
      var controlId = prefix + index;
      var row = createElement("div", "response-field");
      var control = buildControl(field, controlId);
      var label = createElement("label", "response-field-label");
      label.setAttribute("for", controlId);

      if (field.type === "checkbox") {
        row.classList.add("is-checkbox");
        label.textContent = field.label;
        row.appendChild(control);
        row.appendChild(label);
      } else {
        label.textContent = field.label;
        row.appendChild(label);
        row.appendChild(control);
      }

      if (field.required === true) {
        var required = createElement("span", "response-required muted", " (required)");
        label.appendChild(required);
      }

      if (typeof field.help === "string" && field.help.trim() !== "") {
        row.appendChild(createElement("p", "response-field-help muted", field.help));
      }

      form.appendChild(row);
    });

    return form;
  }

  // ---- The response area ---------------------------------------------------

  var ResponseView = {
    create: function (options) {
      var settings = options || {};
      var element = createElement("section", "response-area");
      element.setAttribute("aria-label", "AI response");

      var heading = createElement("h2", "", "Response");

      var placeholder = createElement("p", "response-placeholder muted", PLACEHOLDER_TEXT);

      var responseFor = createElement("p", "response-for");
      responseFor.hidden = true;

      var body = createElement("div", "response-body");
      body.hidden = true;

      var textArea = document.createElement("textarea");
      textArea.className = "response-input";
      textArea.rows = 10;
      textArea.spellcheck = false;
      textArea.id = "response-input-" + (formCounter += 1);
      textArea.setAttribute("aria-label", "AI response as JSON");
      textArea.placeholder = "Paste the JSON response from the AI here, or load it from a file.";

      var actions = createElement("div", "response-actions");

      var checkButton = createElement("button", "response-check", "Check and show");
      checkButton.type = "button";

      var loadButton = createElement("button", "response-load", "Load from file");
      loadButton.type = "button";

      var fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json,application/json,text/plain";
      fileInput.className = "response-file";
      fileInput.hidden = true;
      fileInput.setAttribute("aria-label", "Load the JSON response from a file");

      var status = createElement("span", "response-status muted");
      status.setAttribute("role", "status");

      actions.appendChild(checkButton);
      actions.appendChild(loadButton);
      actions.appendChild(fileInput);
      actions.appendChild(status);

      // Says whether the response in the text area is saved on this device.
      // It has the class is-saved or is-unavailable when it is shown.
      var storageNote = createElement("p", "response-storage");
      storageNote.setAttribute("role", "status");
      storageNote.hidden = true;

      var errorBox = createElement("div", "response-errors");
      errorBox.setAttribute("role", "alert");
      errorBox.hidden = true;

      var output = createElement("div", "response-output");
      output.hidden = true;

      body.appendChild(textArea);
      body.appendChild(actions);
      body.appendChild(storageNote);
      body.appendChild(errorBox);
      body.appendChild(output);

      element.appendChild(heading);
      element.appendChild(placeholder);
      element.appendChild(responseFor);
      element.appendChild(body);

      // What is kept for each leaf step while the page is open:
      //   text        - the text in the text area,
      //   result      - the result of checking the text (or null),
      //   savedText   - the text that is saved in the store (or null),
      //   loaded      - whether the store has been asked for the saved response,
      //   storeProblem - whether the store failed for this step.
      var states = {};
      var currentKey = null;
      // The id of the current leaf step, which is the key in the store.
      var currentId = null;
      var statusTimer = null;

      function setStatus(message) {
        status.textContent = message;
        if (statusTimer) {
          clearTimeout(statusTimer);
          statusTimer = null;
        }
        if (message) {
          statusTimer = setTimeout(function () {
            status.textContent = "";
            statusTimer = null;
          }, STATUS_DURATION_MS);
        }
      }

      // Show whether the response in the text area is saved, or that it cannot be.
      function updateNote() {
        var state = getState();
        var message = "";
        var saved = false;
        var unavailable = false;

        if (state && (state.storeProblem || !storeAvailable())) {
          message = STORAGE_UNAVAILABLE_TEXT;
          unavailable = true;
        } else if (state && state.savedText !== null && state.savedText === textArea.value) {
          message = SAVED_TEXT;
          saved = true;
        }

        storageNote.textContent = message;
        storageNote.classList.toggle("is-saved", saved);
        storageNote.classList.toggle("is-unavailable", unavailable);
        storageNote.hidden = message === "";
      }

      function getState() {
        if (currentKey === null) {
          return null;
        }
        if (!states[currentKey]) {
          states[currentKey] = {
            text: "",
            result: null,
            savedText: null,
            loaded: false,
            storeProblem: false
          };
        }
        return states[currentKey];
      }

      // Show the errors, or the document and form, for a result (or nothing).
      function renderResult(result) {
        removeChildren(errorBox);
        removeChildren(output);
        errorBox.hidden = true;
        output.hidden = true;

        if (!result) {
          return;
        }

        if (!result.valid) {
          errorBox.appendChild(
            createElement(
              "p",
              "response-errors-title",
              "The response does not match the \"" + window.ResponseValidator.SCHEMA_NAME + "\" schema:"
            )
          );
          var list = createElement("ul", "response-errors-list");
          result.errors.forEach(function (message) {
            list.appendChild(createElement("li", "", message));
          });
          errorBox.appendChild(list);
          errorBox.hidden = false;
          return;
        }

        if (result.value.document) {
          output.appendChild(renderDocument(result.value.document));
        }
        if (result.value.form) {
          output.appendChild(renderForm(result.value.form));
        }
        output.hidden = false;
      }

      // Check the text in the text area and show the result.
      function checkAndShow() {
        var state = getState();
        if (!state) {
          return;
        }

        if (!window.ResponseValidator || typeof window.ResponseValidator.validateText !== "function") {
          state.result = {
            valid: false,
            errors: ["The response cannot be checked. Check that response-schema.js is loaded."],
            value: null
          };
          renderResult(state.result);
          setStatus("");
          return;
        }

        state.text = textArea.value;
        state.result = window.ResponseValidator.validateText(state.text);
        renderResult(state.result);

        if (state.result.valid) {
          // Only a valid response is saved.
          saveValid(state, currentKey, currentId, state.text);
        } else {
          setStatus("");
          updateNote();
        }
      }

      // Save a valid response against its leaf step.
      function saveValid(state, key, id, text) {
        if (id === null || !storeAvailable()) {
          state.storeProblem = true;
          setStatus("The response is valid.");
          updateNote();
          return;
        }

        setStatus("The response is valid. Saving...");

        window.ResponseStore.save(id, text).then(
          function () {
            state.savedText = text;
            state.storeProblem = false;
            // The user may have selected another step while the response was saved.
            if (key === currentKey) {
              setStatus("The response is valid and saved.");
              updateNote();
            }
            if (typeof settings.onSaved === "function") {
              settings.onSaved(id);
            }
          },
          function () {
            state.storeProblem = true;
            if (key === currentKey) {
              setStatus("The response is valid, but it could not be saved.");
              updateNote();
            }
          }
        );
      }

      // Load the saved response of the current step from the store. This is
      // done once for each step, and not if the user has already typed or loaded
      // text for the step.
      function loadSaved() {
        var state = getState();
        if (!state || state.loaded || currentId === null) {
          return;
        }
        state.loaded = true;

        if (!storeAvailable()) {
          updateNote();
          return;
        }

        var key = currentKey;

        window.ResponseStore.load(currentId).then(
          function (record) {
            if (!record || typeof record.text !== "string") {
              return;
            }
            // Keep what the user typed or loaded while the store was read.
            if (state.text !== "") {
              return;
            }

            state.text = record.text;
            state.savedText = record.text;
            state.result = resultFromRecord(record);

            // The user may have selected another step while the store was read.
            if (key === currentKey) {
              textArea.value = state.text;
              renderResult(state.result);
              setStatus(state.result.valid ? "Showing the saved response." : "");
              updateNote();
            }
          },
          function () {
            state.storeProblem = true;
            if (key === currentKey) {
              updateNote();
            }
          }
        );
      }

      // Show the text and result that are kept for a step, or an empty area.
      function restoreState() {
        var state = getState();
        textArea.value = state ? state.text : "";
        renderResult(state ? state.result : null);
        setStatus("");
        updateNote();
      }

      textArea.addEventListener("input", function () {
        var state = getState();
        if (!state) {
          return;
        }
        // The old result no longer belongs to the new text.
        state.text = textArea.value;
        state.result = null;
        renderResult(null);
        setStatus("");
        updateNote();
      });

      checkButton.addEventListener("click", checkAndShow);

      loadButton.addEventListener("click", function () {
        fileInput.click();
      });

      fileInput.addEventListener("change", function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) {
          return;
        }

        var keyAtStart = currentKey;
        var reader = new FileReader();

        reader.onload = function () {
          // The user may have selected another step while the file was read.
          if (keyAtStart !== currentKey) {
            return;
          }
          textArea.value = String(reader.result);
          checkAndShow();
        };

        reader.onerror = function () {
          setStatus("The file could not be read.");
        };

        reader.readAsText(file);

        // Allow the same file to be loaded again later.
        fileInput.value = "";
      });

      function showPlaceholder(message) {
        placeholder.textContent = message;
        placeholder.hidden = false;
        responseFor.hidden = true;
        body.hidden = true;
        currentKey = null;
        currentId = null;
        textArea.value = "";
        renderResult(null);
        setStatus("");
        updateNote();
      }

      return {
        element: element,

        // Show the response area for the selected leaf step.
        // path - the steps from the top level down to the selected leaf step.
        show: function (path) {
          if (!Array.isArray(path) || path.length === 0) {
            showPlaceholder(PLACEHOLDER_TEXT);
            return;
          }

          var leaf = path[path.length - 1];
          var key = stepKey(leaf);

          // Showing the same step again keeps what the user is doing.
          if (key === currentKey && !body.hidden) {
            return;
          }

          currentKey = key;
          currentId = leaf.id !== undefined && leaf.id !== null ? String(leaf.id) : null;
          responseFor.textContent = "Response for: " + String(leaf.title);

          placeholder.hidden = true;
          responseFor.hidden = false;
          body.hidden = false;

          restoreState();
          loadSaved();
        },

        // Go back to the "select a step" message.
        clear: function () {
          showPlaceholder(PLACEHOLDER_TEXT);
        }
      };
    }
  };

  window.ResponseView = ResponseView;
})();