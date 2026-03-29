import { createViewerCore } from './core/viewer-core.js';

function boot() {
    const core = createViewerCore();
    const started = core.init();

    if (!started) {
        return;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
