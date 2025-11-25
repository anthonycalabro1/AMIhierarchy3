function initTreeVisualization(data, itReleaseFilter = null, useCaseFilter = null) {
    const containerId = "#tree-container";
    const container = document.querySelector(containerId);
    
    // Store original data for filtering
    originalTreeData = data;
    
    // Clear previous
    d3.select(containerId).selectAll("*").remove();

    if (!container) return;

    // Apply combined filter if provided
    let filteredData = data;
    if (typeof filterHierarchy === 'function') {
        filteredData = filterHierarchy(data, itReleaseFilter, useCaseFilter);
    }

    // Check if filtered data has any children
    if (!filteredData.children || filteredData.children.length === 0) {
        let message = 'No processes found.';
        const activeFilters = [];
        if (itReleaseFilter) {
            activeFilters.push(`IT Release: ${itReleaseFilter}`);
        }
        if (useCaseFilter) {
            activeFilters.push(`Use Case: ${useCaseFilter}`);
        }
        if (activeFilters.length > 0) {
            message = `No processes found matching filter(s): ${activeFilters.join(', ')}`;
        }
        container.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500">${message}</div>`;
        setupTreeFilterListeners();
        return;
    }

    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 800;
    
    // Margins
    const margin = {top: 20, right: 90, bottom: 30, left: 120}; // Increased left margin for root label
    
    // Create SVG
    const svg = d3.select(containerId)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);

    // Group for Zooming
    const zoomGroup = svg.append("g");
    
    // IMPORTANT: The group 'g' starts at vertically centered position.
    // This means (0,0) inside 'g' is at (margin.left, height/2) on screen (if zoom is identity).
    const g = zoomGroup.append("g")
        .attr("transform", `translate(${margin.left},${height/2})`); 

    // Setup Zoom
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            zoomGroup.attr("transform", event.transform);
        });

    svg.call(zoom);

    let i = 0;
    const duration = 750;
    let root;

    // Declare a tree layout and assign the size
    const treeMap = d3.tree().nodeSize([30, 200]); 

    // Assign Parent, Children, Height, Depth
    root = d3.hierarchy(filteredData, function(d) { return d.children; });
    root.x0 = 0; 
    root.y0 = 0;

    let selectedNode = root;

    function updateSelection(d) {
        selectedNode = d;
        g.selectAll('circle.node')
             .style("stroke", n => n === d ? "#f59e0b" : "white")
             .style("stroke-width", n => n === d ? "4px" : "2px");
    }

    // Keyboard Navigation
    d3.select(window).on("keydown.tree", (event) => {
        if (document.getElementById("tree-view").classList.contains("hidden")) return;
        if (!selectedNode) selectedNode = root;

        if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(event.key) > -1) {
            event.preventDefault();
        }

        switch(event.key) {
            case "ArrowLeft":
                if (selectedNode.children) {
                    collapse(selectedNode);
                    update(selectedNode);
                } else if (selectedNode.parent) {
                    updateSelection(selectedNode.parent);
                }
                break;
            case "ArrowRight":
                if (selectedNode._children) {
                    selectedNode.children = selectedNode._children;
                    selectedNode._children = null;
                    update(selectedNode);
                } else if (selectedNode.children) {
                    updateSelection(selectedNode.children[0]);
                }
                break;
            case "ArrowUp":
                if (selectedNode.parent) {
                    const siblings = selectedNode.parent.children;
                    if (siblings) {
                        const idx = siblings.indexOf(selectedNode);
                        if (idx > 0) updateSelection(siblings[idx - 1]);
                    }
                }
                break;
            case "ArrowDown":
                if (selectedNode.parent) {
                    const siblings = selectedNode.parent.children;
                    if (siblings) {
                        const idx = siblings.indexOf(selectedNode);
                        if (idx < siblings.length - 1) updateSelection(siblings[idx + 1]);
                    }
                }
                break;
            case "Enter":
                openDetails(selectedNode.data);
                break;
        }
    });

    // Define collapse function
    function collapse(d) {
        if(d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }

    // Collapse after L1 - ONLY if we are NOT programmatically focusing right now
    // Ideally, we want the tree to start collapsed, but if we are deep-linking, we shouldn't collapse everything immediately before expanding.
    // However, initTreeVisualization is called every time we switch view.
    // Let's keep it collapsed by default. The focus function will handle expansion.
    if (root.children) {
        root.children.forEach(d => {
            if (d.children) {
                collapse(d);
            }
        });
    }

    // Expose focus function globally
    window.focusProcessNode = function(processName) {
        // Find the node via recursive search including hidden/collapsed nodes
        function findNode(node, name) {
            if (node.data.name === name) return node;
            
            // Check visible children
            if (node.children) {
                for (let child of node.children) {
                    const found = findNode(child, name);
                    if (found) return found;
                }
            }
            
            // Check hidden children
            if (node._children) {
                for (let child of node._children) {
                    const found = findNode(child, name);
                    if (found) return found;
                }
            }
            
            return null;
        }

        let targetNode = findNode(root, processName);

        if (!targetNode) {
            console.warn("Node not found:", processName);
            return;
        }

        // Expand all parents
        let current = targetNode;
        while (current.parent) {
            if (current.parent._children) {
                current.parent.children = current.parent._children;
                current.parent._children = null;
            }
            current = current.parent;
        }

        update(root);

        // Zoom to node
        // Center the view on the node
        // Note: x is vertical (row), y is horizontal (column) in tree layout
        // Viewport center
        const center = [width / 2, height / 2];
        const scale = 1.5;
        const x = -targetNode.y * scale + center[0] - margin.left * scale; 
        
        // Corrected Y calculation accounting for initial group transform (height/2)
        // targetY = height/2 - (height/2 + d.x) * scale
        // = height/2 * (1 - scale) - d.x * scale
        const y = (height / 2) * (1 - scale) - (targetNode.x * scale);

        const transform = d3.zoomIdentity
            .translate(x, y)
            .scale(scale);

        svg.transition()
            .duration(750)
            .call(zoom.transform, transform);
            
        // Update selection state
        updateSelection(targetNode);

        // Highlight effect (Pulse)
        const nodeSelection = g.selectAll('g.node')
            .filter(d => d.data.name === processName);
            
        nodeSelection.select('circle')
            .transition()
            .duration(500)
            .style("fill", "#ff0")
            .attr("r", 12)
            .transition()
            .duration(500)
            .style("fill", d => {
                if (d.data.level === 'L1') return d._children ? "#1d4ed8" : "#3b82f6"; 
                if (d.data.level === 'L2') return d._children ? "#15803d" : "#22c55e";
                if (d.data.level === 'L3') return "#f97316";
                return "#555";
            })
            .attr("r", 8);
    };

    update(root);

    function update(source) {
        // Assigns the x and y position for the nodes
        const treeData = treeMap(root);

        // Compute the new tree layout.
        const nodes = treeData.descendants();
        const links = treeData.descendants().slice(1);

        // Normalize for fixed-depth.
        // Reduced spacing from 250 to 200 to keep it more compact
        nodes.forEach(d => { d.y = d.depth * 200; }); 

        // ****************** Nodes section ******************

        // Update the nodes...
        const node = g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        // Enter any new nodes at the parent's previous position.
        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr("transform", d => `translate(${source.y0},${source.x0})`)
            .on('click', click);

        // Add Circle
        nodeEnter.append('circle')
            .attr('class', 'node')
            .attr('r', 1e-6)
            .style("fill", d => {
                if (d.data.level === 'L1') return "#3b82f6"; 
                if (d.data.level === 'L2') return "#22c55e"; 
                if (d.data.level === 'L3') return "#f97316"; 
                return "#555";
            })
            .style("stroke", "white")
            .style("stroke-width", "2px");

        // Add Labels
        nodeEnter.append('text')
            .attr("dy", ".35em")
            .attr("x", d => d.depth === 0 ? -13 : 13)
            .attr("text-anchor", d => d.depth === 0 ? "end" : "start")
            .text(d => d.data.name)
            .style("font-size", "12px")
            .style("fill-opacity", 1e-6)
            .style("cursor", "pointer")
            .clone(true).lower()
            .attr("stroke", "white")
            .attr("stroke-width", 3);

        // UPDATE
        const nodeUpdate = nodeEnter.merge(node);

        // Transition to the proper position for the node
        nodeUpdate.transition()
            .duration(duration)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        // Update the node attributes and style
        nodeUpdate.select('circle.node')
            .attr('r', 8)
            .style("fill", d => {
                if (d.data.level === 'L1') return d._children ? "#1d4ed8" : "#3b82f6"; 
                if (d.data.level === 'L2') return d._children ? "#15803d" : "#22c55e";
                if (d.data.level === 'L3') return "#f97316";
                return "#555";
            });

        nodeUpdate.selectAll('text')
             .style("fill-opacity", 1);

        // Remove any exiting nodes
        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('circle').attr('r', 1e-6);
        nodeExit.select('text').style('fill-opacity', 1e-6);

        // ****************** Links section ******************
        const link = g.selectAll('path.link').data(links, d => d.id);

        const linkEnter = link.enter().insert('path', "g")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", "#ccc")
            .attr("stroke-width", "1.5px")
            .attr('d', d => {
                const o = {x: source.x0, y: source.y0};
                return diagonal(o, o);
            });

        const linkUpdate = linkEnter.merge(link);

        linkUpdate.transition()
            .duration(duration)
            .attr('d', d => diagonal(d, d.parent));

        const linkExit = link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = {x: source.x, y: source.y};
                return diagonal(o, o);
            })
            .remove();

        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });

        function diagonal(s, d) {
            return `M ${s.y} ${s.x}
                    C ${(s.y + d.y) / 2} ${s.x},
                      ${(s.y + d.y) / 2} ${d.x},
                      ${d.y} ${d.x}`;
        }

        function click(event, d) {
            openDetails(d.data);
            updateSelection(d);

            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else {
                d.children = d._children;
                d._children = null;
            }
            
            update(d);
            event.stopPropagation();

            // --- Auto-Pan Logic ---
            // Only auto-pan if we are expanding/collapsing (i.e., it's not a leaf node like L3)
            // If it's L3 (no children and no _children), do NOT auto-pan.
            // Check if it is a leaf node in the data structure context
            // Note: leaf nodes have no children or _children
            const isLeaf = !d.children && !d._children;

            if (!isLeaf) {
                const scale = d3.zoomTransform(svg.node()).k;
                
                // Target X: Position node at 25% of width (minus left margin)
                const targetX = (width * 0.25) - (margin.left * scale) - (d.y * scale); 
                
                // Target Y: Center vertically
                const targetY = (height / 2) * (1 - scale) - (d.x * scale);

                // Transition the zoom
                svg.transition()
                    .duration(750)
                    .call(zoom.transform, d3.zoomIdentity.translate(targetX, targetY).scale(scale));
            }
        }
    }
    
    // Store references globally for expand/collapse functions
    window.treeRoot = root;
    window.treeUpdate = update;
    
    // Setup filter event listeners
    setupTreeFilterListeners();
}

