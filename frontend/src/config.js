window.APP_CONFIG = {
    baseUrl: "http://localhost:8000",
    apiEndpoint: "http://localhost:8000/synthesize",
    mockDelay: 1500
};

window.INITIAL_STATE = {
    inputType: 'live',
    discType: 'roundtable',
    selectedFile: null,
    isRecording: false,
    graphData: { nodes: [], edges: [] },
    analysisResult: null
};
