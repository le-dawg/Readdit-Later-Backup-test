class DetailedViewController {
    constructor() {
        this.allPosts = [];
        this.filteredPosts = [];
        this.currentPage = 1;
        this.postsPerPage = 12; // Adjusted for grid view
        this.currentView = 'grid'; // Default to grid view
        this.filters = {
            search: '',
            subreddit: '',
            type: '',
            time: ''
        };
        this.sortBy = 'date_desc';

        this.initializeElements();
        this.bindEvents();
        this.loadData();
    }

    initializeElements() {
        this.elements = {
            // Navigation
            navSavedPosts: document.getElementById('navSavedPosts'),
            navExportAssist: document.getElementById('navExportAssist'),
            savedPostsView: document.getElementById('savedPostsView'),
            exportAssistView: document.getElementById('exportAssistView'),

            // Export elements
            exportFiltersContainer: document.getElementById('exportFilters'),
            exportSelectAllCheckbox: document.getElementById('exportSelectAllCheckbox'),
            exportBtn: document.getElementById('exportBtn'),
            exportPostsContainer: document.getElementById('exportPostsContainer'),
            exportLoadingContainer: document.getElementById('exportLoadingContainer'),
            exportEmptyState: document.getElementById('exportEmptyState'),

            // Stats
            totalPostsStat: document.getElementById('totalPostsStat'),
            weeklyPostsStat: document.getElementById('weeklyPostsStat'),
            subredditsStat: document.getElementById('subredditsStat'),
            lastSyncStat: document.getElementById('lastSyncStat'),

            // Filters
            searchInput: document.getElementById('searchInput'),
            subredditFilter: document.getElementById('subredditFilter'),
            typeFilter: document.getElementById('typeFilter'),
            timeFilter: document.getElementById('timeFilter'),
            clearFilters: document.getElementById('clearFilters'),
            selectAllCheckbox: document.getElementById('selectAllCheckbox'),

            // View controls
            contentTitle: document.getElementById('contentTitle'),
            sortSelect: document.getElementById('sortSelect'),

            // Content
            loadingContainer: document.getElementById('loadingContainer'),
            postsContainer: document.getElementById('postsContainer'),
            emptyState: document.getElementById('emptyState'),

            // Pagination
            pagination: document.getElementById('pagination'),
            prevPageBtn: document.getElementById('prevPageBtn'),
            nextPageBtn: document.getElementById('nextPageBtn'),
            pageInfo: document.getElementById('pageInfo'),

            // Header actions
            deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),
            refreshBtn: document.getElementById('refreshBtn'),
            logoutBtn: document.getElementById('logoutBtn')
        };
        
        // Initialize export-related data
        this.filteredExportPosts = [];
    }

    bindEvents() {
        // Navigation events
        this.elements.navSavedPosts.addEventListener('click', (e) => {
            e.preventDefault();
            this.showView('savedPosts');
        });

        this.elements.navExportAssist.addEventListener('click', (e) => {
            e.preventDefault();
            this.showView('exportAssist');
        });

        // Export events
        this.elements.exportSelectAllCheckbox.addEventListener('change', (e) => {
            this.toggleExportSelectAll(e.target.checked);
        });

        this.elements.exportBtn.addEventListener('click', () => this.handleExport());

        // Filter events
        this.elements.searchInput.addEventListener('input', (e) => {
            this.debounce(() => {
                this.filters.search = e.target.value;
                this.applyFilters();
            }, 300);
        });

        this.elements.subredditFilter.addEventListener('change', (e) => {
            this.filters.subreddit = e.target.value;
            this.applyFilters();
        });

        this.elements.typeFilter.addEventListener('change', (e) => {
            this.filters.type = e.target.value;
            this.applyFilters();
        });

        this.elements.timeFilter.addEventListener('change', (e) => {
            this.filters.time = e.target.value;
            this.applyFilters();
        });

        this.elements.clearFilters.addEventListener('click', () => {
            this.clearAllFilters();
        });

        this.elements.selectAllCheckbox.addEventListener('change', (e) => {
            this.toggleSelectAll(e.target.checked);
        });

        // View controls
        this.elements.sortSelect.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.applyFilters();
        });

        // Pagination
        this.elements.prevPageBtn.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderPosts();
                this.updatePagination();
            }
        });

        this.elements.nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredPosts.length / this.postsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderPosts();
                this.updatePagination();
            }
        });

        // Header actions
        this.elements.deleteSelectedBtn.addEventListener('click', () => this.deleteSelectedPosts());
        this.elements.refreshBtn.addEventListener('click', () => this.syncPosts());
        this.elements.logoutBtn.addEventListener('click', () => this.logout());
    }

    async loadData() {
        try {
            this.showLoading(true);
            const storedData = await this.getStoredData();
            console.log('Stored data:', storedData);
            
            if (!storedData.saved_posts || storedData.saved_posts.length === 0) {
                this.showEmptyState();
                return;
            }

            this.allPosts = storedData.saved_posts.map(child => child.data);
            console.log('All posts:', this.allPosts);
            this.filteredPosts = [...this.allPosts];

            this.updateStats(storedData);
            this.populateSubredditFilter();
            this.applyFilters();
            this.showLoading(false);

        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load saved posts. Please refresh the page.');
        }
    }

    async getStoredData() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['saved_posts', 'last_sync'], (result) => {
                resolve(result || { saved_posts: [], last_sync: null });
            });
        });
    }

    async syncPosts() {
        this.elements.refreshBtn.textContent = 'Syncing...';
        this.elements.refreshBtn.disabled = true;
        try {
            const response = await chrome.runtime.sendMessage({ type: 'SYNC_SAVED_POSTS' });
            if (response && response.success) {
                await this.loadData();
            }
        } catch (error) {
            this.showError('Failed to sync posts.');
        } finally {
            this.elements.refreshBtn.textContent = 'Refresh';
            this.elements.refreshBtn.disabled = false;
        }
    }

    applyFilters() {
        const { search, subreddit, type, time } = this.filters;
        const searchTerm = search.toLowerCase();

        const filtered = this.allPosts.filter(post => {
            if (searchTerm && !post.title.toLowerCase().includes(searchTerm) && !post.subreddit.toLowerCase().includes(searchTerm)) {
                return false;
            }
            if (subreddit && post.subreddit !== subreddit) {
                return false;
            }
            if (type) {
                let postType;
                if (post.is_video || post.post_hint === 'hosted:video' || post.post_hint === 'rich:video') {
                    postType = 'video';
                } else if (post.post_hint === 'image') {
                    postType = 'image';
                } else if (post.is_self) {
                    postType = 'text';
                } else {
                    postType = 'link';
                }
                if (type !== postType) {
                    return false;
                }
            }
            if (time) {
                const postDate = new Date(post.created_utc * 1000);
                const timeLimits = {
                    day: 1,
                    week: 7,
                    month: 30,
                    year: 365,
                };
                const diffDays = (new Date() - postDate) / (1000 * 60 * 60 * 24);
                if (diffDays > timeLimits[time]) {
                    return false;
                }
            }
            return true;
        });

        this.sortPosts(filtered);
        this.filteredPosts = filtered;
        this.currentPage = 1;
        this.renderPosts();
        this.updatePagination();
        this.updateContentTitle();
    }

    renderPosts() {
        this.elements.postsContainer.innerHTML = '';
        if (this.filteredPosts.length === 0) {
            this.showEmptyState(true);
            return;
        }
        this.showEmptyState(false);
        this.elements.postsContainer.style.display = 'grid'; // Ensure container is visible

        const startIndex = (this.currentPage - 1) * this.postsPerPage;
        const endIndex = startIndex + this.postsPerPage;
        const postsToShow = this.filteredPosts.slice(startIndex, endIndex);

        postsToShow.forEach(post => {
            const postElement = this.createPostCard(post);
            this.elements.postsContainer.appendChild(postElement);
        });
        this.elements.selectAllCheckbox.checked = false;
    }

    createPostCard(post) {
        const card = document.createElement('div');
        card.className = 'post-card';

        card.innerHTML = `
            <input type="checkbox" class="post-select-checkbox" data-post-name="${post.name}" data-post-id="${post.id}">
            <div class="post-content">
                <a href="https://reddit.com${post.permalink}" class="post-title" target="_blank" title="${this.escapeHtml(post.title)}">${this.escapeHtml(post.title)}</a>
                <div class="post-meta">
                    <a href="https://reddit.com/r/${post.subreddit}" class="subreddit-link" target="_blank">r/${post.subreddit}</a>
                    <span>• ${this.getTimeAgo(new Date((post.created_utc ?? 0) * 1000))}</span>
                </div>
                <div class="post-stats">
                    <span>⬆️ ${post.score ?? 0}</span>
                    <span>💬 ${post.num_comments ?? 0}</span>
                </div>
                <div class="post-actions">
                    <button class="card-action-btn open-externally">Open Link</button>
                    <button class="card-action-btn danger remove-post">Remove</button>
                </div>
            </div>
        `;

        card.querySelector('.open-externally').addEventListener('click', (e) => {
            e.preventDefault();
            window.open(post.url, '_blank');
        });

        card.querySelector('.remove-post').addEventListener('click', () => this.removePost(post.id));

        return card;
    }

    getThumbnail(post) {
        if (post.thumbnail && post.thumbnail.startsWith('http')) {
            return post.thumbnail;
        }
        // You can add a placeholder image URL here if you want
        return ''; 
    }

    toggleSelectAll(checked) {
        const checkboxes = this.elements.postsContainer.querySelectorAll('.post-select-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });
    }

    async deleteSelectedPosts() {
        const checkboxes = this.elements.postsContainer.querySelectorAll('.post-select-checkbox:checked');
        const postNames = Array.from(checkboxes).map(cb => cb.dataset.postName);

        if (postNames.length === 0) {
            alert('Please select posts to delete.');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${postNames.length} posts?`)) {
            return;
        }

        try {
            this.elements.deleteSelectedBtn.textContent = 'Deleting...';
            this.elements.deleteSelectedBtn.disabled = true;
            await chrome.runtime.sendMessage({ type: 'UNSAVE_MULTIPLE_POSTS', postNames: postNames });
            // The background script will now handle un-saving and re-syncing.
            // We can optionally reflect the change immediately for better UX.
            this.allPosts = this.allPosts.filter(p => !postNames.includes(p.name));
            this.applyFilters();
        } catch (error) {
            console.error('Error deleting posts:', error);
            this.showError('Failed to delete selected posts.');
        } finally {
            this.elements.deleteSelectedBtn.textContent = 'Delete Selected';
            this.elements.deleteSelectedBtn.disabled = false;
        }
    }

    // View switching logic
    showView(viewName) {
        this.elements.savedPostsView.style.display = 'none';
        this.elements.exportAssistView.style.display = 'none';
        this.elements.navSavedPosts.classList.remove('active');
        this.elements.navExportAssist.classList.remove('active');

        if (viewName === 'savedPosts') {
            this.elements.savedPostsView.style.display = 'block';
            this.elements.navSavedPosts.classList.add('active');
        } else if (viewName === 'exportAssist') {
            this.elements.exportAssistView.style.display = 'block';
            this.elements.navExportAssist.classList.add('active');
            // When switching to export view, initialize it
            this.initializeExportView();
        }
    }

    // Export assist logic
    initializeExportView() {
        // For now, we'll use subreddits as the filterable "category"
        const subreddits = [...new Set(this.allPosts.map(p => p.subreddit))].sort();
        
        // Let's create a simple multi-select for subreddits
        this.elements.exportFiltersContainer.innerHTML = `
            <div class="filter-group">
                <label class="filter-label">Filter by Subreddits</label>
                <select id="exportSubredditFilter" class="filter-select" multiple size="5">
                    ${subreddits.map(sub => `<option value="${sub}">${sub}</option>`).join('')}
                </select>
            </div>
        `;

        const exportSubredditFilter = document.getElementById('exportSubredditFilter');
        exportSubredditFilter.addEventListener('change', () => this.applyExportFilters());
        
        // Initially, display all posts
        this.applyExportFilters();
    }

    applyExportFilters() {
        const exportSubredditFilter = document.getElementById('exportSubredditFilter');
        const selectedSubreddits = exportSubredditFilter ? 
            Array.from(exportSubredditFilter.selectedOptions).map(opt => opt.value) : [];
        
        if (selectedSubreddits.length === 0) {
            this.filteredExportPosts = [...this.allPosts];
        } else {
            this.filteredExportPosts = this.allPosts.filter(post => selectedSubreddits.includes(post.subreddit));
        }

        this.renderExportPosts();
    }

    renderExportPosts() {
        this.elements.exportPostsContainer.innerHTML = '';
        this.elements.exportEmptyState.style.display = this.filteredExportPosts.length === 0 ? 'block' : 'none';

        if (this.filteredExportPosts.length > 0) {
            // We reuse the existing createPostCard function
            this.filteredExportPosts.forEach(post => {
                const postElement = this.createPostCard(post);
                this.elements.exportPostsContainer.appendChild(postElement);
            });
        }
        
        // Reset select all checkbox
        this.elements.exportSelectAllCheckbox.checked = false;
    }

    toggleExportSelectAll(checked) {
        const checkboxes = this.elements.exportPostsContainer.querySelectorAll('.post-select-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });
    }

    handleExport() {
        const selectedCheckboxes = this.elements.exportPostsContainer.querySelectorAll('.post-select-checkbox:checked');
        const postIdsToExport = new Set(Array.from(selectedCheckboxes).map(cb => cb.dataset.postId));

        if (postIdsToExport.size === 0) {
            alert('Please select at least one post to export.');
            return;
        }

        const postsToExport = this.allPosts.filter(post => postIdsToExport.has(post.id));

        const exportData = postsToExport.map(post => {
            const isComment = post.name.startsWith('t1_');
            
            // Construct the URL to the original post for comments
            const originalPostUrl = isComment ? `https://www.reddit.com${post.permalink.substring(0, post.permalink.lastIndexOf('/', post.permalink.length - 2))}` : null;

            return {
                headline: post.title || null, // Comments don't have titles
                content: isComment ? post.body_html : post.selftext_html,
                subreddit: post.subreddit,
                original_post_url: originalPostUrl,
                // As discussed, tags are not yet implemented. We add an empty array.
                tags: [], 
                // Adding some other useful data
                url: `https://www.reddit.com${post.permalink}`,
                score: post.score,
                created_utc: post.created_utc,
                is_comment: isComment
            };
        });
        
        // Defensive check
        if(exportData.length === 0) {
            alert("An error occurred: No data to export.");
            return;
        }

        this.downloadJson(exportData, `readdit-later-export-${new Date().toISOString().slice(0,10)}.json`);
    }

    downloadJson(data, filename) {
        try {
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to generate or download JSON file:", error);
            alert("An error occurred while trying to export the data. Please check the console for details.");
        }
    }

    // --- Helper methods from original file ---
    debounce(func, delay) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(func, delay);
    }

    updateContentTitle() {
        const count = this.filteredPosts.length;
        this.elements.contentTitle.textContent = `Showing ${count} Post${count !== 1 ? 's' : ''}`;
    }

    clearAllFilters() {
        this.filters = { search: '', subreddit: '', type: '', time: '' };
        this.elements.searchInput.value = '';
        this.elements.subredditFilter.value = '';
        this.elements.typeFilter.value = '';
        this.elements.timeFilter.value = '';
        this.applyFilters();
    }

    showLoading(show) {
        this.elements.loadingContainer.style.display = show ? 'block' : 'none';
        this.elements.postsContainer.style.display = show ? 'none' : 'grid';
        if(show) this.elements.emptyState.style.display = 'none';
    }

    showEmptyState(show) {
        this.elements.emptyState.style.display = show ? 'block' : 'none';
        if(show) {
            this.elements.postsContainer.style.display = 'none';
            this.elements.pagination.style.display = 'none';
        }
    }

    showError(message) {
        this.elements.postsContainer.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${message}</p></div>`;
        this.showLoading(false);
    }

    async logout() {
        if (confirm('Are you sure you want to log out?')) {
            await chrome.runtime.sendMessage({ type: 'LOGOUT' });
            window.close();
        }
    }

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    }

    escapeHtml(text) {
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    updateStats(data) {
        const posts = this.allPosts;
        const weeklyPosts = posts.filter(p => (new Date() - new Date(p.created_utc * 1000)) < 7 * 24 * 60 * 60 * 1000).length;
        const subreddits = new Set(posts.map(p => p.subreddit)).size;
        this.elements.totalPostsStat.textContent = posts.length;
        this.elements.weeklyPostsStat.textContent = weeklyPosts;
        this.elements.subredditsStat.textContent = subreddits;
        this.elements.lastSyncStat.textContent = data.last_sync ? this.getTimeAgo(new Date(data.last_sync)) : 'Never';
    }

    populateSubredditFilter() {
        const subreddits = [...new Set(this.allPosts.map(p => p.subreddit))].sort();
        this.elements.subredditFilter.innerHTML = '<option value="">All Subreddits</option>';
        subreddits.forEach(sub => {
            const option = document.createElement('option');
            option.value = sub;
            option.textContent = `r/${sub}`;
            this.elements.subredditFilter.appendChild(option);
        });
    }

    sortPosts(posts) {
        posts.sort((a, b) => {
            switch (this.sortBy) {
                case 'date_desc': return b.created_utc - a.created_utc;
                case 'date_asc': return a.created_utc - b.created_utc;
                case 'title_asc': return a.title.localeCompare(b.title);
                case 'title_desc': return b.title.localeCompare(a.title);
                case 'subreddit_asc': return a.subreddit.localeCompare(b.subreddit);
                case 'score_desc': return (b.score || 0) - (a.score || 0);
                default: return 0;
            }
        });
    }

    async removePost(postId) {
        if (!confirm('Are you sure you want to remove this post?')) return;
        const postToRemove = this.allPosts.find(p => p.id === postId);
        if (!postToRemove) return;

        try {
            await chrome.runtime.sendMessage({ type: 'UNSAVE_POST', postId: postToRemove.name });
            this.allPosts = this.allPosts.filter(p => p.id !== postId);
            const updatedPosts = this.allPosts.map(post => ({ data: post }));
            await chrome.storage.local.set({ saved_posts: updatedPosts });
            this.applyFilters();
        } catch (error) {
            console.error('Error removing post:', error);
            this.showError('Failed to remove post.');
        }
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredPosts.length / this.postsPerPage);
        this.elements.pagination.style.display = totalPages > 1 ? 'flex' : 'none';
        this.elements.prevPageBtn.disabled = this.currentPage === 1;
        this.elements.nextPageBtn.disabled = this.currentPage === totalPages;
        this.elements.pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DetailedViewController();
});
