/**
 * Process Flow Visualization Component
 * Renders the flow graph using ELK layout engine
 */

// Global state for flow data
let flowNodes = [];
let flowEdges = [];
let positionedData = null;

/**
 * Initialize Process Flow Visualization
 * @param {Array} nodes - Flow nodes from parseDependencies
 * @param {Array} edges - Flow edges from parseDependencies
 */
async function initProcessFlowVisualization(nodes, edges) {
    try {
        flowNodes = nodes;
        flowEdges = edges;
        
        // Apply layout using ELK
        if (typeof window.useFlowLayout === 'function') {
            positionedData = await window.useFlowLayout(nodes, edges);
            renderProcessFlow();
        } else {
            console.error('useFlowLayout not available. Make sure lib/useFlowLayout.js is loaded.');
            const container = document.getElementById('process-flow-container');
            if (container) {
                container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Layout engine not available. Please ensure ELK.js is loaded.</div>';
            }
        }
    } catch (error) {
        console.error('Error initializing process flow visualization:', error);
        const container = document.getElementById('process-flow-container');
        if (container) {
            container.innerHTML = `<div class="flex items-center justify-center h-full text-red-500">Error loading process flow: ${error.message}</div>`;
        }
    }
}

/**
 * Render the process flow visualization
 */
function renderProcessFlow() {
    const container = document.getElementById('process-flow-container');
    if (!container || !positionedData) {
        return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Check if D3 is available for zoom/pan
    const useD3Zoom = typeof d3 !== 'undefined';
    
    if (useD3Zoom) {
        renderProcessFlowWithD3(container);
    } else {
        renderProcessFlowBasic(container);
    }
}

/**
 * Render with D3.js zoom and pan support
 */
function renderProcessFlowWithD3(container) {
    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 800;
    
    // Create SVG using D3
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', '#ffffff')
        .style('cursor', 'grab')
        .style('pointer-events', 'all'); // Ensure SVG can receive mouse events
    
    // Create a group for zoom/pan transformations
    const zoomGroup = svg.append('g');
    
    // Calculate initial viewBox to fit content
    const padding = 100;
    const viewWidth = positionedData.bounds.width + padding * 2;
    const viewHeight = positionedData.bounds.height + padding * 2;
    
    // Add a very large background rectangle for panning (behind everything)
    // Make it much larger than the graph to ensure panning works everywhere
    // This makes it easy to click and drag on empty space
    const extraPadding = 5000; // Large padding to cover zoomed-out views
    const backgroundRect = zoomGroup.append('rect')
        .attr('x', -extraPadding)
        .attr('y', -extraPadding)
        .attr('width', viewWidth + extraPadding * 2)
        .attr('height', viewHeight + extraPadding * 2)
        .attr('fill', 'transparent')
        .attr('class', 'pan-background')
        .style('cursor', 'grab')
        .style('pointer-events', 'all') // Ensure it captures mouse events
        .lower(); // Put it at the bottom (behind everything)
    
    // Create groups for edges, nodes, and labels
    const edgesGroup = zoomGroup.append('g').attr('class', 'edges');
    const nodesGroup = zoomGroup.append('g').attr('class', 'nodes');
    const labelsGroup = zoomGroup.append('g').attr('class', 'labels');
    
    // Setup zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 5]) // Allow zoom from 10% to 500%
        .on('zoom', (event) => {
            zoomGroup.attr('transform', event.transform);
        });
    
    // Apply zoom to SVG - this enables panning by default
    svg.call(zoom);
    
    // Initial transform to center and fit the content
    const initialScale = Math.min(
        (width - padding * 2) / viewWidth,
        (height - padding * 2) / viewHeight,
        1 // Don't zoom in initially
    );
    const initialX = (width - viewWidth * initialScale) / 2;
    const initialY = (height - viewHeight * initialScale) / 2;
    
    svg.call(zoom.transform, d3.zoomIdentity
        .translate(initialX, initialY)
        .scale(initialScale)
    );
    
    // Add arrowhead marker definition
    const defs = svg.append('defs');
    const marker = defs.append('marker')
        .attr('id', 'arrowhead')
        .attr('markerWidth', 10)
        .attr('markerHeight', 10)
        .attr('refX', 9)
        .attr('refY', 3)
        .attr('orient', 'auto');
    marker.append('polygon')
        .attr('points', '0 0, 10 3, 0 6')
        .attr('fill', '#94a3b8');
    
    // Render edges
    renderEdgesD3(edgesGroup);
    
    // Render nodes
    renderNodesD3(nodesGroup, labelsGroup);
    
    // After rendering, prevent panning when clicking directly on nodes/edges/labels
    // But allow panning on the background rectangle
    nodesGroup.selectAll('.flow-node')
        .on('mousedown.zoom', function(event) {
            event.stopPropagation(); // Prevent panning when clicking nodes
        });
    
    edgesGroup.selectAll('.flow-edge')
        .on('mousedown.zoom', function(event) {
            event.stopPropagation(); // Prevent panning when clicking edges
        });
    
    labelsGroup.selectAll('.node-label-group, .edge-label-group')
        .on('mousedown.zoom', function(event) {
            event.stopPropagation(); // Prevent panning when clicking labels
        });
    
    // Update cursor based on what we're hovering over
    function updateCursor(target) {
        if (target === backgroundRect.node() || target === svg.node()) {
            svg.style('cursor', 'grab');
        } else if (target.classList && target.classList.contains('flow-node')) {
            svg.style('cursor', 'pointer');
        } else if (target.classList && target.classList.contains('flow-edge')) {
            svg.style('cursor', 'pointer');
        } else {
            // Default to grab for empty space
            svg.style('cursor', 'grab');
        }
    }
    
    svg.on('mousemove', function(event) {
        updateCursor(event.target);
    });
    
    // Change cursor when dragging starts
    let isDragging = false;
    svg.on('mousedown', function(event) {
        const target = event.target;
        // Change to grabbing if we're on the background or SVG
        if (target === backgroundRect.node() || target === svg.node() || 
            (target.tagName === 'rect' && target.classList.contains('pan-background'))) {
            svg.style('cursor', 'grabbing');
            isDragging = true;
        }
    });
    
    svg.on('mouseup', function(event) {
        if (isDragging) {
            updateCursor(event.target);
            isDragging = false;
        }
    });
    
    svg.on('mouseleave', function() {
        svg.style('cursor', 'grab');
        isDragging = false;
    });
    
    // Store zoom reference for fit/reset functions
    window.processFlowZoom = zoom;
    window.processFlowSvg = svg;
    window.processFlowZoomGroup = zoomGroup;
    window.processFlowInitialTransform = { x: initialX, y: initialY, scale: initialScale };
}

/**
 * Render edges using D3
 */
function renderEdgesD3(edgesGroup) {
    const edges = edgesGroup.selectAll('.flow-edge')
        .data(positionedData.edges)
        .enter()
        .append('path')
        .attr('class', 'flow-edge')
        .attr('d', edge => {
            // Always use the edge's source and target (preserved from original Excel data)
            const sourceNode = positionedData.nodes.find(n => n.id === edge.source);
            const targetNode = positionedData.nodes.find(n => n.id === edge.target);
            
            if (!sourceNode || !targetNode) {
                console.warn('Could not find nodes for edge:', edge);
                return '';
            }
            
            // Verify we have the correct source/target relationship
            // In a left-to-right layout, source should generally be to the left of target
            // But we always draw from source to target regardless of layout position
            
            // Use ELK routing sections if available (more accurate)
            if (edge._routing && edge._routing.sections && edge._routing.sections.length > 0) {
                const section = edge._routing.sections[0]; // Use first section
                let pathData = '';
                
                // Determine if we need to reverse the routing (if ELK swapped nodes)
                // Check if target node is actually to the left of source node
                const targetIsLeftOfSource = targetNode.x < sourceNode.x;
                
                // Start from section startPoint (where edge leaves source node)
                // But verify it's actually connected to our source node
                if (section.startPoint) {
                    // Use ELK's routing, but ensure we start from source and end at target
                    pathData = `M ${section.startPoint.x} ${section.startPoint.y}`;
                } else {
                    // Fallback to node right edge (for left-to-right flow)
                    pathData = `M ${sourceNode.x + sourceNode.width} ${sourceNode.y + sourceNode.height / 2}`;
                }
                
                // Add bend points if available
                if (section.bendPoints && section.bendPoints.length > 0) {
                    section.bendPoints.forEach(point => {
                        pathData += ` L ${point.x} ${point.y}`;
                    });
                }
                
                // End at section endPoint (where edge enters target node)
                if (section.endPoint) {
                    pathData += ` L ${section.endPoint.x} ${section.endPoint.y}`;
                } else {
                    // Fallback to node left edge (for left-to-right flow)
                    pathData += ` L ${targetNode.x} ${targetNode.y + targetNode.height / 2}`;
                }
                
                return pathData;
            }
            
            // Fallback: use simple path if no routing sections available
            // Always draw from source node (right edge) to target node (left edge)
            let pathData = `M ${sourceNode.x + sourceNode.width} ${sourceNode.y + sourceNode.height / 2}`;
            
            if (edge._routing && edge._routing.points && edge._routing.points.length > 0) {
                edge._routing.points.forEach(point => {
                    pathData += ` L ${point.x} ${point.y}`;
                });
            }
            
            pathData += ` L ${targetNode.x} ${targetNode.y + targetNode.height / 2}`;
            return pathData;
        })
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 2)
        .attr('fill', 'none')
        .attr('marker-end', 'url(#arrowhead)')
        .style('cursor', 'pointer')
        .on('click', (event, edge) => {
            console.log('Edge clicked:', edge);
        });
    
    // Add edge labels
    const edgeLabels = edgesGroup.selectAll('.edge-label-group')
        .data(positionedData.edges.filter(e => e.label && e._labelPosition))
        .enter()
        .append('g')
        .attr('class', 'edge-label-group');
    
    edgeLabels.append('rect')
        .attr('x', d => {
            // Approximate label width
            const textWidth = d.label.length * 6;
            return d._labelPosition.x - textWidth / 2 - 4;
        })
        .attr('y', d => d._labelPosition.y - 10)
        .attr('width', d => d.label.length * 6 + 8)
        .attr('height', 20)
        .attr('fill', 'white')
        .attr('stroke', '#e2e8f0')
        .attr('rx', 3);
    
    edgeLabels.append('text')
        .attr('x', d => d._labelPosition.x)
        .attr('y', d => d._labelPosition.y)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#475569')
        .text(d => d.label);
}

