import os
import shutil
import re
import uuid
from typing import Optional, List, Dict, Any, Tuple
from collections import Counter
from datetime import datetime

# CORE LIBRARIES
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from textblob import TextBlob
from deep_translator import GoogleTranslator
import speech_recognition as sr
from pydub import AudioSegment
from pydub.silence import split_on_silence
from pydub.effects import normalize
import uvicorn

# --- IMPORTING YOUR MODULES ---
from src.tagging import SmartTagger
from src.retention_engine import RetentionEngine
from src.visual_notes import VisualNoteManager

# --- FFMPEG AUTO-CONFIG ---
def setup_ffmpeg():
    """Locates ffmpeg binaries to ensure audio processing works on all systems."""
    if shutil.which("ffmpeg"):
        return True
    possible_paths = [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        r"C:\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe"
    ]
    for path in possible_paths:
        if os.path.exists(path):
            AudioSegment.converter = path
            AudioSegment.ffmpeg = path
            os.environ["PATH"] += os.pathsep + os.path.dirname(path)
            return True
    return False

FFMPEG_READY = setup_ffmpeg()

# ==========================================
# MODULE: AUDIO INTELLIGENCE (Transcriber)
# ==========================================
class AudioEngine:
    """Handles speech-to-text conversion with noise reduction and silence trimming."""
    def __init__(self):
        self.recognizer = sr.Recognizer()

    def transcribe(self, file_path: str) -> Tuple[str, Optional[str]]:
        """Returns (transcript, error_message)"""
        if not FFMPEG_READY:
            return "", "FFmpeg not detected. Audio processing is unavailable."

        wav_path = None
        try:
            # Load and Pre-process
            sound = AudioSegment.from_file(file_path)
            sound = normalize(sound)
            
            # Export to WAV for the recognizer
            wav_path = f"{file_path}_{uuid.uuid4().hex}.wav"
            sound.export(wav_path, format="wav")
            
            with sr.AudioFile(wav_path) as source:
                audio_data = self.recognizer.record(source)
                transcript = self.recognizer.recognize_google(audio_data)
                
            return transcript, None
        except Exception as e:
            return "", f"Transcription failed: {str(e)}"
        finally:
            # Cleanup
            if wav_path and os.path.exists(wav_path):
                try:
                    os.remove(wav_path)
                except:
                    pass

class SynthesisRequest(BaseModel):
    text: str = None
    inputType: str = "text"

class TranslationRequest(BaseModel):
    text: str
    target_lang: str

# ==========================================
# API SERVER & CORE LOGIC
# ==========================================
app = FastAPI()

# Enable CORS for frontend connectivity
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins
    allow_methods=["*"],
    allow_credentials=True,
    allow_headers=["*"],
)
# Initialize Engines
tagger = SmartTagger()
retention = RetentionEngine()
visual_manager = VisualNoteManager(storage_dir="static_visuals")
audio_engine = AudioEngine()

# Static Files for Whiteboard Snapshots
os.makedirs("static_visuals", exist_ok=True)
app.mount("/visuals", StaticFiles(directory="static_visuals"), name="visuals")

