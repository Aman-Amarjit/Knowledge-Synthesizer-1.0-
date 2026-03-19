

class KnowledgeSynthesizerApp {
    constructor() {
        window.appState = { ...INITIAL_STATE };
        this.graphRenderer = new GraphRenderer('knowledgeGraph');
        this.uiManager = new UIManager(window.appState, this.graphRenderer);
        this.navigation = new NavigationController(this.graphRenderer);
        this.apiClient = new APIClient(window.appState, this.uiManager);
    }

    init() {
        this.uiManager.removePreloader();
        this.exposeGlobals();
    }

    exposeGlobals() {
        // Expose uiManager for inline handlers (like Study Mode toggle)
        window.uiManager = this.uiManager;

        // Theme
        window.toggleTheme = () => this.uiManager.toggleTheme();

        // Navigation
        window.navigateTo = (id) => this.navigation.navigateTo(id);

        // Input Options
        window.selectOption = (el, group, value) => this.uiManager.selectOption(el, group, value);

        // File/Upload Area
        window.triggerFileUpload = () => {
             if (window.appState.inputType === 'live') {
                window.appState.isRecording = !window.appState.isRecording;
                const uploadArea = document.getElementById('uploadArea');
                uploadArea.classList.toggle('recording', window.appState.isRecording);
                document.getElementById('uploadText').innerText = window.appState.isRecording ? 
                    "Recording in progress... (Click to Stop)" : "Recording stopped. Ready to Execute.";
            } else {
                document.getElementById('fileInput').click();
            }
        };

        window.handleFileSelect = (input) => this.uiManager.handleFileSelect(input);

        // Processing
        window.startProcessing = () => this.apiClient.startProcessing(id => this.navigation.navigateTo(id));
    }
}

const App = new KnowledgeSynthesizerApp();
window.onload = () => App.init();
