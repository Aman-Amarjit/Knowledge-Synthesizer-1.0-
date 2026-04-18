# Knowledge Synthesizer ≡ƒºá

**Knowledge Synthesizer** is a high-performance "Deeptech" application designed to transform unstructured discussions, classroom debates, and complex data into structured, interactive visual maps.

Built with a focus on education and research, it leverages AI to identify key arguments, extract consensus, and visualize the evolution of ideas.

---

## ≡ƒÜÇ Getting Started

### 1. Prerequisites
- **Python 3.10+**
- **FFmpeg**: Required for audio processing and transcription.
    - [Download FFmpeg](https://ffmpeg.org/download.html) and add the `bin` folder to your System PATH.
- **Tesseract OCR** (Optional): For processing whiteboard images.

### 2. Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure environment variables in `.env` (refer to `.env.example`).
4. Run the server:
   ```bash
   python main.py
   ```

### 3. Frontend Setup
The frontend is built with pure HTML/JS for zero-config deployment.
1. Simply open `frontend/index.html` in your browser.
2. Ensure the backend is running to enable AI features.

---

## ≡ƒö¿ Key Features

### 1. Audio Intelligence (Live & Upload)
- **Automatic Speaker Diarization**: Detects different voices during a live roundtable.
- **Noise Reduction**: Cleans audio before processing.
- **Fast Transcription**: Converts speech to text in real-time.

### 2. Knowledge Synthesizer (The Engine)
- **Key Point Extraction**: Identifies the core logic of a discussion.
- **Smart Tagging**: Categorizes insights using NLP.
- **Decision Replay**: An animated walkthrough of how the discussion unfolded.

### 3. Interactive Knowledge Graph
- **Dynamic Mapping**: Visualizes concepts as nodes and relationships as edges.
- **Theme Support**: Seamlessly switch between **Intellectual Tech** (Light) and **Deeptech Neural** (Dark) modes.

### 4. Fact-Check Pipeline
- **Auto-Verification**: Cross-references claims against external logic using the Integrated Fact-Checker.
- **Evidence Retrieval**: Provides context and "gray zone" detection for ambiguous claims.

---

## ≡ƒæü premium User Experience

### Animated Scrolling
The landing page uses the **Lenis** inertia engine for smooth momentum-based scrolling. Elements reveal themselves with cinematic blur-fades as you navigate.

### Dual-Theme Architecture
Toggle between the high-contrast Light mode and the immersive Dark mode using the floating icon.

---

## ≡ƒæ⌐≡ƒæ╗ Technology Stack
- **Frontend**: Vanilla JS, D3-like Graphing, CSS3 Grid/Flex, FontAwesome.
- **Backend**: FastAPI, Uvicorn, SpeechRecognition, Pydub, TextBlob, Deep Translator.
- **AI/LLM**: Support for **Together.ai** and local **Ollama** (Llama3) for advanced reasoning.

---

## ≡ƒôö Documentation & Support
For advanced configuration of the Fact-Checker or Graph Engine, please refer to the `src/` directory within the backend.