// Store original tree data for filtering
let originalTreeData = null;

function setupTreeFilterListeners() {
    const itReleaseFilter = document.getElementById('tree-it-release-filter');
    const useCaseFilter = document.getElementById('tree-use-case-filter');
    
    // Setup IT Release filter listener
    if (itReleaseFilter && itReleaseFilter.dataset.listenerSetup !== 'true') {
        itReleaseFilter.dataset.listenerSetup = 'true';
        itReleaseFilter.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            window.currentITReleaseFilter = selectedValue === 'All' ? null : selectedValue;
            
            // Sync nav filter dropdown
            const navITReleaseFilter = document.getElementById('nav-it-release-filter');
            if (navITReleaseFilter) {
                navITReleaseFilter.value = selectedValue;
            }
            
            // Apply combined filter
            applyTreeFilters();
        });
    }
    
    // Setup Use Case filter listener
    if (useCaseFilter && useCaseFilter.dataset.listenerSetup !== 'true') {
        useCaseFilter.dataset.listenerSetup = 'true';
        useCaseFilter.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            window.currentUseCaseFilter = selectedValue === 'All' ? null : selectedValue;
            
            // Sync nav filter dropdown
            const navUseCaseFilter = document.getElementById('nav-use-case-filter');
            if (navUseCaseFilter) {
                navUseCaseFilter.value = selectedValue;
            }
            
            // Apply combined filter
            applyTreeFilters();
        });
    }
}

