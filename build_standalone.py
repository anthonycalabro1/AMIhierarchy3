#!/usr/bin/env python3
"""Build standalone.html by combining HTML structure with embedded JSON and JavaScript files."""

import json
import os

# Read the base HTML file (up to the embedded data section)
with open('standalone.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Find where to replace the embedded data
# Look for the comment that marks the embedded data section
script_start_marker = '    <!-- Embedded Data -->'
script_start_pos = html_content.find(script_start_marker)

if script_start_pos == -1:
    print("Error: Could not find embedded data section start")
    exit(1)

# Start replacement from the comment (this will include the comment in replacement)
insert_pos = script_start_pos

# Find where ALL embedded JavaScript files end - look for the LAST </body> tag
# This will replace everything from the embedded data comment to the end of all scripts
# Use rfind to get the last occurrence
body_close = html_content.rfind('</body>')
if body_close == -1:
    print("Error: Could not find closing body tag")
    exit(1)

# Also find the last </html> tag to make sure we get everything
html_close = html_content.rfind('</html>')
if html_close == -1:
    print("Error: Could not find closing html tag")
    exit(1)

# End position is right before </body> (we'll add it back in embedded_section)
# But we need to include everything up to </html>
end_pos = html_close + len('</html>')

# Read JSON files
with open('hierarchy-data.json', 'r', encoding='utf-8') as f:
    hierarchy_data = json.load(f)

with open('search-index.json', 'r', encoding='utf-8') as f:
    search_index_data = json.load(f)

# Read JavaScript files
js_files = [
    ('app.js', 'app'),
    ('navigation.js', 'navigation'),
    ('tree-visualization.js', 'tree'),
    ('search.js', 'search'),
    ('export_to_excel.js', 'export')
]

js_contents = {}
for filename, key in js_files:
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
        # Remove process-flow related code from app.js
        if filename == 'app.js':
            # Find and remove the process-flow block in switchView function
            # The block starts with "} else if (viewName === 'process-flow') {" and ends with "}"
            start_marker = "} else if (viewName === 'process-flow') {"
            start_pos = content.find(start_marker)
            if start_pos != -1:
                # Find the matching closing brace
                brace_count = 1
                pos = start_pos + len(start_marker)
                while pos < len(content) and brace_count > 0:
                    if content[pos] == '{':
                        brace_count += 1
                    elif content[pos] == '}':
                        brace_count -= 1
                    pos += 1
                # Remove the entire block including the closing brace
                content = content[:start_pos] + content[pos:]
            
            # Remove process-flow refresh logic in refreshCurrentView
            start_marker2 = "} else if (currentView === 'process-flow') {"
            start_pos2 = content.find(start_marker2)
            if start_pos2 != -1:
                # Find the matching closing brace
                brace_count = 1
                pos = start_pos2 + len(start_marker2)
                while pos < len(content) and brace_count > 0:
                    if content[pos] == '{':
                        brace_count += 1
                    elif content[pos] == '}':
                        brace_count -= 1
                    pos += 1
                # Remove the entire block including the closing brace
                content = content[:start_pos2] + content[pos:]
            
            # Remove references to process-flow-visualization.js and related libs (entire lines)
            lines = content.split('\n')
            content = '\n'.join([l for l in lines if 'process-flow-visualization.js' not in l and 'parseDependencies.js' not in l and 'useFlowLayout.js' not in l and 'elkjs' not in l.lower() and 'elk.bundled.js' not in l.lower()])
        js_contents[key] = content

# Modify app.js to use embedded data
app_js = js_contents['app']
# Replace fetch calls with embedded data
app_js = app_js.replace(
    "const [hierarchyRes, searchRes] = await Promise.all([\n            fetch('hierarchy-data.json'),\n            fetch('search-index.json')\n        ]);\n        \n        if (!hierarchyRes.ok || !searchRes.ok) {\n            throw new Error('Failed to load data files');\n        }\n        \n        hierarchyData = await hierarchyRes.json();\n        searchIndex = await searchRes.json();",
    "// Use embedded data instead of fetching\n        hierarchyData = embeddedHierarchyData;\n        searchIndex = embeddedSearchIndex;"
)

# Build the embedded data section
embedded_section = f"""    <!-- Embedded Data -->
    <script>
        // Embedded hierarchy data
        const embeddedHierarchyData = {json.dumps(hierarchy_data, indent=8, ensure_ascii=False)};

        // Embedded search index
        const embeddedSearchIndex = {json.dumps(search_index_data, indent=8, ensure_ascii=False)};
    </script>

    <!-- Embedded JavaScript Files -->
    <script>
        // Modified app.js - using embedded data and removed process-flow logic
        {app_js}
    </script>
    <script>
        // navigation.js
        {js_contents['navigation']}
    </script>
    <script>
        // tree-visualization.js
        {js_contents['tree']}
    </script>
    <script>
        // search.js
        {js_contents['search']}
    </script>
    <script>
        // export_to_excel.js
        {js_contents['export']}
    </script>
</body>
</html>"""

# Combine everything - replace from insert_pos to end_pos
# We need to keep everything before insert_pos, add the new embedded section, and add closing tags
# Find what comes before the embedded data section
before_section = html_content[:insert_pos]

# The embedded_section already includes </body> and </html>, so we just need to combine
final_html = before_section + embedded_section

# Write the final file
with open('standalone.html', 'w', encoding='utf-8') as f:
    f.write(final_html)

print("Successfully built standalone.html")