/**
 * Render nodes using D3
 */
function renderNodesD3(nodesGroup, labelsGroup) {
    // Render node rectangles
    const nodes = nodesGroup.selectAll('.flow-node')
        .data(positionedData.nodes)
        .enter()
        .append('rect')
        .attr('class', 'flow-node')
        .attr('x', d => d.x)
        .attr('y', d => d.y)
        .attr('width', d => d.width)
        .attr('height', d => d.height)
        .attr('rx', 8)
        .attr('fill', d => getNodeColor(d.group))
        .attr('stroke', '#475569')
        .attr('stroke-width', 2)
        .attr('opacity', 0.9)
        .style('cursor', 'pointer')
        .on('click', (event, node) => {
            console.log('Node clicked:', node);
            if (window.openDetails) {
                window.openDetails({
                    name: node.label,
                    level: 'L3',
                    group: node.group
                });
            }
        });
    
    // Render node labels
    const nodeLabels = labelsGroup.selectAll('.node-label-group')
        .data(positionedData.nodes)
        .enter()
        .append('g')
        .attr('class', 'node-label-group')
        .attr('transform', d => `translate(${d.x + d.width / 2}, ${d.y + d.height / 2})`);
    
    nodeLabels.each(function(node) {
        const labelGroup = d3.select(this);
        const words = node.label.split(' ');
        const lines = [];
        let currentLine = '';
        const maxWidth = node.width - 20; // Padding
        
        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const testWidth = testLine.length * 6; // Approximate character width
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) lines.push(currentLine);
        
        lines.forEach((line, index) => {
            labelGroup.append('text')
                .attr('x', 0)
                .attr('y', (index - (lines.length - 1) / 2) * 14)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '11px')
                .attr('font-weight', '500')
                .attr('fill', '#1e293b')
                .text(line);
        });
    });
}

