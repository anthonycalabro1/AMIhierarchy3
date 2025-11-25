# Process Hierarchy Visualization Tool

A web-based interactive visualization tool for exploring and validating a 3-level process hierarchy.

## Features

- **Navigation View**: Interactive drill-down (L1 → L2 → L3).
- **Tree View**: D3.js hierarchical tree diagram.
  - Collapsible/Expandable nodes.
  - Auto-pan logic to keep parents visible while expanding.
  - Vertically centered and compactly spaced.
- **Search View**: Free-text search across process names, objectives, and use cases.
- **Gap Identification**: Form to propose new processes when gaps are found.
- **Process Details**: Slide-out panel with process objectives, use case mappings, and IT release info.

## Setup & Installation

1. **Prerequisites**:
   - Python 3.x
   - `pandas` and `openpyxl` libraries:
     ```bash
     pip install pandas openpyxl
     ```

2. **Data Preparation**:
   - Place your `Hierarchy.xlsx` file in the root directory.
   - Run the conversion script:
     ```bash
     python convert_excel_to_json.py
     ```
   - This generates `hierarchy-data.json` and `search-index.json`.

3. **Running the Application**:
   - Since this is a static site, you can open `index.html` directly in your browser (though some browsers block local file fetches).
   - Better approach: Use a simple local server.
     ```bash
     # Python 3
     python -m http.server 8000
     ```
   - Open http://localhost:8000 in your browser.

## Project Structure

- `index.html`: Main entry point.
- `app.js`: Core application logic and state management.
- `navigation.js`: Logic for the drill-down list view.
- `tree-visualization.js`: D3.js logic for the tree view.
- `search.js`: Search filtering and gap identification logic.
- `styles.css`: Custom styles.
- `convert_excel_to_json.py`: Data processing script.

## Technologies

- HTML5 / CSS3
- Tailwind CSS (CDN)
- D3.js v7 (CDN)
- Vanilla JavaScript (ES6+)
- Python (Data Processing)

