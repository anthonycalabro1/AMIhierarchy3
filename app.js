// Global State
window.hierarchyData = null;
window.searchIndex = null;
let currentView = 'navigation';
window.currentITReleaseFilter = null; // Track current IT Release filter state
window.currentUseCaseFilter = null; // Track current Use Case filter state

// Show/Hide Loading Indicator
function showLoading() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) indicator.classList.remove('hidden');
}

function hideLoading() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) indicator.classList.add('hidden');
}

// Show Error Message
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.classList.remove('hidden');
        // Auto-hide after 5 seconds
        setTimeout(() => closeError(), 5000);
    }
}

function closeError() {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) errorDiv.classList.add('hidden');
}

// Show Success Message
function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    const successText = document.getElementById('success-text');
    if (successDiv && successText) {
        successText.textContent = message;
        successDiv.classList.remove('hidden');
        // Auto-hide after 3 seconds
        setTimeout(() => closeSuccess(), 3000);
    }
}

function closeSuccess() {
    const successDiv = document.getElementById('success-message');
    if (successDiv) successDiv.classList.add('hidden');
}

// Mobile Menu Toggle
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const button = document.getElementById('mobile-menu-btn');
    if (menu && button) {
        const isHidden = menu.classList.contains('hidden');
        menu.classList.toggle('hidden');
        button.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    }
}

window.toggleMobileMenu = toggleMobileMenu;

// Filter Utility Function
function filterHierarchyByITRelease(data, releaseValue) {
    // If no filter or "All" selected, return original data
    if (!releaseValue || releaseValue === 'All' || releaseValue === '') {
        return data;
    }

    // Helper function to check if a node or its descendants match the filter
    function hasMatchingL3(node) {
        // If this is an L3 node, check if it_release matches
        if (node.level === 'L3') {
            const itRelease = node.it_release || '';
            return itRelease.includes(releaseValue);
        }

        // If this node has children, check if any descendant matches
        if (node.children && node.children.length > 0) {
            return node.children.some(child => hasMatchingL3(child));
        }

        return false;
    }

    // Helper function to recursively filter the hierarchy
    function filterNode(node) {
        // Create a copy of the node
        const filteredNode = { ...node };

        // If this is an L3 node, include it only if it matches
        if (node.level === 'L3') {
            const itRelease = node.it_release || '';
            return itRelease.includes(releaseValue) ? filteredNode : null;
        }

        // For L1 and L2 nodes, filter children recursively
        if (node.children && node.children.length > 0) {
            const filteredChildren = node.children
                .map(child => filterNode(child))
                .filter(child => child !== null);

            // Only include this node if it has at least one matching child
            if (filteredChildren.length > 0) {
                filteredNode.children = filteredChildren;
                return filteredNode;
            }
        }

        return null;
    }

    // Apply filter to root node
    const filteredData = filterNode(data);
    
    // If root has no matching children, return empty structure
    if (!filteredData || !filteredData.children || filteredData.children.length === 0) {
        return {
            name: data.name || "Process Hierarchy",
            children: []
        };
    }

    return filteredData;
}

// Use Case Filter Utility Function
function filterHierarchyByUseCase(data, useCaseValue) {
    // If no filter or "All" selected, return original data
    if (!useCaseValue || useCaseValue === 'All' || useCaseValue === '') {
        return data;
    }

    // Helper function to check if use_case field matches the filter value
    function matchesUseCase(useCaseField, filterValue) {
        if (!useCaseField) return false;
        
        const useCaseLower = useCaseField.toLowerCase();
        const filterLower = filterValue.toLowerCase();
        
        // Handle "Foundational" case - match the full phrase
        if (filterLower.includes('foundational')) {
            return useCaseLower.includes('foundational') && 
                   useCaseLower.includes('not directly mapped to sce use case');
        }
        
        // Handle "Use Case X" patterns - need to match exactly to avoid partial matches
        // Extract the number from filter (e.g., "Use Case 1" -> "1")
        const useCaseMatch = filterLower.match(/use case (\d+)/);
        if (useCaseMatch) {
            const filterNumber = useCaseMatch[1];
            
            // Create patterns that match "Use Case X" but not "Use Case X0", "Use Case X1", etc.
            // Use word boundary or ensure the number is followed by a non-digit character
            // This ensures "Use Case 1" doesn't match "Use Case 13" (because "3" is a digit)
            // Also handle variations like "UC X:" or "Use Case X –"
            const patterns = [
                // "Use Case X" where X is followed by non-digit (space, dash, comma, colon, etc.) or end of string
                // Using negative lookahead to ensure next char is not a digit
                new RegExp(`use case ${filterNumber}(?!\\d)`, 'i'),
                // "UC X" or "UC X:" where X is followed by non-digit
                new RegExp(`uc\\s*${filterNumber}(?!\\d)`, 'i')
            ];
            
            // Check if any pattern matches
            return patterns.some(pattern => pattern.test(useCaseField));
        }
        
        // Fallback to exact match for other cases
        return useCaseLower.includes(filterLower);
    }

    // Helper function to check if a node or its descendants match the filter
    function hasMatchingL3(node) {
        // If this is an L3 node, check if use_case matches
        if (node.level === 'L3') {
            return matchesUseCase(node.use_case, useCaseValue);
        }

        // If this node has children, check if any descendant matches
        if (node.children && node.children.length > 0) {
            return node.children.some(child => hasMatchingL3(child));
        }

        return false;
    }

    // Helper function to recursively filter the hierarchy
    function filterNode(node) {
        // Create a copy of the node
        const filteredNode = { ...node };

        // If this is an L3 node, include it only if it matches
        if (node.level === 'L3') {
            return matchesUseCase(node.use_case, useCaseValue) ? filteredNode : null;
        }

        // For L1 and L2 nodes, filter children recursively
        if (node.children && node.children.length > 0) {
            const filteredChildren = node.children
                .map(child => filterNode(child))
                .filter(child => child !== null);

            // Only include this node if it has at least one matching child
            if (filteredChildren.length > 0) {
                filteredNode.children = filteredChildren;
                return filteredNode;
            }
        }

        return null;
    }

    // Apply filter to root node
    const filteredData = filterNode(data);
    
    // If root has no matching children, return empty structure
    if (!filteredData || !filteredData.children || filteredData.children.length === 0) {
        return {
            name: data.name || "Process Hierarchy",
            children: []
        };
    }

    return filteredData;
}

