import { createViewerCore } from './core/viewer-core.js';
import { installDiscordFeature } from './features/discord/feature.js';

function boot() {
    const core = createViewerCore();
    const started = core.init();

    if (!started) {
        return;
    }

    installDiscordFeature(core);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
