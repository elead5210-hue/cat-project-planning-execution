/*
 * Prompt panel.
 * Plain JavaScript: no modules, bundler or build step.
 *
 * The panel is shown to the right of the step list. It shows the prompt that
 * PromptBuilder generates for the selected leaf step, with a button that
 * copies the prompt text to the clipboard.
 *
 * It defines window.PromptPanel. Usage:
 *
 *   var panel = PromptPanel.create();
 *   parentElement.appendChild(panel.element);
 *   panel.show(pathOfSteps);   // [top-level step, ..., selected leaf step]
 *   panel.clear();             // go back to the "select a step" message
 *
 * This script must be loaded after prompt-builder.js.
 */
(function () {
  "use strict";

  var PLACEHOLDER_TEXT = "Select a step in the list to generate a prompt for it.";
  var STATUS_DURATION_MS = 2500;

  // Copy text to the clipboard. Calls done(true) or done(false) when finished.
  function copyText(text, textArea, done) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).then(
        function () {
          done(true);
        },
        function () {
          done(copyWithSelection(textArea));
        }
      );
      return;
    }
    done(copyWithSelection(textArea));
  }

  // Older way to copy: select the text and use the copy command.
  function copyWithSelection(textArea) {
    try {
      textArea.focus();
      textArea.select();
      var copied = document.execCommand("copy");
      textArea.setSelectionRange(0, 0);
      return Boolean(copied);
    } catch (error) {
      return false;
    }
  }

  var PromptPanel = {
    create: function () {
      var element = document.createElement("aside");
      element.className = "prompt-panel";
      element.setAttribute("aria-label", "Generated prompt");

      var heading = document.createElement("h2");
      heading.textContent = "Prompt";

      var placeholder = document.createElement("p");
      placeholder.className = "prompt-placeholder muted";
      placeholder.textContent = PLACEHOLDER_TEXT;

      var promptFor = document.createElement("p");
      promptFor.className = "prompt-for";
      promptFor.hidden = true;

      var textArea = document.createElement("textarea");
      textArea.className = "prompt-text";
      textArea.readOnly = true;
      textArea.rows = 18;
      textArea.setAttribute("aria-label", "Prompt text");
      textArea.hidden = true;

      var actions = document.createElement("div");
      actions.className = "prompt-actions";
      actions.hidden = true;

      var copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "prompt-copy";
      copyButton.textContent = "Copy prompt";

      var status = document.createElement("span");
      status.className = "prompt-status muted";
      status.setAttribute("role", "status");

      actions.appendChild(copyButton);
      actions.appendChild(status);

      element.appendChild(heading);
      element.appendChild(placeholder);
      element.appendChild(promptFor);
      element.appendChild(textArea);
      element.appendChild(actions);

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

      function showPlaceholder(message) {
        placeholder.textContent = message;
        placeholder.hidden = false;
        promptFor.hidden = true;
        textArea.hidden = true;
        actions.hidden = true;
        textArea.value = "";
        setStatus("");
      }

      copyButton.addEventListener("click", function () {
        copyText(textArea.value, textArea, function (copied) {
          setStatus(copied ? "Copied to the clipboard." : "Could not copy. Select the text and copy it yourself.");
        });
      });

      return {
        element: element,

        // Show the prompt for the selected leaf step.
        // path - the steps from the top level down to the selected leaf step.
        show: function (path) {
          if (!window.PromptBuilder || typeof window.PromptBuilder.build !== "function") {
            showPlaceholder("The prompt cannot be generated. Check that prompt-builder.js is loaded.");
            return;
          }

          var prompt;
          try {
            prompt = window.PromptBuilder.build(path);
          } catch (error) {
            showPlaceholder("The prompt could not be generated for this step.");
            return;
          }

          var leaf = path[path.length - 1];
          promptFor.textContent = "Prompt for: " + String(leaf.title);
          textArea.value = prompt;

          placeholder.hidden = true;
          promptFor.hidden = false;
          textArea.hidden = false;
          actions.hidden = false;
          setStatus("");
        },

        // Go back to the "select a step" message.
        clear: function () {
          showPlaceholder(PLACEHOLDER_TEXT);
        }
      };
    }
  };

  window.PromptPanel = PromptPanel;
})();