// Combined Filter Function
function filterHierarchy(data, itReleaseValue, useCaseValue) {
    let filteredData = data;

    // Apply IT Release filter first if provided
    if (itReleaseValue && itReleaseValue !== 'All') {
        filteredData = filterHierarchyByITRelease(filteredData, itReleaseValue);
    }

    // Apply Use Case filter on the result if provided
    if (useCaseValue && useCaseValue !== 'All') {
        filteredData = filterHierarchyByUseCase(filteredData, useCaseValue);
    }

    return filteredData;
}

// Function to count processes at each level
function countProcesses(data) {
    let l1Count = 0;
    let l2Count = 0;
    let l3Count = 0;

    function countNode(node) {
        if (node.level === 'L1') {
            l1Count++;
            if (node.children) {
                node.children.forEach(countNode);
            }
        } else if (node.level === 'L2') {
            l2Count++;
            if (node.children) {
                node.children.forEach(countNode);
            }
        } else if (node.level === 'L3') {
            l3Count++;
        }
    }

    // Count from children (skip root node)
    if (data && data.children) {
        data.children.forEach(countNode);
    }

    return { l1Count, l2Count, l3Count };
}

// Function to update process statistics in header
function updateProcessStatistics(data) {
    const counts = countProcesses(data);
    const l1Element = document.getElementById('l1-count');
    const l2Element = document.getElementById('l2-count');
    const l3Element = document.getElementById('l3-count');

    if (l1Element) {
        l1Element.querySelector('span').textContent = counts.l1Count;
    }
    if (l2Element) {
        l2Element.querySelector('span').textContent = counts.l2Count;
    }
    if (l3Element) {
        l3Element.querySelector('span').textContent = counts.l3Count;
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoading();
        
        // Fetch Data
        const [hierarchyRes, searchRes] = await Promise.all([
            fetch('hierarchy-data.json'),
            fetch('search-index.json')
        ]);

        if (!hierarchyRes.ok || !searchRes.ok) {
            throw new Error('Failed to load data files');
        }

        hierarchyData = await hierarchyRes.json();
        searchIndex = await searchRes.json();

        // Update statistics with initial data
        updateProcessStatistics(hierarchyData);

        // Initialize Views
        initNavigationView(hierarchyData);
        
        // Set initial view
        switchView('navigation');
        
        // Tree view is initialized when switched to, to ensure container dimensions are correct
        
        hideLoading();
        console.log('Data loaded successfully');

    } catch (error) {
        console.error('Error loading data:', error);
        hideLoading();
        showError('Error loading data. Please ensure the conversion script has been run and refresh the page.');
    }
    
    // Setup mobile menu button
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
});

