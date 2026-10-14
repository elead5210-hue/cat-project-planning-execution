/*
 * Step data for the step list view.
 * Plain script: it defines window.stepsData, an array of top-level steps.
 *
 * Each step is an object:
 *   id       - a unique string, used to track the step
 *   title    - the text shown for the step
 *   done     - true if the step starts checked off
 *   children - (optional) an array of steps nested one level deeper
 *
 * Steps can be nested to any depth.
 */
window.stepsData = [
  {
    id: "phase-1",
    title: "Phase 1: Find and access information",
    done: false,
    children: [
      {
        id: "phase-1-planning",
        title: "Write the research planning document",
        done: false,
        children: [
          { id: "phase-1-planning-task", title: "Define the task and the focus question", done: false },
          { id: "phase-1-planning-questions", title: "List the research questions", done: false },
          { id: "phase-1-planning-sources", title: "Choose suitable information sources", done: false },
          { id: "phase-1-planning-summary", title: "Summarise the information in my own words", done: false },
          { id: "phase-1-planning-references", title: "Record the references and image sources", done: false }
        ]
      },
      {
        id: "phase-1-questionnaire",
        title: "Run the questionnaire",
        done: false,
        children: [
          { id: "phase-1-questionnaire-design", title: "Design the questionnaire", done: false },
          { id: "phase-1-questionnaire-collect", title: "Collect ten completed questionnaires", done: false }
        ]
      },
      { id: "phase-1-declaration", title: "Sign the Phase 1 declaration", done: false }
    ]
  },
  {
    id: "phase-2",
    title: "Phase 2: Process and present the findings",
    done: false,
    children: [
      {
        id: "phase-2-spreadsheet",
        title: "Build the spreadsheet",
        done: false,
        children: [
          { id: "phase-2-spreadsheet-data", title: "Capture the questionnaire results", done: false },
          { id: "phase-2-spreadsheet-formulas", title: "Process the data with formulas and COUNTIF", done: false },
          { id: "phase-2-spreadsheet-graphs", title: "Add at least two readable graphs", done: false }
        ]
      },
      {
        id: "phase-2-presentation",
        title: "Build the final presentation",
        done: false,
        children: [
          { id: "phase-2-presentation-content", title: "Add the slides from the Addendum A layout", done: false },
          { id: "phase-2-presentation-navigation", title: "Add links, action buttons and effects", done: false },
          { id: "phase-2-presentation-check", title: "Run the spelling check", done: false }
        ]
      },
      { id: "phase-2-website", title: "Build the school website", done: false },
      { id: "phase-2-declarations", title: "Sign the Phase 2a and final declarations", done: false }
    ]
  },
  {
    id: "submission",
    title: "Submit the PAT",
    done: false,
    children: [
      { id: "submission-backup", title: "Back up the PAT folder", done: false },
      { id: "submission-stick", title: "Copy the PAT folder to the memory stick", done: false },
      { id: "submission-test", title: "Test the memory stick on another computer", done: false }
    ]
  }
];