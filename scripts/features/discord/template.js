export function createDiscordFeaturePanelMarkup() {
    return `
        <div class="developer-panel__section" data-feature="discord">
            <button class="refresh-btn toggle-btn developer-panel__section-toggle" id="discordDebugOpenBtn" type="button" title="打开 Discord 调试窗口" aria-label="打开 Discord 调试窗口">
                Discord 调试窗口 <i class="fas fa-up-right-from-square"></i>
            </button>
            <div class="developer-panel__hint" id="discordRelaySummary">Discord 自动转发：未启用</div>
        </div>
    `;
}

export function createDiscordFeatureModalMarkup() {
    return `
        <div class="attr-modal" id="discordDebugModal" aria-hidden="true">
            <div class="attr-modal__backdrop" id="discordDebugModalBackdrop"></div>
            <div class="attr-modal__content" role="dialog" aria-modal="true" aria-labelledby="discordDebugModalTitle">
                <div class="attr-modal__header">
                    <h3 id="discordDebugModalTitle">Discord 调试</h3>
                    <button class="attr-modal__close" id="discordDebugModalClose" aria-label="Close">×</button>
                </div>
                <div class="attr-modal__body">
                    <div class="attr-section">
                        <div class="developer-panel__hint">
                            手动填入有效 Webhook URL 后，会自动开始转发最新消息；如果这条消息后续被接口更新，系统也会尝试同步编辑已发送消息。Webhook 地址只保留在当前页面内存里。
                        </div>
                    </div>
                    <div class="attr-section">
                        <div class="discord-debug-grid">
                            <div class="developer-panel__field developer-panel__field--wide">
                                <label class="developer-panel__label" for="discordWebhookUrlInput">Discord Webhook URL</label>
                                <div class="discord-webhook-url-row">
                                    <input type="password" id="discordWebhookUrlInput" placeholder="https://discord.com/api/webhooks/..." autocomplete="off" spellcheck="false" aria-label="Discord Webhook URL">
                                    <button class="refresh-btn toggle-btn" id="discordWebhookVisibilityBtn" type="button" title="显示 Discord Webhook 地址" aria-label="显示 Discord Webhook 地址">显示</button>
                                    <button class="refresh-btn toggle-btn" id="discordWebhookClearBtn" type="button" title="清除 Discord Webhook URL 并立即停止自动转发" aria-label="清除 Discord Webhook URL 并立即停止自动转发">清除</button>
                                </div>
                            </div>
                            <div class="developer-panel__field">
                                <label class="developer-panel__label" for="discordWebhookUsernameInput">Webhook 用户名（新消息可选）</label>
                                <input type="text" id="discordWebhookUsernameInput" maxlength="80" placeholder="例如：Sina 7x24 Relay" aria-label="Discord Webhook 用户名">
                            </div>
                            <div class="developer-panel__field developer-panel__field--wide">
                                <label class="developer-panel__label" for="discordWebhookContentInput">测试消息</label>
                                <textarea id="discordWebhookContentInput" rows="4" placeholder="输入要发送到 Discord 的测试文本，或使用下方按钮填入当前筛选首条。" aria-label="Discord Webhook 测试消息"></textarea>
                            </div>
                            <div class="discord-webhook-actions">
                                <button class="refresh-btn" id="discordWebhookFillBtn" type="button" title="把当前筛选后的首条新闻填入测试消息" aria-label="把当前筛选后的首条新闻填入测试消息">填入当前首条</button>
                                <button class="refresh-btn" id="discordWebhookSendBtn" type="button" title="立即测试发送一条 Discord 消息" aria-label="立即测试发送一条 Discord 消息">立即测试发送</button>
                                <button class="refresh-btn toggle-btn" id="discordWebhookSendBulkBtn" type="button" title="按时间顺序发送当前已加载的 100 条消息" aria-label="按时间顺序发送当前已加载的 100 条消息">发送100条消息</button>
                            </div>
                        </div>
                        <div class="discord-webhook-status" id="discordWebhookStatus">Discord 调试：未发送</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
