

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
        window.triggerFileUpload = async () => {
            if (window.appState.inputType === 'live') {
                const uploadArea = document.getElementById('uploadArea');
                const uploadText = document.getElementById('uploadText');
                let textArea = uploadArea.querySelector('textarea');
                if (!textArea) {
                    textArea = document.createElement('textarea');
                    textArea.style.cssText = 'width:100%;height:100px;border:none;background:transparent;resize:none;color:var(--text-primary);font-family:inherit;font-size:1rem;outline:none;';
                    uploadArea.appendChild(textArea);
                }

                // --- STOP RECORDING ---
                if (window.appState.isRecording) {
                    if (window.appState.mediaRecorder && window.appState.mediaRecorder.state === 'recording') {
                        window.appState.mediaRecorder.stop();
                    }
                    if (window.appState.speechRecognition) {
                        window.appState.speechRecognition.stop();
                    }
                    if (window.appState.silenceTimer) {
                        clearInterval(window.appState.silenceTimer);
                    }
                    uploadText.innerText = 'Recording stopped. Ready to Execute.';
                    uploadArea.classList.remove('recording');
                    window.appState.isRecording = false;
                    return;
                }

                // --- START RECORDING ---
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                    // MediaRecorder for the audio file (for backend transcription as backup)
                    window.appState.audioChunks = [];
                    window.appState.mediaRecorder = new MediaRecorder(stream);
                    window.appState.mediaRecorder.ondataavailable = e => {
                        if (e.data.size > 0) window.appState.audioChunks.push(e.data);
                    };
                    window.appState.mediaRecorder.onstop = () => {
                        window.appState.audioBlob = new Blob(window.appState.audioChunks, { type: 'audio/wav' });
                        window.appState.selectedFile = new File([window.appState.audioBlob], 'live_recording.wav', { type: 'audio/wav' });
                    };
                    window.appState.mediaRecorder.start();

                    // --- SPEAKER DIARIZATION via AudioContext ---
                    const audioCtx = new AudioContext();
                    const analyser = audioCtx.createAnalyser();
                    analyser.fftSize = 256;
                    const source = audioCtx.createMediaStreamSource(stream);
                    source.connect(analyser);

                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);

                    let currentSpeaker = 1;
                    let silenceFrames = 0;
                    const SILENCE_THRESHOLD = 10;  // RMS below this = silence
                    const SILENCE_FRAMES_FOR_SWITCH = 25; // ~0.5s of silence triggers speaker switch

                    // Web Speech API for live transcription
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    let recognition = null;
                    if (SpeechRecognition) {
                        recognition = new SpeechRecognition();
                        recognition.continuous = true;
                        recognition.interimResults = false;
                        recognition.lang = 'en-US';

                        recognition.onresult = (event) => {
                            const last = event.results[event.resultIndex];
                            if (last.isFinal) {
                                const transcript = last[0].transcript.trim();
                                if (transcript) {
                                    textArea.value += `Speaker ${currentSpeaker}: ${transcript}\n`;
                                    textArea.scrollTop = textArea.scrollHeight;
                                    window.appState.inputText = textArea.value;
                                }
                            }
                        };
                        recognition.onerror = () => {};
                        recognition.start();
                        window.appState.speechRecognition = recognition;
                    } else {
                        uploadText.innerText = 'Recording (no live transcript — browser unsupported)';
                    }

                    // Silence-based speaker switch detector
                    window.appState.silenceTimer = setInterval(() => {
                        analyser.getByteFrequencyData(dataArray);
                        const rms = Math.sqrt(dataArray.reduce((s, v) => s + v * v, 0) / bufferLength);

                        if (rms < SILENCE_THRESHOLD) {
                            silenceFrames++;
                            if (silenceFrames === SILENCE_FRAMES_FOR_SWITCH) {
                                // Switch speaker on long pause
                                currentSpeaker++;
                                uploadText.innerText = `🎙️ Speaker ${currentSpeaker} detected — Recording...`;
                            }
                        } else {
                            silenceFrames = 0;
                        }
                    }, 20);

                    uploadArea.classList.add('recording');
                    uploadText.innerText = `🎙️ Speaker ${currentSpeaker} — Recording... (Click to Stop)`;
                    window.appState.isRecording = true;

                } catch (err) {
                    alert('Microphone access denied or unavailable: ' + err);
                }
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

