/*
 * Prompt builder.
 * Plain JavaScript: no modules, bundler or build step.
 *
 * Builds the prompt text for a selected leaf step. The user copies the prompt
 * into an AI session that has the original PDF attached. The prompt contains:
 *   - an instruction,
 *   - the selected leaf step, with its parent steps as context,
 *   - a reference to the attached original PDF,
 *   - the name of the JSON schema that the AI must reply with.
 *
 * It defines window.PromptBuilder. The response schema itself is not defined
 * here. If a script defines window.ResponseSchema (a JSON schema object), the
 * prompt also includes its text, so the schema can be added later without
 * changing this file.
 */
(function () {
  "use strict";

  var PromptBuilder = {
    // Name of the JSON schema that the AI must reply with.
    SCHEMA_NAME: "step_response",

    // How the prompt refers to the original PDF that the user attaches.
    PDF_REFERENCE: "the original PDF attached to this session",

    // Build the prompt for a leaf step.
    //
    // path - an array of steps from the top level down to the selected leaf
    //        step, for example [phase, step, leaf]. Each item needs a title
    //        (and may have an id).
    //
    // Returns the prompt as a string.
    build: function (path) {
      if (!Array.isArray(path) || path.length === 0) {
        throw new Error("A leaf step path is needed to build a prompt.");
      }

      var leaf = path[path.length - 1];
      var parents = path.slice(0, path.length - 1);
      var lines = [];

      lines.push("INSTRUCTION");
      lines.push(
        "Use " + PromptBuilder.PDF_REFERENCE + " as the source material. " +
        "Complete the selected step below. " +
        "Reply with a document, or with a form if you need more information from the user, or with both."
      );
      lines.push("");

      lines.push("SELECTED STEP");
      lines.push(String(leaf.title));
      lines.push("");

      lines.push("CONTEXT (parent steps, from the top level down)");
      if (parents.length === 0) {
        lines.push("(none, this is a top-level step)");
      } else {
        parents.forEach(function (step, index) {
          lines.push(String(index + 1) + ". " + String(step.title));
        });
      }
      lines.push("");

      lines.push("REFERENCE");
      lines.push("The original PDF is attached to this session. Refer to it for the details of the task.");
      lines.push("");

      lines.push("RESPONSE FORMAT");
      lines.push(
        "Reply with only a single JSON object that follows the JSON schema named \"" +
        PromptBuilder.SCHEMA_NAME + "\". " +
        "Do not add any text before or after the JSON object."
      );

      if (window.ResponseSchema) {
        lines.push("");
        lines.push("JSON SCHEMA \"" + PromptBuilder.SCHEMA_NAME + "\"");
        lines.push(JSON.stringify(window.ResponseSchema, null, 2));
      }

      return lines.join("\n");
    }
  };

  window.PromptBuilder = PromptBuilder;
})();