/**
 * Render basic version without D3 (fallback)
 */
function renderProcessFlowBasic(container) {
    // Create SVG for rendering
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${positionedData.bounds.width + 200} ${positionedData.bounds.height + 200}`);
    svg.style.background = '#ffffff'; // White background to match other views
    
    // Create groups for edges and nodes
    const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgesGroup.setAttribute('class', 'edges');
    const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodesGroup.setAttribute('class', 'nodes');
    const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelsGroup.setAttribute('class', 'labels');
    
    // Render edges first (so they appear behind nodes)
    positionedData.edges.forEach(edge => {
        const sourceNode = positionedData.nodes.find(n => n.id === edge.source);
        const targetNode = positionedData.nodes.find(n => n.id === edge.target);
        
        if (!sourceNode || !targetNode) return;
        
        // Draw orthogonal edge with routing points
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let pathData = '';
        
        // Use ELK routing sections if available (more accurate)
        if (edge._routing && edge._routing.sections && edge._routing.sections.length > 0) {
            const section = edge._routing.sections[0]; // Use first section
            
            // Start from section startPoint (where edge leaves source node)
            if (section.startPoint) {
                pathData = `M ${section.startPoint.x} ${section.startPoint.y}`;
            } else {
                // Fallback to node right edge
                pathData = `M ${sourceNode.x + sourceNode.width} ${sourceNode.y + sourceNode.height / 2}`;
            }
            
            // Add bend points if available
            if (section.bendPoints && section.bendPoints.length > 0) {
                section.bendPoints.forEach(point => {
                    pathData += ` L ${point.x} ${point.y}`;
                });
            }
            
            // End at section endPoint (where edge enters target node)
            if (section.endPoint) {
                pathData += ` L ${section.endPoint.x} ${section.endPoint.y}`;
            } else {
                // Fallback to node left edge
                pathData += ` L ${targetNode.x} ${targetNode.y + targetNode.height / 2}`;
            }
        } else {
            // Fallback: use simple path if no routing sections available
            pathData = `M ${sourceNode.x + sourceNode.width} ${sourceNode.y + sourceNode.height / 2}`;
            
            if (edge._routing && edge._routing.points && edge._routing.points.length > 0) {
                edge._routing.points.forEach(point => {
                    pathData += ` L ${point.x} ${point.y}`;
                });
            }
            
            pathData += ` L ${targetNode.x} ${targetNode.y + targetNode.height / 2}`;
        }
        
        path.setAttribute('d', pathData);
        path.setAttribute('stroke', '#94a3b8');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.setAttribute('class', 'flow-edge');
        path.style.cursor = 'pointer';
        
        // Add click handler
        path.addEventListener('click', () => {
            console.log('Edge clicked:', edge);
        });
        
        edgesGroup.appendChild(path);
        
        // Add edge label if available
        if (edge.label && edge._labelPosition) {
            const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('x', edge._labelPosition.x);
            labelText.setAttribute('y', edge._labelPosition.y);
            labelText.setAttribute('text-anchor', 'middle');
            labelText.setAttribute('font-size', '12px');
            labelText.setAttribute('fill', '#475569');
            labelText.setAttribute('class', 'edge-label');
            labelText.textContent = edge.label;
            
            // Add background rectangle for readability
            const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            const bbox = labelText.getBBox();
            labelBg.setAttribute('x', bbox.x - 4);
            labelBg.setAttribute('y', bbox.y - 2);
            labelBg.setAttribute('width', bbox.width + 8);
            labelBg.setAttribute('height', bbox.height + 4);
            labelBg.setAttribute('fill', 'white');
            labelBg.setAttribute('stroke', '#e2e8f0');
            labelBg.setAttribute('rx', '3');
            labelsGroup.appendChild(labelBg);
            labelsGroup.appendChild(labelText);
        }
    });
    
    // Render nodes
    positionedData.nodes.forEach(node => {
        // Node rectangle
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', node.x);
        rect.setAttribute('y', node.y);
        rect.setAttribute('width', node.width);
        rect.setAttribute('height', node.height);
        rect.setAttribute('rx', '8');
        const nodeColor = getNodeColor(node.group);
        rect.setAttribute('fill', nodeColor);
        rect.setAttribute('stroke', '#475569');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('opacity', '0.9'); // Slight transparency for better visual hierarchy
        rect.setAttribute('class', 'flow-node');
        rect.style.cursor = 'pointer';
        
        // Add click handler
        rect.addEventListener('click', () => {
            console.log('Node clicked:', node);
            // You can integrate with details panel here
            if (window.openDetails) {
                window.openDetails({
                    name: node.label,
                    level: 'L3',
                    group: node.group
                });
            }
        });
        
        nodesGroup.appendChild(rect);
        
        // Node label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x + node.width / 2);
        text.setAttribute('y', node.y + node.height / 2);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '11px'); // Match font size with other views
        text.setAttribute('font-weight', '500');
        text.setAttribute('fill', '#1e293b');
        text.setAttribute('class', 'node-label');
        text.textContent = node.label;
        
        // Word wrap for long labels (simplified)
        if (node.label.length > 20) {
            const words = node.label.split(' ');
            const lines = [];
            let currentLine = '';
            words.forEach(word => {
                if ((currentLine + word).length > 20) {
                    if (currentLine) lines.push(currentLine.trim());
                    currentLine = word + ' ';
                } else {
                    currentLine += word + ' ';
                }
            });
            if (currentLine) lines.push(currentLine.trim());
            
            // Clear and add multiple lines
            text.textContent = '';
            lines.forEach((line, index) => {
                const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                tspan.setAttribute('x', node.x + node.width / 2);
                tspan.setAttribute('dy', index === 0 ? '0' : '14');
                tspan.textContent = line;
                text.appendChild(tspan);
            });
        }
        
        nodesGroup.appendChild(text);
    });
    
    // Add arrowhead marker definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3, 0 6');
    polygon.setAttribute('fill', '#94a3b8');
    marker.appendChild(polygon);
    defs.appendChild(marker);
    
    // Assemble SVG
    svg.appendChild(defs);
    svg.appendChild(edgesGroup);
    svg.appendChild(nodesGroup);
    svg.appendChild(labelsGroup);
    
    container.appendChild(svg);
}

/**
 * Get node color based on Value Stream
 * Maps Value Stream values to colors:
 * - Stream 1: Blue
 * - Stream 2: Green
 * - Stream 3: Orange
 * - Stream 4: Purple
 * - Support: Gray
 */
function getNodeColor(group) {
    if (!group) return '#e2e8f0'; // Default gray
    
    const groupLower = String(group).toLowerCase().trim();
    
    // Map Value Stream values to colors
    if (groupLower.includes('stream 1') || groupLower === 'stream 1' || groupLower === '1') {
        return '#3b82f6'; // Blue
    } else if (groupLower.includes('stream 2') || groupLower === 'stream 2' || groupLower === '2') {
        return '#10b981'; // Green
    } else if (groupLower.includes('stream 3') || groupLower === 'stream 3' || groupLower === '3') {
        return '#f97316'; // Orange
    } else if (groupLower.includes('stream 4') || groupLower === 'stream 4' || groupLower === '4') {
        return '#a855f7'; // Purple
    } else if (groupLower.includes('support')) {
        return '#6b7280'; // Gray
    }
    
    // Default fallback
    return '#e2e8f0'; // Light gray
}

/**
 * Fit process flow to screen
 */
function fitProcessFlowToScreen() {
    if (!window.processFlowSvg || !window.processFlowZoom || !positionedData) return;
    
    const svg = window.processFlowSvg.node();
    const container = svg.parentElement;
    if (!container) return;
    
    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 800;
    const padding = 50;
    
    const viewWidth = positionedData.bounds.width + padding * 2;
    const viewHeight = positionedData.bounds.height + padding * 2;
    
    const scale = Math.min(
        (width - padding * 2) / viewWidth,
        (height - padding * 2) / viewHeight,
        1 // Don't zoom in, only out
    );
    
    const x = (width - viewWidth * scale) / 2;
    const y = (height - viewHeight * scale) / 2;
    
    window.processFlowSvg.transition()
        .duration(750)
        .call(window.processFlowZoom.transform, d3.zoomIdentity
            .translate(x, y)
            .scale(scale)
        );
}

/**
 * Reset process flow zoom
 */
function resetProcessFlowZoom() {
    if (!window.processFlowSvg || !window.processFlowZoom || !window.processFlowInitialTransform) return;
    
    const { x, y, scale } = window.processFlowInitialTransform;
    
    window.processFlowSvg.transition()
        .duration(750)
        .call(window.processFlowZoom.transform, d3.zoomIdentity
            .translate(x, y)
            .scale(scale)
        );
}

/**
 * Zoom process flow by a factor
 * @param {number} factor - Zoom factor (e.g., 1.2 to zoom in, 0.8 to zoom out)
 */
function zoomProcessFlow(factor) {
    if (!window.processFlowSvg || !window.processFlowZoom) return;
    
    const svg = window.processFlowSvg.node();
    const width = svg.clientWidth || 1000;
    const height = svg.clientHeight || 800;
    
    // Get current transform
    const currentTransform = d3.zoomTransform(svg);
    
    // Calculate new scale
    const newScale = Math.max(0.1, Math.min(5, currentTransform.k * factor));
    
    // Zoom towards center of viewport
    const centerX = width / 2;
    const centerY = height / 2;
    
    const newTransform = currentTransform
        .translate(centerX - centerX * (newScale / currentTransform.k), centerY - centerY * (newScale / currentTransform.k))
        .scale(newScale);
    
    window.processFlowSvg.transition()
        .duration(200)
        .call(window.processFlowZoom.transform, newTransform);
}

/**
 * Handle file selection for Process Flow
 */
async function handleProcessFlowFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const container = document.getElementById('process-flow-container');
    if (container) {
        container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Loading file...</div>';
    }
    
    try {
        // Parse the selected file
        const { flowNodes, flowEdges } = await window.parseDependencies(file);
        await window.initProcessFlowVisualization(flowNodes, flowEdges);
    } catch (error) {
        console.error('Error loading file:', error);
        if (container) {
            container.innerHTML = `<div class="flex items-center justify-center h-full text-red-500">Error loading file: ${error.message}</div>`;
        }
    }
}

// Export for global use
window.initProcessFlowVisualization = initProcessFlowVisualization;
window.fitProcessFlowToScreen = fitProcessFlowToScreen;
window.resetProcessFlowZoom = resetProcessFlowZoom;
window.zoomProcessFlow = zoomProcessFlow;
window.handleProcessFlowFileSelect = handleProcessFlowFileSelect;

