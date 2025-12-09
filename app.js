// Global State
window.hierarchyData = null;
window.searchIndex = null;
let currentView = 'navigation';
window.currentITReleaseFilter = null; // Track current IT Release filter state
window.currentUseCaseFilter = null; // Track current Use Case filter state

// Edit Mode State
let editMode = false;
window.originalHierarchyData = null; // Store original data for undo/redo
window.pendingChanges = {
    modified: new Map(), // Map of process IDs to modified data
    added: new Map(),    // Map of process IDs to new processes
    deleted: new Set()   // Set of deleted process IDs
};
window.changeHistory = []; // Undo/redo stack
window.historyIndex = -1; // Current position in history
const MAX_HISTORY = 50;

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

// Edit Mode Toggle
function toggleEditMode() {
    editMode = !editMode;
    const editModeBtn = document.getElementById('edit-mode-btn');
    const editModeBadge = document.getElementById('edit-mode-badge');
    
    if (editModeBtn) {
        if (editMode) {
            editModeBtn.classList.remove('bg-gray-100', 'text-gray-700');
            editModeBtn.classList.add('bg-yellow-500', 'text-white');
            editModeBtn.setAttribute('aria-pressed', 'true');
            if (editModeBadge) editModeBadge.classList.remove('hidden');
        } else {
            editModeBtn.classList.remove('bg-yellow-500', 'text-white');
            editModeBtn.classList.add('bg-gray-100', 'text-gray-700');
            editModeBtn.setAttribute('aria-pressed', 'false');
            if (editModeBadge) editModeBadge.classList.add('hidden');
        }
    }
    
    // Refresh current view to show/hide edit controls
    if (currentView === 'navigation') {
        if (hierarchyData) {
            initNavigationView(hierarchyData, window.currentITReleaseFilter, window.currentUseCaseFilter);
        }
    } else if (currentView === 'tree') {
        if (hierarchyData) {
            initTreeVisualization(hierarchyData, window.currentITReleaseFilter, window.currentUseCaseFilter);
        }
    }
    
    // Update export button visibility and undo/redo buttons
    updateExportButtonVisibility();
}

window.toggleEditMode = toggleEditMode;

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
        
        // Store original data for undo/redo and change tracking
        window.originalHierarchyData = JSON.parse(JSON.stringify(hierarchyData));

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
function openDetails(processData, isEditing = false) {
    const panel = document.getElementById('details-panel');
    const content = document.getElementById('details-content');
    
    // Check if we should show edit form
    const shouldEdit = isEditing || (editMode && !isEditing);
    const processId = getProcessId(processData);
    const isDeleted = window.pendingChanges.deleted.has(processId);
    const isModified = window.pendingChanges.modified.has(processId);
    const isAdded = window.pendingChanges.added.has(processId);
    
    // Get current data (may be modified)
    let currentData = processData;
    if (isModified) {
        currentData = { ...processData, ...window.pendingChanges.modified.get(processId) };
    }
    
    if (shouldEdit && editMode) {
        renderEditForm(currentData, processId, isDeleted, isAdded);
    } else {
        renderReadOnlyDetails(currentData, processId, isDeleted, isAdded);
    }
    
    // Show Panel
    panel.classList.remove('translate-x-full');
    panel.classList.add('translate-x-0');
}

function renderReadOnlyDetails(processData, processId, isDeleted, isAdded) {
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
            ${isDeleted ? '<span class="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">DELETED</span>' : ''}
            ${isAdded ? '<span class="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">NEW</span>' : ''}
            ${isModified ? '<span class="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">MODIFIED</span>' : ''}
        </div>
        <h3 class="text-2xl font-bold text-gray-800 mb-4 ${isDeleted ? 'line-through text-gray-400' : ''}">${processData.name}</h3>
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

    // Parent Info (if available)
    if (processData.parent) {
         html += `
            <div class="mt-6 pt-6 border-t border-gray-200">
                <h4 class="font-semibold text-gray-700">Hierarchy</h4>
                <p class="text-sm text-gray-500">Parent: ${processData.parent}</p>
            </div>
        `;
    }

    // Action buttons
    html += `
        <div class="mt-6 pt-6 border-t border-gray-200 space-y-2">
            ${editMode ? `
                <button onclick="openDetailsForEdit('${processId}')" class="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 min-h-[44px]" aria-label="Edit ${processData.name.replace(/'/g, "\\'")}">
                    <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                </button>
            ` : ''}
             <button onclick="locateProcess('${processData.name.replace(/'/g, "\\'")}')" class="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 min-h-[44px]" aria-label="Locate ${processData.name.replace(/'/g, "\\'")} in hierarchy">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
                </svg>
                Locate in Hierarchy
            </button>
        </div>
    `;

    content.innerHTML = html;
}

