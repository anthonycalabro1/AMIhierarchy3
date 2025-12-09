let currentNavData = null;
let navHistory = []; // Array of objects { name: "Root", data: ... }
let originalNavData = null; // Store original unfiltered data

function initNavigationView(data, itReleaseFilter = null, useCaseFilter = null) {
    // Store original data
    originalNavData = data;
    
    // Apply combined filter if provided
    let filteredData = data;
    if (typeof filterHierarchy === 'function') {
        filteredData = filterHierarchy(data, itReleaseFilter, useCaseFilter);
    }
    
    // Reset history
    navHistory = [{ name: "All Processes", data: filteredData }];
    renderNavigationView(filteredData);
    
    // Setup filter event listeners if not already set up
    setupNavFilterListeners();
}

function setupNavFilterListeners() {
    const itReleaseFilter = document.getElementById('nav-it-release-filter');
    const useCaseFilter = document.getElementById('nav-use-case-filter');
    
    // Setup IT Release filter listener
    if (itReleaseFilter && itReleaseFilter.dataset.listenerSetup !== 'true') {
        itReleaseFilter.dataset.listenerSetup = 'true';
        itReleaseFilter.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            window.currentITReleaseFilter = selectedValue === 'All' ? null : selectedValue;
            
            // Sync tree filter dropdown
            const treeITReleaseFilter = document.getElementById('tree-it-release-filter');
            if (treeITReleaseFilter) {
                treeITReleaseFilter.value = selectedValue;
            }
            
            // Apply combined filter
            applyNavFilters();
        });
    }
    
    // Setup Use Case filter listener
    if (useCaseFilter && useCaseFilter.dataset.listenerSetup !== 'true') {
        useCaseFilter.dataset.listenerSetup = 'true';
        useCaseFilter.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            window.currentUseCaseFilter = selectedValue === 'All' ? null : selectedValue;
            
            // Sync tree filter dropdown
            const treeUseCaseFilter = document.getElementById('tree-use-case-filter');
            if (treeUseCaseFilter) {
                treeUseCaseFilter.value = selectedValue;
            }
            
            // Apply combined filter
            applyNavFilters();
        });
    }
}

function applyNavFilters() {
    // Re-apply combined filter to original data
    if (originalNavData && typeof filterHierarchy === 'function') {
        const filteredData = filterHierarchy(
            originalNavData, 
            window.currentITReleaseFilter, 
            window.currentUseCaseFilter
        );
        
        // Update statistics with filtered data
        if (typeof updateProcessStatistics === 'function') {
            updateProcessStatistics(filteredData);
        }
        
        // Reset navigation history with filtered data
        navHistory = [{ name: "All Processes", data: filteredData }];
        renderNavigationView(filteredData);
    }
}

