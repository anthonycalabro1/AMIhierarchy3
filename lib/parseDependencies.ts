/**
 * Parse dependencies from Connections.xlsx file
 * Maps Excel columns to flow graph structure:
 * - Source Process (Output Creator) -> Source Node ID
 * - Target Process (Input Consumer) -> Target Node ID
 * - Object (The Interface) -> Edge Label
 * - Value Stream/Category -> Node Group/Color
 * 
 * Returns: { flowNodes, flowEdges } - separate from hierarchy data
 */

// Type definitions
interface FlowNode {
    id: string;
    label: string;
    group: string;
    level: 'L3';
}

interface FlowEdge {
    source: string;
    target: string;
    label: string;
    id: string;
    category: string | null;
}

interface FlowData {
    flowNodes: FlowNode[];
    flowEdges: FlowEdge[];
}

/**
 * Parse the Connections.xlsx file and extract flow nodes and edges
 * @param fileInput - Excel file (File object or file path)
 * @returns Parsed flow data with nodes and edges
 */
async function parseDependencies(fileInput: File | string): Promise<FlowData> {
    try {
        let workbook: XLSX.WorkBook;
        
        // Handle File object (from file input) or file path
        if (fileInput instanceof File) {
            const arrayBuffer = await fileInput.arrayBuffer();
            workbook = XLSX.read(arrayBuffer, { type: 'array' });
        } else if (typeof fileInput === 'string') {
            // If it's a file path, we need to fetch it
            const response = await fetch(fileInput);
            const arrayBuffer = await response.arrayBuffer();
            workbook = XLSX.read(arrayBuffer, { type: 'array' });
        } else {
            throw new Error('Invalid file input. Expected File object or file path string.');
        }
        
        // Get the first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with header row
        const data: any[] = XLSX.utils.sheet_to_json(worksheet, { 
            defval: '', // Default value for empty cells
            raw: false  // Return formatted strings
        });
        
        if (!data || data.length === 0) {
            throw new Error('Excel file is empty or has no data rows.');
        }
        
        // Find column mappings (handle variations in column names)
        const findColumn = (possibleNames: string[], dataRow: any): string | null => {
            for (const name of possibleNames) {
                if (dataRow.hasOwnProperty(name)) {
                    return name;
                }
            }
            return null;
        };
        
        // Get column names from first row
        const firstRow = data[0];
        const sourceCol = findColumn([
            'Source Process (Output Creator)',
            'Source Process',
            'Source Process (Output Creator)'
        ], firstRow);
        
        const targetCol = findColumn([
            'Target Process (Input Consumer)',
            'Target Process',
            'Target Process (Input Consumer)'
        ], firstRow);
        
        const objectCol = findColumn([
            'Object (The Interface)',
            'Object',
            'The Interface',
            'Interface'
        ], firstRow);
        
        const categoryCol = findColumn([
            'Value Stream/Category',
            'Value Stream',
            'Category',
            'Value Stream Category'
        ], firstRow);
        
        if (!sourceCol || !targetCol) {
            throw new Error(`Required columns not found. Found columns: ${Object.keys(firstRow).join(', ')}`);
        }
        
        // Build nodes and edges
        const nodeMap = new Map<string, FlowNode>(); // Track unique nodes by ID
        const edges: FlowEdge[] = [];
        
        // Helper function to create or update a node
        const createOrUpdateNode = (processName: string, category: string) => {
            if (!processName) return;
            
            if (!nodeMap.has(processName)) {
                nodeMap.set(processName, {
                    id: processName,
                    label: processName,
                    group: category || 'default',
                    level: 'L3' // All processes in this file are L3
                });
            } else {
                // Update group if category is provided and different
                const node = nodeMap.get(processName)!;
                if (category && (!node.group || node.group === 'default')) {
                    node.group = category;
                }
            }
        };
        
        data.forEach((row: any, index: number) => {
            const sourceProcess = String(row[sourceCol] || '').trim();
            const targetProcess = String(row[targetCol] || '').trim();
            const edgeLabel = objectCol ? String(row[objectCol] || '').trim() : '';
            const category = categoryCol ? String(row[categoryCol] || '').trim() : '';
            
            // Skip rows where both source and target are empty
            if (!sourceProcess && !targetProcess) {
                return;
            }
            
            // Handle isolated nodes: if only source exists, create isolated source node
            if (sourceProcess && !targetProcess) {
                createOrUpdateNode(sourceProcess, category);
                // No edge created for isolated node
                return;
            }
            
            // Handle isolated nodes: if only target exists, create isolated target node
            if (!sourceProcess && targetProcess) {
                createOrUpdateNode(targetProcess, category);
                // No edge created for isolated node
                return;
            }
            
            // Both source and target exist - create nodes and edge
            createOrUpdateNode(sourceProcess, category);
            createOrUpdateNode(targetProcess, category);
            
            // Create edge
            edges.push({
                source: sourceProcess,
                target: targetProcess,
                label: edgeLabel,
                id: `${sourceProcess}->${targetProcess}${edgeLabel ? `:${edgeLabel}` : ''}`,
                category: category || null
            });
        });
        
        // Convert node map to array
        const flowNodes: FlowNode[] = Array.from(nodeMap.values());
        
        return {
            flowNodes,
            flowEdges: edges
        };
        
    } catch (error) {
        console.error('Error parsing dependencies:', error);
        throw error;
    }
}

/**
 * Load dependencies from Connections.xlsx file in the project
 * @returns Parsed flow data with nodes and edges
 */
async function loadDependencies(): Promise<FlowData> {
    return await parseDependencies('Connections.xlsx');
}

// Export for use in other modules
export { parseDependencies, loadDependencies };
export type { FlowNode, FlowEdge, FlowData };

