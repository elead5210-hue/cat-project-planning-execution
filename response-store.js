/*
 * Response store.
 * Plain JavaScript: no modules, bundler or build step.
 *
 * Keeps the valid JSON response of each leaf step in IndexedDB, so that the
 * responses are still there when the page is reopened.
 *
 * It defines window.ResponseStore. Every method returns a Promise.
 *
 *   ResponseStore.isAvailable()
 *       -> boolean. False if the browser has no IndexedDB (or blocks it).
 *   ResponseStore.save(stepId, text)
 *       -> Promise of the saved record. The text is checked with
 *          ResponseValidator (response-schema.js) first. Only a valid response
 *          is saved: an invalid one rejects the Promise and saves nothing.
 *          Saving again for the same step replaces its earlier response.
 *   ResponseStore.load(stepId)
 *       -> Promise of the record for the step, or null if none is saved.
 *   ResponseStore.list()
 *       -> Promise of an array with every saved record.
 *   ResponseStore.remove(stepId)
 *       -> Promise. Deletes the saved response of the step, if there is one.
 *
 * A record is: { stepId, text, value, savedAt }
 *   stepId  - the id of the leaf step (a string),
 *   text    - the JSON text of the response, as the user pasted or loaded it,
 *   value   - the parsed response object,
 *   savedAt - the time of saving, in milliseconds since 1970.
 *
 * If IndexedDB cannot be used, the Promises reject with an Error. The caller
 * decides how to tell the user. The rest of the app keeps working without
 * the store.
 *
 * This script must be loaded after response-schema.js and before
 * response-view.js and step-list.js.
 */
(function () {
  "use strict";

  var DB_NAME = "step-responses";
  var DB_VERSION = 1;
  var STORE_NAME = "responses";

  // The open database, as a Promise. It is reset if opening fails or if the
  // database is closed, so that the next call tries again.
  var databasePromise = null;

  // Whether the browser offers IndexedDB.
  function isAvailable() {
    try {
      return Boolean(window.indexedDB);
    } catch (error) {
      // Some browsers throw when storage is blocked.
      return false;
    }
  }

  function openDatabase() {
    if (databasePromise) {
      return databasePromise;
    }

    databasePromise = new Promise(function (resolve, reject) {
      if (!isAvailable()) {
        reject(new Error("IndexedDB is not available in this browser."));
        return;
      }

      var request;
      try {
        request = window.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        reject(error);
        return;
      }

      request.onupgradeneeded = function () {
        var database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "stepId" });
        }
      };

      request.onsuccess = function () {
        var database = request.result;

        // Let another tab upgrade the database, and open it again when needed.
        database.onversionchange = function () {
          database.close();
          databasePromise = null;
        };
        database.onclose = function () {
          databasePromise = null;
        };

        resolve(database);
      };

      request.onerror = function () {
        reject(request.error || new Error("The database could not be opened."));
      };
    });

    databasePromise.catch(function () {
      databasePromise = null;
    });

    return databasePromise;
  }

  // Run one transaction on the response store.
  //
  // mode - "readonly" or "readwrite".
  // work - function (store, setResult). It makes the requests and calls
  //        setResult(value) to say what the Promise resolves with.
  //
  // The Promise resolves when the transaction has completed, so a saved record
  // has really been written when the caller hears about it.
  function run(mode, work) {
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction;
        try {
          transaction = database.transaction(STORE_NAME, mode);
        } catch (error) {
          reject(error);
          return;
        }

        var result = null;

        transaction.oncomplete = function () {
          resolve(result);
        };
        transaction.onerror = function () {
          reject(transaction.error || new Error("The database request failed."));
        };
        transaction.onabort = function () {
          reject(transaction.error || new Error("The database request was cancelled."));
        };

        try {
          work(transaction.objectStore(STORE_NAME), function (value) {
            result = value;
          });
        } catch (error) {
          try {
            transaction.abort();
          } catch (ignore) {
            // The transaction is already finished.
          }
          reject(error);
        }
      });
    });
  }

  // The key for a step. Returns null if the id cannot be used.
  function normalizeId(stepId) {
    if (stepId === undefined || stepId === null) {
      return null;
    }
    var id = String(stepId);
    return id === "" ? null : id;
  }

  // Check the text of a response with the validator.
  // Returns { valid, errors, value }.
  function checkResponse(text) {
    if (!window.ResponseValidator || typeof window.ResponseValidator.validateText !== "function") {
      return {
        valid: false,
        errors: ["The response cannot be checked. Check that response-schema.js is loaded."],
        value: null
      };
    }
    return window.ResponseValidator.validateText(text);
  }

  function save(stepId, text) {
    var id = normalizeId(stepId);
    if (id === null) {
      return Promise.reject(new Error("A step id is needed to save a response."));
    }

    var checked = checkResponse(text);
    if (!checked.valid) {
      return Promise.reject(
        new Error("Only a valid response can be saved. " + (checked.errors.length > 0 ? checked.errors[0] : ""))
      );
    }

    var record = {
      stepId: id,
      text: String(text),
      value: checked.value,
      savedAt: Date.now()
    };

    return run("readwrite", function (store, setResult) {
      store.put(record);
      setResult(record);
    });
  }

  function load(stepId) {
    var id = normalizeId(stepId);
    if (id === null) {
      return Promise.resolve(null);
    }

    return run("readonly", function (store, setResult) {
      var request = store.get(id);
      request.onsuccess = function () {
        setResult(request.result || null);
      };
    });
  }

  function list() {
    return run("readonly", function (store, setResult) {
      var records = [];
      setResult(records);

      var request = store.openCursor();
      request.onsuccess = function () {
        var cursor = request.result;
        if (cursor) {
          records.push(cursor.value);
          cursor.continue();
        }
      };
    });
  }

  function remove(stepId) {
    var id = normalizeId(stepId);
    if (id === null) {
      return Promise.resolve();
    }

    return run("readwrite", function (store) {
      store.delete(id);
    }).then(function () {
      return undefined;
    });
  }

  window.ResponseStore = {
    DB_NAME: DB_NAME,
    STORE_NAME: STORE_NAME,
    isAvailable: isAvailable,
    save: save,
    load: load,
    list: list,
    remove: remove
  };
})();