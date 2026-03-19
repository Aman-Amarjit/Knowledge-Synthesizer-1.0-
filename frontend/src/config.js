window.APP_CONFIG = {
    baseUrl: window.location.origin,
    apiEndpoint: "/synthesize",
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