function applyTreeFilters() {
    // Re-initialize tree with combined filtered data
    if (originalTreeData || window.hierarchyData) {
        const dataToUse = originalTreeData || window.hierarchyData;
        
        // Apply filters to get filtered data for statistics
        let filteredData = dataToUse;
        if (typeof filterHierarchy === 'function') {
            filteredData = filterHierarchy(
                dataToUse,
                window.currentITReleaseFilter,
                window.currentUseCaseFilter
            );
        }
        
        // Update statistics with filtered data
        if (typeof updateProcessStatistics === 'function') {
            updateProcessStatistics(filteredData);
        }
        
        initTreeVisualization(dataToUse, window.currentITReleaseFilter, window.currentUseCaseFilter);
    }
}

// Expand All function - expands all nodes in the tree
window.expandAllTreeNodes = function() {
    if (!window.treeRoot || !window.treeUpdate) {
        return;
    }
    
    // Recursively expand all nodes
    function expandNode(node) {
        if (node._children) {
            node.children = node._children;
            node._children = null;
        }
        if (node.children) {
            node.children.forEach(expandNode);
        }
    }
    
    // Expand all children of root
    if (window.treeRoot.children) {
        window.treeRoot.children.forEach(expandNode);
    }
    
    // Update the visualization
    window.treeUpdate(window.treeRoot);
};

// Collapse All function - collapses to just L1 processes (or root if filtered)
window.collapseAllTreeNodes = function() {
    if (!window.treeRoot || !window.treeUpdate) {
        return;
    }
    
    // Recursively collapse all nodes except root
    function collapseNode(node) {
        if (node.children) {
            node._children = node.children;
            node._children.forEach(collapseNode);
            node.children = null;
        }
    }
    
    // Collapse all children of root (this will collapse L1 children, which will collapse their L2 children, etc.)
    if (window.treeRoot.children) {
        window.treeRoot.children.forEach(collapseNode);
    }
    
    // Update the visualization
    window.treeUpdate(window.treeRoot);
};

