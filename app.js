/*
 * Entry script for the static app.
 * Plain JavaScript: no modules, bundler or build step. It is loaded with a
 * normal script tag and runs when index.html is opened in a browser.
 *
 * Views register themselves on window.App.views (for example a step list
 * view) and are shown inside the #app container.
 */
(function () {
  "use strict";

  var App = {
    // Container that views are rendered into (set when the page loads).
    root: null,

    // Name of the view being shown, or null if no view is shown (for example a message).
    currentView: null,

    // Registered views: name -> function(container) that renders the view.
    views: {},

    // Add a view so that it can be shown by name.
    registerView: function (name, renderFn) {
      if (typeof name !== "string" || name === "") {
        throw new Error("A view needs a name.");
      }
      if (typeof renderFn !== "function") {
        throw new Error("The view '" + name + "' needs a render function.");
      }
      App.views[name] = renderFn;

      // If the app has already started and is only showing a message, show the
      // step list view as soon as it registers.
      if (App.root && name === "steps" && App.currentView === null) {
        App.showView("steps");
      }
    },

    // Remove everything from the mount point.
    clear: function () {
      while (App.root && App.root.firstChild) {
        App.root.removeChild(App.root.firstChild);
      }
    },

    // Show a registered view inside the mount point.
    showView: function (name) {
      if (!App.root) {
        throw new Error("The app has not started yet.");
      }
      var renderFn = App.views[name];
      if (!renderFn) {
        throw new Error("There is no view named '" + name + "'.");
      }
      App.clear();
      App.currentView = name;
      renderFn(App.root);
    },

    // Show a simple message in the mount point.
    showMessage: function (text) {
      App.clear();
      App.currentView = null;
      var paragraph = document.createElement("p");
      paragraph.className = "muted";
      paragraph.textContent = text;
      App.root.appendChild(paragraph);
    },

    // Start the app: find the mount point and show the first view.
    start: function () {
      App.root = document.getElementById("app");
      if (!App.root) {
        console.error("The #app container was not found in the page.");
        return;
      }

      if (App.views.steps) {
        App.showView("steps");
      } else {
        App.showMessage("The app is ready. The step list view has not been added yet.");
      }
    }
  };

  window.App = App;

  // Scripts with the defer attribute run while readyState is "interactive", before
  // DOMContentLoaded fires. Wait for that event so that the other scripts have
  // registered their views, and only start straight away if the page has fully loaded.
  if (document.readyState !== "complete") {
    document.addEventListener("DOMContentLoaded", App.start);
  } else {
    App.start();
  }
})();