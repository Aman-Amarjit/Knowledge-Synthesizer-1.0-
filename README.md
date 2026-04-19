# Knowledge Synthesizer ≡ƒºá
> **Executive Intelligence & Real-Time Discussion Mapping**

**Knowledge Synthesizer** is a high-performance, cinematic "Deeptech" application designed to transform unstructured discussions, classroom debates, and complex data into structured, interactive visual landscapes. 

Designed for executives, researchers, and educators, it bridges the gap between raw audio and actionable insight through advanced AI synthesis and immersive UI/UX.

---

## ≡ƒÜÇ Getting Started

### 1. Quick Launch (Windows)
Simply run the root `start.bat` file to initialize both the FastAPI backend and the frontend environment.

### 2. Manual Prerequisites
- **Python 3.10+**
- **FFmpeg**: Required for audio processing and high-fidelity transcription.
    - [Download FFmpeg](https://ffmpeg.org/download.html) and add the `bin` folder to your System PATH.
- **Tesseract OCR**: (Optional) For digitizing whiteboard captures.

### 3. Environment Configuration
Ensure your `.env` in the `backend/` directory is configured with your API keys (e.g., Together.ai, OpenAI) for the reasoning engine to function.

---

## ≡ƒö¿ Key Features & Architecture

### 1. Neural Audio Capture
- **Universal Input**: Supports **Live Microphone**, **Transcript Text**, and **Voice File** uploads.
- **Real-Time Synthesis**: Connects to high-end LLM providers (Together.ai) to extract keynotes and logic while the audio is still processing.

### 2. Executive Intelligence Dashboard
- **Dynamic Knowledge Mapping**: Visualizes discussions as interactive nodes. Identify consensus, friction points, and argument evolution at a glance.
- **Decision Replay**: An animated timeline that walks you through the "birthing" of ideas during the session.

### 3. Integrated Fact-Check Pipeline
- **Auto-Verification**: Cross-references claims against logical consistency checks.
- **Evidence Retrieval**: Highlights "Gray Zones" and provides evidence-backed reasoning for complex claims.

---

## ≡ƒæü premium UI/UX (The "Executive" Look)

### Cinematic Scramble Animations
The interface features a custom **High-Performance Scramble Engine** that reveals text with a tech-heavy, decrypted aesthetic without compromising browser performance.

### Optimized Z-Pattern Layout
The landing page follows a meticulously balanced Z-pattern, ensuring that visuals and "writings" are perfectly aligned for readability and visual impact.

### Butter-Smooth Performance
- **Lenis Inertia Engine**: Momentum-based smooth scrolling for a premium feel.
- **Native Scroll Animations**: Leverages modern CSS `view()` timelines for 60fps cinematic transitions with zero JS overhead.
- **Advanced Glassmorphism**: A state-of-the-art frosted glass UI that adapts dynamically to dark and light modes.

---

## ≡ƒæ⌐≡ƒæ╗ Technology Stack
- **Frontend**: Vanilla JS (ES6+), CSS3 (Custom Design System), FontAwesome 6, Lenis Scroll.
- **Backend**: FastAPI (Async), Uvicorn, Pydub (Audio), SpeechRecognition, TextBlob.
- **Reasoning**: Support for **Together.ai**, **Ollama** (Llama 3), and **Google Gemini** for fact-checking and synthesis.

---

## ≡ƒôö License & Support
Developed for high-stakes knowledge retention. For architectural deep-dives, explore the `backend/src/` modules including the `fact_checker` and `reasoning_engine`.