@app.post("/upload_visual")
def upload_visual(file: UploadFile = File(...), timestamp: str = Form("00:00")):
    # Use UUID to prevent collisions
    file_ext = os.path.splitext(file.filename)[1]
    tmp_path = f"temp_visual_{uuid.uuid4().hex}{file_ext}"
    
    try:
        with open(tmp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        result = visual_manager.save_and_process(tmp_path, file.filename, timestamp)
        return result
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"Visual upload failed: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "online"}

@app.post("/translate")
async def translate(request: TranslationRequest):
    try:
        translated = GoogleTranslator(source='auto', target=request.target_lang).translate(request.text)
        return {"translatedText": translated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/synthesize")
def synthesize(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    inputType: Optional[str] = Form("text")
):
    # 1. Capture Raw Content
    raw_content = ""
    if inputType in ["live", "voice"] and file:
        file_ext = os.path.splitext(file.filename)[1] or ".tmp"
        tmp_audio = f"temp_audio_{uuid.uuid4().hex}{file_ext}"
        
        try:
            with open(tmp_audio, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Real Transcription
            transcript, error = audio_engine.transcribe(tmp_audio)
            
            if error:
                raise HTTPException(status_code=422, detail=error)
            
            raw_content = transcript
        finally:
            if os.path.exists(tmp_audio):
                os.remove(tmp_audio)
    else:
        raw_content = text or ""

    if not raw_content or raw_content.strip() == "":
        raise HTTPException(status_code=400, detail="No intelligible content detected.")

    # 2. Run Tagging & Retention Engines
    tags = tagger.generate_tags(raw_content)
    flashcards = retention.generate_flashcards(raw_content)
    quiz = retention.create_active_recall_quiz(raw_content)
    schedule = retention.get_spaced_repetition_schedule()
    
    # 3. Process Linguistic Structure (Summary & Key Points)
    blob = TextBlob(raw_content)
    sentences = list(blob.sentences)
    
    # NEW: Enhanced Extraction Algorithm
    # 3.1 Extract top keywords for scoring
    keywords = [np.lower() for np in blob.noun_phrases if len(np) > 3]
    top_keywords = set([w for w, _ in Counter(keywords).most_common(10)])
    
    # 3.2 Segment-based coverage to ensure "important points" are captured from start to end
    num_segments = 4
    segment_size = max(1, len(sentences) // num_segments)
    key_points = []
    
    for i in range(num_segments):
        start = i * segment_size
        end = (i + 1) * segment_size if i < num_segments - 1 else len(sentences)
        segment = sentences[start:end]
        
        if not segment: continue
        
        # Score each sentence in segment
        scored_segment = []
        for s in segment:
            s_str = str(s)
            if len(s_str) < 30: continue # Skip trivial sentences
            
            # Scoring factors
            k_count = sum(1 for kw in top_keywords if kw in s_str.lower())
            subj = s.sentiment.subjectivity
            pol = abs(s.sentiment.polarity)
            
            score = (k_count * 3.0) + (subj * 5.0) + (pol * 2.0)
            scored_segment.append((s_str, score))
        
        # Take top 2-3 from each segment
        scored_segment.sort(key=lambda x: x[1], reverse=True)
        key_points.extend([item[0] for item in scored_segment[:3]])

    # Final Cap and Clean
    key_points = list(dict.fromkeys(key_points))[:12] # Deduplicate and cap
    if not key_points and sentences:
        key_points = [str(s) for s in sentences[:8]]

    # 4. Generate Graph Nodes
    top_concepts = [w for w, _ in Counter(keywords).most_common(6)]
    if not top_concepts: top_concepts = ["Core Discussion"]

    nodes = [{"id": 1, "type": "concept", "label": top_concepts[0].title()}]
    edges = []
    for i, concept in enumerate(top_concepts[1:], start=2):
        nodes.append({"id": i, "type": "argument", "label": concept.title()})
        edges.append({"source": 1, "target": i})
    
    # Add peripheral "Noise" nodes (dimmed in UI)
    noise_count = 3
    for i in range(len(nodes) + 1, len(nodes) + 1 + noise_count):
        nodes.append({"id": i, "type": "noise", "label": "Filtered Data"})
        edges.append({"source": 1, "target": i, "dashed": True})

    # NEW: Generate timeline data for 'Decision Replay'
    timeline = []
    chunk_size = max(1, len(sentences) // 10)
    for i in range(min(10, len(sentences) // chunk_size + 1)):
        start_idx = i * chunk_size
        end_idx = (i + 1) * chunk_size
        chunk = sentences[start_idx:end_idx]
        if not chunk: continue
        
        # Determine sentiment of this chunk
        chunk_blob = TextBlob(" ".join([str(s) for s in chunk]))
        polarity = chunk_blob.sentiment.polarity
        status = "Agreement Rising" if polarity > 0.1 else "Debate Ongoing" if polarity < -0.1 else "Neutral Exploration"
        
        timeline.append({
            "timestamp": f"{i:02d}:{(i*6)%60:02d}",
            "insight": str(chunk[0]),
            "status": status,
            "sentiment": "positive" if polarity > 0.1 else "negative" if polarity < -0.1 else "neutral"
        })

    # NEW: Generate retention data for each key point (ELI5 style)
    retention_data = []
    for point in key_points:
        # Simplify the point for the "Back" of the card
        simple = retention.generate_eli5(point)
        # Robust fallback: if simple is same as point or too short, use a themed prompt
        if not simple or len(simple) < 20 or simple.strip() == point.strip():
            retention_data.append(f"Strategic context: This point emphasizes the core logic of {point[:30]}... Examine how it connects to the broader synthesis.")
        else:
            retention_data.append(simple)
    
    # Ensure they are the same length
    retention_data = retention_data[:len(key_points)]

    return {
        "analysis": {
            "summary": str(blob.sentences[0]) if blob.sentences else "Discussion synthesized.",
            "keyNodes": key_points if key_points else [raw_content[:100] + "..."],
            "tags": tags,
            "retention_data": retention_data,
            "timeline": timeline,
            "retention": {
                "flashcards": flashcards,
                "quiz": quiz,
                "schedule": schedule
            }
        },
        "graph": {
            "nodes": nodes,
            "edges": edges
        }
    }

# Mount the frontend directory at the root last to avoid shadowing API routes
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
