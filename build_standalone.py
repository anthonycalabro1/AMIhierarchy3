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
                # Ensure the search block is properly closed in switchView function
                # Find the search block before the removed process-flow block
                search_marker_switch = "} else if (viewName === 'search') {"
                search_start_switch = content[:start_pos].rfind(search_marker_switch)
                if search_start_switch != -1:
                    # Count braces in the search block to see if it's closed
                    search_block_switch = content[search_start_switch:start_pos]
                    open_braces_switch = search_block_switch.count('{')
                    close_braces_switch = search_block_switch.count('}')
                    if open_braces_switch > close_braces_switch:
                        # Add missing closing brace for search block in switchView
                        content = content[:start_pos] + '    }\n' + content[start_pos:]
            
            # Remove process-flow refresh logic in refreshCurrentView
            # We need to remove: "} else if (currentView === 'process-flow') { ... }"
            # But preserve the code that comes after it (updateProcessStatistics)
            start_marker2 = "} else if (currentView === 'process-flow') {"
            start_pos2 = content.find(start_marker2)
            if start_pos2 != -1:
                # Find the matching closing brace for the process-flow block
                brace_count = 1
                pos = start_pos2 + len(start_marker2)
                while pos < len(content) and brace_count > 0:
                    if content[pos] == '{':
                        brace_count += 1
                    elif content[pos] == '}':
                        brace_count -= 1
                    pos += 1
                # Now pos points to the character after the closing brace of process-flow block
                # We want to remove from start_pos2 (start of "} else if...") to pos (after closing brace)
                # This will leave the search block's closing brace and updateProcessStatistics intact
                content = content[:start_pos2] + content[pos:]
                # Ensure the search block is properly closed - add closing brace if needed
                # Find the search block before the removed process-flow block
                search_marker = "} else if (currentView === 'search') {"
                search_start = content[:start_pos2].rfind(search_marker)
                if search_start != -1:
                    # Count braces in the search block to see if it's closed
                    search_block = content[search_start:start_pos2]
                    open_braces = search_block.count('{')
                    close_braces = search_block.count('}')
                    if open_braces > close_braces:
                        # Add missing closing brace for search block
                        # Insert it right before where process-flow block was (now removed)
                        content = content[:start_pos2] + '    }\n' + content[start_pos2:]
            
            # Remove references to process-flow-visualization.js and related libs (entire lines)
            lines = content.split('\n')
            content = '\n'.join([l for l in lines if 'process-flow-visualization.js' not in l and 'parseDependencies.js' not in l and 'useFlowLayout.js' not in l and 'elkjs' not in l.lower() and 'elk.bundled.js' not in l.lower()])
        js_contents[key] = content

# Modify app.js to use embedded data
app_js = js_contents['app']

# Replace fetch calls with embedded data
# Use a flexible approach that finds the actual block and preserves indentation
start_marker = "const [hierarchyRes, searchRes] = await Promise.all(["
end_marker = "searchIndex = await searchRes.json();"

start_pos = app_js.find(start_marker)
if start_pos != -1:
    # Find the indentation before the const statement
    # Look backwards to find the start of the line
    line_start = app_js.rfind('\n', 0, start_pos) + 1
    indent = app_js[line_start:start_pos]  # Capture the indentation (spaces/tabs)
    
    # Find the end of the block (after searchIndex assignment)
    end_pos = app_js.find(end_marker, start_pos)
    if end_pos != -1:
        # Include the semicolon and any trailing whitespace/newline
        end_pos += len(end_marker)
        # Find the end of the line (or next non-whitespace)
        while end_pos < len(app_js) and app_js[end_pos] in [' ', '\t']:
            end_pos += 1
        if end_pos < len(app_js) and app_js[end_pos] == '\n':
            end_pos += 1
        
        # Create replacement with preserved indentation
        # Note: We replace from line_start (not start_pos) to avoid double indentation
        replacement = f"{indent}// Use embedded data instead of fetching\n{indent}hierarchyData = embeddedHierarchyData;\n{indent}searchIndex = embeddedSearchIndex;"
        
        # Perform the replacement from line_start to avoid including the original indentation twice
        app_js = app_js[:line_start] + replacement + app_js[end_pos:]
    else:
        print("Warning: Could not find end marker for fetch block replacement")
else:
    print("Warning: Could not find start marker for fetch block replacement")

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
