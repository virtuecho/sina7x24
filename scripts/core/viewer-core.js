export function createViewerCore() {
        // Viewer core owns the page itself:
        // feed fetching, state merge, filters, rendering, stats, and built-in modals.
        // Optional features should connect through the exported hooks near the bottom.

        // Core configuration
        // Use the local same-origin proxy instead of public CORS relay services.
        const API_BASE = '/api/zhibo/feed';
        const API_DEFAULT_PARAMS = 'zhibo_id=152&id=&tag_id=0&page_size=100&type=0';
        const REQUEST_TIMEOUT = 10000;
        const RETRY_DELAY_MS = 1200;
        const DEFAULT_AUTO_REFRESH_INTERVAL_MS = 60000;
        const ITEM_LIMIT_COUNT = 100;
        const HISTORY_VISIBILITY_MARGIN = 220;
        const STICKY_PANEL_MAX_WIDTH = 820;
        const STICKY_PANEL_MAX_HEIGHT = 640;
        const STICKY_PANEL_WIDE_RATIO = 1.45;
        const STICKY_PANEL_MAX_HEIGHT_RATIO = 0.36;
        const STICKY_PANEL_COLLAPSE_SCROLL_Y = 120;
        const STICKY_PANEL_COMPACT_SCROLL_Y = 28;
        
        function buildApiUrl(page) {
            return `${API_BASE}?${API_DEFAULT_PARAMS}&page=${page}`;
        }

        // Core state
        let allItems = [];
        let itemsById = new Map();
        let lastUpdateTime = null;
        let refreshInterval = null;
        let isFirstLoad = true;
        let currentSearch = '';
        let currentType = 'all';
        let currentPage = 1;
        let isLoadingMore = false;
        let hasMorePages = true;
        let historyAutoLoadEnabled = true;
        let showStandaloneTitle = true;
        let showStandaloneSource = true;
        let developerModeEnabled = false;
        let itemLimitEnabled = false;
        let latestRefreshPaused = false;
        let autoRefreshIntervalMs = DEFAULT_AUTO_REFRESH_INTERVAL_MS;
        let stickyPanelPinnedOpen = false;
        let isRefreshing = false;
        let lastIdOrderStatus = { text: 'ID顺序检测：未检测', warning: false };
        const featureHooks = {
            latestReady: new Set(),
            sync: new Set()
        };
        
        // Stable DOM references owned by the page shell
        const contentList = document.getElementById('contentList');
        const stickyPanel = document.getElementById('stickyPanel');
        const stickyPanelToggleBtn = document.getElementById('stickyPanelToggleBtn');
        const stickyPanelContent = document.getElementById('stickyPanelContent');
        const searchInput = document.getElementById('searchInput');
        const typeFilter = document.getElementById('typeFilter');
        const refreshBtn = document.getElementById('refreshBtn');
        const developerModeBtn = document.getElementById('developerModeBtn');
        const developerPanel = document.getElementById('developerPanel');
        const titleModeBtn = document.getElementById('titleModeBtn');
        const sourceModeBtn = document.getElementById('sourceModeBtn');
        const refreshSecondsInput = document.getElementById('refreshSecondsInput');
        const applyRefreshSecondsBtn = document.getElementById('applyRefreshSecondsBtn');
        const pauseLatestRefreshBtn = document.getElementById('pauseLatestRefreshBtn');
        const idOrderStatus = document.getElementById('idOrderStatus');
        const developerFeatureMount = document.getElementById('developerFeatureMount');
        const itemLimitBtn = document.getElementById('itemLimitBtn');
        const refreshIcon = document.getElementById('refreshIcon');
        const errorMessage = document.getElementById('errorMessage');
        const totalItemsEl = document.getElementById('totalItems');
        const lastUpdateEl = document.getElementById('lastUpdate');
        const visibleItemsEl = document.getElementById('visibleItems');
        const updatedItemsEl = document.getElementById('updatedItems');
        const scrollTopBtn = document.getElementById('scrollTopBtn');
        const historyToggleBtn = document.getElementById('historyToggleBtn');
        const scrollBottomBtn = document.getElementById('scrollBottomBtn');
        const globalLoading = document.getElementById('globalLoading');
        const loadMoreSentinel = document.getElementById('loadMoreSentinel');
        const loadMoreStatus = document.getElementById('loadMoreStatus');
        const attrModal = document.getElementById('attrModal');
        const attrModalBackdrop = document.getElementById('attrModalBackdrop');
        const attrModalClose = document.getElementById('attrModalClose');
        const attrTableBody = document.getElementById('attrTableBody');
        const attrRaw = document.getElementById('attrRaw');
        const attrExt = document.getElementById('attrExt');
        const attrExtSection = document.getElementById('attrExtSection');
        const commentsModal = document.getElementById('commentsModal');
        const commentsModalBackdrop = document.getElementById('commentsModalBackdrop');
        const commentsModalClose = document.getElementById('commentsModalClose');
        const commentsSummary = document.getElementById('commentsSummary');
        const commentsList = document.getElementById('commentsList');
        const featureModalMount = document.getElementById('featureModalMount');

        function emitFeatureHandlers(handlers, payload) {
            handlers.forEach(handler => {
                Promise.resolve()
                    .then(() => handler(payload))
                    .catch(error => {
                        console.error('Feature hook failed:', error);
                    });
            });
        }

        function onLatestFeedReady(handler) {
            featureHooks.latestReady.add(handler);
            return () => featureHooks.latestReady.delete(handler);
        }

        function onFeedItemsSynced(handler) {
            featureHooks.sync.add(handler);
            return () => featureHooks.sync.delete(handler);
        }

        // Initialization
        function init() {
            if (window.location.protocol === 'file:') {
                showError('请通过 Node 代理服务访问此页面，例如运行 npm install && npm start 后打开 http://127.0.0.1:3000 。');
                return false;
            }

            updateAutoRefreshStatus();
            updateHistoryToggleButton();
            updateDeveloperModeButton();
            updateDeveloperPanelVisibility();
            updateTitleModeButton();
            updateSourceModeButton();
            updateLatestRefreshButton();
            updateItemLimitButton();
            fetchData();
            setupEventListeners();
            startAutoRefresh();
            updateStickyPanelState();
            setupInfiniteScroll();
            setupAttributeModal();
            return true;
        }
        
        // Set up event listeners
        function setupEventListeners() {
            searchInput.addEventListener('input', function() {
                currentSearch = this.value.toLowerCase();
                filterContent();
            });
            
            typeFilter.addEventListener('change', function() {
                currentType = this.value;
                filterContent();
            });
            
            refreshBtn.addEventListener('click', fetchData);
            developerModeBtn.addEventListener('click', toggleDeveloperMode);
            titleModeBtn.addEventListener('click', toggleTitleMode);
            sourceModeBtn.addEventListener('click', toggleSourceMode);
            applyRefreshSecondsBtn.addEventListener('click', applyAutoRefreshInterval);
            refreshSecondsInput.addEventListener('keydown', handleRefreshSecondsInputKeydown);
            pauseLatestRefreshBtn.addEventListener('click', toggleLatestRefreshPaused);
            itemLimitBtn.addEventListener('click', toggleItemLimit);
            stickyPanelToggleBtn.addEventListener('click', toggleStickyPanel);
            scrollTopBtn.addEventListener('click', scrollToTop);
            historyToggleBtn.addEventListener('click', toggleHistoryAutoLoad);
            scrollBottomBtn.addEventListener('click', scrollToBottom);
            window.addEventListener('scroll', updateStickyPanelState, { passive: true });
            window.addEventListener('resize', updateStickyPanelState);
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', updateStickyPanelState);
            }
        }
        
        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        function updateAutoRefreshStatus() {
            updateRefreshIntervalControls();
            updateRefreshButtonAvailability();
        }

        function updateDeveloperModeButton() {
            const label = developerModeEnabled ? '更多设置：开' : '更多设置：关';
            const tooltip = developerModeEnabled
                ? '已展开更多设置；点击后收起高级功能'
                : '点击展开更多设置';

            developerModeBtn.textContent = label;
            developerModeBtn.classList.toggle('is-active', developerModeEnabled);
            developerModeBtn.setAttribute('title', tooltip);
            developerModeBtn.setAttribute('aria-label', tooltip);
            developerModeBtn.setAttribute('aria-expanded', String(developerModeEnabled));
        }

        function updateDeveloperPanelVisibility() {
            developerPanel.hidden = !developerModeEnabled;
        }

        function toggleDeveloperMode() {
            developerModeEnabled = !developerModeEnabled;
            updateDeveloperModeButton();
            updateDeveloperPanelVisibility();
            updateIdOrderStatus();
            updateStickyPanelState();
        }

        function updateTitleModeButton() {
            const label = showStandaloneTitle ? '标题单显：开' : '标题单显：关';
            const tooltip = showStandaloneTitle
                ? '已开启标题单独显示；点击后恢复为正文一体显示'
                : '已关闭标题单独显示；点击后提取【标题】并单独显示';

            titleModeBtn.textContent = label;
            titleModeBtn.classList.toggle('is-active', showStandaloneTitle);
            titleModeBtn.setAttribute('title', tooltip);
            titleModeBtn.setAttribute('aria-label', tooltip);
        }

        function toggleTitleMode() {
            showStandaloneTitle = !showStandaloneTitle;
            updateTitleModeButton();
            filterContent();
        }

        function updateSourceModeButton() {
            const label = showStandaloneSource ? '来源单显：开' : '来源单显：关';
            const tooltip = showStandaloneSource
                ? '已开启来源单独显示；点击后恢复为正文内显示'
                : '已关闭来源单独显示；点击后提取末尾来源并单独显示';

            sourceModeBtn.textContent = label;
            sourceModeBtn.classList.toggle('is-active', showStandaloneSource);
            sourceModeBtn.setAttribute('title', tooltip);
            sourceModeBtn.setAttribute('aria-label', tooltip);
        }

        function toggleSourceMode() {
            showStandaloneSource = !showStandaloneSource;
            updateSourceModeButton();
            filterContent();
        }

        function updateRefreshIntervalControls() {
            const seconds = Math.max(1, Math.round(autoRefreshIntervalMs / 1000));
            const tooltip = `当前每 ${seconds} 秒自动刷新一次`;

            refreshSecondsInput.value = String(seconds);
            applyRefreshSecondsBtn.setAttribute('title', tooltip);
            applyRefreshSecondsBtn.setAttribute('aria-label', tooltip);
        }

        function applyAutoRefreshInterval() {
            const nextSeconds = Number(refreshSecondsInput.value);

            if (!Number.isFinite(nextSeconds) || nextSeconds < 1) {
                showError('自动刷新秒数至少需要 1 秒。');
                updateRefreshIntervalControls();
                return;
            }

            autoRefreshIntervalMs = Math.round(nextSeconds * 1000);
            hideError();
            updateAutoRefreshStatus();
            startAutoRefresh();
        }

        function handleRefreshSecondsInputKeydown(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                applyAutoRefreshInterval();
            }
        }

        function updateLatestRefreshButton() {
            const label = latestRefreshPaused ? '新数据刷新：停' : '新数据刷新：开';
            const tooltip = latestRefreshPaused
                ? '当前已暂停新数据自动刷新和手动刷新；点击恢复'
                : '当前允许新数据自动刷新和手动刷新；点击暂停';

            pauseLatestRefreshBtn.textContent = label;
            pauseLatestRefreshBtn.classList.toggle('is-active', latestRefreshPaused);
            pauseLatestRefreshBtn.setAttribute('title', tooltip);
            pauseLatestRefreshBtn.setAttribute('aria-label', tooltip);
            pauseLatestRefreshBtn.setAttribute('aria-pressed', String(latestRefreshPaused));
            pauseLatestRefreshBtn.disabled = false;
        }

        function toggleLatestRefreshPaused() {
            latestRefreshPaused = !latestRefreshPaused;
            updateLatestRefreshButton();
            updateRefreshButtonAvailability();
            startAutoRefresh();

            if (!latestRefreshPaused) {
                fetchData();
            }
        }

        function updateRefreshButtonAvailability() {
            const isDisabled = isRefreshing || latestRefreshPaused;
            const tooltip = latestRefreshPaused
                ? '更多设置中已暂停新数据刷新'
                : '立即拉取最新消息';

            refreshBtn.disabled = isDisabled;
            refreshBtn.setAttribute('title', tooltip);
            refreshBtn.setAttribute('aria-label', tooltip);
        }

        function truncateText(text, maxLength, suffix = '\n[已截断]') {
            if (typeof text !== 'string') {
                return '';
            }

            if (text.length <= maxLength) {
                return text;
            }

            return `${text.slice(0, Math.max(0, maxLength - suffix.length))}${suffix}`;
        }

        function getCurrentPrimaryItem() {
            const filteredItems = filterItemsByCriteria(allItems, currentSearch, currentType);
            return filteredItems.length > 0 ? filteredItems[0] : null;
        }

        function getCurrentBulkItems(limit = 100) {
            return allItems
                .slice(0, limit)
                .slice()
                .sort((left, right) => Number(left.id) - Number(right.id));
        }

        function updateItemLimitButton() {
            const label = itemLimitEnabled ? `项目上限：${ITEM_LIMIT_COUNT}条` : '项目上限：不限';
            const tooltip = itemLimitEnabled
                ? `当前最多保留 ${ITEM_LIMIT_COUNT} 条项目；新消息到来时会自动删除更旧的项目`
                : `当前不限制项目数量；点击后改为最多保留 ${ITEM_LIMIT_COUNT} 条`;

            itemLimitBtn.textContent = label;
            itemLimitBtn.classList.toggle('is-active', itemLimitEnabled);
            itemLimitBtn.setAttribute('title', tooltip);
            itemLimitBtn.setAttribute('aria-label', tooltip);
        }

        function shouldUseCompactStickyPanel() {
            const viewportWidth = window.visualViewport?.width || window.innerWidth;
            const viewportHeight = window.visualViewport?.height || window.innerHeight;
            const viewportRatio = viewportWidth / Math.max(viewportHeight, 1);
            const expandedPanelHeight = stickyPanelContent?.scrollHeight || stickyPanel?.scrollHeight || 0;
            const isNarrowViewport = viewportWidth <= STICKY_PANEL_MAX_WIDTH;
            const isShortViewport = viewportHeight <= STICKY_PANEL_MAX_HEIGHT;
            const isShortWideViewport = viewportRatio >= STICKY_PANEL_WIDE_RATIO && viewportHeight <= 820;
            const panelOccupiesTooMuchHeight = expandedPanelHeight >= viewportHeight * STICKY_PANEL_MAX_HEIGHT_RATIO;

            return isNarrowViewport
                || isShortViewport
                || isShortWideViewport
                || panelOccupiesTooMuchHeight;
        }

        function updateStickyPanelScrollableLayout() {
            const isCompactViewport = shouldUseCompactStickyPanel();

            if (!isCompactViewport) {
                stickyPanel.style.removeProperty('--sticky-panel-max-height');
                stickyPanel.style.removeProperty('--sticky-panel-content-max-height');
                return;
            }

            const viewportHeight = window.visualViewport?.height || window.innerHeight;
            const panelRect = stickyPanel.getBoundingClientRect();
            const panelTop = Math.max(panelRect.top, 8);
            const availableHeight = Math.max(240, Math.floor(viewportHeight - panelTop - 8));
            const toggleSpacing = stickyPanelToggleBtn.hidden ? 0 : stickyPanelToggleBtn.offsetHeight + 10;
            const panelPaddingAllowance = stickyPanel.classList.contains('is-compact') ? 20 : 30;
            const contentHeight = Math.max(150, availableHeight - toggleSpacing - panelPaddingAllowance);

            stickyPanel.style.setProperty('--sticky-panel-max-height', `${availableHeight}px`);
            stickyPanel.style.setProperty('--sticky-panel-content-max-height', `${contentHeight}px`);
        }

        function updateStickyPanelToggleButton() {
            const isCompact = stickyPanel.classList.contains('is-compact');
            const isVisible = isCompact || stickyPanel.classList.contains('is-mobile-expanded');
            const textEl = stickyPanelToggleBtn.querySelector('.sticky-panel__mobile-text');
            const hintEl = stickyPanelToggleBtn.querySelector('.sticky-panel__mobile-hint');
            const iconEl = stickyPanelToggleBtn.querySelector('i');

            stickyPanelToggleBtn.hidden = !isVisible;
            if (!isVisible) return;

            const label = isCompact ? '展开筛选与统计' : '收起筛选与统计';
            const hint = isCompact ? '点击打开设置面板' : '点击缩小为一条';

            textEl.textContent = label;
            hintEl.textContent = hint;
            iconEl.className = `fas ${isCompact ? 'fa-chevron-down' : 'fa-chevron-up'}`;
            stickyPanelToggleBtn.setAttribute('title', label);
            stickyPanelToggleBtn.setAttribute('aria-label', label);
            stickyPanelToggleBtn.setAttribute('aria-expanded', String(!isCompact));
        }

        function getStickyPanelCollapseThreshold(isCompactViewport) {
            return isCompactViewport ? STICKY_PANEL_COMPACT_SCROLL_Y : STICKY_PANEL_COLLAPSE_SCROLL_Y;
        }

        function updateStickyPanelState() {
            const isCompactViewport = shouldUseCompactStickyPanel();
            const collapseThreshold = getStickyPanelCollapseThreshold(isCompactViewport);

            if (!isCompactViewport || window.scrollY <= collapseThreshold) {
                stickyPanelPinnedOpen = false;
            }

            const isCompact = isCompactViewport
                && window.scrollY > collapseThreshold
                && !stickyPanelPinnedOpen;
            const isMobileExpanded = isCompactViewport
                && window.scrollY > collapseThreshold
                && stickyPanelPinnedOpen;

            stickyPanel.classList.toggle('is-compact', isCompact);
            stickyPanel.classList.toggle('is-mobile-expanded', isMobileExpanded);
            stickyPanelContent.setAttribute('aria-hidden', String(isCompact));
            updateStickyPanelToggleButton();
            updateStickyPanelScrollableLayout();
        }

        function toggleStickyPanel() {
            if (!shouldUseCompactStickyPanel()) return;

            const isCompact = stickyPanel.classList.contains('is-compact');
            stickyPanelPinnedOpen = isCompact;
            updateStickyPanelState();
        }

        function toggleItemLimit() {
            itemLimitEnabled = !itemLimitEnabled;
            updateItemLimitButton();

            if (itemLimitEnabled) {
                enforceItemLimit();
            }

            updateStats(0, 0);
            filterContent();
            updateHistoryStatus();
        }

        function updateHistoryToggleButton() {
            const iconClass = historyAutoLoadEnabled ? 'fa-pause' : 'fa-play';
            const label = historyAutoLoadEnabled ? '暂停滚动加载历史消息' : '恢复滚动加载历史消息';

            historyToggleBtn.innerHTML = `<i class="fas ${iconClass}"></i>`;
            historyToggleBtn.classList.toggle('is-off', !historyAutoLoadEnabled);
            historyToggleBtn.setAttribute('title', label);
            historyToggleBtn.setAttribute('aria-label', label);
            historyToggleBtn.setAttribute('aria-pressed', String(historyAutoLoadEnabled));
        }

        function toggleHistoryAutoLoad() {
            historyAutoLoadEnabled = !historyAutoLoadEnabled;
            updateHistoryToggleButton();
            updateHistoryStatus();

            if (historyAutoLoadEnabled) {
                scheduleHistoryLoadCheck();
            }
        }

        function scrollToTop() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function scrollToBottom() {
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });

            if (historyAutoLoadEnabled) {
                scheduleHistoryLoadCheck();
            }
        }

        function isHistoryLoadAreaVisible() {
            const rect = loadMoreSentinel.getBoundingClientRect();
            return rect.top <= window.innerHeight + HISTORY_VISIBILITY_MARGIN;
        }

        function scheduleHistoryLoadCheck() {
            const delays = [0, 250, 700, 1200];

            delays.forEach(delay => {
                window.setTimeout(() => {
                    if (!historyAutoLoadEnabled || isFirstLoad || isLoadingMore || !hasMorePages) return;
                    if (isHistoryLoadAreaVisible()) {
                        loadOlderPage();
                    }
                }, delay);
            });
        }

        // Fetch JSON with timeout and configurable retries.
        async function fetchJson(url, { page, purpose, maxRetries = Number.POSITIVE_INFINITY } = {}) {
            const contextLabel = page ? `page=${page}${purpose ? `, ${purpose}` : ''}` : 'page=unknown';
            const maxAttempts = Number.isFinite(maxRetries)
                ? Math.max(1, Math.floor(maxRetries) + 1)
                : Number.POSITIVE_INFINITY;
            let attempt = 0;

            while (true) {
                attempt += 1;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

                try {
                    const response = await fetch(url, {
                        method: 'GET',
                        cache: 'no-store',
                        credentials: 'same-origin',
                        headers: {
                            'Accept': 'application/json'
                        },
                        signal: controller.signal
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    return await response.json();
                } catch (error) {
                    const normalizedError = error.name === 'AbortError'
                        ? new Error(`请求超时（>${REQUEST_TIMEOUT / 1000}秒）`)
                        : error;

                    if (attempt >= maxAttempts) {
                        throw normalizedError;
                    }

                    const retryDelay = Math.min(RETRY_DELAY_MS * Math.min(attempt, 10), 15000);
                    console.warn(`[${new Date().toLocaleTimeString()}] Failed ${contextLabel}, attempt ${attempt}: ${normalizedError.message}. Retrying in ${Math.round(retryDelay / 1000)}s.`);
                    await sleep(retryDelay);
                } finally {
                    clearTimeout(timeoutId);
                }
            }
        }
        
        // Fetch data
        async function fetchData() {
            if (isRefreshing || latestRefreshPaused) return;

            try {
                isRefreshing = true;
                setRefreshingState(true);
                showGlobalLoading();
                hideError();
                
                const data = await fetchJson(buildApiUrl(1), { page: 1, purpose: 'latest' });
                processData(data, { page: 1, mode: 'prepend' });
                updateHistoryStatus();
            } catch (error) {
                showError(`获取数据失败：${error.message}。请确认本地代理服务正在运行，并稍后重试。`);
            } finally {
                isRefreshing = false;
                setRefreshingState(false);
                hideGlobalLoading();
            }
        }
        
        // Process data
        function processData(data, { page, mode }) {
            if (data.result && data.result.status.code === 0) {
                const wasFirstLoad = isFirstLoad;
                const newItems = Array.isArray(data.result.data.feed.list)
                    ? data.result.data.feed.list
                    : [];
                const pageInfo = data.result.data.feed.page_info;
                const previousNewestId = Number(allItems[0]?.id ?? Number.NEGATIVE_INFINITY);
                const previousOldestId = Number(allItems[allItems.length - 1]?.id ?? Number.POSITIVE_INFINITY);
                const idOrderAnalysis = analyzeIdOrder(newItems);
                const normalizedItems = normalizeItemsByIdDesc(newItems);
                
                // Merge new data and keep existing content
                const { addedItems, updatedItems } = mergeItems(normalizedItems, { prepend: mode === 'prepend' });
                const prependOrderDrift = mode === 'prepend'
                    && addedItems.some(item => Number(item.id) < previousNewestId);
                const appendOrderDrift = mode === 'append'
                    && addedItems.some(item => Number(item.id) > previousOldestId);
                const orderDisorderDetected = !idOrderAnalysis.isDescending || prependOrderDrift || appendOrderDrift;

                updateIdOrderStatus({
                    purpose: mode === 'prepend' ? 'latest' : 'history',
                    page,
                    checkedCount: idOrderAnalysis.count,
                    disorderDetected: orderDisorderDetected,
                    outOfOrderCount: idOrderAnalysis.outOfOrderCount
                });

                if (orderDisorderDetected && addedItems.length > 0) {
                    sortAllItemsByIdDesc();
                }

                const trimmedCount = enforceItemLimit();
                
                lastUpdateTime = new Date();
                updateStats(addedItems.length, updatedItems.length);
                
                if (isFirstLoad || trimmedCount > 0 || (orderDisorderDetected && addedItems.length > 0)) {
                    filterContent();
                    isFirstLoad = false;

                    if (wasFirstLoad && mode === 'prepend') {
                        emitFeatureHandlers(featureHooks.latestReady, {
                            latestItem: allItems[0] || null
                        });
                    }
                } else {
                    // Filter new items based on current criteria
                    const filteredNewItems = filterItemsByCriteria(addedItems, currentSearch, currentType);
                    if (filteredNewItems.length > 0) {
                        if (mode === 'prepend') {
                            renderNewItems(filteredNewItems);
                        } else {
                            renderOlderItems(filteredNewItems);
                        }
                    }
                    
                    // Update existing items
                    if (updatedItems.length > 0) {
                        updateExistingItems(updatedItems);
                    }
                }

                if (!wasFirstLoad) {
                    emitFeatureHandlers(featureHooks.sync, { addedItems, updatedItems, mode });
                }
                
                return { addedItems, updatedItems, rawItems: newItems, pageInfo };
            } else {
                showError('API返回的数据格式不正确');
                return { addedItems: [], updatedItems: [], rawItems: [], pageInfo: null };
            }
        }

        function analyzeIdOrder(items) {
            const ids = items
                .map(item => Number(item?.id))
                .filter(id => Number.isFinite(id));

            let outOfOrderCount = 0;
            for (let index = 1; index < ids.length; index += 1) {
                if (ids[index] > ids[index - 1]) {
                    outOfOrderCount += 1;
                }
            }

            return {
                count: ids.length,
                isDescending: outOfOrderCount === 0,
                outOfOrderCount
            };
        }

        function normalizeItemsByIdDesc(items) {
            return [...items].sort((left, right) => Number(right.id) - Number(left.id));
        }

        function sortAllItemsByIdDesc() {
            allItems.sort((left, right) => Number(right.id) - Number(left.id));
        }

        function updateIdOrderStatus({
            purpose,
            page,
            checkedCount,
            disorderDetected,
            outOfOrderCount
        } = {}) {
            if (purpose) {
                const purposeLabel = purpose === 'latest' ? '最新页' : '历史页';
                lastIdOrderStatus = disorderDetected
                    ? {
                        text: `ID顺序检测：${purposeLabel} page=${page} 发现异常，已按 ID 降序整理`,
                        warning: true
                    }
                    : {
                        text: checkedCount > 1
                            ? `ID顺序检测：${purposeLabel} page=${page} 正常`
                            : `ID顺序检测：${purposeLabel} page=${page} 样本不足`,
                        warning: false
                    };

                if (disorderDetected && outOfOrderCount > 0) {
                    lastIdOrderStatus.text += `（逆序点 ${outOfOrderCount} 处）`;
                }
            }

            idOrderStatus.textContent = lastIdOrderStatus.text;
            idOrderStatus.classList.toggle('is-warning', Boolean(lastIdOrderStatus.warning));
            idOrderStatus.classList.toggle('is-ok', !lastIdOrderStatus.warning && lastIdOrderStatus.text !== 'ID顺序检测：未检测');
        }

        function clearLoadedItems() {
            allItems = [];
            itemsById = new Map();
            currentPage = 1;
            hasMorePages = true;
            isLoadingMore = false;
            contentList.innerHTML = '';
        }

        function replaceLoadedItems(items) {
            const normalized = normalizeItemsByIdDesc(items).map(item => ({ ...item }));
            allItems = normalized;
            itemsById = new Map(normalized.map(item => [item.id, item]));
        }

        // Merge new items into the existing list
        function mergeItems(newItems, { prepend = false } = {}) {
            const addedItems = [];
            const updatedItems = [];
            
            // Filter out existing items
            for (const newItem of newItems) {
                const existingItem = itemsById.get(newItem.id);
                
                if (!existingItem) {
                    // New item
                    const storedItem = { ...newItem };
                    itemsById.set(newItem.id, storedItem);
                    addedItems.push(storedItem);
                } else {
                    // Update item
                    // Check for changes
                    const hasChanges = 
                        JSON.stringify(existingItem.rich_text) !== JSON.stringify(newItem.rich_text) ||
                        JSON.stringify(existingItem.docurl) !== JSON.stringify(newItem.docurl) ||
                        JSON.stringify(existingItem.tag) !== JSON.stringify(newItem.tag);
                    
                    if (hasChanges) {
                        // Update item properties
                        existingItem.rich_text = newItem.rich_text;
                        existingItem.docurl = newItem.docurl;
                        existingItem.tag = newItem.tag;
                        updatedItems.push(existingItem);
                    }
                }
            }
            
            // Add new items to the top or bottom
            if (addedItems.length > 0) {
                allItems = prepend ? [...addedItems, ...allItems] : [...allItems, ...addedItems];
            }
            
            return { addedItems, updatedItems };
        }

        function enforceItemLimit() {
            if (!itemLimitEnabled || allItems.length <= ITEM_LIMIT_COUNT) {
                return 0;
            }

            const removedItems = allItems.slice(ITEM_LIMIT_COUNT);
            allItems = allItems.slice(0, ITEM_LIMIT_COUNT);

            removedItems.forEach(item => {
                itemsById.delete(item.id);
            });

            return removedItems.length;
        }
        
        // Filter items by criteria
        function filterItemsByCriteria(items, searchText, selectedType) {
            return items.filter(item => {
                const matchesSearch = getSearchableText(item).includes(searchText);
                const commentTotal = Number(item.comment_list?.total) || 0;
                const returnedCommentCount = Array.isArray(item.comment_list?.list) ? item.comment_list.list.length : 0;
                const hasComments = commentTotal > 0 || returnedCommentCount > 0;
                const matchesType = selectedType === 'all'
                    || (selectedType === 'has-comments' && hasComments)
                    || item.tag.some(t => t.id.toString() === selectedType);
                return matchesSearch && matchesType;
            });
        }
        
        // Render content
        function renderContent(items) {
            contentList.innerHTML = items.map(item => createContentItem(item)).join('');
        }
        
        // Render new items
        function renderNewItems(items) {
            if (items.length === 0) return;
            
            const newContent = items.map(item => createContentItem(item)).join('');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newContent;
            
            // Add new elements to the top of the list
            Array.from(tempDiv.children).forEach(element => {
                contentList.insertBefore(element, contentList.firstChild);
            });
        }

        // Render older items at the bottom
        function renderOlderItems(items) {
            if (items.length === 0) return;
            
            const newContent = items.map(item => createContentItem(item)).join('');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newContent;
            
            Array.from(tempDiv.children).forEach(element => {
                contentList.appendChild(element);
            });
        }
        
        // Update existing items
        function updateExistingItems(items) {
            items.forEach(item => {
                const existingElement = document.querySelector(`.content-item[data-id="${item.id}"]`);
                if (existingElement) {
                    // Replace the entire element
                    const newElement = createElementFromHTML(createContentItem(item));
                    existingElement.parentNode.replaceChild(newElement, existingElement);
                }
            });
        }
        
        // Create element from HTML string
        function createElementFromHTML(htmlString) {
            const div = document.createElement('div');
            div.innerHTML = htmlString.trim();
            return div.firstChild;
        }

        const DEFAULT_COMMENT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><rect width="44" height="44" rx="22" fill="%23e2e8f0"/><circle cx="22" cy="17" r="8" fill="%2394a3b8"/><path d="M9 37c2.8-7 9.4-10 13-10s10.2 3 13 10" fill="%2394a3b8"/></svg>';

        function escapeHtml(text) {
            return String(text ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
        
        // Create a single content item
        function createContentItem(item) {
            const hasDocUrl = item.docurl && item.docurl.trim() !== '';
            const buttonClass = hasDocUrl ? 'action-btn' : 'action-btn disabled';
            const onClick = hasDocUrl ? `openDocUrl('${getDocUrl(item)}')` : '';
            
            // Check whether to highlight (ID is 9)
            const isHighlight = item.tag.some(t => t.id == 9);
            const textClass = isHighlight ? 'content-text highlight-text' : 'content-text';
            const titleClass = isHighlight ? 'content-title highlight-text' : 'content-title';
            const displayParts = getDisplayTextParts(item.rich_text);
            
            const imageUrls = Array.isArray(item.multimedia?.img_url) ? item.multimedia.img_url : [];
            const mediaHtml = imageUrls.length > 0
                ? `<div class="content-media">
                        ${imageUrls.map(url => `<img class="content-image" src="${url}" alt="">`).join('')}
                   </div>`
                : '';

            const titleHtml = displayParts.title
                ? `<div class="${titleClass}">${displayParts.title}</div>`
                : '';
            const bodyHtml = displayParts.body
                ? `<div class="${textClass}">${displayParts.body}</div>`
                : '';
            const sourceLabel = displayParts.source ? `来源：${displayParts.source}` : '';
            const sourceTooltip = displayParts.source ? `识别出的来源：${displayParts.source}` : '';
            const sourceHtml = displayParts.source
                ? `<span class="action-btn source-btn" title="${escapeHtml(sourceTooltip)}" aria-label="${escapeHtml(sourceTooltip)}">${escapeHtml(sourceLabel)}</span>`
                : '';
            const loadedCommentCount = Array.isArray(item.comment_list?.list) ? item.comment_list.list.length : 0;
            const commentsHtml = loadedCommentCount > 0
                ? `<button class="action-btn comment-btn" data-action="comments" title="查看评论信息" aria-label="查看评论信息">
                                <i class="fas fa-comments"></i> 评论
                            </button>`
                : '';
            
            return `
                <div class="content-item" data-id="${item.id}">
                    <div class="content-header">
                        <span class="content-id">ID: ${item.id}</span>
                        <span class="content-time">${formatTime(item.create_time)}</span>
                    </div>
                    ${titleHtml}
                    ${bodyHtml}
                    ${mediaHtml}
                    <div class="content-footer">
                        <div class="content-tags">
                            ${item.tag.map(t => `<span class="tag">${t.name}</span>`).join('')}
                        </div>
                        <div class="content-actions">
                            <button class="action-btn copy-btn" data-action="copy" title="复制这条新闻原文" aria-label="复制这条新闻原文">
                                <i class="fas fa-copy"></i> 复制
                            </button>
                            ${sourceHtml}
                            ${commentsHtml}
                            <button class="action-btn attr-btn" data-action="attrs">全部属性</button>
                            <button class="${buttonClass}" ${onClick ? `onclick="${onClick}"` : ''}>
                                <i class="fas fa-external-link-alt"></i> 原文
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Open document URL
        function openDocUrl(url) {
            if (url) {
                window.open(url, '_blank');
            }
        }

        async function writeTextToClipboard(text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return;
            }

            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }

        function flashActionButtonState(button, nextLabel) {
            if (!button) return;

            const originalHtml = button.dataset.originalHtml || button.innerHTML;
            button.dataset.originalHtml = originalHtml;
            button.innerHTML = nextLabel;

            window.setTimeout(() => {
                button.innerHTML = originalHtml;
            }, 1200);
        }

        async function copyNewsItem(item, button) {
            try {
                await writeTextToClipboard(item.rich_text || '');
                flashActionButtonState(button, '<i class="fas fa-check"></i> 已复制');
            } catch (error) {
                flashActionButtonState(button, '复制失败');
            }
        }

        document.addEventListener('click', function(event) {
            const img = event.target.closest('.content-image');
            if (!img) return;
            img.classList.toggle('is-expanded');
        });
        
        // Get document URL (convert mobile link to PC link)
        function getDocUrl(item) {
            // Prefer item.docurl
            if (item.docurl && item.docurl.trim() !== '') {
                let url = item.docurl;
                // Replace domain and path format
                url = url.replace('//finance.sina.cn', '//finance.sina.com.cn')
                        .replace('/detail-', '/doc-')
                        .replace('.d.html', '.shtml');
                return url;
            }
            
            return null;
        }

        function getCommentAvatarUrl(url) {
            if (typeof url !== 'string' || url.trim() === '') {
                return '';
            }

            return `/api/avatar?url=${encodeURIComponent(url.trim())}`;
        }

        const FIELD_MEANINGS = {
            id: '唯一条目ID',
            zhibo_id: '直播间ID',
            type: '内容类型代码',
            rich_text: '正文内容（富文本）',
            multimedia: '多媒体内容（字符串或对象）',
            'multimedia.img_url[]': '图片URL列表',
            commentid: '评论系统ID',
            compere_id: '主持人/主播ID',
            creator: '创建者账号',
            mender: '最后编辑账号',
            create_time: '创建时间',
            update_time: '更新时间',
            is_need_check: '是否需要审核',
            check_time: '审核时间',
            check_status: '审核状态',
            check_user: '审核人账号',
            is_delete: '是否删除',
            top_value: '置顶权重/优先级',
            is_focus: '是否焦点',
            source_content_id: '来源内容ID',
            anchor_image_url: '主播图片URL',
            anchor: '主播名称',
            ext: '扩展JSON字符串（需解析）',
            ext_parsed: '解析后的ext对象',
            'ext_parsed.docurl': '文档URL（来自ext）',
            'ext_parsed.docid': '文档ID（来自ext）',
            'ext_parsed.stocks': '关联标的列表',
            'ext_parsed.stocks[].market': '标的市场',
            'ext_parsed.stocks[].symbol': '标的代码',
            'ext_parsed.stocks[].key': '标的关键词/名称',
            'ext_parsed.stocks[].sym_party_status': '标的党派状态（推测）',
            'ext_parsed.needPushWB': '是否推送微博',
            'ext_parsed.needCMSLink': '是否生成CMS链接',
            'ext_parsed.needCalender': '是否关联日历',
            old_live_cid: '旧版内容ID',
            tab: 'Tab名称',
            is_repeat: '是否重复',
            'tag[]': '标签列表',
            'tag[].id': '标签ID',
            'tag[].name': '标签名称',
            like_nums: '点赞数',
            comment_list: '评论概览',
            'comment_list.total': '评论总数',
            'comment_list.thread_show': '是否显示线程',
            'comment_list.qreply': '问答回复数',
            'comment_list.qreply_show': '问答回复显示标记',
            'comment_list.show': '评论显示标记',
            'comment_list.list[]': '评论列表',
            'comment_list.list[].mid': '评论ID',
            'comment_list.list[].comment_mid': '父评论ID',
            'comment_list.list[].channel': '评论频道',
            'comment_list.list[].newsid': '新闻ID',
            'comment_list.list[].news_mid': '新闻消息ID',
            'comment_list.list[].channel_source': '来源频道',
            'comment_list.list[].newsid_source': '来源新闻ID',
            'comment_list.list[].news_mid_source': '来源新闻消息ID',
            'comment_list.list[].status': '审核状态',
            'comment_list.list[].time': '评论时间',
            'comment_list.list[].agree': '赞同数',
            'comment_list.list[].score': '评分',
            'comment_list.list[].hot': '热度',
            'comment_list.list[].against': '反对数',
            'comment_list.list[].length': '内容长度',
            'comment_list.list[].rank': '排序/排名',
            'comment_list.list[].vote': '投票数',
            'comment_list.list[].level': '层级',
            'comment_list.list[].parent': '父线程ID',
            'comment_list.list[].parent_mid': '父评论MID',
            'comment_list.list[].thread': '线程ID',
            'comment_list.list[].thread_mid': '线程MID',
            'comment_list.list[].uid': '用户ID',
            'comment_list.list[].nick': '用户昵称',
            'comment_list.list[].usertype': '用户类型',
            'comment_list.list[].content': '评论内容',
            'comment_list.list[].ip': 'IP地址',
            'comment_list.list[].config': '配置字符串',
            'comment_list.list[].profile_img': '用户头像URL',
            'comment_list.list[].parent_uid': '父用户ID',
            'comment_list.list[].parent_nick': '父用户昵称',
            'comment_list.list[].parent_profile_img': '父用户头像URL',
            'comment_list.list[].area': '用户地区',
            'comment_list.list[].status_uid': '状态用户ID',
            'comment_list.list[].comment_imgs': '评论图片',
            'comment_list.list[].status_cmnt_mid': '状态评论MID',
            'comment_list.list[].import_type': '导入类型',
            'comment_list.list[].media_type': '媒体类型',
            'comment_list.list[].audio': '音频URL',
            'comment_list.list[].video': '视频URL',
            'comment_list.list[].openid': 'OpenID',
            'comment_list.list[].login_type': '登录类型',
            'comment_list.list[].batch_type': '批处理类型',
            'comment_list.list[].check_type': '检查类型',
            'comment_list.list[].status_show': '状态显示标记',
            'comment_list.list[].code': '状态码',
            'comment_list.list[].layer': '层级编号',
            'comment_list.list[].show_loc': '显示位置标记',
            'comment_list.list[].top_desc': '置顶描述',
            'comment_list.list[].thread2': '次级线程ID',
            'comment_list.list[].status2': '次级状态',
            'comment_list.list[].content_ext': '评论扩展内容',
            'comment_list.list[].content_ext.reply': '回复数',
            'comment_list.list[].content_ext.weibourl': '微博链接',
            'comment_list.list[].content_ext.videoinfo': '视频信息',
            'comment_list.list[].is_hot': '是否热门',
            'comment_list.list[].is_top': '是否置顶',
            'comment_list.list[].parent_new': '父级新标记',
            'comment_list.list[].count_layer': '层级计数',
            'comment_list.list[].did': '设备ID',
            'comment_list.list[].is_agree': '是否赞同',
            'comment_list.list[].has_my': '是否包含我的数据',
            docurl: '移动端文档URL',
            rich_text_nick_to_url: '昵称到URL映射',
            rich_text_nick_to_routeUri: '昵称到路由URI映射',
            compere_info: '主播/主持人信息'
        };

        function normalizePath(path) {
            return path.replace(/\[\d+\]/g, '[]');
        }

        function inferMeaning(path, value) {
            const normalizedPath = normalizePath(path);
            if (FIELD_MEANINGS[normalizedPath]) return FIELD_MEANINGS[normalizedPath];

            const key = normalizedPath.split('.').pop();
            if (!key) return '根节点值';
            if (/_time$/.test(key)) return '时间戳';
            if (/_id$/.test(key) || key === 'id') return '标识符';
            if (/^is_/.test(key) || /_flag$/.test(key)) return '布尔标记';
            if (/num|count|total|size|page/i.test(key)) return '数量/大小';
            if (/url/i.test(key)) return 'URL';
            if (/name|nick/i.test(key)) return '名称/标签';
            if (/status/i.test(key)) return '状态码/状态标记';
            if (/type/i.test(key)) return '类型代码';
            if (/list/i.test(key)) return '列表/数组';
            if (/img|image/.test(key)) return '图片URL或图片数据';
            if (/time/.test(key)) return '时间值';
            if (typeof value === 'boolean') return '布尔值';
            if (typeof value === 'number') return '数值';
            if (typeof value === 'string') return '文本';
            return '未文档化，基于上下文推测';
        }

        function parseExtValue(ext) {
            if (typeof ext !== 'string' || ext.trim() === '') return null;
            try {
                return JSON.parse(ext);
            } catch (error) {
                return null;
            }
        }

        function buildDisplayItem(item) {
            const displayItem = { ...item };
            const parsedExt = parseExtValue(item.ext);
            if (parsedExt) {
                displayItem.ext_parsed = parsedExt;
            }
            return displayItem;
        }

        function flattenObject(value, path, out) {
            if (value === null || typeof value !== 'object') {
                out.push({ path, value });
                return;
            }

            if (Array.isArray(value)) {
                if (value.length === 0) {
                    out.push({ path, value });
                    return;
                }
                value.forEach((item, index) => {
                    const nextPath = `${path}[${index}]`;
                    flattenObject(item, nextPath, out);
                });
                return;
            }

            const keys = Object.keys(value);
            if (keys.length === 0) {
                out.push({ path, value });
                return;
            }

            keys.forEach(key => {
                const nextPath = path ? `${path}.${key}` : key;
                flattenObject(value[key], nextPath, out);
            });
        }

        function formatValue(value) {
            if (typeof value === 'string') return value;
            return JSON.stringify(value, null, 2);
        }

        function renderAttributeTable(entries) {
            attrTableBody.textContent = '';
            const fragment = document.createDocumentFragment();

            entries.forEach(({ path, value }) => {
                const row = document.createElement('tr');
                const fieldCell = document.createElement('td');
                const valueCell = document.createElement('td');
                const meaningCell = document.createElement('td');

                fieldCell.textContent = path || '(root)';
                const valuePre = document.createElement('pre');
                valuePre.textContent = formatValue(value);
                valueCell.appendChild(valuePre);
                meaningCell.textContent = inferMeaning(path, value);

                row.appendChild(fieldCell);
                row.appendChild(valueCell);
                row.appendChild(meaningCell);
                fragment.appendChild(row);
            });

            attrTableBody.appendChild(fragment);
        }

        function openAttributeModal(item) {
            closeCommentsModal();
            const displayItem = buildDisplayItem(item);
            const entries = [];
            flattenObject(displayItem, '', entries);
            renderAttributeTable(entries);

            attrRaw.textContent = JSON.stringify(item, null, 2);
            const parsedExt = parseExtValue(item.ext);
            if (parsedExt) {
                attrExtSection.hidden = false;
                attrExt.textContent = JSON.stringify(parsedExt, null, 2);
            } else {
                attrExtSection.hidden = true;
                attrExt.textContent = '';
            }

            attrModal.classList.add('is-open');
            attrModal.setAttribute('aria-hidden', 'false');
        }

        function closeAttributeModal() {
            attrModal.classList.remove('is-open');
            attrModal.setAttribute('aria-hidden', 'true');
        }

        function renderCommentsSummary(item) {
            const summary = item.comment_list || {};
            const summaryItems = [
                { label: '评论总数', value: Number(summary.total) || 0 },
                { label: '接口返回条数', value: Array.isArray(summary.list) ? summary.list.length : 0 }
            ];

            commentsSummary.textContent = '';
            const fragment = document.createDocumentFragment();

            summaryItems.forEach(({ label, value }) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'comments-summary__item';

                const labelEl = document.createElement('div');
                labelEl.className = 'comments-summary__label';
                labelEl.textContent = label;

                const valueEl = document.createElement('div');
                valueEl.className = 'comments-summary__value';
                valueEl.textContent = String(value);

                itemEl.appendChild(labelEl);
                itemEl.appendChild(valueEl);
                fragment.appendChild(itemEl);
            });

            commentsSummary.appendChild(fragment);
        }

        function renderCommentsList(item) {
            const comments = Array.isArray(item.comment_list?.list) ? item.comment_list.list : [];
            commentsList.textContent = '';

            if (comments.length === 0) {
                const emptyEl = document.createElement('div');
                emptyEl.className = 'comment-empty';
                emptyEl.textContent = '这条新闻当前没有随接口返回可展示的评论列表。';
                commentsList.appendChild(emptyEl);
                return;
            }

            const fragment = document.createDocumentFragment();

            comments.forEach(comment => {
                const card = document.createElement('div');
                card.className = 'comment-card';

                const avatar = document.createElement('img');
                avatar.className = 'comment-avatar';
                avatar.src = getCommentAvatarUrl(comment.profile_img) || DEFAULT_COMMENT_AVATAR;
                avatar.alt = comment.nick || '用户头像';
                avatar.onerror = () => {
                    avatar.onerror = null;
                    avatar.src = DEFAULT_COMMENT_AVATAR;
                };

                const main = document.createElement('div');
                main.className = 'comment-main';

                const author = document.createElement('div');
                author.className = 'comment-author';

                const name = document.createElement('span');
                name.className = 'comment-author__name';
                name.textContent = comment.nick || '匿名用户';

                const uid = document.createElement('span');
                uid.className = 'comment-author__uid';
                uid.textContent = `UID: ${comment.uid || '-'}`;

                author.appendChild(name);
                author.appendChild(uid);

                const meta = document.createElement('div');
                meta.className = 'comment-meta';

                const metaParts = [
                    comment.area ? `地区：${comment.area}` : '',
                    comment.time ? `时间：${comment.time}` : '',
                    comment.usertype ? `类型：${comment.usertype}` : '',
                    comment.agree ? `赞同：${comment.agree}` : '',
                    comment.rank ? `排序：${comment.rank}` : ''
                ].filter(Boolean);

                metaParts.forEach(part => {
                    const metaItem = document.createElement('span');
                    metaItem.textContent = part;
                    meta.appendChild(metaItem);
                });

                const content = document.createElement('div');
                content.className = 'comment-content';
                content.textContent = comment.content || '';

                main.appendChild(author);
                if (metaParts.length > 0) {
                    main.appendChild(meta);
                }
                main.appendChild(content);

                card.appendChild(avatar);
                card.appendChild(main);
                fragment.appendChild(card);
            });

            commentsList.appendChild(fragment);
        }

        function openCommentsModal(item) {
            closeAttributeModal();
            renderCommentsSummary(item);
            renderCommentsList(item);
            commentsModal.classList.add('is-open');
            commentsModal.setAttribute('aria-hidden', 'false');
        }

        function closeCommentsModal() {
            commentsModal.classList.remove('is-open');
            commentsModal.setAttribute('aria-hidden', 'true');
        }

        function setupAttributeModal() {
            document.addEventListener('click', function(event) {
                const copyBtn = event.target.closest('[data-action="copy"]');
                if (copyBtn) {
                    const itemEl = copyBtn.closest('.content-item');
                    if (itemEl) {
                        const itemId = Number(itemEl.dataset.id);
                        const item = itemsById.get(itemId);
                        if (item) {
                            copyNewsItem(item, copyBtn);
                        }
                    }
                    return;
                }

                const commentsBtn = event.target.closest('[data-action="comments"]');
                if (commentsBtn) {
                    const itemEl = commentsBtn.closest('.content-item');
                    if (itemEl) {
                        const itemId = Number(itemEl.dataset.id);
                        const item = itemsById.get(itemId);
                        if (item) openCommentsModal(item);
                    }
                    return;
                }

                const attrBtn = event.target.closest('[data-action="attrs"]');
                if (attrBtn) {
                    const itemEl = attrBtn.closest('.content-item');
                    if (itemEl) {
                        const itemId = Number(itemEl.dataset.id);
                        const item = itemsById.get(itemId);
                        if (item) openAttributeModal(item);
                    }
                    return;
                }

                if (event.target === attrModalBackdrop || event.target === attrModalClose) {
                    closeAttributeModal();
                    return;
                }

                if (event.target === commentsModalBackdrop || event.target === commentsModalClose) {
                    closeCommentsModal();
                }
            });

            document.addEventListener('keydown', function(event) {
                if (event.key === 'Escape' && attrModal.classList.contains('is-open')) {
                    closeAttributeModal();
                    return;
                }

                if (event.key === 'Escape' && commentsModal.classList.contains('is-open')) {
                    closeCommentsModal();
                }
            });
        }
        
        // Filter content
        function filterContent() {
            const filteredItems = filterItemsByCriteria(allItems, currentSearch, currentType);
            
            updateVisibleStats(filteredItems.length);
            renderContent(filteredItems);
        }
        
        // Update stats
        function updateStats(addedCount = 0, updatedCount = 0) {
            totalItemsEl.textContent = allItems.length;
            lastUpdateEl.textContent = lastUpdateTime
                ? lastUpdateTime.toLocaleTimeString('zh-CN', { hour12: false })
                : '--:--';
            updatedItemsEl.textContent = updatedCount;
            
            // Update visible item count
            const filteredItems = filterItemsByCriteria(allItems, currentSearch, currentType);
            visibleItemsEl.textContent = filteredItems.length;
        }
        
        // Update visible item stats
        function updateVisibleStats(count) {
            visibleItemsEl.textContent = count;
        }
        
        // Set refresh state
        function setRefreshingState(refreshing) {
            if (refreshing) {
                refreshIcon.classList.add('refreshing');
            } else {
                refreshIcon.classList.remove('refreshing');
            }

            updateRefreshButtonAvailability();
        }
        
        // Show global loading indicator
        function showGlobalLoading() {
            if (!isFirstLoad) {
                globalLoading.style.display = 'block';
            }
        }
        
        // Hide global loading indicator
        function hideGlobalLoading() {
            globalLoading.style.display = 'none';
        }
        
        // Show error
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
        
        // Hide error
        function hideError() {
            errorMessage.style.display = 'none';
        }
        
        // Format time
        function formatTime(timeString) {
            try {
                const date = parseApiTime(timeString);
                if (!date) return timeString;
                return date.toLocaleString('zh-CN', { hour12: false });
            } catch (e) {
                return timeString;
            }
        }

        function parseApiTime(timeString) {
            if (typeof timeString !== 'string' || timeString.trim() === '') return null;

            const match = timeString.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
            if (!match) {
                const fallback = new Date(timeString);
                return Number.isNaN(fallback.getTime()) ? null : fallback;
            }

            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            const hour = Number(match[4]);
            const minute = Number(match[5]);
            const second = Number(match[6]);

            // Sina feed timestamps are interpreted as Asia/Shanghai source time.
            return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
        }

        function padNumber(value) {
            return String(value).padStart(2, '0');
        }

        function formatDateKey(date) {
            return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
        }

        function getItemDateKey(item) {
            const date = parseApiTime(item.create_time);
            return date ? formatDateKey(date) : '';
        }

        function getSearchableText(item) {
            return [
                item.rich_text,
                String(item.id ?? ''),
                item.create_time,
                formatTime(item.create_time),
                getItemDateKey(item)
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
        }

        function extractHeadlineParts(text) {
            if (typeof text !== 'string') {
                return { title: '', body: '' };
            }

            const trimmedText = text.trim();
            const match = trimmedText.match(/^【([^】]+)】\s*[-—–:：]?\s*([\s\S]*)$/);

            if (!match) {
                return { title: '', body: trimmedText };
            }

            return {
                title: match[1].trim(),
                body: match[2].trim()
            };
        }

        function extractTrailingSource(text) {
            if (typeof text !== 'string') {
                return { body: '', source: '' };
            }

            const trimmedText = text.trim();
            if (!trimmedText.endsWith('）') && !trimmedText.endsWith(')')) {
                return { body: trimmedText, source: '' };
            }

            const match = trimmedText.match(/^([\s\S]*?)(?:\s*[（(]([^\n]{1,24})[）)])$/u);
            if (!match) {
                return { body: trimmedText, source: '' };
            }

            const source = match[2].trim();
            if (!source) {
                return { body: trimmedText, source: '' };
            }

            return {
                body: match[1].trim(),
                source
            };
        }

        function getDisplayTextParts(text) {
            const originalText = typeof text === 'string' ? text : '';
            let title = '';
            let body = originalText;
            let source = '';

            if (showStandaloneTitle) {
                const headlineParts = extractHeadlineParts(originalText);
                if (headlineParts.title) {
                    title = headlineParts.title;
                    body = headlineParts.body;
                }
            }

            if (showStandaloneSource) {
                const sourceParts = extractTrailingSource(body);
                body = sourceParts.body;
                source = sourceParts.source;
            }

            return {
                title,
                body,
                source
            };
        }

        function getOldestLoadedItem() {
            return allItems.length > 0 ? allItems[allItems.length - 1] : null;
        }

        function getHistoryStatusText() {
            const oldestItem = getOldestLoadedItem();

            if (!oldestItem) {
                return '';
            }

            return `最旧 ID ${oldestItem.id} / 最旧时间 ${formatTime(oldestItem.create_time)}`;
        }

        function updateHistoryStatus({ loading = false, exhausted = false, error = '' } = {}) {
            const baseText = getHistoryStatusText();
            const parts = [];

            if (error) {
                parts.push(error);
            } else if (loading) {
                parts.push('正在加载更早消息...');
            } else if (exhausted) {
                parts.push('已到接口当前可提供的最旧内容');
            } else if (itemLimitEnabled && allItems.length >= ITEM_LIMIT_COUNT) {
                parts.push(`已限制最多 ${ITEM_LIMIT_COUNT} 条`);
            } else if (!historyAutoLoadEnabled) {
                parts.push('已暂停下拉加载历史消息');
            }

            if (baseText) {
                parts.push(baseText);
            }

            if (loading) {
                loadMoreStatus.innerHTML = `${parts.join(' / ')} <i class="fas fa-spinner fa-spin"></i>`;
                return;
            }

            loadMoreStatus.textContent = parts.join(' / ');
        }
        
        // Auto-refresh
        function startAutoRefresh() {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }

            if (latestRefreshPaused) {
                refreshInterval = null;
                return;
            }

            refreshInterval = setInterval(fetchData, autoRefreshIntervalMs);
        }

        // Load older pages when scrolling down
        async function loadOlderPage() {
            if (isFirstLoad || isLoadingMore || !hasMorePages || !historyAutoLoadEnabled) return;
            if (itemLimitEnabled && allItems.length >= ITEM_LIMIT_COUNT) {
                updateHistoryStatus();
                return;
            }
            
            isLoadingMore = true;
            updateHistoryStatus({ loading: true });
            
            try {
                const nextPage = currentPage + 1;
                const data = await fetchJson(buildApiUrl(nextPage), { page: nextPage, purpose: 'history' });
                const result = processData(data, { page: nextPage, mode: 'append' });
                
                currentPage = nextPage;

                if (result.rawItems.length === 0 || result.addedItems.length === 0) {
                    hasMorePages = false;
                    updateHistoryStatus({ exhausted: true });
                } else {
                    updateHistoryStatus();
                }
            } catch (error) {
                updateHistoryStatus({ error: `加载失败：${error.message}` });
            } finally {
                isLoadingMore = false;
            }
        }

        function setupInfiniteScroll() {
            if (!('IntersectionObserver' in window)) {
                updateHistoryStatus();
                return;
            }
            
            const observer = new IntersectionObserver(entries => {
                const entry = entries[0];
                if (entry.isIntersecting && historyAutoLoadEnabled) {
                    loadOlderPage();
                }
            }, {
                root: null,
                rootMargin: '200px',
                threshold: 0
            });
            
            observer.observe(loadMoreSentinel);
        }

        return {
            init,
            onLatestFeedReady,
            onFeedItemsSynced,
            getCurrentPrimaryItem,
            getCurrentBulkItems,
            getFeatureMounts() {
                return {
                    developerFeatureMount,
                    featureModalMount
                };
            },
            buildRelayContext(item) {
                return {
                    item,
                    formatTime,
                    extractHeadlineParts,
                    extractTrailingSource,
                    truncateText
                };
            }
        };
}
