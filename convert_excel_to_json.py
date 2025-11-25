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
                for _, row in l2_group.iterrows():
                    l3_node = {
                        "name": row['L3 Process Name'],
                        "level": "L3",
                        "objective": row['L3 Process Objective'],
                        "use_case": row['Use Case Mapping'],
                        "it_release": row['IT Release']
                    }
                    l2_node["children"].append(l3_node)
                
                l1_node["children"].append(l2_node)
            
            hierarchy_data["children"].append(l1_node)

        # Build Search Index (Flat list)
        search_index = []
        for _, row in df.iterrows():
            # Add L1
            search_index.append({
                "name": row['L1 Process Name'],
                "level": "L1",
                "parent": "",
                "details": {}
            })
            # Add L2
            search_index.append({
                "name": row['L2 Process Name'],
                "level": "L2",
                "parent": row['L1 Process Name'],
                "details": {}
            })
            # Add L3
            search_index.append({
                "name": row['L3 Process Name'],
                "level": "L3",
                "parent": row['L2 Process Name'],
                "details": {
                    "objective": row['L3 Process Objective'],
                    "use_case": row['Use Case Mapping'],
                    "it_release": row['IT Release']
                }
            })
        
        # Remove duplicates from search index (since L1 and L2 repeat in rows)
        unique_search_index = []
        seen = set()
        for item in search_index:
            # Create a unique key based on name and level
            key = (item['name'], item['level'])
            if key not in seen and item['name']: # Ensure name is not empty
                seen.add(key)
                unique_search_index.append(item)

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