// View Switching Logic
function switchView(viewName) {
    // Update State
    currentView = viewName;

    // Update Buttons
    document.querySelectorAll('header button').forEach(btn => {
        if (btn.id === `${viewName}-view-btn`) {
            btn.classList.remove('text-gray-700', 'bg-gray-50', 'hover:bg-gray-50');
            btn.classList.add('text-white', 'bg-blue-600', 'hover:bg-blue-700');
        } else {
            btn.classList.remove('text-white', 'bg-blue-600', 'hover:bg-blue-700');
            btn.classList.add('text-gray-700', 'bg-gray-50', 'hover:bg-gray-50');
        }
    });

    // Toggle Containers
    document.querySelectorAll('.view-container').forEach(el => el.classList.add('hidden'));
    const viewEl = document.getElementById(`${viewName}-view`);
    if (viewEl) viewEl.classList.remove('hidden');

    // Sync filter dropdowns with current filter state
    const navITReleaseFilter = document.getElementById('nav-it-release-filter');
    const navUseCaseFilter = document.getElementById('nav-use-case-filter');
    const treeITReleaseFilter = document.getElementById('tree-it-release-filter');
    const treeUseCaseFilter = document.getElementById('tree-use-case-filter');
    
    if (navITReleaseFilter) {
        navITReleaseFilter.value = window.currentITReleaseFilter || 'All';
    }
    if (navUseCaseFilter) {
        navUseCaseFilter.value = window.currentUseCaseFilter || 'All';
    }
    if (treeITReleaseFilter) {
        treeITReleaseFilter.value = window.currentITReleaseFilter || 'All';
    }
    if (treeUseCaseFilter) {
        treeUseCaseFilter.value = window.currentUseCaseFilter || 'All';
    }

    // Trigger view specific initializations with current filters
    if (viewName === 'navigation') {
        if (hierarchyData) {
            initNavigationView(hierarchyData, window.currentITReleaseFilter, window.currentUseCaseFilter);
            // Update statistics with filtered data
            if (typeof filterHierarchy === 'function' && typeof updateProcessStatistics === 'function') {
                const filteredData = filterHierarchy(hierarchyData, window.currentITReleaseFilter, window.currentUseCaseFilter);
                updateProcessStatistics(filteredData);
            }
        }
    } else if (viewName === 'tree') {
        if (hierarchyData) {
            initTreeVisualization(hierarchyData, window.currentITReleaseFilter, window.currentUseCaseFilter);
            // Update statistics with filtered data
            if (typeof filterHierarchy === 'function' && typeof updateProcessStatistics === 'function') {
                const filteredData = filterHierarchy(hierarchyData, window.currentITReleaseFilter, window.currentUseCaseFilter);
                updateProcessStatistics(filteredData);
            }
        }
    }
}

// Details Panel Logic
function openDetails(processData) {
    const panel = document.getElementById('details-panel');
    const content = document.getElementById('details-content');
    
    // Generate Content
    let html = `
        <div class="mb-4">
            <span class="inline-block px-2 py-1 text-xs font-semibold rounded-full 
                ${processData.level === 'L1' ? 'bg-blue-100 text-blue-800' : 
                  processData.level === 'L2' ? 'bg-green-100 text-green-800' : 
                  'bg-orange-100 text-orange-800'}">
                ${processData.level || 'Process'}
            </span>
        </div>
        <h3 class="text-2xl font-bold text-gray-800 mb-4">${processData.name}</h3>
    `;

    if (processData.level === 'L3') {
        html += `
            <div class="space-y-4">
                <div>
                    <h4 class="font-semibold text-gray-700">Objective</h4>
                    <p class="text-gray-600 mt-1">${processData.objective || processData.details?.objective || 'N/A'}</p>
                </div>
                <div>
                    <h4 class="font-semibold text-gray-700">Use Case Mapping</h4>
                    <p class="text-gray-600 mt-1">${processData.use_case || processData.details?.use_case || 'N/A'}</p>
                </div>
                <div>
                    <h4 class="font-semibold text-gray-700">IT Release</h4>
                    <p class="text-gray-600 mt-1">${processData.it_release || processData.details?.it_release || 'N/A'}</p>
                </div>
            </div>
        `;
    }

    // Parent Info (if available) - simpler version for now
    // In a real app, we might want to traverse up. 
    // For search results, we have 'parent' in the object.
    if (processData.parent) {
         html += `
            <div class="mt-6 pt-6 border-t border-gray-200">
                <h4 class="font-semibold text-gray-700">Hierarchy</h4>
                <p class="text-sm text-gray-500">Parent: ${processData.parent}</p>
            </div>
        `;
    }

    // Locate in Hierarchy Button
    html += `
        <div class="mt-6 pt-6 border-t border-gray-200">
             <button onclick="locateProcess('${processData.name.replace(/'/g, "\\'")}')" class="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 min-h-[44px]" aria-label="Locate ${processData.name.replace(/'/g, "\\'")} in hierarchy">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
                </svg>
                Locate in Hierarchy
            </button>
        </div>
    `;

    content.innerHTML = html;
    
    // Show Panel
    panel.classList.remove('translate-x-full');
    panel.classList.add('translate-x-0');
}

function closeDetails() {
    const panel = document.getElementById('details-panel');
    panel.classList.remove('translate-x-0');
    panel.classList.add('translate-x-full');
}

window.locateProcess = function(processName) {
    switchView('tree');
    // Close mobile menu if open
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        toggleMobileMenu();
    }
    // Allow tree to initialize
    setTimeout(() => {
        if (window.focusProcessNode) {
            window.focusProcessNode(processName);
        }
    }, 200); // Increased delay to ensure D3 is ready
}

// Expose utility functions globally
window.showError = showError;
window.closeError = closeError;
window.showSuccess = showSuccess;
window.closeSuccess = closeSuccess;
window.filterHierarchyByITRelease = filterHierarchyByITRelease;
window.filterHierarchyByUseCase = filterHierarchyByUseCase;
window.filterHierarchy = filterHierarchy;

