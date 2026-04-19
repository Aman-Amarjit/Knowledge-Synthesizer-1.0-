class NavigationController {
    constructor(graphRenderer) {
        this.main = document.getElementById('mainContainer');
        this.graphRenderer = graphRenderer;
    }

    navigateTo(targetId) {
        const nextView = document.getElementById(targetId);
        if (nextView.classList.contains('is-active')) return;

        const overlay = document.getElementById('origami-overlay');
        overlay.classList.add('active');
        this.main.classList.add('spatial-exit');

        setTimeout(() => {
            document.querySelectorAll('.page-view').forEach(v => v.classList.remove('is-active'));
            nextView.classList.add('is-active');
            
            // Premium Reset: Always scroll to top on view change
            window.scrollTo(0, 0);
            if (window.uiManager && window.uiManager.lenis) {
                window.uiManager.lenis.scrollTo(0, { immediate: true });
            }

            this.main.classList.remove('spatial-exit');
            this.main.classList.add('spatial-enter');
            
            if (targetId === 'result-view') {
                setTimeout(() => this.graphRenderer.init(window.appState.graphData), 300);
            }
        }, 800);

        setTimeout(() => {
            overlay.classList.remove('active');
            this.main.classList.remove('spatial-enter');
        }, 1900);
    }
}
