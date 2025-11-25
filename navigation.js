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
    
    // Clear container
    container.innerHTML = '';
    
    // Render Breadcrumbs
    renderBreadcrumbs();

    // Check if leaf node (L3) - though typically we stop at L2 listing L3s
    // If the current node is an L3, it shouldn't really happen in this logic 
    // unless we clicked an L3, but L3 click should open details.
    
    if (!nodeData.children || nodeData.children.length === 0) {
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
        container.innerHTML = `<div class="p-4 text-gray-500">${filterMessage}</div>`;
        return;
    }

    // Render Children
    nodeData.children.forEach(child => {
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

        card.className = `bg-white p-4 md:p-6 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border border-gray-200 ${levelClass} min-h-[60px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2`;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `${child.name}, ${levelLabel}`);
        
        card.innerHTML = `
            <div class="flex justify-between items-center">
                <h3 class="text-lg font-medium text-gray-900">${child.name}</h3>
                <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded" aria-label="Level ${child.level}">${levelLabel}</span>
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

