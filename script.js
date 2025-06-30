class PiholeDashboard {
    constructor() {
        this.netifyCache = this.loadNetifyCache();
        this.userApps = this.loadUserApps();
        this.cacheStats = { hits: 0, misses: 0 };
        this.appsChart = null;
        this.statusChart = null;
        this.liveInterval = null;
        this.lastQuery = null;
        this.lastDomains = [];
        this.includedApps = new Set();
        this.excludedApps = new Set();
        
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeTheme();
        this.displayCacheStats();
    }

    initializeElements() {
        this.elements = {
            piholeUrl: document.getElementById('pihole_url'),
            useCorsProxy: document.getElementById('useCorsProxy'),
            queryForm: document.getElementById('queryForm'),
            userIp: document.getElementById('user_ip'),
            timerange: document.getElementById('timerange'),
            showLive: document.getElementById('showLive'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingStatus: document.getElementById('loadingStatus'),
            errorMessage: document.getElementById('errorMessage'),
            resultsTable: document.getElementById('resultsTable'),
            resultsBody: document.getElementById('resultsBody'),
            charts: document.getElementById('charts'),
            darkModeToggle: document.getElementById('darkModeToggle'),
            themeText: document.getElementById('themeText'),
            
            // Filter elements
            appFilter: document.getElementById('appFilter'),
            statusDropdown: document.getElementById('statusDropdown'),
            appsOnlyToggle: document.getElementById('appsOnlyToggle'),
            includeTrigger: document.getElementById('includeTrigger'),
            includeMenu: document.getElementById('includeMenu'),
            includeText: document.getElementById('includeText'),
            excludeTrigger: document.getElementById('excludeTrigger'),
            excludeMenu: document.getElementById('excludeMenu'),
            excludeText: document.getElementById('excludeText'),
            applyFiltersBtn: document.getElementById('applyFiltersBtn'),
            clearFiltersBtn: document.getElementById('clearFiltersBtn'),
            
            // Modal elements
            addAppForm: document.getElementById('addAppForm'),
            bulkImportForm: document.getElementById('bulkImportForm'),
            userAppsList: document.getElementById('userAppsList'),
            manageAppsModal: document.getElementById('manageAppsModal')
        };
    }

    initializeEventListeners() {
        this.elements.queryForm.addEventListener('submit', (e) => this.handleQuerySubmit(e));
        this.elements.darkModeToggle.addEventListener('click', () => this.toggleTheme());
        this.elements.showLive.addEventListener('change', () => this.handleLiveToggle());
        
        // Filter event listeners
        this.elements.appFilter.addEventListener('input', () => this.applyFiltersIfData());
        this.elements.applyFiltersBtn.addEventListener('click', () => this.applyFilters());
        this.elements.clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        
        // Multi-select dropdown setup
        this.setupDropdown(this.elements.includeTrigger, this.elements.includeMenu);
        this.setupDropdown(this.elements.excludeTrigger, this.elements.excludeMenu);
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', () => this.closeAllDropdowns());
        
        // Modal event listeners
        this.elements.addAppForm.addEventListener('submit', (e) => this.handleAddApp(e));
        this.elements.bulkImportForm.addEventListener('submit', (e) => this.handleBulkImport(e));
        this.elements.manageAppsModal.addEventListener('show.bs.modal', () => this.refreshUserApps());
        
        // Cache management
        this.addCacheManagementUI();
    }

    // =================== CACHE MANAGEMENT ===================

    addCacheManagementUI() {
        const configCard = document.querySelector('.dashboard-card');
        if (configCard && !document.getElementById('cacheStats')) {
            const cacheUI = document.createElement('div');
            cacheUI.innerHTML = `
                <hr>
                <div class="row g-3 align-items-center">
                    <div class="col-md-6">
                        <div id="cacheStats" class="d-flex align-items-center">
                            <i class="bi bi-database me-2"></i>
                            <span>Cache: <span id="cacheCount">0</span> domains | 
                            Hits: <span id="cacheHits">0</span> | 
                            Misses: <span id="cacheMisses">0</span></span>
                        </div>
                    </div>
                    <div class="col-md-6 text-end">
                        <button type="button" class="btn btn-outline-secondary btn-sm me-2" id="viewCacheBtn">
                            <i class="bi bi-eye me-1"></i>View Cache
                        </button>
                        <button type="button" class="btn btn-outline-danger btn-sm" id="clearCacheBtn">
                            <i class="bi bi-trash me-1"></i>Clear Cache
                        </button>
                    </div>
                </div>
            `;
            configCard.appendChild(cacheUI);
            
            document.getElementById('clearCacheBtn').addEventListener('click', () => this.clearNetifyCache());
            document.getElementById('viewCacheBtn').addEventListener('click', () => this.showCacheModal());
        }
    }

    loadNetifyCache() {
        try {
            const cached = localStorage.getItem('netify_domain_cache');
            if (cached) {
                const data = JSON.parse(cached);
                const cacheAge = Date.now() - (data.timestamp || 0);
                const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
                
                if (cacheAge < maxAge) {
                    console.log(`Loaded ${Object.keys(data.domains || {}).length} domains from cache`);
                    return new Map(Object.entries(data.domains || {}));
                } else {
                    console.log('Cache expired, starting fresh');
                    this.clearNetifyCache();
                }
            }
        } catch (error) {
            console.error('Error loading cache:', error);
        }
        return new Map();
    }

    loadUserApps() {
        try {
            const apps = localStorage.getItem('user_apps');
            return apps ? JSON.parse(apps) : {};
        } catch (error) {
            console.error('Error loading user apps:', error);
            return {};
        }
    }

    saveNetifyCache() {
        try {
            const cacheData = {
                timestamp: Date.now(),
                domains: Object.fromEntries(this.netifyCache)
            };
            localStorage.setItem('netify_domain_cache', JSON.stringify(cacheData));
        } catch (error) {
            console.error('Error saving cache:', error);
            if (error.name === 'QuotaExceededError') {
                this.cleanupCache();
            }
        }
    }

    saveUserApps() {
        try {
            localStorage.setItem('user_apps', JSON.stringify(this.userApps));
        } catch (error) {
            console.error('Error saving user apps:', error);
        }
    }

    clearNetifyCache() {
        this.netifyCache.clear();
        localStorage.removeItem('netify_domain_cache');
        this.cacheStats = { hits: 0, misses: 0 };
        this.displayCacheStats();
        console.log('Cache cleared');
    }

    cleanupCache() {
        const sortedEntries = Array.from(this.netifyCache.entries())
            .sort((a, b) => (b[1].accessCount || 0) - (a[1].accessCount || 0))
            .slice(0, 500);
        
        this.netifyCache.clear();
        sortedEntries.forEach(([domain, info]) => {
            this.netifyCache.set(domain, info);
        });
        
        this.saveNetifyCache();
        console.log(`Cleaned up cache, kept ${sortedEntries.length} most accessed domains`);
    }

    displayCacheStats() {
        const cacheCount = document.getElementById('cacheCount');
        const cacheHits = document.getElementById('cacheHits');
        const cacheMisses = document.getElementById('cacheMisses');
        
        if (cacheCount) cacheCount.textContent = this.netifyCache.size;
        if (cacheHits) cacheHits.textContent = this.cacheStats.hits;
        if (cacheMisses) cacheMisses.textContent = this.cacheStats.misses;
    }

    showCacheModal() {
        const modalHTML = `
            <div class="modal fade" id="cacheModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-database me-2"></i>
                                Netify Domain Cache (${this.netifyCache.size} domains)
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Domain</th>
                                            <th>App/Service</th>
                                            <th>Description</th>
                                            <th>Access Count</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${this.generateCacheTableRows()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-danger" onclick="dashboard.clearNetifyCache(); bootstrap.Modal.getInstance(document.getElementById('cacheModal')).hide();">
                                <i class="bi bi-trash me-1"></i>Clear All Cache
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const existingModal = document.getElementById('cacheModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('cacheModal'));
        modal.show();
    }

    generateCacheTableRows() {
        if (this.netifyCache.size === 0) {
            return '<tr><td colspan="4" class="text-center text-muted">No cached domains</td></tr>';
        }
        
        const sortedEntries = Array.from(this.netifyCache.entries())
            .sort((a, b) => (b[1].accessCount || 0) - (a[1].accessCount || 0));
        
        return sortedEntries.map(([domain, info]) => `
            <tr>
                <td><code>${domain}</code></td>
                <td><strong>${info.app || 'Unknown'}</strong></td>
                <td><small>${(info.desc || 'No description').substring(0, 100)}${info.desc && info.desc.length > 100 ? '...' : ''}</small></td>
                <td><span class="badge bg-primary">${info.accessCount || 1}</span></td>
            </tr>
        `).join('');
    }

    // =================== FILTERING SYSTEM ===================

    setupDropdown(trigger, menu) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.multi-select-menu').forEach(m => {
                if (m !== menu) m.classList.remove('show');
            });
            document.querySelectorAll('.multi-select-trigger').forEach(t => {
                if (t !== trigger) t.classList.remove('active');
            });
            
            menu.classList.toggle('show');
            trigger.classList.toggle('active');
        });

        menu.addEventListener('click', (e) => e.stopPropagation());
    }

    closeAllDropdowns() {
        document.querySelectorAll('.multi-select-menu').forEach(menu => {
            menu.classList.remove('show');
        });
        document.querySelectorAll('.multi-select-trigger').forEach(trigger => {
            trigger.classList.remove('active');
        });
    }

    updateIncludeText() {
        const count = this.includedApps.size;
        if (count === 0) {
            this.elements.includeText.innerHTML = 'All apps included';
        } else {
            this.elements.includeText.innerHTML = `${count} app${count > 1 ? 's' : ''} included <span class="include-count">${count}</span>`;
        }
    }

    updateExcludeText() {
        const count = this.excludedApps.size;
        if (count === 0) {
            this.elements.excludeText.innerHTML = 'No apps excluded';
        } else {
            this.elements.excludeText.innerHTML = `${count} app${count > 1 ? 's' : ''} excluded <span class="exclude-count">${count}</span>`;
        }
    }

    populateDropdown(menu, apps, selectedSet, updateTextFunc, isInclude = false) {
        menu.innerHTML = '';
        
        if (apps.length === 0) {
            menu.innerHTML = '<div class="multi-select-option">No apps available</div>';
            return;
        }

        apps.forEach(app => {
            const option = document.createElement('div');
            option.className = 'multi-select-option';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `${isInclude ? 'include' : 'exclude'}_${app}`;
            checkbox.checked = selectedSet.has(app);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedSet.add(app);
                    if (isInclude) {
                        this.excludedApps.delete(app);
                        this.updateExcludeText();
                    } else {
                        this.includedApps.delete(app);
                        this.updateIncludeText();
                    }
                } else {
                    selectedSet.delete(app);
                }
                updateTextFunc();
                
                const otherCheckbox = document.getElementById(`${isInclude ? 'exclude' : 'include'}_${app}`);
                if (otherCheckbox) {
                    otherCheckbox.checked = (isInclude ? this.excludedApps : this.includedApps).has(app);
                }
            });

            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = app;

            option.appendChild(checkbox);
            option.appendChild(label);
            menu.appendChild(option);
        });
    }

    updateAppDropdowns(domains) {
        let apps = Array.from(new Set(domains.map(d => d.app).filter(a => a && a !== "Unknown"))).sort();
        
        this.populateDropdown(this.elements.includeMenu, apps, this.includedApps, () => this.updateIncludeText(), true);
        this.populateDropdown(this.elements.excludeMenu, apps, this.excludedApps, () => this.updateExcludeText(), false);
        this.updateIncludeText();
        this.updateExcludeText();
    }

    getFilteredDomains(domains) {
        let filterTxt = this.elements.appFilter.value.trim().toLowerCase();
        let appsOnly = this.elements.appsOnlyToggle.checked;
        let statusSelected = this.elements.statusDropdown.value;

        let filtered = domains;

        // Apps Only Mode - Group by app
        if (appsOnly) {
            const appMap = {};
            for (let d of domains) {
                if (!d.app || d.app === "Unknown") continue;
                if (!appMap[d.app]) {
                    appMap[d.app] = {
                        app: d.app,
                        desc: d.desc,
                        count: 0,
                        blocked: 0,
                        allowed: 0,
                        domains: []
                    };
                }
                appMap[d.app].count += d.count;
                appMap[d.app].blocked += d.blocked;
                appMap[d.app].allowed += d.allowed;
                appMap[d.app].domains.push(d.domain);
            }
            filtered = Object.values(appMap);
        } else {
            filtered = domains.slice();
        }

        // Apply text filter
        if (filterTxt) {
            filtered = filtered.filter(d => (d.app || "").toLowerCase().includes(filterTxt));
        }

        // Apply status filter
        if (statusSelected) {
            filtered = filtered.filter(d => {
                if (statusSelected === "Blocked") return d.blocked > 0;
                if (statusSelected === "Allowed") return d.allowed > 0;
                return true;
            });
        }
        
        // Apply include filter
        if (this.includedApps.size > 0) {
            filtered = filtered.filter(d => this.includedApps.has(d.app));
        }
        
        // Apply exclude filter
        if (this.excludedApps.size > 0) {
            filtered = filtered.filter(d => !this.excludedApps.has(d.app));
        }

        return filtered;
    }

    applyFiltersIfData() {
        if (this.lastDomains.length > 0) {
            this.renderTable(this.lastDomains);
        }
    }

    applyFilters() {
        this.elements.applyFiltersBtn.disabled = true;
        this.elements.applyFiltersBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Applying...';
        
        setTimeout(() => {
            this.renderTable(this.lastDomains);
            this.updateCharts(this.getFilteredDomains(this.lastDomains));
            
            this.elements.applyFiltersBtn.disabled = false;
            this.elements.applyFiltersBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Apply Filters';
        }, 300);
    }

    clearFilters() {
        this.elements.appFilter.value = '';
        this.elements.statusDropdown.value = '';
        this.elements.appsOnlyToggle.checked = false;
        
        this.includedApps.clear();
        this.excludedApps.clear();
        this.updateIncludeText();
        this.updateExcludeText();
        
        document.querySelectorAll('.multi-select-option input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        
        this.renderTable(this.lastDomains);
        this.updateCharts(this.getFilteredDomains(this.lastDomains));
    }

    // =================== USER APPS MANAGEMENT ===================

    refreshUserApps() {
        let html = '<div class="list-group">';
        let count = 0;
        
        for (const [app, info] of Object.entries(this.userApps)) {
            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1" style="color: var(--text-primary) !important;">${app}</h6>
                            <p class="mb-1 text-muted">${info.desc || 'No description'}</p>
                            <small class="text-secondary">
                                ${info.domains.length} domains: 
                                ${info.domains.slice(0, 3).map(d => `<span class="domain-badge">${d}</span>`).join('')}
                                ${info.domains.length > 3 ? '<span class="text-muted">...</span>' : ''}
                            </small>
                        </div>
                        <button class="btn btn-outline-danger btn-sm" onclick="dashboard.deleteUserApp('${app}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>`;
            count++;
        }
        
        if (count === 0) {
            html += '<div class="list-group-item text-center text-muted">No custom apps defined yet</div>';
        }
        
        html += '</div>';
        this.elements.userAppsList.innerHTML = html;
    }

    handleAddApp(e) {
        e.preventDefault();
        
        const app = document.getElementById('newAppName').value.trim();
        const desc = document.getElementById('newAppDesc').value.trim();
        const domains = document.getElementById('newAppDomains').value.trim()
            .split(',').map(d => d.trim()).filter(Boolean);
        
        if (!app || domains.length === 0) {
            alert('Please provide app name and at least one domain.');
            return;
        }
        
        this.userApps[app] = { desc, domains };
        this.saveUserApps();
        this.refreshUserApps();
        
        document.getElementById('newAppName').value = '';
        document.getElementById('newAppDesc').value = '';
        document.getElementById('newAppDomains').value = '';
    }

    handleBulkImport(e) {
        e.preventDefault();
        
        const app = document.getElementById('importAppName').value.trim();
        const desc = document.getElementById('importAppDesc').value.trim();
        const domainList = document.getElementById('importDomainList').value.trim();
        
        if (!app || !domainList) {
            alert('Please provide app name and domain list.');
            return;
        }
        
        const domains = domainList.split('\n').map(d => d.trim()).filter(Boolean);
        
        if (this.userApps[app]) {
            this.userApps[app].domains = [...new Set([...this.userApps[app].domains, ...domains])];
            if (desc) this.userApps[app].desc = desc;
        } else {
            this.userApps[app] = { desc, domains };
        }
        
        this.saveUserApps();
        this.refreshUserApps();
        
        document.getElementById('importStatus').innerHTML = 
            `<div class="alert alert-success">
                <i class="bi bi-check-circle me-2"></i>
                Successfully imported ${domains.length} domains for ${app}
            </div>`;
        
        document.getElementById('importAppName').value = '';
        document.getElementById('importAppDesc').value = '';
        document.getElementById('importDomainList').value = '';
    }

    deleteUserApp(appName) {
        if (confirm(`Delete app "${appName}" and all its domain mappings?`)) {
            delete this.userApps[appName];
            this.saveUserApps();
            this.refreshUserApps();
        }
    }

    getUserAppForDomain(domain) {
        for (const [app, info] of Object.entries(this.userApps)) {
            if (info.domains.includes(domain)) {
                return { app, desc: info.desc || 'User-defined app/service' };
            }
        }
        return null;
    }

    // =================== THEME MANAGEMENT ===================

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        if (theme === 'dark') {
            this.elements.themeText.textContent = 'Light Mode';
            this.elements.darkModeToggle.innerHTML = '<i class="bi bi-sun-fill me-2"></i><span id="themeText">Light Mode</span>';
        } else {
            this.elements.themeText.textContent = 'Dark Mode';
            this.elements.darkModeToggle.innerHTML = '<i class="bi bi-moon-fill me-2"></i><span id="themeText">Dark Mode</span>';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    // =================== UI UTILITIES ===================

    showLoading(status = 'Processing...') {
        this.elements.loadingOverlay.style.display = 'flex';
        this.elements.loadingStatus.textContent = status;
        this.hideError();
    }

    hideLoading() {
        this.elements.loadingOverlay.style.display = 'none';
    }

    showError(message) {
        this.elements.errorMessage.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>${message}`;
        this.elements.errorMessage.style.display = 'block';
        this.hideLoading();
    }

    hideError() {
        this.elements.errorMessage.style.display = 'none';
    }

    timeRangeToSeconds(rangeStr) {
        const ranges = {
            '5m': 5 * 60,
            '1h': 60 * 60,
            '24h': 24 * 60 * 60
        };
        return ranges[rangeStr] || 300;
    }

    // =================== DATA FETCHING ===================

    async fetchPiholeData(url) {
        try {
            let fetchUrl = url;
            
            if (this.elements.useCorsProxy.checked) {
                fetchUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            }

            const response = await fetch(fetchUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (this.elements.useCorsProxy.checked) {
                const actualData = JSON.parse(data.contents);
                return actualData.data || [];
            }
            
            return data.data || [];
        } catch (error) {
            console.error('Error fetching Pi-hole data:', error);
            throw new Error(`Failed to fetch Pi-hole data: ${error.message}`);
        }
    }

    async fetchNetifyInfo(domain) {
        // Check user apps first
        const userApp = this.getUserAppForDomain(domain);
        if (userApp) {
            return userApp;
        }

        // Check cache
        if (this.netifyCache.has(domain)) {
            const cachedInfo = this.netifyCache.get(domain);
            cachedInfo.accessCount = (cachedInfo.accessCount || 0) + 1;
            cachedInfo.lastAccessed = Date.now();
            this.netifyCache.set(domain, cachedInfo);
            this.cacheStats.hits++;
            this.displayCacheStats();
            console.log(`Cache HIT for ${domain} (${cachedInfo.app})`);
            return cachedInfo;
        }

        this.cacheStats.misses++;
        console.log(`Cache MISS for ${domain} - fetching from Netify`);

        try {
            const baseUrl = `https://www.netify.ai/resources/domains/${domain}`;
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(baseUrl)}`;
            
            const response = await fetch(proxyUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                throw new Error('Netify lookup failed');
            }

            const data = await response.json();
            const html = data.contents;
            const appInfo = this.extractNetifyFromHtml(html);
            
            appInfo.accessCount = 1;
            appInfo.lastAccessed = Date.now();
            appInfo.fetchedAt = Date.now();
            
            this.netifyCache.set(domain, appInfo);
            this.saveNetifyCache();
            this.displayCacheStats();
            
            console.log(`Cached new domain: ${domain} -> ${appInfo.app}`);
            return appInfo;
            
        } catch (error) {
            console.error(`Error fetching Netify info for ${domain}:`, error);
            const fallback = { 
                app: 'Unknown', 
                desc: 'No description available.',
                accessCount: 1,
                lastAccessed: Date.now(),
                fetchedAt: Date.now(),
                error: true
            };
            
            this.netifyCache.set(domain, fallback);
            this.saveNetifyCache();
            this.displayCacheStats();
            
            return fallback;
        }
    }

    extractNetifyFromHtml(html) {
        const appMatch = html.match(/<a class="link-resources"[^>]*>([\w\s\.\-&]+)<\/a>/);
        const appName = appMatch ? appMatch[1].trim() : 'Unknown';

        const descMatch = html.match(/<div class="col-xs-12 col-md-7">.*?<p>(.*?)<\/p>/s);
        let desc = '';
        
        if (descMatch) {
            desc = descMatch[1].replace(/<.*?>/g, '').replace(/\n/g, ' ').trim();
        }
        
        if (!desc) {
            const metaMatch = html.match(/<meta name="description" content="([^"]+)"/);
            desc = metaMatch ? metaMatch[1].trim() : 'No description available.';
        }

        return {
            app: appName,
            desc: desc || 'No description available.'
        };
    }

    async processDomainsWithNetify(domainStats, userIp, timeRange) {
        const domains = Object.keys(domainStats);
        const results = [];
        
        const cachedDomains = domains.filter(domain => 
            this.netifyCache.has(domain) || this.getUserAppForDomain(domain)
        );
        const uncachedDomains = domains.filter(domain => 
            !this.netifyCache.has(domain) && !this.getUserAppForDomain(domain)
        );
        
        console.log(`Processing ${domains.length} domains: ${cachedDomains.length} cached, ${uncachedDomains.length} need fetching`);
        
        this.showLoading(`Processing ${domains.length} domains (${cachedDomains.length} from cache)...`);

        // Process cached domains first
        for (const domain of cachedDomains) {
            const stats = domainStats[domain];
            const netifyInfo = await this.fetchNetifyInfo(domain);
            
            results.push({
                domain,
                count: stats.count,
                blocked: stats.blocked,
                allowed: stats.allowed,
                app: netifyInfo.app,
                desc: netifyInfo.desc
            });
        }

        // Process uncached domains in batches
        if (uncachedDomains.length > 0) {
            const batchSize = 3;
            
            for (let i = 0; i < uncachedDomains.length; i += batchSize) {
                const batch = uncachedDomains.slice(i, i + batchSize);
                
                this.showLoading(`Fetching ${i + 1}-${Math.min(i + batchSize, uncachedDomains.length)} of ${uncachedDomains.length} new domains...`);
                
                const batchPromises = batch.map(async (domain) => {
                    const stats = domainStats[domain];
                    const netifyInfo = await this.fetchNetifyInfo(domain);
                    
                    return {
                        domain,
                        count: stats.count,
                        blocked: stats.blocked,
                        allowed: stats.allowed,
                        app: netifyInfo.app,
                        desc: netifyInfo.desc
                    };
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                
                if (i + batchSize < uncachedDomains.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        return results;
    }

    // =================== LIVE UPDATES ===================

    handleLiveToggle() {
        if (!this.elements.showLive.checked && this.liveInterval) {
            clearInterval(this.liveInterval);
            this.liveInterval = null;
        } else if (this.elements.showLive.checked && this.lastQuery) {
            this.liveInterval = setInterval(() => {
                this.doQuery(this.lastQuery.ip, this.lastQuery.range);
            }, 10000); // 10 seconds
        }
    }

    // =================== MAIN QUERY HANDLER ===================

    async handleQuerySubmit(e) {
        e.preventDefault();
        
        if (this.liveInterval) {
            clearInterval(this.liveInterval);
            this.liveInterval = null;
        }

        const piholeUrl = this.elements.piholeUrl.value.trim();
        const userIp = this.elements.userIp.value.trim();
        const timeRange = this.elements.timerange.value;

        if (!piholeUrl) {
            this.showError('Please enter a Pi-hole API URL');
            return;
        }

        if (!userIp) {
            this.showError('Please enter a user IP address');
            return;
        }

        this.lastQuery = { ip: userIp, range: timeRange };
        await this.doQuery(userIp, timeRange);

        if (this.elements.showLive.checked) {
            this.liveInterval = setInterval(() => {
                this.doQuery(userIp, timeRange);
            }, 10000);
        }
    }

    async doQuery(userIp, timeRange) {
        const piholeUrl = this.elements.piholeUrl.value.trim();

        try {
            this.showLoading('Fetching Pi-hole data...');
            
            const piholeData = await this.fetchPiholeData(piholeUrl);
            
            if (!piholeData || piholeData.length === 0) {
                this.showError('No data received from Pi-hole API');
                return;
            }

            // Filter data by IP and time range
            const now = Math.floor(Date.now() / 1000);
            const secondsBack = this.timeRangeToSeconds(timeRange);
            const statusMap = { 1: 'Allowed', 2: 'Blocked', 3: 'Blocked', 4: 'Blocked' };

            const filteredEntries = piholeData.filter(entry => {
                try {
                    const timestamp = parseInt(entry[0]);
                    const logIp = entry[3];
                    return logIp === userIp && (now - timestamp) <= secondsBack;
                } catch (e) {
                    console.error('Error parsing entry:', e, entry);
                    return false;
                }
            });

            if (filteredEntries.length === 0) {
                this.showError('No queries found for this user in the selected time range');
                return;
            }

            // Aggregate domain statistics
            const domainStats = {};
            
            filteredEntries.forEach(entry => {
                const domain = entry[2];
                const statusCode = parseInt(entry[4]) || 0;
                const status = statusMap[statusCode] || 'Other';

                if (!domainStats[domain]) {
                    domainStats[domain] = { count: 0, blocked: 0, allowed: 0 };
                }

                domainStats[domain].count++;
                if (status === 'Blocked') {
                    domainStats[domain].blocked++;
                } else if (status === 'Allowed') {
                    domainStats[domain].allowed++;
                }
            });

            // Process domains with Netify lookups
            const results = await this.processDomainsWithNetify(domainStats, userIp, timeRange);
            
            this.hideLoading();
            this.lastDomains = results;
            this.updateAppDropdowns(results);
            this.renderTable(results);
            this.updateCharts(this.getFilteredDomains(results));

            this.saveNetifyCache();

        } catch (error) {
            this.showError(error.message);
        }
    }

    // =================== RENDERING ===================

    renderTable(domains) {
        const filtered = this.getFilteredDomains(domains);

        this.elements.resultsBody.innerHTML = "";
        if (filtered.length === 0) {
            this.elements.resultsBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <i class="bi bi-search me-2"></i>
                        No results found for the current filters
                    </td>
                </tr>`;
        } else {
            for (let d of filtered.sort((a,b) => b.count - a.count)) {
                let tooltip = d.desc ? d.desc.replace(/"/g,'&quot;') : "";
                let domainCell = "";
                
                if (this.elements.appsOnlyToggle.checked) {
                    domainCell = `
                        <div data-bs-toggle="tooltip" data-bs-title="${tooltip}" style="color: var(--text-primary) !important;">
                            <strong style="color: var(--text-primary) !important;">${d.app}</strong>
                            <div class="text-muted small mt-1">
                                ${d.domains.slice(0,3).map(dom=>`<span class="domain-badge">${dom}</span>`).join("")}
                                ${d.domains.length > 3 ? '<span class="text-muted">...</span>' : ''}
                            </div>
                        </div>`;
                } else {
                    domainCell = `
                        <div data-bs-toggle="tooltip" data-bs-title="${tooltip}" style="color: var(--text-primary) !important;">
                            <strong style="color: var(--text-primary) !important;">${d.domain}</strong>
                            ${d.app && d.app !== "Unknown" ? `<span class="app-badge">${d.app}</span>` : ""}
                        </div>`;
                }
                
                this.elements.resultsBody.innerHTML += `
                    <tr>
                        <td style="color: var(--text-primary) !important;">${domainCell}</td>
                        <td style="color: var(--text-primary) !important;"><span class="badge bg-warning">${d.count}</span></td>
                        <td style="color: var(--text-primary) !important;"><span class="badge bg-danger">${d.blocked}</span></td>
                        <td style="color: var(--text-primary) !important;"><span class="badge bg-success">${d.allowed}</span></td>
                        <td style="color: var(--text-primary) !important;"><strong>${d.app}</strong></td>
                        <td style="color: var(--text-primary) !important;"><small class="text-muted">${d.desc}</small></td>
                    </tr>`;
            }
        }
        
        this.elements.resultsTable.style.display = "table";
        
        // Enable tooltips
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.forEach(function (tooltipTriggerEl) {
            new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    updateCharts(results) {
        const appCounts = {};
        let totalBlocked = 0;
        let totalAllowed = 0;
        
        results.forEach(result => {
            const app = result.app || 'Unknown';
            appCounts[app] = (appCounts[app] || 0) + result.count;
            totalBlocked += result.blocked;
            totalAllowed += result.allowed;
        });

        const appLabels = Object.keys(appCounts);
        const appData = Object.values(appCounts);

        // Apps pie chart
        const ctx1 = document.getElementById('appsChart').getContext('2d');
        if (this.appsChart) this.appsChart.destroy();
        
        this.appsChart = new Chart(ctx1, {
            type: 'pie',
            data: {
                labels: appLabels,
                datasets: [{
                    data: appData,
                    backgroundColor: appLabels.map((_, i) => `hsl(${(i * 360) / appLabels.length}, 70%, 60%)`),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { 
                        display: true, 
                        text: 'App/Service Distribution',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        position: 'bottom',
                        labels: { padding: 20 }
                    }
                }
            }
        });

        // Status bar chart
        const ctx2 = document.getElementById('statusChart').getContext('2d');
        if (this.statusChart) this.statusChart.destroy();
        
        this.statusChart = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: ['Allowed', 'Blocked'],
                datasets: [{
                    label: 'DNS Requests',
                    data: [totalAllowed, totalBlocked],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderRadius: 8,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { 
                        display: true, 
                        text: 'Total Allowed vs Blocked',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
        
        this.elements.charts.style.display = 'block';
    }
}

// Initialize the dashboard when the page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new PiholeDashboard();
});
