// Initialize Search Listener
document.getElementById('search-input').addEventListener('input', (e) => {
    handleSearch(e.target.value);
});

function handleSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    const gapForm = document.getElementById('gap-form');
    
    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '';
        gapForm.classList.add('hidden');
        return;
    }

    const lowerQuery = query.toLowerCase();
    
    // Filter Search Index
    const results = searchIndex.filter(item => {
        // Check Name
        if (item.name && item.name.toLowerCase().includes(lowerQuery)) return true;
        
        // Check Details for L3
        if (item.level === 'L3' && item.details) {
            if (item.details.objective && item.details.objective.toLowerCase().includes(lowerQuery)) return true;
            if (item.details.use_case && item.details.use_case.toLowerCase().includes(lowerQuery)) return true;
        }
        return false;
    });

    // Render Results
    renderSearchResults(results);

    // Handle No Results -> Show Gap Form
    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="text-gray-500 italic">No matching processes found.</div>';
        gapForm.classList.remove('hidden');
    } else {
        gapForm.classList.add('hidden');
    }
}

function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    container.innerHTML = '';

    // Limit results for performance if needed
    const displayResults = results.slice(0, 50); 

    displayResults.forEach(item => {
        const div = document.createElement('div');
        
        // Badge color
        let badgeColor = 'bg-gray-100 text-gray-800';
        if (item.level === 'L1') badgeColor = 'bg-blue-100 text-blue-800';
        if (item.level === 'L2') badgeColor = 'bg-green-100 text-green-800';
        if (item.level === 'L3') badgeColor = 'bg-orange-100 text-orange-800';

        div.className = 'bg-white p-4 rounded-lg shadow border border-gray-200 hover:bg-gray-50 cursor-pointer flex justify-between items-start';
        
        let content = `
            <div>
                <div class="flex items-center space-x-2">
                    <h4 class="font-medium text-gray-900">${item.name}</h4>
                    <span class="px-2 py-0.5 text-xs rounded-full ${badgeColor}">${item.level}</span>
                </div>
        `;
        
        // Add context if it's L3
        if (item.level === 'L3' && item.parent) {
             content += `<div class="text-xs text-gray-500 mt-1">Parent: ${item.parent}</div>`;
        }
        
        // Add snippet if matched in objective or use case? (Optional enhancement)

        content += `</div>`;
        
        // Locate Button
        content += `
            <div class="ml-4 flex-shrink-0 self-center">
                <button onclick="event.stopPropagation(); locateProcess('${item.name.replace(/'/g, "\\'")}')" class="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" aria-label="Locate ${item.name.replace(/'/g, "\\'")} in hierarchy" title="Locate in Hierarchy">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                </button>
            </div>
        `;
        
        div.innerHTML = content;
        div.onclick = () => openDetails({
            name: item.name,
            level: item.level,
            parent: item.parent,
            ...item.details
        });

        container.appendChild(div);
    });
}

function handleProposal(event) {
    event.preventDefault();
    // In a real app, this would POST to a backend.
    // For now, we show a success message using the new UI.
    if (window.showSuccess) {
        window.showSuccess('Thank you! Your process proposal has been submitted for review.');
    } else {
        // Fallback if showSuccess is not available
        alert('Thank you! Your process proposal has been submitted for review.');
    }
    event.target.reset();
    clearSuggestions();
}

// --- Smart Gap Suggestions ---

// Attach listeners when DOM is ready (or immediately if script runs after DOM)
// Since script is at end of body, DOM is likely ready.
setTimeout(() => {
    const form = document.getElementById('proposal-form');
    if (form) {
        const inputs = form.querySelectorAll('input[type="text"], textarea');
        // Assuming order: [0]=Name, [1]=Parent, [2]=Description (textarea) - wait, textarea is separate query
        const nameInput = form.querySelector('input[type="text"]:nth-of-type(1)'); 
        // Note: Tailwind classes might mess with simple selectors, but order is reliable if we grab all controls
        
        // More robust selection:
        const nameField = form.querySelector('input:not([id="proposal-parent"])');
        const descField = form.querySelector('textarea');
        
        function trigger() {
            if (nameField && descField) {
                 updateGapSuggestions(nameField.value, descField.value);
            }
        }

        if (nameField) nameField.addEventListener('input', trigger);
        if (descField) descField.addEventListener('input', trigger);
    }
}, 1000); // Delay slightly to ensure everything is rendered

function updateGapSuggestions(name, desc) {
    const text = (name + ' ' + desc).toLowerCase();
    if (text.length < 4) {
        clearSuggestions();
        return;
    }

    // Candidates: L1 and L2
    const candidates = searchIndex.filter(i => i.level === 'L1' || i.level === 'L2');
    const bestMatch = findBestMatch(text, candidates);
    
    if (bestMatch) {
        showSuggestion(bestMatch);
    } else {
        clearSuggestions();
    }
}

function findBestMatch(text, candidates) {
    const words = text.split(/\W+/).filter(w => w.length > 3);
    if (words.length === 0) return null;

    let bestScore = 0;
    let bestCandidate = null;

    candidates.forEach(cand => {
        const candText = (cand.name + ' ' + (cand.details?.objective || '')).toLowerCase();
        const candWords = candText.split(/\W+/).filter(w => w.length > 3);
        
        let matchCount = 0;
        words.forEach(w => {
            if (candWords.includes(w)) matchCount++;
        });
        
        // Simple score: Matches
        if (matchCount > bestScore) {
            bestScore = matchCount;
            bestCandidate = cand;
        }
    });

    return bestScore > 0 ? bestCandidate : null;
}

function showSuggestion(candidate) {
    let suggestBox = document.getElementById('gap-suggestion-box');
    const form = document.getElementById('proposal-form');
    
    if (!suggestBox) {
        suggestBox = document.createElement('div');
        suggestBox.id = 'gap-suggestion-box';
        suggestBox.className = 'mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md';
        // Insert before submit button (last child usually)
        form.querySelector('button[type="submit"]').parentNode.insertBefore(suggestBox, form.querySelector('button[type="submit"]'));
    }
    
    suggestBox.innerHTML = `
        <p class="text-sm text-yellow-800 font-medium">Suggestion:</p>
        <p class="text-xs text-yellow-600">Based on your input, this process might belong under:</p>
        <div class="mt-2 flex items-center justify-between bg-white p-2 rounded border border-yellow-100">
            <div>
                <span class="font-bold text-gray-800 text-sm">${candidate.name}</span>
                <span class="ml-2 text-xs text-gray-500">(${candidate.level})</span>
            </div>
            <button type="button" onclick="useSuggestion('${candidate.name.replace(/'/g, "\\'")}')" class="text-xs font-bold text-blue-600 hover:underline">Use Parent</button>
        </div>
    `;
}

function clearSuggestions() {
    const suggestBox = document.getElementById('gap-suggestion-box');
    if (suggestBox) suggestBox.remove();
}

window.useSuggestion = function(parentName) {
    const parentInput = document.getElementById('proposal-parent');
    if (parentInput) {
        parentInput.value = parentName;
        // Highlight it
        parentInput.classList.add('ring-2', 'ring-yellow-400');
        setTimeout(() => parentInput.classList.remove('ring-2', 'ring-yellow-400'), 1000);
    }
}