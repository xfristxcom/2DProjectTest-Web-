// wiki-tool.js - Custom Editor.js Inline Tool for Wiki Internal Links

class WikiLinkTool {
    static get isInline() {
        return true;
    }

    constructor({ api }) {
        this.api = api;
        this.button = null;
        this._state = false;
        this.tag = 'A';
        this.class = 'wiki-internal-link';
    }

    render() {
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.innerHTML = '<span style="font-size: 14px; font-weight: bold;">🔗Wiki</span>';
        this.button.classList.add(this.api.styles.inlineToolButton);
        return this.button;
    }

    surround(range) {
        if (!range) return;
        let termWrapper = this.api.selection.findParentTag(this.tag, this.class);

        if (termWrapper) {
            this.unwrap(termWrapper);
        } else {
            this.wrap(range);
        }
    }

    wrap(range) {
        // Save the current selection range to a global variable so the modal can use it
        window.currentWikiLinkRange = range;
        window.currentWikiLinkApi = this.api;
        
        // Open the search modal
        const modal = document.getElementById('wikiLinkModal');
        const input = document.getElementById('wikiLinkSearchInput');
        const list = document.getElementById('wikiLinkResultList');
        
        if (modal && input && list) {
            modal.style.display = 'flex';
            input.value = '';
            // Render all pages initially
            const pages = typeof wikiPages !== 'undefined' ? wikiPages : [];
            renderWikiLinkResults(pages);
            setTimeout(() => input.focus(), 100);
        } else {
            console.error('Wiki Link Modal not found in DOM.');
        }
    }

    unwrap(termWrapper) {
        this.api.selection.expandToTag(termWrapper);
        let sel = window.getSelection();
        let range = sel.getRangeAt(0);
        let unwrappedContent = range.extractContents();
        termWrapper.parentNode.removeChild(termWrapper);
        range.insertNode(unwrappedContent);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    checkState(selection) {
        const termTag = this.api.selection.findParentTag(this.tag, this.class);
        this.button.classList.toggle(this.api.styles.inlineToolButtonActive, !!termTag);
    }
}

// Global function to render search results in the modal
function renderWikiLinkResults(pages) {
    const list = document.getElementById('wikiLinkResultList');
    list.innerHTML = '';
    
    if (pages.length === 0) {
        list.innerHTML = '<div style="color: #888; text-align: center; padding: 10px;">No pages found</div>';
        return;
    }

    pages.forEach(page => {
        const btn = document.createElement('div');
        btn.style.padding = '10px';
        btn.style.borderBottom = '1px solid #333';
        btn.style.cursor = 'pointer';
        btn.style.transition = '0.2s';
        btn.innerText = page.title;
        
        btn.onmouseover = () => btn.style.backgroundColor = '#333';
        btn.onmouseout = () => btn.style.backgroundColor = 'transparent';
        
        btn.onclick = () => {
            insertWikiLink(page);
        };
        
        list.appendChild(btn);
    });
}

// Global function to filter results
function filterWikiLinkResults(e) {
    const searchTerm = e.target.value.toLowerCase();
    const pages = typeof wikiPages !== 'undefined' ? wikiPages : [];
    const filtered = pages.filter(p => p.title.toLowerCase().includes(searchTerm));
    renderWikiLinkResults(filtered);
}

// Global function to insert the link into Editor.js
function insertWikiLink(page) {
    const range = window.currentWikiLinkRange;
    const api = window.currentWikiLinkApi;
    const modal = document.getElementById('wikiLinkModal');
    
    if (range && api) {
        const a = document.createElement('A');
        a.classList.add('wiki-internal-link');
        a.href = `wiki://${page.id}`;
        a.dataset.wikiTitle = page.title; // For easy reading if needed
        
        a.appendChild(range.extractContents());
        range.insertNode(a);
        api.selection.expandToTag(a);
    }
    
    if (modal) modal.style.display = 'none';
}

function closeWikiLinkModal() {
    document.getElementById('wikiLinkModal').style.display = 'none';
}
