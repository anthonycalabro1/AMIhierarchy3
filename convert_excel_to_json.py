import pandas as pd
import json
import os

def convert_excel_to_json():
    input_file = 'SCE AMI - Process Hierarchy.xlsx'
    hierarchy_output = 'hierarchy-data.json'
    search_output = 'search-index.json'

    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    try:
        df = pd.read_excel(input_file)
        
        # Clean column names - strip whitespace
        df.columns = df.columns.str.strip()
        
        # Verify required columns exist
        required_columns = [
            'L1 Process Name', 
            'L2 Process Name', 
            'L3 Process Name', 
            'L3 Process Objective', 
            'Use Case Mapping', 
            'IT Release'
        ]
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            print(f"Error: Missing columns in Excel file: {missing_columns}")
            return

        # Fill NaN values with empty strings
        df = df.fillna('')

        # Known columns (not department columns). Wave/Priority is optional.
        # Excel uses "Priority" column for Wave values (Wave 1, Wave 2, etc.)
        KNOWN_COLUMNS = {
            'L1 Process Name', 'L2 Process Name', 'L3 Process Name',
            'L3 Process Objective', 'Use Case Mapping', 'IT Release', 'Wave', 'Priority'
        }

        def get_departments_for_row(row, all_columns):
            """Extract department names from row where cell value is 'X'."""
            depts = []
            for col in all_columns:
                if col in KNOWN_COLUMNS:
                    continue
                val = row.get(col, '')
                if pd.notna(val) and str(val).strip().upper() == 'X':
                    depts.append(col.strip())
            return depts

        # Build Hierarchy Data
        hierarchy_data = {"name": "Process Hierarchy", "children": []}
        
        # Group by L1, preserving order (sort=False)
        for l1_name, l1_group in df.groupby('L1 Process Name', sort=False):
            l1_node = {
                "name": l1_name,
                "level": "L1",
                "children": []
            }
            
            # Group by L2 within L1, preserving order (sort=False)
            for l2_name, l2_group in l1_group.groupby('L2 Process Name', sort=False):
                l2_node = {
                    "name": l2_name,
                    "level": "L2",
                    "children": []
                }
                
                # Iterate L3 within L2 (already preserves row order)
                all_columns = df.columns.tolist()
                for _, row in l2_group.iterrows():
                    row_dict = row.to_dict()
                    wave_val = ''
                    # Read from Priority column (Wave 1, Wave 2, etc.) or fallback to Wave
                    if 'Priority' in df.columns and pd.notna(row.get('Priority')):
                        wave_val = str(row.get('Priority', '')).strip()
                    elif 'Wave' in df.columns and pd.notna(row.get('Wave')):
                        wave_val = str(row.get('Wave', '')).strip()
                    departments = get_departments_for_row(row_dict, all_columns)
                    l3_node = {
                        "name": row['L3 Process Name'],
                        "level": "L3",
                        "objective": row['L3 Process Objective'],
                        "use_case": row['Use Case Mapping'],
                        "it_release": row['IT Release'],
                        "wave": wave_val,
                        "departments": departments
                    }
                    l2_node["children"].append(l3_node)
                
                l1_node["children"].append(l2_node)
            
            hierarchy_data["children"].append(l1_node)

        # Build Search Index (Flat list) - maintaining hierarchical order
        # L1 entries should be followed by their L2 children, which should be followed by their L3 children
        search_index = []
        seen_l1 = set()
        seen_l2 = set()
        
        # Group by L1, preserving order
        for l1_name, l1_group in df.groupby('L1 Process Name', sort=False):
            # Add L1 (only once per L1)
            if l1_name not in seen_l1:
                search_index.append({
                    "name": l1_name,
                    "level": "L1",
                    "parent": "",
                    "details": {}
                })
                seen_l1.add(l1_name)
            
            # Group by L2 within L1, preserving order
            for l2_name, l2_group in l1_group.groupby('L2 Process Name', sort=False):
                # Add L2 (only once per L2, immediately after its L1)
                if l2_name not in seen_l2:
                    search_index.append({
                        "name": l2_name,
                        "level": "L2",
                        "parent": l1_name,
                        "details": {}
                    })
                    seen_l2.add(l2_name)
                
                # Add all L3 entries for this L2 immediately after the L2 entry
                all_columns = df.columns.tolist()
                for _, row in l2_group.iterrows():
                    row_dict = row.to_dict()
                    wave_val = ''
                    if 'Priority' in df.columns and pd.notna(row.get('Priority')):
                        wave_val = str(row.get('Priority', '')).strip()
                    elif 'Wave' in df.columns and pd.notna(row.get('Wave')):
                        wave_val = str(row.get('Wave', '')).strip()
                    departments = get_departments_for_row(row_dict, all_columns)
                    search_index.append({
                        "name": row['L3 Process Name'],
                        "level": "L3",
                        "parent": l2_name,
                        "details": {
                            "objective": row['L3 Process Objective'],
                            "use_case": row['Use Case Mapping'],
                            "it_release": row['IT Release'],
                            "wave": wave_val,
                            "departments": departments
                        }
                    })
        
        unique_search_index = search_index

        # Save files
        with open(hierarchy_output, 'w', encoding='utf-8') as f:
            json.dump(hierarchy_data, f, indent=2)
        
        with open(search_output, 'w', encoding='utf-8') as f:
            json.dump(unique_search_index, f, indent=2)

        print(f"Successfully converted {input_file}")
        print(f"Created {hierarchy_output} and {search_output}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    convert_excel_to_json()