function renderEditForm(processData, processId, isDeleted, isAdded) {
    const content = document.getElementById('details-content');
    const useCaseOptions = [
        'Use Case 1 – Meter-to-Cash',
        'Use Case 2 – Optimizing Energy Savings',
        'Use Case 3 – Improve Customer Experience',
        'Use Case 4 – Revenue Protection',
        'Use Case 5 – Advanced Outage Identification',
        'Use Case 6 – 3rd Party Meter Data Access',
        'Use Case 7 – Long-Term Grid Planning',
        'Use Case 8 – Anomaly & Fault Detection BTM',
        'Use Case 9 – Environmental Monitoring',
        'Use Case 10 – Performance & Health of Dist. Assets',
        'Use Case 11 – Distribution Connectivity Model',
        'Use Case 12 – Switching Support & Outage Selection',
        'Use Case 13 – Post Event Analysis',
        'Use Case 14 – AMI 2.0 Interoperability',
        'Use Case 15 – Fault & Incipient Fault ID',
        'Use Case 18 – Grid Ops: Situational Awareness',
        'Foundational – Not Directly Mapped to SCE Use Case'
    ];
    
    let html = `
        <div class="mb-4">
            <span class="inline-block px-2 py-1 text-xs font-semibold rounded-full 
                ${processData.level === 'L1' ? 'bg-blue-100 text-blue-800' : 
                  processData.level === 'L2' ? 'bg-green-100 text-green-800' : 
                  'bg-orange-100 text-orange-800'}">
                ${processData.level || 'Process'}
            </span>
            ${isDeleted ? '<span class="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">DELETED</span>' : ''}
            ${isAdded ? '<span class="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">NEW</span>' : ''}
        </div>
        <form id="edit-process-form" onsubmit="saveProcess(event, '${processId}')">
            <div class="space-y-4">
                <div>
                    <label for="edit-process-name" class="block text-sm font-medium text-gray-700">Process Name</label>
                    <input type="text" id="edit-process-name" value="${(processData.name || '').replace(/"/g, '&quot;')}" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 min-h-[44px]">
                </div>
    `;
    
    if (processData.level === 'L3') {
        html += `
                <div>
                    <label for="edit-process-objective" class="block text-sm font-medium text-gray-700">Objective</label>
                    <textarea id="edit-process-objective" rows="4" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 min-h-[44px]">${(processData.objective || processData.details?.objective || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div>
                    <label for="edit-process-use-case" class="block text-sm font-medium text-gray-700">Use Case Mapping</label>
                    <select id="edit-process-use-case" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 min-h-[44px]">
                        <option value="">-- Select Use Case --</option>
                        ${useCaseOptions.map(uc => `<option value="${uc}" ${(processData.use_case || processData.details?.use_case || '') === uc ? 'selected' : ''}>${uc}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label for="edit-process-it-release" class="block text-sm font-medium text-gray-700">IT Release</label>
                    <select id="edit-process-it-release" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 min-h-[44px]">
                        <option value="">-- Select IT Release --</option>
                        <option value="IT Release 1" ${(processData.it_release || processData.details?.it_release || '') === 'IT Release 1' ? 'selected' : ''}>IT Release 1</option>
                        <option value="IT Release 2" ${(processData.it_release || processData.details?.it_release || '') === 'IT Release 2' ? 'selected' : ''}>IT Release 2</option>
                        <option value="IT Release 3" ${(processData.it_release || processData.details?.it_release || '') === 'IT Release 3' ? 'selected' : ''}>IT Release 3</option>
                    </select>
                </div>
        `;
    }
    
    html += `
            </div>
            <div class="mt-6 pt-6 border-t border-gray-200 space-y-2">
                <button type="submit" class="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 min-h-[44px]">
                    Save Changes
                </button>
                <button type="button" onclick="closeDetails()" class="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 min-h-[44px]">
                    Cancel
                </button>
                ${!isAdded ? `
                    <button type="button" onclick="deleteProcess('${processId}')" class="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 min-h-[44px]">
                        Delete Process
                    </button>
                ` : ''}
            </div>
        </form>
    `;
    
    content.innerHTML = html;
}

// Helper function to generate unique process ID
function getProcessId(processData) {
    // Use a combination of level and name as ID
    return `${processData.level}_${processData.name}`;
}

window.getProcessId = getProcessId;
window.refreshCurrentView = refreshCurrentView;
window.updateSearchIndex = updateSearchIndex;

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

// Save Process Changes
function saveProcess(event, processId) {
    event.preventDefault();
    
    const name = document.getElementById('edit-process-name').value.trim();
    if (!name) {
        showError('Process name is required');
        return;
    }
    
    const processData = {
        name: name
    };
    
    // Get level from processId or form
    const levelMatch = processId.match(/^(L\d+)_/);
    const level = levelMatch ? levelMatch[1] : 'L3';
    processData.level = level;
    
    // Add L3-specific fields if applicable
    if (level === 'L3') {
        processData.objective = document.getElementById('edit-process-objective').value.trim();
        processData.use_case = document.getElementById('edit-process-use-case').value.trim();
        processData.it_release = document.getElementById('edit-process-it-release').value.trim();
    }
    
    // Check if this is a new process
    const isAdded = window.pendingChanges.added.has(processId);
    
    if (isAdded) {
        // Update added process
        window.pendingChanges.added.set(processId, processData);
    } else {
        // Mark as modified
        window.pendingChanges.modified.set(processId, processData);
    }
    
    // Update the actual hierarchy data
    updateProcessInHierarchy(processId, processData, isAdded);
    
    // Update search index
    updateSearchIndex();
    
    // Add to history
    addToHistory('modify', processId, processData);
    
    // Refresh current view
    refreshCurrentView();
    
    // Update export button
    updateExportButtonVisibility();
    
    // Close details panel
    closeDetails();
    
    showSuccess('Process saved successfully');
}

// Delete Process
function deleteProcess(processId) {
    const processData = findProcessById(processId);
    if (!processData) {
        showError('Process not found');
        return;
    }
    
    // Count children recursively
    function countChildren(node) {
        let count = 0;
        if (node.children) {
            count += node.children.length;
            node.children.forEach(child => {
                count += countChildren(child);
            });
        }
        return count;
    }
    
    const childCount = countChildren(processData);
    let confirmMessage = 'Are you sure you want to delete this process?';
    if (childCount > 0) {
        confirmMessage = `This process has ${childCount} child process(es). Deleting it will also delete all children. Continue?`;
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Recursively mark all children as deleted
    function markChildrenDeleted(node) {
        const nodeId = getProcessId(node);
        window.pendingChanges.deleted.add(nodeId);
        window.pendingChanges.added.delete(nodeId);
        window.pendingChanges.modified.delete(nodeId);
        
        if (node.children) {
            node.children.forEach(child => markChildrenDeleted(child));
        }
    }
    
    // Mark process and all children as deleted
    markChildrenDeleted(processData);
    
    // Add to history
    addToHistory('delete', processId, processData);
    
    // Refresh current view
    refreshCurrentView();
    
    // Update export button
    updateExportButtonVisibility();
    
    // Close details panel
    closeDetails();
    
    showSuccess(`Process and ${childCount} child process(es) marked for deletion (changes will be saved on export)`);
}

window.saveProcess = saveProcess;
window.deleteProcess = deleteProcess;

// Helper function to open details in edit mode
window.openDetailsForEdit = function(processId) {
    const processData = findProcessById(processId);
    if (processData) {
        openDetails(processData, true);
    }
};

// Add Process Function
function addProcess(name, level, parentName, description = '', useCase = '', itRelease = '') {
    try {
        // Validate inputs
        if (!name || !level) {
            return { success: false, error: 'Process name and level are required.' };
        }
        
        // Find parent if specified
        let parentNode = null;
        if (parentName) {
            parentNode = findProcessByName(parentName);
            if (!parentNode) {
                return { success: false, error: `Parent process "${parentName}" not found.` };
            }
            
            // Validate parent level
            if (level === 'L1' && parentNode.level !== 'L1') {
                return { success: false, error: 'L1 processes cannot have a parent.' };
            }
            if (level === 'L2' && parentNode.level !== 'L1') {
                return { success: false, error: 'L2 processes must have an L1 parent.' };
            }
            if (level === 'L3' && parentNode.level !== 'L2') {
                return { success: false, error: 'L3 processes must have an L2 parent.' };
            }
        } else {
            // For L1, no parent needed
            if (level !== 'L1') {
                return { success: false, error: `Parent process is required for ${level} processes.` };
            }
        }
        
        // Create new process object
        const newProcess = {
            name: name,
            level: level
        };
        
        // Add L3-specific fields if applicable
        if (level === 'L3') {
            newProcess.objective = description;
            newProcess.use_case = useCase;
            newProcess.it_release = itRelease;
        } else {
            // Add children array if not L3
            newProcess.children = [];
        }
        
        // Add to hierarchy
        if (level === 'L1') {
            // Add as top-level
            if (!hierarchyData.children) {
                hierarchyData.children = [];
            }
            hierarchyData.children.push(newProcess);
        } else if (parentNode) {
            // Add to parent's children
            if (!parentNode.children) {
                parentNode.children = [];
            }
            parentNode.children.push(newProcess);
        } else {
            return { success: false, error: 'Parent node not found in hierarchy.' };
        }
        
        // Track as added
        const processId = getProcessId(newProcess);
        window.pendingChanges.added.set(processId, newProcess);
        
        // Add to history
        addToHistory('add', processId, newProcess);
        
        // Update search index
        updateSearchIndex();
        
        // Refresh current view
        refreshCurrentView();
        
        // Update export button
        updateExportButtonVisibility();
        
        return { success: true, processId: processId };
    } catch (error) {
        console.error('Error adding process:', error);
        return { success: false, error: error.message || 'Failed to add process.' };
    }
}

// Helper function to find process by name
function findProcessByName(name) {
    function searchNode(node) {
        if (node.name === name) {
            return node;
        }
        if (node.children) {
            for (let child of node.children) {
                const found = searchNode(child);
                if (found) return found;
            }
        }
        return null;
    }
    
    if (hierarchyData && hierarchyData.children) {
        for (let child of hierarchyData.children) {
            const found = searchNode(child);
            if (found) return found;
        }
    }
    return null;
}

window.addProcess = addProcess;

// Helper function to find process in hierarchy by ID
function findProcessById(processId) {
    function searchNode(node) {
        const nodeId = getProcessId(node);
        if (nodeId === processId) {
            return node;
        }
        if (node.children) {
            for (let child of node.children) {
                const found = searchNode(child);
                if (found) return found;
            }
        }
        return null;
    }
    
    // Check added processes first
    if (window.pendingChanges && window.pendingChanges.added) {
        const addedProcess = window.pendingChanges.added.get(processId);
        if (addedProcess) {
            return addedProcess;
        }
    }
    
    if (hierarchyData && hierarchyData.children) {
        for (let child of hierarchyData.children) {
            const found = searchNode(child);
            if (found) return found;
        }
    }
    return null;
}

// Helper function to update process in hierarchy
function updateProcessInHierarchy(processId, newData, isAdded) {
    // If it's an added process, update the added map
    if (isAdded && window.pendingChanges.added.has(processId)) {
        const existing = window.pendingChanges.added.get(processId);
        Object.assign(existing, newData);
        // Also update the actual hierarchy if it exists
        function updateNode(node) {
            const nodeId = getProcessId(node);
            if (nodeId === processId) {
                Object.assign(node, newData);
                return true;
            }
            if (node.children) {
                for (let child of node.children) {
                    if (updateNode(child)) return true;
                }
            }
            return false;
        }
        if (hierarchyData && hierarchyData.children) {
            updateNode(hierarchyData);
        }
        return;
    }
    
    // Update existing process
    function updateNode(node) {
        const nodeId = getProcessId(node);
        if (nodeId === processId) {
            Object.assign(node, newData);
            return true;
        }
        if (node.children) {
            for (let child of node.children) {
                if (updateNode(child)) return true;
            }
        }
        return false;
    }
    
    if (hierarchyData && hierarchyData.children) {
        updateNode(hierarchyData);
    }
}

// Refresh current view after changes
function refreshCurrentView() {
    if (currentView === 'navigation') {
        if (hierarchyData) {
            initNavigationView(hierarchyData, window.currentITReleaseFilter, window.currentUseCaseFilter);
        }
    } else if (currentView === 'tree') {
        if (hierarchyData) {
            initTreeVisualization(hierarchyData, window.currentITReleaseFilter, window.currentUseCaseFilter);
        }
    }
    updateProcessStatistics(hierarchyData);
}

// Update search index when hierarchy changes
function updateSearchIndex() {
    // Rebuild search index from current hierarchy
    searchIndex = [];
    const seen_l1 = new Set();
    const seen_l2 = new Set();
    
    function buildIndex(node, parentName = '') {
        if (node.level === 'L1') {
            if (!seen_l1.has(node.name)) {
                searchIndex.push({
                    name: node.name,
                    level: 'L1',
                    parent: '',
                    details: {}
                });
                seen_l1.add(node.name);
            }
            if (node.children) {
                node.children.forEach(child => buildIndex(child, node.name));
            }
        } else if (node.level === 'L2') {
            if (!seen_l2.has(node.name)) {
                searchIndex.push({
                    name: node.name,
                    level: 'L2',
                    parent: parentName,
                    details: {}
                });
                seen_l2.add(node.name);
            }
            if (node.children) {
                node.children.forEach(child => buildIndex(child, node.name));
            }
        } else if (node.level === 'L3') {
            searchIndex.push({
                name: node.name,
                level: 'L3',
                parent: parentName,
                details: {
                    objective: node.objective || '',
                    use_case: node.use_case || '',
                    it_release: node.it_release || ''
                }
            });
        }
    }
    
    if (hierarchyData && hierarchyData.children) {
        hierarchyData.children.forEach(child => buildIndex(child));
    }
}

// Expose utility functions globally
window.showError = showError;
window.closeError = closeError;
window.showSuccess = showSuccess;
window.closeSuccess = closeSuccess;
window.filterHierarchyByITRelease = filterHierarchyByITRelease;
window.filterHierarchyByUseCase = filterHierarchyByUseCase;
window.filterHierarchy = filterHierarchy;

// Helper function to check if edit mode is enabled
function isEditMode() {
    return editMode;
}

// Helper function to get change count
function getChangeCount() {
    return window.pendingChanges.modified.size + 
           window.pendingChanges.added.size + 
           window.pendingChanges.deleted.size;
}

// Update export button visibility based on changes
function updateExportButtonVisibility() {
    const exportBtn = document.getElementById('export-excel-btn');
    const exportBtnMobile = document.getElementById('export-excel-btn-mobile');
    const changesBtn = document.getElementById('changes-btn');
    const changeCountBadge = document.getElementById('change-count-badge');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const changeCount = getChangeCount();
    
    if (exportBtn) {
        if (changeCount > 0) {
            exportBtn.classList.remove('hidden');
        } else {
            exportBtn.classList.add('hidden');
        }
    }
    
    if (exportBtnMobile) {
        if (changeCount > 0) {
            exportBtnMobile.classList.remove('hidden');
        } else {
            exportBtnMobile.classList.add('hidden');
        }
    }
    
    const changesBtnMobile = document.getElementById('changes-btn-mobile');
    if (changesBtnMobile) {
        if (changeCount > 0) {
            changesBtnMobile.classList.remove('hidden');
        } else {
            changesBtnMobile.classList.add('hidden');
        }
    }
    
    if (changesBtn) {
        if (changeCount > 0) {
            changesBtn.classList.remove('hidden');
        } else {
            changesBtn.classList.add('hidden');
        }
    }
    
    if (changeCountBadge) {
        if (changeCount > 0) {
            changeCountBadge.textContent = changeCount;
            changeCountBadge.classList.remove('hidden');
        } else {
            changeCountBadge.classList.add('hidden');
        }
    }
    
    // Show/hide undo/redo buttons when edit mode is on
    if (editMode) {
        if (undoBtn) undoBtn.classList.remove('hidden');
        if (redoBtn) redoBtn.classList.remove('hidden');
        updateUndoRedoButtons();
    } else {
        if (undoBtn) undoBtn.classList.add('hidden');
        if (redoBtn) redoBtn.classList.add('hidden');
    }
}

window.isEditMode = isEditMode;
window.getChangeCount = getChangeCount;

// History Management for Undo/Redo
function addToHistory(action, processId, data) {
    // Remove any history after current index (if we're not at the end)
    if (window.historyIndex < window.changeHistory.length - 1) {
        window.changeHistory = window.changeHistory.slice(0, window.historyIndex + 1);
    }
    
    // Add new action to history
    window.changeHistory.push({
        action: action,
        processId: processId,
        data: JSON.parse(JSON.stringify(data)),
        timestamp: Date.now()
    });
    
    // Limit history size
    if (window.changeHistory.length > MAX_HISTORY) {
        window.changeHistory.shift();
    } else {
        window.historyIndex = window.changeHistory.length - 1;
    }
    
    // Update undo/redo button states
    updateUndoRedoButtons();
}

function undoChange() {
    if (window.historyIndex < 0) return;
    
    const action = window.changeHistory[window.historyIndex];
    // Implementation would reverse the action
    // For now, just decrement index
    window.historyIndex--;
    
    updateUndoRedoButtons();
    refreshCurrentView();
    showSuccess('Undo: ' + action.action);
}

function redoChange() {
    if (window.historyIndex >= window.changeHistory.length - 1) return;
    
    window.historyIndex++;
    const action = window.changeHistory[window.historyIndex];
    
    updateUndoRedoButtons();
    refreshCurrentView();
    showSuccess('Redo: ' + action.action);
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    
    if (undoBtn) {
        undoBtn.disabled = window.historyIndex < 0;
        undoBtn.classList.toggle('opacity-50', window.historyIndex < 0);
        undoBtn.classList.toggle('cursor-not-allowed', window.historyIndex < 0);
    }
    
    if (redoBtn) {
        redoBtn.disabled = window.historyIndex >= window.changeHistory.length - 1;
        redoBtn.classList.toggle('opacity-50', window.historyIndex >= window.changeHistory.length - 1);
        redoBtn.classList.toggle('cursor-not-allowed', window.historyIndex >= window.changeHistory.length - 1);
    }
}

window.undoChange = undoChange;
window.redoChange = redoChange;

// Changes Summary Panel
function showChangesSummary() {
    const panel = document.getElementById('changes-panel');
    const content = document.getElementById('changes-content');
    
    if (!panel || !content) return;
    
    const modified = Array.from(window.pendingChanges.modified.entries());
    const added = Array.from(window.pendingChanges.added.entries());
    const deleted = Array.from(window.pendingChanges.deleted);
    
    let html = '';
    
    // Modified processes
    if (modified.length > 0) {
        html += `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full mr-2">MODIFIED</span>
                    ${modified.length} process(es)
                </h3>
                <div class="space-y-2">
        `;
        modified.forEach(([processId, data]) => {
            const original = findProcessById(processId);
            html += `
                <div class="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div class="font-medium text-gray-900">${data.name || original?.name || processId}</div>
                    ${original ? `<div class="text-xs text-gray-500 mt-1">Original: ${original.name}</div>` : ''}
                </div>
            `;
        });
        html += `</div></div>`;
    }
    
    // Added processes
    if (added.length > 0) {
        html += `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full mr-2">ADDED</span>
                    ${added.length} process(es)
                </h3>
                <div class="space-y-2">
        `;
        added.forEach(([processId, data]) => {
            html += `
                <div class="p-3 bg-green-50 border border-green-200 rounded">
                    <div class="font-medium text-gray-900">${data.name || processId}</div>
                    <div class="text-xs text-gray-500 mt-1">Level: ${data.level}</div>
                </div>
            `;
        });
        html += `</div></div>`;
    }
    
    // Deleted processes
    if (deleted.length > 0) {
        html += `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full mr-2">DELETED</span>
                    ${deleted.length} process(es)
                </h3>
                <div class="space-y-2">
        `;
        deleted.forEach(processId => {
            const parts = processId.split('_');
            const name = parts.slice(1).join('_');
            html += `
                <div class="p-3 bg-red-50 border border-red-200 rounded">
                    <div class="font-medium text-gray-900 line-through">${name}</div>
                    <div class="text-xs text-gray-500 mt-1">Level: ${parts[0]}</div>
                </div>
            `;
        });
        html += `</div></div>`;
    }
    
    if (html === '') {
        html = '<p class="text-gray-500">No pending changes.</p>';
    }
    
    content.innerHTML = html;
    
    // Show panel
    panel.classList.remove('hidden', 'translate-x-full');
    panel.classList.add('translate-x-0');
}

function closeChangesPanel() {
    const panel = document.getElementById('changes-panel');
    if (panel) {
        panel.classList.remove('translate-x-0');
        panel.classList.add('translate-x-full');
    }
}

function discardAllChanges() {
    if (!confirm('Are you sure you want to discard all changes? This cannot be undone.')) {
        return;
    }
    
    // Reload original data
    if (window.originalHierarchyData) {
        window.hierarchyData = JSON.parse(JSON.stringify(window.originalHierarchyData));
    }
    
    // Clear all changes
    window.pendingChanges.modified.clear();
    window.pendingChanges.added.clear();
    window.pendingChanges.deleted.clear();
    window.changeHistory = [];
    window.historyIndex = -1;
    
    // Rebuild search index
    updateSearchIndex();
    
    // Refresh views
    refreshCurrentView();
    
    // Update UI
    updateExportButtonVisibility();
    closeChangesPanel();
    
    showSuccess('All changes discarded');
}

window.showChangesSummary = showChangesSummary;
window.closeChangesPanel = closeChangesPanel;
window.discardAllChanges = discardAllChanges;

// Show Add Process Dialog
function showAddProcessDialog(level, parentName = '') {
    // Switch to search view and show gap form
    switchView('search');
    
    // Set form values
    const form = document.getElementById('proposal-form');
    if (form) {
        const levelSelect = form.querySelector('#proposal-level');
        const parentInput = form.querySelector('#proposal-parent');
        const l3Fields = document.getElementById('proposal-l3-fields');
        
        if (levelSelect) levelSelect.value = level;
        if (parentInput && parentName) parentInput.value = parentName;
        
        // Show L3 fields if level is L3
        if (level === 'L3' && l3Fields) {
            l3Fields.classList.remove('hidden');
        } else if (l3Fields) {
            l3Fields.classList.add('hidden');
        }
        
        // Show gap form
        const gapForm = document.getElementById('gap-form');
        if (gapForm) {
            gapForm.classList.remove('hidden');
        }
        
        // Scroll to form
        setTimeout(() => {
            gapForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const nameInput = form.querySelector('#proposal-name');
            if (nameInput) {
                nameInput.focus();
            }
        }, 100);
    }
}

window.showAddProcessDialog = showAddProcessDialog;

