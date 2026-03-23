class APIClient {
    constructor(state, uiManager) {
        this.state = state;
        this.uiManager = uiManager;
    }

    async startProcessing(navigateTo) {
        const btn = document.getElementById('processBtn');
        const overlay = document.getElementById('processingOverlay');
        const statusText = document.getElementById('processStatus');
        const subText = document.querySelector('.process-sub');
        const progressBar = document.getElementById('progressBar');
        const mainContainer = document.getElementById('mainContainer');

        overlay.classList.add('visible');
        mainContainer.style.opacity = '0';
        btn.disabled = true;
        progressBar.style.width = '5%';

        try {
            let formData = new FormData();
            formData.append('inputType', this.state.inputType);

            if (this.state.inputType === 'text') {
                const textarea = document.querySelector('#uploadArea textarea');
                if (textarea && textarea.value.trim()) {
                    formData.append('text', textarea.value.trim());
                } else {
                    throw new Error("No text provided.");
                }
            } else if (this.state.inputType === 'live' || this.state.inputType === 'voice') {
                if (this.state.selectedFile) {
                    formData.append('file', this.state.selectedFile);
                } else {
                    throw new Error("No audio or file provided.");
                }
            }

            // Simulate Steps
            statusText.innerText = "Extracting Keynotes...";
            subText.innerText = "Processing (1/3)";
            await new Promise(resolve => setTimeout(resolve, 500));
            progressBar.style.width = '33%';

            statusText.innerText = "Generating Detailed Text...";
            subText.innerText = "Processing (2/3)";
            await new Promise(resolve => setTimeout(resolve, 500));
            progressBar.style.width = '66%';

            statusText.innerText = "Constructing Memory Maps...";
            subText.innerText = "Processing (3/3)";

            const response = await fetch(`${APP_CONFIG.baseUrl}/${APP_CONFIG.apiEndpoint}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`API failed with status ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            progressBar.style.width = '100%';

            this.state.analysisResult = data.analysis;
            this.state.graphData = data.graph || { nodes: [], edges: [] };

            this.uiManager.renderResults();

            setTimeout(() => {
                overlay.classList.remove('visible');
                btn.disabled = false;
                navigateTo('result-view');
                setTimeout(() => { mainContainer.style.opacity = '1'; }, 50);
            }, 800);

        } catch (error) {
            console.error("API Error:", error);
            alert("Connection failed: " + error.message + ". Ensure the FastAPI backend is running.");
            overlay.classList.remove('visible');
            mainContainer.style.opacity = '1';
            btn.disabled = false;
        }
    }
}
