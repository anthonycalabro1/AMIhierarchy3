/**
 * Flow Layout Engine using ELK (Eclipse Layout Kernel)
 * Configures ELK for Process Flow visualization with:
 * - Algorithm: layered
 * - Direction: RIGHT (Left-to-Right flow)
 * - Edge Routing: ORTHOGONAL (Right angles, circuit-board style)
 * - Increased node separation to prevent clutter
 */

// Type definitions
interface FlowNode {
    id: string;
    label: string;
    group: string;
    level: 'L3';
    width?: number;
    height?: number;
}

interface FlowEdge {
    source: string;
    target: string;
    label: string;
    id: string;
    category: string | null;
}

interface PositionedNode extends FlowNode {
    x: number;
    y: number;
    width: number;
    height: number;
    _layout?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

interface PositionedEdge extends FlowEdge {
    _routing?: {
        points: Array<{ x: number; y: number }>;
        sections: any[];
    };
    _labelPosition?: { x: number; y: number } | null;
}

interface LayoutResult {
    nodes: PositionedNode[];
    edges: PositionedEdge[];
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

interface ELKNode {
    id: string;
    x?: number;
    y?: number;
    width: number;
    height: number;
    labels?: Array<{ text: string; width: number; height: number }>;
    _original?: FlowNode;
}

interface ELKEdge {
    id: string;
    sources: string[];
    targets: string[];
    labels?: Array<{ text: string; x?: number; y?: number; width: number; height: number }>;
    sections?: Array<{ bendPoints?: Array<{ x: number; y: number }> }>;
    _original?: FlowEdge;
}

interface ELKGraph {
    id: string;
    layoutOptions: Record<string, string>;
    children: ELKNode[];
    edges: ELKEdge[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

// ELK instance
let ELK: any;

/**
 * Initialize ELK - supports both browser (CDN) and Node.js (npm)
 */
async function initializeELK(): Promise<any> {
    if (typeof window !== 'undefined' && (window as any).ELK) {
        // Browser with CDN - ELK is available as a class
        ELK = new (window as any).ELK();
        return ELK;
    } else if (typeof require !== 'undefined') {
        // Node.js
        const elkjs = require('elkjs');
        ELK = new elkjs.default();
        return ELK;
    } else {
        // Wait a bit for CDN to load if not immediately available
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const checkELK = setInterval(() => {
                attempts++;
                if (typeof window !== 'undefined' && (window as any).ELK) {
                    clearInterval(checkELK);
                    ELK = new (window as any).ELK();
                    resolve(ELK);
                } else if (attempts > 50) { // 5 seconds max wait
                    clearInterval(checkELK);
                    reject(new Error('ELK not found. Please include elkjs via CDN or npm.'));
                }
            }, 100);
        });
    }
}

/**
 * Convert flow nodes and edges to ELK graph format
 */
function convertToELKGraph(flowNodes: FlowNode[], flowEdges: FlowEdge[]): ELKGraph {
    // Convert nodes to ELK format
    const elkNodes: ELKNode[] = flowNodes.map(node => ({
        id: node.id,
        width: node.width || 150,
        height: node.height || 60,
        labels: [{
            text: node.label || node.id,
            width: node.width || 150,
            height: node.height || 60
        }],
        _original: node
    }));
    
    // Convert edges to ELK format
    const elkEdges: ELKEdge[] = flowEdges.map(edge => ({
        id: edge.id || `${edge.source}->${edge.target}`,
        sources: [edge.source],
        targets: [edge.target],
        labels: edge.label ? [{
            text: edge.label,
            width: edge.label.length * 8, // Approximate width
            height: 20
        }] : [],
        _original: edge
    }));
    
    return {
        id: 'root',
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.spacing.nodeNode': '80',
            'elk.spacing.edgeNode': '40',
            'elk.spacing.edgeEdge': '20',
            'elk.spacing.nodeNodeBetweenLayers': '100',
            'elk.layered.spacing.nodeNodeBetweenLayers': '100',
            'elk.layered.spacing.edgeNodeBetweenLayers': '40',
            'elk.layered.spacing.edgeEdgeBetweenLayers': '20',
            'elk.layered.spacing.edgeNode': '40',
            'elk.layered.spacing.nodeNode': '80',
            'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
            'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
            'elk.layered.cycleBreaking.strategy': 'GREEDY',
            'elk.layered.direction': 'RIGHT',
            'elk.insideSelfLoops.activate': 'true',
            'elk.portAlignment.basic': 'JUSTIFIED'
        },
        children: elkNodes,
        edges: elkEdges
    };
}

/**
 * Calculate node dimensions based on label length
 */
function calculateNodeDimensions(node: FlowNode): { width: number; height: number } {
    const label = node.label || node.id;
    const minWidth = 120;
    const minHeight = 50;
    const charWidth = 8;
    const lineHeight = 20;
    const padding = 20;
    
    const estimatedWidth = Math.max(minWidth, label.length * charWidth + padding);
    const estimatedHeight = Math.max(minHeight, lineHeight + padding);
    
    return {
        width: estimatedWidth,
        height: estimatedHeight
    };
}

/**
 * Apply layout to flow nodes and edges using ELK
 * @param flowNodes - Array of flow nodes
 * @param flowEdges - Array of flow edges
 * @returns Positioned nodes and edges
 */
async function useFlowLayout(flowNodes: FlowNode[], flowEdges: FlowEdge[]): Promise<LayoutResult> {
    try {
        // Initialize ELK if not already done
        if (!ELK) {
            await initializeELK();
        }
        
        // Calculate node dimensions
        const nodesWithDimensions = flowNodes.map(node => {
            const dims = calculateNodeDimensions(node);
            return {
                ...node,
                width: dims.width,
                height: dims.height
            };
        });
        
        // Convert to ELK graph format
        const elkGraph = convertToELKGraph(nodesWithDimensions, flowEdges);
        
        // Run ELK layout
        const laidOutGraph = await ELK.layout(elkGraph) as ELKGraph;
        
        // Extract positioned nodes
        const positionedNodes: PositionedNode[] = laidOutGraph.children.map(elkNode => {
            const originalNode = elkNode._original || flowNodes.find(n => n.id === elkNode.id)!;
            return {
                ...originalNode,
                x: elkNode.x || 0,
                y: elkNode.y || 0,
                width: elkNode.width,
                height: elkNode.height,
                _layout: {
                    x: elkNode.x || 0,
                    y: elkNode.y || 0,
                    width: elkNode.width,
                    height: elkNode.height
                }
            };
        });
        
        // Extract positioned edges with routing points
        const positionedEdges: PositionedEdge[] = laidOutGraph.edges.map(elkEdge => {
            const originalEdge = elkEdge._original || flowEdges.find(e => 
                e.source === elkEdge.sources[0] && e.target === elkEdge.targets[0]
            )!;
            
            // Extract routing points if available
            const routingPoints = elkEdge.sections?.flatMap(section => 
                section.bendPoints || []
            ) || [];
            
            return {
                ...originalEdge,
                source: elkEdge.sources[0],
                target: elkEdge.targets[0],
                _routing: {
                    points: routingPoints,
                    sections: elkEdge.sections || []
                },
                _labelPosition: elkEdge.labels?.[0] ? {
                    x: elkEdge.labels[0].x || 0,
                    y: elkEdge.labels[0].y || 0
                } : null
            };
        });
        
        return {
            nodes: positionedNodes,
            edges: positionedEdges,
            bounds: {
                x: laidOutGraph.x || 0,
                y: laidOutGraph.y || 0,
                width: laidOutGraph.width || 0,
                height: laidOutGraph.height || 0
            }
        };
        
    } catch (error) {
        console.error('Error in flow layout:', error);
        throw error;
    }
}

// Export for use in other modules
export { useFlowLayout, initializeELK };
export type { FlowNode, FlowEdge, PositionedNode, PositionedEdge, LayoutResult };

