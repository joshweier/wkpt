var data = {};

// Check if the tab is visible
function checkVisibility() {
    if (document.visibilityState === 'visible') {
        const now = new Date();
        const currentDate = now.toDateString();
        const currentHour = now.getHours();

        // console.log('Checking visibility...', lastIdleDate, lastIdleHour, currentDate, currentHour);
        // console.log('Path:', window.location.pathname);

        // Only do this if we're sitting at the main screen
        const targetPath = '/dashboard';
        const timeRecorded = (lastIdleDate && lastIdleHour);
        const timeChanged = timeRecorded && (lastIdleDate !== currentDate || lastIdleHour !== currentHour);
        const pathMatches = (window.location.pathname === targetPath || window.location.pathname === '/');
        if (timeChanged && pathMatches) {
            window.location.reload();
        }

        // Update our times
        lastIdleDate = currentDate;
        lastIdleHour = currentHour
    }
}

// Listen for visibility changes
document.addEventListener('visibilitychange', checkVisibility);

function loadData(callback) {
    const xhr = new XMLHttpRequest();
    xhr.overrideMimeType("application/json");
    xhr.open("GET", chrome.runtime.getURL('data.json'), true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            data = JSON.parse(xhr.responseText);
            callback();
        }
    };
    xhr.send(null);
}

async function fetchAndDisplaySVG(url, element, bounds) {
    const response = await fetch(url);
    const svgText = await response.text();
    element.innerHTML = svgText;
    element.style.top = `${window.scrollY + bounds.top - element.offsetHeight - 15}px`;
    element.style.left = `${window.scrollX + bounds.left + (bounds.width / 2) - (element.offsetWidth / 2)}px`;
    element.style.display = 'block';

    // Override the character color to white
    element.style.setProperty('--color-text', 'white');
}

function addTooltipToElement(element, isRadical) {
    element.addEventListener('mouseenter', (event) => {
        let tooltip = document.createElement('div');
        tooltip.className = (isRadical) ? 'radical-tooltip' : 'kanji-tooltip';

        const rect = element.getBoundingClientRect();
        let name = element.innerText.toLowerCase();
        name = name.replace(' ', '-');
        let charData = (isRadical) ? data.radicals[name] : data.kanji[name];

        // Make sure to handle SVG types
        if (charData.startsWith('http')) {
            fetchAndDisplaySVG(charData, tooltip, rect);
        }
        else {
            tooltip.innerText = charData || '???';
        }

        document.body.appendChild(tooltip);

        // Center the tooltip above the element
        tooltip.style.top = `${window.scrollY + rect.top - tooltip.offsetHeight - 15}px`;
        tooltip.style.left = `${window.scrollX + rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;

        // FIXME: This creates some weirdness when the tooltip is removed
        element.addEventListener('mouseout', () => {
             if (tooltip && document.body.contains(tooltip)) {
                 document.body.removeChild(tooltip);
             }
        });
    });
}

function getTimeDuration(timeString) {
    const regex = /(\d+)\s*(days|hours|minutes)/i;
    const match = timeString.match(regex);
    if (match) {
        return {
            numeral: match[1],
            unit: match[2]
        }
    }

    return null;
}

function getDueDateColor(statusText) {
    const match = getTimeDuration(statusText);
    if (match) {
        if (match.unit === 'days') {
            return 'due-long';
        }
        if (match.unit === 'hours') {
            return 'due-mid';
        }
        if (match.unit === 'minutes') {
            return 'due-soon';
        }
    }
    else {
        const searchString = 'right now';
        if (statusText.includes(searchString)) {
            return 'due-now';
        }

        return null;
    }
}

function decorateDueItem(item){
    // Simplify the status text
    let statusText = item.getAttribute('title');
    const match = getTimeDuration(statusText);
    statusText = (match) ? `${match.numeral} ${match.unit}` : statusText;
    item.setAttribute('title', statusText);

    const colorClass = getDueDateColor(statusText);
    if (colorClass) {
        // Add the new decoration
        let child = item.querySelector('.subject-character__content')
        child.classList.add(colorClass);
    }
    else{
        // Remove any old decorators
        item.classList.remove(["due-now", "due-soon", "due-mid", "due-long"]);
    }
}

function decorateDueItems() {
    const reviewItems = document.querySelectorAll('a.subject-srs-progress'); 
    if (reviewItems.length === 0) 
        return;

    // Loop through each item and add the appropriate decoration
    reviewItems.forEach((element) => {
        decorateDueItem(element);
    });
}

function addTooltipListeners() {
    const radicals = document.querySelectorAll('.radical-highlight');
    if (radicals.length > 0) {
        radicals.forEach((radical) => {
            addTooltipToElement(radical, true);
        });
    } 

    // const kanji = document.querySelectorAll('.kanji-highlight');
    // if (kanji.length > 0) {
        //     kanji.forEach((kanji) => {
            //         addTooltipToElement(kanji, false);
            //     });
        // } 

    decorateDueItems();
}

// Use MutationObserver to handle dynamically added elements
function observeMutations() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && node.classList.contains('radical-highlight')) {
                    addTooltipToElement(node, true);
                }
                // If the added node contains child nodes with the class, handle them too
                const radicalElements = node.querySelectorAll ? node.querySelectorAll('.radical-highlight') : [];
                radicalElements.forEach((radical) => {
                    addTooltipToElement(radical, true);
                });

                // NOTE: For the moment kanji are too unreliable to show properly, stick to radicals
                // if (node.nodeType === 1 && node.classList.contains('kanji-highlight')) {
                    //     addTooltipToElement(node, false);
                    // }
                // // If the added node contains child nodes with the class, handle them too
                // const kanjiElements = node.querySelectorAll ? node.querySelectorAll('.kanji-highlight') : [];
                // kanjiElements.forEach((kanji) => {
                    //     addTooltipToElement(kanji, false);
                    // });

                if (node.nodeType === 1 && node.classList.contains('a.subject-srs-progress')) {
                    decorateDueItem(node);
                }

                // If the added node contains child nodes with the class, handle them too
                const character = node.querySelectorAll ? node.querySelectorAll('a.subject-srs-progress') : [];
                character.forEach((element) => {
                    decorateDueItem(element);
                });
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

// Seed our idle time
const now = new Date();
let lastIdleDate = now.toDateString();
let lastIdleHour = now.getHours();

window.addEventListener('load', (event) => {
    // Watch for changes
    observeMutations();

    // Load extra kanji data
    loadData(addTooltipListeners);
});

