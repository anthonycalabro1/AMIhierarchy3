// Excel Export Functionality using SheetJS

function exportToExcel() {
    if (!window.hierarchyData) {
        if (window.showError) {
            window.showError('No hierarchy data available to export.');
        }
        return;
    }
    
    try {
        const KNOWN_COLS = ['L1 Process Name', 'L2 Process Name', 'L3 Process Name', 'L3 Process Objective', 'Use Case Mapping', 'IT Release', 'Wave'];
        const allDepartments = new Set();
        function collectDepartments(node) {
            if (node.level === 'L3' && node.departments) {
                node.departments.forEach(d => allDepartments.add(d));
            }
            (node.children || []).forEach(collectDepartments);
        }
        if (window.hierarchyData.children) {
            window.hierarchyData.children.forEach(collectDepartments);
        }
        const departmentList = Array.from(allDepartments).sort();

        const rows = [];
        function flattenHierarchy(node, l1Name = '', l2Name = '') {
            if (node.level === 'L1') {
                l1Name = node.name;
                if (node.children) node.children.forEach(child => flattenHierarchy(child, l1Name, l2Name));
            } else if (node.level === 'L2') {
                l2Name = node.name;
                if (node.children) node.children.forEach(child => flattenHierarchy(child, l1Name, l2Name));
            } else if (node.level === 'L3') {
                const processId = window.getProcessId ? window.getProcessId(node) : `${node.level}_${node.name}`;
                const isDeleted = window.pendingChanges && window.pendingChanges.deleted && window.pendingChanges.deleted.has(processId);
                if (!isDeleted) {
                    const deptSet = new Set(node.departments || []);
                    const row = {
                        'L1 Process Name': l1Name,
                        'L2 Process Name': l2Name,
                        'L3 Process Name': node.name,
                        'L3 Process Objective': node.objective || '',
                        'Use Case Mapping': node.use_case || '',
                        'IT Release': node.it_release || '',
                        'Wave': node.wave || ''
                    };
                    departmentList.forEach(d => { row[d] = deptSet.has(d) ? 'X' : ''; });
                    rows.push(row);
                }
            }
        }
        if (window.hierarchyData.children) {
            window.hierarchyData.children.forEach(child => flattenHierarchy(child));
        }
        
        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        
        const colWidths = [
            { wch: 30 }, { wch: 40 }, { wch: 50 }, { wch: 80 }, { wch: 50 }, { wch: 20 }, { wch: 15 }
        ];
        departmentList.forEach(() => colWidths.push({ wch: 15 }));
        ws['!cols'] = colWidths;
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Process Hierarchy');
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `Process_Hierarchy_${timestamp}.xlsx`;
        
        // Write file
        XLSX.writeFile(wb, filename);
        
        // Clear change history after export
        window.pendingChanges.modified.clear();
        window.pendingChanges.added.clear();
        window.pendingChanges.deleted.clear();
        window.changeHistory = [];
        window.historyIndex = -1;
        
        // Update UI
        if (window.updateExportButtonVisibility) {
            window.updateExportButtonVisibility();
        }
        if (window.updateUndoRedoButtons) {
            window.updateUndoRedoButtons();
        }
        if (window.refreshCurrentView) {
            window.refreshCurrentView();
        }
        
        if (window.showSuccess) {
            window.showSuccess(`Exported to ${filename}`);
        }
    } catch (error) {
        console.error('Export error:', error);
        if (window.showError) {
            window.showError('Failed to export to Excel: ' + error.message);
        }
    }
}

function importFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get first worksheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            // Validate structure
            const requiredColumns = ['L1 Process Name', 'L2 Process Name', 'L3 Process Name'];
            const firstRow = jsonData[0];
            if (!firstRow) {
                throw new Error('Excel file is empty');
            }
            
            const hasRequiredColumns = requiredColumns.every(col => firstRow.hasOwnProperty(col));
            if (!hasRequiredColumns) {
                throw new Error('Excel file must contain columns: L1 Process Name, L2 Process Name, L3 Process Name');
            }
            
            // Show confirmation dialog
            const confirmed = confirm(`Import ${jsonData.length} processes? This will replace the current hierarchy.`);
            if (!confirmed) {
                event.target.value = ''; // Reset file input
                return;
            }
            
            const KNOWN_COLS = new Set(['L1 Process Name', 'L2 Process Name', 'L3 Process Name', 'L3 Process Objective', 'Use Case Mapping', 'IT Release', 'Wave', 'Priority']);
            const allColumns = Object.keys(firstRow);

            const newHierarchy = { name: 'Process Hierarchy', children: [] };
            const l1Map = new Map();
            const l2Map = new Map();

            jsonData.forEach(row => {
                const l1Name = row['L1 Process Name'] || '';
                const l2Name = row['L2 Process Name'] || '';
                const l3Name = row['L3 Process Name'] || '';

                if (!l1Name || !l2Name || !l3Name) return;

                let l1Node = l1Map.get(l1Name);
                if (!l1Node) {
                    l1Node = { name: l1Name, level: 'L1', children: [] };
                    l1Map.set(l1Name, l1Node);
                    newHierarchy.children.push(l1Node);
                }

                const l2Key = `${l1Name}_${l2Name}`;
                let l2Node = l2Map.get(l2Key);
                if (!l2Node) {
                    l2Node = { name: l2Name, level: 'L2', children: [] };
                    l2Map.set(l2Key, l2Node);
                    l1Node.children.push(l2Node);
                }

                const departments = [];
                allColumns.forEach(col => {
                    if (KNOWN_COLS.has(col)) return;
                    const val = row[col];
                    if (val != null && String(val).trim().toUpperCase() === 'X') {
                        departments.push(col.trim());
                    }
                });

                const waveVal = (row['Priority'] != null ? row['Priority'] : row['Wave']);
                const l3Node = {
                    name: l3Name,
                    level: 'L3',
                    objective: row['L3 Process Objective'] || '',
                    use_case: row['Use Case Mapping'] || '',
                    it_release: row['IT Release'] || '',
                    wave: waveVal != null ? String(waveVal).trim() : '',
                    departments: departments
                };
                l2Node.children.push(l3Node);
            });
            
            // Update hierarchy data
            window.hierarchyData = newHierarchy;
            window.originalHierarchyData = JSON.parse(JSON.stringify(newHierarchy));
            
            // Rebuild L3 lookup map for Process Flow enrichment
            if (typeof window.buildL3LookupMap === 'function') {
                window.l3DetailsMap = window.buildL3LookupMap(newHierarchy);
                console.log(`Rebuilt L3 lookup map with ${window.l3DetailsMap.size} entries`);
            }
            
            // Clear pending changes
            window.pendingChanges.modified.clear();
            window.pendingChanges.added.clear();
            window.pendingChanges.deleted.clear();
            window.changeHistory = [];
            window.historyIndex = -1;
            
            if (window.updateSearchIndex) window.updateSearchIndex();
            if (window.populateFilterDropdowns) window.populateFilterDropdowns(newHierarchy);
            if (window.refreshCurrentView) {
                window.refreshCurrentView();
            }
            
            // Update statistics
            if (window.updateProcessStatistics) {
                window.updateProcessStatistics(window.hierarchyData);
            }
            
            // Update UI
            if (window.updateExportButtonVisibility) {
                window.updateExportButtonVisibility();
            }
            
            // Reset file input
            event.target.value = '';
            
            if (window.showSuccess) {
                window.showSuccess(`Successfully imported ${jsonData.length} processes`);
            }
        } catch (error) {
            console.error('Import error:', error);
            if (window.showError) {
                window.showError('Failed to import Excel file: ' + error.message);
            }
            event.target.value = ''; // Reset file input
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// Expose functions globally
window.exportToExcel = exportToExcel;
window.importFromExcel = importFromExcel;
