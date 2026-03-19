class NavigationController {
    constructor(graphRenderer) {
        this.main = document.getElementById('mainContainer');
        this.graphRenderer = graphRenderer;
    }

    navigateTo(targetId) {
        if (document.getElementById(targetId).classList.contains('is-active')) return;

        const overlay = document.getElementById('origami-overlay');
        overlay.classList.add('active');
        this.main.classList.add('content-hidden');

        setTimeout(() => {
            // Switch views when bird is centered (approx 0.8s into 1.8s animation)
            document.querySelectorAll('.page-view').forEach(v => v.classList.remove('is-active'));
            const nextView = document.getElementById(targetId);
            nextView.classList.add('is-active');
            
            this.main.classList.remove('content-hidden');

            if (targetId === 'result-view') {
                setTimeout(() => this.graphRenderer.init(window.appState.graphData), 300);
            }
        }, 800);

        setTimeout(() => {
            overlay.classList.remove('active');
        }, 1900); // 1.8s animation + small buffer
    }
}
