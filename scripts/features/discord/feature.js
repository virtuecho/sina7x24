import { createDiscordFeatureModalMarkup, createDiscordFeaturePanelMarkup } from './template.js';

export function installDiscordFeature(core) {
    // This feature is intentionally self-contained:
    // it injects its own UI, keeps its own state, and listens to core feed hooks.
    // Removing this file plus its import from the app entry disables Discord entirely.

    const mounts = core.getFeatureMounts();
    if (!mounts.developerFeatureMount || !mounts.featureModalMount) {
        return null;
    }

    mounts.developerFeatureMount.innerHTML = createDiscordFeaturePanelMarkup();
    mounts.featureModalMount.innerHTML = createDiscordFeatureModalMarkup();

    const refs = {
        openBtn: document.getElementById('discordDebugOpenBtn'),
        summary: document.getElementById('discordRelaySummary'),
        modal: document.getElementById('discordDebugModal'),
        modalBackdrop: document.getElementById('discordDebugModalBackdrop'),
        modalClose: document.getElementById('discordDebugModalClose'),
        webhookUrlInput: document.getElementById('discordWebhookUrlInput'),
        visibilityBtn: document.getElementById('discordWebhookVisibilityBtn'),
        clearBtn: document.getElementById('discordWebhookClearBtn'),
        usernameInput: document.getElementById('discordWebhookUsernameInput'),
        contentInput: document.getElementById('discordWebhookContentInput'),
        fillBtn: document.getElementById('discordWebhookFillBtn'),
        sendBtn: document.getElementById('discordWebhookSendBtn'),
        sendBulkBtn: document.getElementById('discordWebhookSendBulkBtn'),
        status: document.getElementById('discordWebhookStatus')
    };

    const state = {
        sending: false,
        visible: false,
        autoRelayEnabled: false,
        activeWebhookUrl: '',
        relayQueue: Promise.resolve(),
        relayedMessages: new Map(),
        bulkConfirmPending: false,
        bulkConfirmTimer: null,
        requestControllers: new Set(),
        abortReason: ''
    };

    function isValidDiscordWebhookUrl(rawUrl) {
        if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
            return false;
        }

        try {
            const parsed = new URL(rawUrl.trim());
            if (parsed.protocol !== 'https:') {
                return false;
            }

            const isAllowedHost = parsed.hostname === 'discord.com'
                || parsed.hostname.endsWith('.discord.com')
                || parsed.hostname === 'discordapp.com'
                || parsed.hostname.endsWith('.discordapp.com');

            return isAllowedHost && /^\/api\/webhooks\/\d+\/[^/]+\/?$/.test(parsed.pathname);
        } catch (_error) {
            return false;
        }
    }

    function setStatus(message, type = '') {
        refs.status.textContent = message;
        refs.status.classList.remove('is-success', 'is-warning', 'is-error');

        if (type) {
            refs.status.classList.add(type);
        }
    }

    function updateSummary() {
        refs.summary.textContent = state.autoRelayEnabled && state.activeWebhookUrl
            ? 'Discord 自动转发：已启用'
            : 'Discord 自动转发：未启用';
    }

    function openModal() {
        refs.modal.classList.add('is-open');
        refs.modal.setAttribute('aria-hidden', 'false');
    }

    function closeModal() {
        refs.modal.classList.remove('is-open');
        refs.modal.setAttribute('aria-hidden', 'true');
    }

    function clearRelayState() {
        state.relayQueue = Promise.resolve();
        state.relayedMessages = new Map();
    }

    function abortAllRequests(reason = '') {
        const normalizedReason = typeof reason === 'string' ? reason.trim() : '';

        state.abortReason = normalizedReason;
        state.requestControllers.forEach(controller => controller.abort(normalizedReason || 'Discord 请求已取消'));
        state.requestControllers.clear();
    }

    function getAbortMessage(controller, fallback = 'Discord 请求已取消') {
        const signalReason = controller?.signal?.reason;

        if (typeof signalReason === 'string' && signalReason.trim()) {
            return signalReason.trim();
        }

        if (signalReason instanceof Error && signalReason.message) {
            return signalReason.message;
        }

        if (state.abortReason) {
            return state.abortReason;
        }

        return fallback;
    }

    function isStoppedMessage(message) {
        return typeof message === 'string'
            && (message.includes('已停止') || message.includes('已取消') || message.includes('已清除 Webhook URL'));
    }

    function updateVisibilityButton() {
        const label = state.visible ? '隐藏' : '显示';
        const tooltip = state.visible ? '隐藏 Discord Webhook 地址' : '显示 Discord Webhook 地址';

        refs.webhookUrlInput.type = state.visible ? 'text' : 'password';
        refs.visibilityBtn.textContent = label;
        refs.visibilityBtn.classList.toggle('is-active', state.visible);
        refs.visibilityBtn.setAttribute('title', tooltip);
        refs.visibilityBtn.setAttribute('aria-label', tooltip);
        refs.visibilityBtn.setAttribute('aria-pressed', String(state.visible));
    }

    function updateBulkButton() {
        const isDisabled = state.sending;
        let label = '发送100条消息';
        let tooltip = '按时间顺序发送当前已加载的 100 条消息';

        if (state.sending) {
            label = '批量发送中...';
            tooltip = '正在按时间顺序批量发送当前消息';
        } else if (state.bulkConfirmPending) {
            label = '你确定吗？';
            tooltip = '再次点击后才会发送当前已加载的 100 条消息';
        }

        refs.sendBulkBtn.disabled = isDisabled;
        refs.sendBulkBtn.textContent = label;
        refs.sendBulkBtn.classList.toggle('is-active', state.bulkConfirmPending);
        refs.sendBulkBtn.setAttribute('title', tooltip);
        refs.sendBulkBtn.setAttribute('aria-label', tooltip);
    }

    function updateSendButton() {
        refs.sendBtn.disabled = state.sending;
        refs.fillBtn.disabled = state.sending;
        refs.visibilityBtn.disabled = state.sending;
        refs.clearBtn.disabled = false;
        refs.sendBtn.textContent = state.sending ? '发送中...' : '立即测试发送';
        updateBulkButton();
    }

    function clearBulkConfirmTimer() {
        if (state.bulkConfirmTimer) {
            window.clearTimeout(state.bulkConfirmTimer);
            state.bulkConfirmTimer = null;
        }
    }

    function resetBulkButton() {
        state.bulkConfirmPending = false;
        clearBulkConfirmTimer();
        updateBulkButton();
    }

    function deactivateAutoRelay(message = 'Discord 自动转发：未启用', { abortReason = '' } = {}) {
        state.activeWebhookUrl = '';
        state.autoRelayEnabled = false;
        abortAllRequests(abortReason);
        clearRelayState();
        resetBulkButton();
        updateSummary();
        setStatus(message);
    }

    function activateAutoRelay(rawUrl, { sendLatestNow = true } = {}) {
        const trimmedUrl = rawUrl.trim();
        const hasChanged = trimmedUrl !== state.activeWebhookUrl;

        state.activeWebhookUrl = trimmedUrl;
        state.autoRelayEnabled = true;

        if (hasChanged) {
            clearRelayState();
            setStatus('Discord 调试：已启用自动转发，将从当前最新消息开始。', 'is-success');
            if (sendLatestNow) {
                void ensureLatestItemRelayed();
            }
        } else {
            setStatus('Discord 调试：自动转发已启用。');
        }

        updateSummary();
    }

    function handleWebhookUrlInput() {
        const rawUrl = refs.webhookUrlInput.value.trim();

        if (!rawUrl) {
            deactivateAutoRelay('Discord 调试：未配置 Webhook URL。');
            return;
        }

        if (!isValidDiscordWebhookUrl(rawUrl)) {
            state.activeWebhookUrl = '';
            state.autoRelayEnabled = false;
            clearRelayState();
            updateSummary();
            setStatus('Discord 调试：Webhook URL 还不是完整有效格式。', 'is-warning');
            return;
        }

        activateAutoRelay(rawUrl);
    }

    function clearWebhookUrl() {
        refs.webhookUrlInput.value = '';
        deactivateAutoRelay('Discord 调试：已清除 Webhook URL，并停止自动转发。', {
            abortReason: '已清除 Webhook URL，当前发送已停止。'
        });
        refs.webhookUrlInput.focus();
    }

    function formatEmphasisBlock(text) {
        if (typeof text !== 'string' || text.trim() === '') {
            return '';
        }

        return text
            .split('\n')
            .map(line => {
                const trimmedLine = line.trim();
                return trimmedLine ? `**${trimmedLine}**` : '';
            })
            .join('\n');
    }

    function buildRelayMessage(item) {
        if (!item) {
            return '';
        }

        const { formatTime, extractHeadlineParts, extractTrailingSource, truncateText } = core.buildRelayContext(item);
        const tagNames = Array.isArray(item.tag)
            ? item.tag.map(tag => tag?.name).filter(Boolean).join(' / ')
            : '';
        const isFocusItem = Array.isArray(item.tag)
            && item.tag.some(tag => String(tag?.id) === '9' || String(tag?.name || '').trim() === '焦点');
        const originalText = typeof item.rich_text === 'string' ? item.rich_text.trim() : '';
        const headlineParts = extractHeadlineParts(originalText);
        const sourceParts = extractTrailingSource(headlineParts.body || originalText);
        const title = headlineParts.title.trim();
        const body = sourceParts.body.trim();
        const metadataLine = `-# ID: ${item.id || '-'} 时间: ${formatTime(item.create_time)} 标签: ${tagNames || '无'}`;
        const dividerLine = '------------------------------';
        const bodyText = body || (!title && originalText ? originalText : '');
        const contentLines = [];

        if (title) {
            contentLines.push(isFocusItem ? `### **${title}**` : `### ${title}`);
        }

        if (bodyText) {
            contentLines.push(isFocusItem ? formatEmphasisBlock(bodyText) : bodyText);
        }

        contentLines.push(metadataLine);
        return truncateText(`\u200b\n${dividerLine}\n\n${contentLines.join('\n')}`, 2000);
    }

    async function requestDelivery({ webhookUrl, content, username = '', messageId = '' }) {
        const controller = new AbortController();
        state.requestControllers.add(controller);

        try {
            const response = await fetch('/api/discord-webhook', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ webhookUrl, content, username, messageId }),
                signal: controller.signal
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.ok) {
                throw new Error(result.message || `HTTP ${response.status}`);
            }

            return result;
        } catch (error) {
            if (controller.signal.aborted || error?.name === 'AbortError') {
                throw new Error(getAbortMessage(controller));
            }

            throw error;
        } finally {
            state.requestControllers.delete(controller);
            if (state.requestControllers.size === 0) {
                state.abortReason = '';
            }
        }
    }

    function enqueueRelayTask(task) {
        state.relayQueue = state.relayQueue
            .catch(() => undefined)
            .then(task);

        return state.relayQueue;
    }

    async function relayItem(item, { forceCreate = false } = {}) {
        if (!state.autoRelayEnabled || !state.activeWebhookUrl || !item) {
            return;
        }

        const itemId = Number(item.id);
        if (!Number.isFinite(itemId)) {
            return;
        }

        const nextContent = buildRelayMessage(item);
        const existingRecord = state.relayedMessages.get(itemId);

        if (!forceCreate && existingRecord) {
            if (existingRecord.content === nextContent) {
                return;
            }

            const result = await requestDelivery({
                webhookUrl: state.activeWebhookUrl,
                content: nextContent,
                messageId: existingRecord.messageId
            });

            state.relayedMessages.set(itemId, {
                messageId: result.messageId || existingRecord.messageId,
                content: nextContent
            });
            updateSummary();
            setStatus(`Discord 调试：已更新 Discord 消息，新闻 ID ${itemId}。`, 'is-success');
            return;
        }

        const result = await requestDelivery({
            webhookUrl: state.activeWebhookUrl,
            content: nextContent,
            username: refs.usernameInput.value.trim()
        });

        if (result.messageId) {
            state.relayedMessages.set(itemId, {
                messageId: result.messageId,
                content: nextContent
            });
        }

        updateSummary();
        setStatus(`Discord 调试：已转发最新消息，新闻 ID ${itemId}。`, 'is-success');
    }

    async function ensureLatestItemRelayed() {
        if (!state.autoRelayEnabled || !state.activeWebhookUrl) {
            return;
        }

        const latestItem = core.getCurrentPrimaryItem();
        if (!latestItem) {
            return;
        }

        await enqueueRelayTask(() => relayItem(latestItem));
    }

    function queueRelaySync({ addedItems = [], updatedItems = [], mode = 'prepend' } = {}) {
        if (!state.autoRelayEnabled || !state.activeWebhookUrl || mode !== 'prepend') {
            return;
        }

        const addedQueue = [...addedItems]
            .filter(item => !state.relayedMessages.has(Number(item.id)))
            .sort((left, right) => Number(left.id) - Number(right.id));

        const updatedQueue = updatedItems
            .filter(item => state.relayedMessages.has(Number(item.id)));

        if (addedQueue.length === 0 && updatedQueue.length === 0) {
            return;
        }

        enqueueRelayTask(async () => {
            for (const item of addedQueue) {
                await relayItem(item, { forceCreate: true });
            }

            for (const item of updatedQueue) {
                await relayItem(item);
            }
        });
    }

    function fillFromCurrentItem() {
        const item = core.getCurrentPrimaryItem();
        if (!item) {
            setStatus('Discord 调试：当前没有可填入的新闻。', 'is-warning');
            return;
        }

        refs.contentInput.value = buildRelayMessage(item);
        setStatus(`Discord 调试：已填入当前首条新闻（ID ${item.id}）。`);
    }

    async function sendDebugMessage() {
        const webhookUrl = refs.webhookUrlInput.value.trim();
        const content = refs.contentInput.value.trim();
        const username = refs.usernameInput.value.trim();

        if (!webhookUrl) {
            setStatus('Discord 调试：请先输入 Discord Webhook URL。', 'is-error');
            refs.webhookUrlInput.focus();
            return;
        }

        if (!content) {
            setStatus('Discord 调试：请先输入测试消息，或点击“填入当前首条”。', 'is-warning');
            refs.contentInput.focus();
            return;
        }

        if (!isValidDiscordWebhookUrl(webhookUrl)) {
            setStatus('Discord 调试：请先输入有效的 Discord Webhook URL。', 'is-error');
            refs.webhookUrlInput.focus();
            return;
        }

        try {
            state.sending = true;
            updateSendButton();
            setStatus('Discord 调试：正在通过本地代理发送消息...', 'is-warning');

            const result = await requestDelivery({ webhookUrl, content, username });
            const messageIdText = result.messageId ? `，消息 ID：${result.messageId}` : '';
            setStatus(`Discord 调试：发送成功${messageIdText}`, 'is-success');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (isStoppedMessage(message)) {
                setStatus(`Discord 调试：${message}`, 'is-warning');
            } else {
                setStatus(`Discord 调试：发送失败，${message}`, 'is-error');
            }
        } finally {
            state.sending = false;
            updateSendButton();
        }
    }

    async function sendCurrentHundred() {
        const webhookUrl = refs.webhookUrlInput.value.trim();
        const username = refs.usernameInput.value.trim();
        const batchItems = core.getCurrentBulkItems(100);

        if (!webhookUrl) {
            setStatus('Discord 调试：请先输入 Discord Webhook URL。', 'is-error');
            refs.webhookUrlInput.focus();
            return;
        }

        if (!isValidDiscordWebhookUrl(webhookUrl)) {
            setStatus('Discord 调试：请先输入有效的 Discord Webhook URL。', 'is-error');
            refs.webhookUrlInput.focus();
            return;
        }

        if (batchItems.length === 0) {
            setStatus('Discord 调试：当前没有可批量发送的消息。', 'is-warning');
            return;
        }

        activateAutoRelay(webhookUrl, { sendLatestNow: false });

        try {
            state.sending = true;
            updateSendButton();
            setStatus(`Discord 调试：正在按时间顺序发送 ${batchItems.length} 条消息...`, 'is-warning');

            await enqueueRelayTask(async () => {
                let sentCount = 0;

                for (const item of batchItems) {
                    if (!state.autoRelayEnabled || state.activeWebhookUrl !== webhookUrl) {
                        break;
                    }

                    const existingRecord = state.relayedMessages.get(Number(item.id));
                    if (existingRecord) {
                        continue;
                    }

                    const result = await requestDelivery({
                        webhookUrl,
                        content: buildRelayMessage(item),
                        username
                    });

                    if (result.messageId) {
                        state.relayedMessages.set(Number(item.id), {
                            messageId: result.messageId,
                            content: buildRelayMessage(item)
                        });
                    }

                    sentCount += 1;
                    setStatus(`Discord 调试：批量发送中 ${sentCount}/${batchItems.length}...`, 'is-warning');
                }
            });

            updateSummary();
            setStatus(`Discord 调试：已完成批量发送，共处理 ${batchItems.length} 条消息。`, 'is-success');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (isStoppedMessage(message)) {
                setStatus(`Discord 调试：已停止批量发送，${message}`, 'is-warning');
            } else {
                setStatus(`Discord 调试：批量发送失败，${message}`, 'is-error');
            }
        } finally {
            state.sending = false;
            resetBulkButton();
            updateSendButton();
        }
    }

    function handleBulkSendClick() {
        if (state.sending) {
            return;
        }

        if (!state.bulkConfirmPending) {
            state.bulkConfirmPending = true;
            updateBulkButton();
            setStatus('Discord 调试：再次点击“你确定吗？”后，才会发送当前已加载的 100 条消息。', 'is-warning');
            clearBulkConfirmTimer();
            state.bulkConfirmTimer = window.setTimeout(() => {
                resetBulkButton();
            }, 6000);
            return;
        }

        void sendCurrentHundred();
    }

    function bindEvents() {
        refs.openBtn.addEventListener('click', openModal);
        refs.modalBackdrop.addEventListener('click', closeModal);
        refs.modalClose.addEventListener('click', closeModal);
        refs.webhookUrlInput.addEventListener('input', handleWebhookUrlInput);
        refs.webhookUrlInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleWebhookUrlInput();
            }
        });
        refs.visibilityBtn.addEventListener('click', () => {
            state.visible = !state.visible;
            updateVisibilityButton();
        });
        refs.clearBtn.addEventListener('click', clearWebhookUrl);
        refs.fillBtn.addEventListener('click', fillFromCurrentItem);
        refs.sendBtn.addEventListener('click', sendDebugMessage);
        refs.sendBulkBtn.addEventListener('click', handleBulkSendClick);

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && refs.modal.classList.contains('is-open')) {
                closeModal();
            }
        });
    }

    bindEvents();
    updateSummary();
    updateVisibilityButton();
    updateSendButton();

    core.onLatestFeedReady(() => {
        if (state.autoRelayEnabled) {
            void ensureLatestItemRelayed();
        }
    });

    core.onFeedItemsSynced(payload => {
        queueRelaySync(payload);
    });

    return {
        destroy() {
            deactivateAutoRelay('Discord 自动转发：未启用');
            mounts.developerFeatureMount.innerHTML = '';
            mounts.featureModalMount.innerHTML = '';
        }
    };
}
