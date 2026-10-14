/*
 * Response schema.
 * Plain JavaScript: no modules, bundler or build step.
 *
 * Defines the JSON schema that the AI must reply with, and a validator that
 * checks a parsed response against it. The only allowed outputs are:
 *   - a document,
 *   - a form (when the AI needs more information from the user), or
 *   - both a document and a form.
 *
 * It defines:
 *   - window.ResponseSchema: the JSON schema object (named "step_response").
 *     prompt-builder.js includes its text in the prompt. The object holds
 *     only plain schema data. Its validate function is hidden from
 *     JSON.stringify.
 *   - window.ResponseValidator: the validator.
 *       ResponseValidator.validate(value)    -> { valid, errors }
 *       ResponseValidator.validateText(text) -> { valid, errors, value }
 *     "errors" is a list of messages that say where the problem is, for
 *     example: $.document.sections[0].heading must be a string.
 *
 * This script must be loaded before prompt-builder.js.
 */
(function () {
  "use strict";

  var SCHEMA_NAME = "step_response";

  var FIELD_TYPES = ["text", "textarea", "number", "select", "checkbox"];

  // The JSON schema that the AI must reply with.
  var ResponseSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: SCHEMA_NAME,
    description:
      "The reply to a step prompt. It holds a document, a form (when more " +
      "information is needed from the user), or both. Nothing else is allowed.",
    type: "object",
    additionalProperties: false,
    properties: {
      document: {
        description: "The finished document for the selected step.",
        type: "object",
        additionalProperties: false,
        required: ["title", "sections"],
        properties: {
          title: { type: "string", minLength: 1 },
          sections: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["heading", "body"],
              properties: {
                heading: { type: "string", minLength: 1 },
                body: {
                  description: "Plain text. A line break starts a new paragraph.",
                  type: "string"
                },
                items: {
                  description: "An optional bullet list shown after the body.",
                  type: "array",
                  items: { type: "string", minLength: 1 }
                }
              }
            }
          }
        }
      },
      form: {
        description: "Questions for the user, used when more information is needed.",
        type: "object",
        additionalProperties: false,
        required: ["title", "fields"],
        properties: {
          title: { type: "string", minLength: 1 },
          description: { type: "string" },
          fields: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "label", "type"],
              properties: {
                id: {
                  description: "A unique id for the field within the form.",
                  type: "string",
                  minLength: 1
                },
                label: { type: "string", minLength: 1 },
                type: { type: "string", enum: FIELD_TYPES },
                required: { type: "boolean" },
                help: { type: "string" },
                options: {
                  description: "The choices for a field of type select. Needed for select only.",
                  type: "array",
                  minItems: 1,
                  items: { type: "string", minLength: 1 }
                }
              }
            }
          }
        }
      }
    },
    anyOf: [{ required: ["document"] }, { required: ["form"] }]
  };

  // ---- Validator -----------------------------------------------------------

  function typeOf(value) {
    if (value === null) {
      return "null";
    }
    if (Array.isArray(value)) {
      return "array";
    }
    return typeof value;
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function propertyPath(path, key) {
    return path + "." + key;
  }

  function indexPath(path, index) {
    return path + "[" + index + "]";
  }

  // Check a value against a schema node. Messages are added to "errors".
  // Only the parts of JSON schema that this schema uses are supported:
  // type, enum, required, properties, additionalProperties, items,
  // minItems, minLength and anyOf.
  function check(value, schema, path, errors) {
    var actual = typeOf(value);

    if (schema.type && actual !== schema.type) {
      errors.push(path + " must be " + (schema.type === "array" || schema.type === "object" ? "an " : "a ") + schema.type + ".");
      return;
    }

    if (schema.enum && schema.enum.indexOf(value) === -1) {
      errors.push(path + " must be one of: " + schema.enum.join(", ") + ".");
      return;
    }

    if (schema.type === "string" && typeof schema.minLength === "number") {
      if (value.trim().length < schema.minLength) {
        errors.push(path + " must not be empty.");
      }
    }

    if (schema.type === "array") {
      if (typeof schema.minItems === "number" && value.length < schema.minItems) {
        errors.push(path + " must have at least " + schema.minItems + (schema.minItems === 1 ? " item." : " items."));
      }
      if (schema.items) {
        value.forEach(function (item, index) {
          check(item, schema.items, indexPath(path, index), errors);
        });
      }
    }

    if (schema.type === "object") {
      var properties = schema.properties || {};

      (schema.required || []).forEach(function (key) {
        if (!hasOwn(value, key)) {
          errors.push(path + " is missing the required property \"" + key + "\".");
        }
      });

      Object.keys(value).forEach(function (key) {
        if (hasOwn(properties, key)) {
          check(value[key], properties[key], propertyPath(path, key), errors);
        } else if (schema.additionalProperties === false) {
          errors.push(path + " has the property \"" + key + "\", which is not allowed.");
        }
      });
    }

    if (schema.anyOf) {
      var matched = schema.anyOf.some(function (option) {
        var optionErrors = [];
        check(value, option, path, optionErrors);
        return optionErrors.length === 0;
      });
      if (!matched) {
        errors.push(path + " does not match any of the allowed shapes.");
      }
    }
  }

  // Rules that the schema cannot say: field ids are unique, and a select
  // field has options.
  function checkForm(form, errors) {
    if (!form || typeOf(form.fields) !== "array") {
      return;
    }
    var seen = {};
    form.fields.forEach(function (field, index) {
      if (typeOf(field) !== "object") {
        return;
      }
      var fieldPath = indexPath("$.form.fields", index);

      if (typeof field.id === "string" && field.id.trim() !== "") {
        if (hasOwn(seen, field.id)) {
          errors.push(fieldPath + ".id \"" + field.id + "\" is used more than once.");
        }
        seen[field.id] = true;
      }

      if (field.type === "select" && !hasOwn(field, "options")) {
        errors.push(fieldPath + " is a select field, so it needs the property \"options\".");
      }
      if (field.type !== "select" && hasOwn(field, "options")) {
        errors.push(fieldPath + ".options is only allowed on a select field.");
      }
    });
  }

  // Check a parsed response. Returns { valid: boolean, errors: string[] }.
  function validate(value) {
    var errors = [];

    if (typeOf(value) !== "object") {
      errors.push("The response must be a JSON object.");
      return { valid: false, errors: errors };
    }

    if (!hasOwn(value, "document") && !hasOwn(value, "form")) {
      errors.push("The response must contain a document, a form, or both.");
    }

    check(value, ResponseSchema, "$", errors);

    // The shape message above already covers the "anyOf" failure, so drop the
    // generic duplicate.
    errors = errors.filter(function (message, index) {
      return !(message === "$ does not match any of the allowed shapes." && index > 0 && errors[0].indexOf("must contain a document") === 0);
    });

    checkForm(value.form, errors);

    return { valid: errors.length === 0, errors: errors };
  }

  // Remove a code fence if the AI wrapped the JSON in one.
  function stripFence(text) {
    var trimmed = text.trim();
    var match = /^```[A-Za-z0-9_-]*[ \t]*\r?\n([\s\S]*?)\r?\n```$/.exec(trimmed);
    return match ? match[1] : trimmed;
  }

  // Parse the text of a response and check it.
  // Returns { valid, errors, value }. "value" is the parsed object, or null if
  // the text is not JSON.
  function validateText(text) {
    if (typeof text !== "string" || text.trim() === "") {
      return { valid: false, errors: ["Paste or load the JSON response first."], value: null };
    }

    var value;
    try {
      value = JSON.parse(stripFence(text));
    } catch (error) {
      return { valid: false, errors: ["The response is not valid JSON: " + error.message], value: null };
    }

    var result = validate(value);
    return { valid: result.valid, errors: result.errors, value: value };
  }

  var ResponseValidator = {
    SCHEMA_NAME: SCHEMA_NAME,
    FIELD_TYPES: FIELD_TYPES,
    validate: validate,
    validateText: validateText
  };

  // Also reachable from the schema object. It is not enumerable, so the
  // schema text that goes into the prompt stays plain data.
  Object.defineProperty(ResponseSchema, "validate", {
    value: validate,
    enumerable: false
  });

  window.ResponseSchema = ResponseSchema;
  window.ResponseValidator = ResponseValidator;
})();