function renderNavigationView(nodeData) {
    currentNavData = nodeData;
    const container = document.getElementById('nav-list');
    const breadcrumbs = document.getElementById('breadcrumbs');
    
    if (!container) {
        console.error('Navigation container not found');
        return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Render Breadcrumbs
    renderBreadcrumbs();
    
    // Ensure we have valid data
    if (!nodeData) {
        container.innerHTML = '<div class="p-4 text-gray-500">No data available.</div>';
        return;
    }
    
    // Debug: Check data structure
    if (!nodeData.children) {
        console.warn('nodeData.children is undefined:', nodeData);
        container.innerHTML = '<div class="p-4 text-gray-500">No child processes found in data structure.</div>';
        return;
    }
    
    // Filter out deleted items
    const visibleChildren = (nodeData.children || []).filter(child => {
        if (!window.pendingChanges || !window.pendingChanges.deleted) {
            return true; // If pendingChanges not initialized, show all
        }
        const processId = window.getProcessId ? window.getProcessId(child) : `${child.level}_${child.name}`;
        return !window.pendingChanges.deleted.has(processId);
    });
    
    if (visibleChildren.length === 0) {
        let filterMessage = 'No child processes found.';
        const activeFilters = [];
        if (window.currentITReleaseFilter) {
            activeFilters.push(`IT Release: ${window.currentITReleaseFilter}`);
        }
        if (window.currentUseCaseFilter) {
            activeFilters.push(`Use Case: ${window.currentUseCaseFilter}`);
        }
        if (activeFilters.length > 0) {
            filterMessage = `No processes found matching filter(s): ${activeFilters.join(', ')}`;
        }
        
        let html = `<div class="p-4 text-gray-500">${filterMessage}</div>`;
        
        // Add "Add Process" button if edit mode is enabled
        if (window.isEditMode && window.isEditMode()) {
            const currentLevel = nodeData.level || 'L1';
            let nextLevel = 'L2';
            if (currentLevel === 'L1') nextLevel = 'L2';
            else if (currentLevel === 'L2') nextLevel = 'L3';
            else nextLevel = 'L3';
            
            html += `
                <div class="mt-4">
                    <button onclick="showAddProcessDialog('${nextLevel}', '${nodeData.name || ''}')" class="w-full px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 min-h-[44px]">
                        <span class="flex items-center justify-center">
                            <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                            Add ${nextLevel} Process
                        </span>
                    </button>
                </div>
            `;
        }
        
        container.innerHTML = html;
        return;
    }
    
    // Add "Add Process" button at the top if edit mode is enabled
    if (window.isEditMode && window.isEditMode()) {
        const currentLevel = nodeData.level || 'L1';
        let nextLevel = 'L2';
        if (currentLevel === 'L1') nextLevel = 'L2';
        else if (currentLevel === 'L2') nextLevel = 'L3';
        else nextLevel = 'L3';
        
        const addButton = document.createElement('div');
        addButton.className = 'mb-4';
        addButton.innerHTML = `
            <button onclick="showAddProcessDialog('${nextLevel}', '${nodeData.name || ''}')" class="w-full px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 min-h-[44px]">
                <span class="flex items-center justify-center">
                    <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add ${nextLevel} Process
                </span>
            </button>
        `;
        container.appendChild(addButton);
    }

    // Render Children
    visibleChildren.forEach(child => {
        const card = document.createElement('div');
        
        // Determine styling based on level
        let levelClass = '';
        let levelLabel = '';
        
        if (child.level === 'L1') {
            levelClass = 'border-l-4 border-blue-500';
            levelLabel = 'Level 1';
        } else if (child.level === 'L2') {
            levelClass = 'border-l-4 border-green-500';
            levelLabel = 'Level 2';
        } else if (child.level === 'L3') {
            levelClass = 'border-l-4 border-orange-500';
            levelLabel = 'Level 3';
        }
        
        // Check for changes
        const processId = window.getProcessId ? window.getProcessId(child) : `${child.level}_${child.name}`;
        const isDeleted = window.pendingChanges?.deleted?.has(processId) || false;
        const isModified = window.pendingChanges?.modified?.has(processId) || false;
        const isAdded = window.pendingChanges?.added?.has(processId) || false;
        
        // Add change indicator classes
        let changeClass = '';
        if (isDeleted) {
            changeClass = 'process-deleted';
        } else if (isAdded) {
            changeClass = 'process-added';
        } else if (isModified) {
            changeClass = 'process-modified';
        }
        
        // Build badge HTML
        let badges = `<span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded" aria-label="Level ${child.level}">${levelLabel}</span>`;
        if (isDeleted) badges += '<span class="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded">DELETED</span>';
        if (isAdded) badges += '<span class="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">NEW</span>';
        if (isModified) badges += '<span class="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">MODIFIED</span>';

        card.className = `bg-white p-4 md:p-6 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border border-gray-200 ${levelClass} ${changeClass} min-h-[60px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2`;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `${child.name}, ${levelLabel}`);
        
        card.innerHTML = `
            <div class="flex justify-between items-center">
                <h3 class="text-lg font-medium ${isDeleted ? 'line-through text-gray-400' : 'text-gray-900'}">${child.name}</h3>
                <div class="flex items-center space-x-2">
                    ${badges}
                    ${window.isEditMode && window.isEditMode() ? `
                        <button onclick="event.stopPropagation(); window.openDetailsForEdit('${processId}')" class="p-1 text-gray-400 hover:text-blue-600 rounded" aria-label="Edit ${child.name}" title="Edit">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        // Click handler
        card.onclick = () => handleNavClick(child);
        
        // Keyboard handler for accessibility
        card.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNavClick(child);
            }
        };
        
        container.appendChild(card);
    });
}

function renderBreadcrumbs() {
    const container = document.getElementById('breadcrumbs');
    container.innerHTML = '';
    container.setAttribute('role', 'navigation');
    container.setAttribute('aria-label', 'Breadcrumb');

    navHistory.forEach((item, index) => {
        const isLast = index === navHistory.length - 1;
        
        if (isLast) {
            const span = document.createElement('span');
            span.className = 'font-bold text-gray-800';
            span.innerText = item.name;
            span.setAttribute('aria-current', 'page');
            container.appendChild(span);
        } else {
            const link = document.createElement('button');
            link.className = 'hover:text-blue-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded px-1 min-h-[44px]';
            link.innerText = item.name;
            link.setAttribute('aria-label', `Navigate to ${item.name}`);
            link.onclick = () => navigateToHistory(index);
            link.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigateToHistory(index);
                }
            };
            container.appendChild(link);
            
            const separator = document.createElement('span');
            separator.className = 'mx-2 text-gray-400';
            separator.innerText = '>';
            separator.setAttribute('aria-hidden', 'true');
            container.appendChild(separator);
        }
    });
}

function handleNavClick(childNode) {
    if (childNode.level === 'L3') {
        // If L3, show details
        openDetails(childNode);
    } else {
        // If L1 or L2, drill down
        navHistory.push({ name: childNode.name, data: childNode });
        renderNavigationView(childNode);
    }
}

function navigateToHistory(index) {
    // Slice history to the selected index (inclusive)
    navHistory = navHistory.slice(0, index + 1);
    const targetItem = navHistory[index];
    renderNavigationView(targetItem.data);
}

