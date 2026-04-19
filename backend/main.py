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
import httpx

# --- IMPORTING YOUR MODULES ---
from src.tagging import SmartTagger
from src.retention_engine import RetentionEngine
from src.visual_notes import VisualNoteManager
from src.fact_checker import FactCheckPipeline

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

# --- NLTK ENSURE CORPORA (fix for verify endpoint) ---
import nltk
for _corpus in ['punkt', 'averaged_perceptron_tagger', 'averaged_perceptron_tagger_eng', 'brown', 'wordnet']:
    try:
        nltk.download(_corpus, quiet=True)
    except Exception:
        pass

# ==========================================
# MODULE: AUDIO INTELLIGENCE (Transcriber)
# ==========================================
class AudioEngine:
    """Handles speech-to-text conversion with noise reduction and silence trimming."""
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.energy_threshold = 300
        self.recognizer.pause_threshold = 0.8

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
    nodes: Optional[List[str]] = []
    retention_data: Optional[List[str]] = []

class VerifyRequest(BaseModel):
    text: str

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
fact_checker = FactCheckPipeline()

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
        # Avoid crashes on empty input
        if not request.text or request.text.strip() == "":
             return {"translatedText": "", "translatedNodes": [], "translatedRetention": []}

        translator = GoogleTranslator(source='auto', target=request.target_lang)
        
        # Translate main summary with fallback
        try:
            translated_text = translator.translate(request.text) or request.text
        except:
            translated_text = request.text
        
        # Translate nodes if provided
        translated_nodes = []
        if request.nodes:
            for node in request.nodes:
                try:
                    translated_nodes.append(translator.translate(node) or node)
                except:
                    translated_nodes.append(node)
                    
        # Translate retention data if provided
        translated_retention = []
        if request.retention_data:
            for ret in request.retention_data:
                try:
                    translated_retention.append(translator.translate(ret) or ret)
                except:
                    translated_retention.append(ret)
        
        return {
            "translatedText": translated_text,
            "translatedNodes": translated_nodes,
            "translatedRetention": translated_retention
        }
    except Exception as e:
        print(f"Translation logic error: {str(e)}")
        # Partial success: Return original text instead of error
        return {
            "translatedText": request.text, 
            "translatedNodes": request.nodes or [],
            "translatedRetention": getattr(request, "retention_data", []) or []
        }

@app.post("/verify")
async def verify_insight(request: VerifyRequest):
    try:
        results = await fact_checker.run(request.text)
        return results
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"verified": False, "evidence": f"Verification failed: {str(e)}", "topic": "Error", "gray_zone": True}

@app.post("/synthesize")
def synthesize(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    inputType: Optional[str] = Form("text")
):
    print(f"[INFO] Synthesis started. Input Type: {inputType}")
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
        print("[ERROR] No content detected.")
        raise HTTPException(status_code=400, detail="No intelligible content detected.")

    print(f"[INFO] Content captured ({len(raw_content)} chars). Running analysis...")

    # --- SPEAKER DIARIZATION: Parse labeled transcript ---
    speaker_pattern = re.compile(r'^(Speaker\s+\d+)\s*:\s*', re.MULTILINE)
    is_debated_transcript = bool(speaker_pattern.search(raw_content))
    speaker_turns = []
    if is_debated_transcript:
        for match in speaker_pattern.finditer(raw_content):
            start = match.end()
            next_match = speaker_pattern.search(raw_content, start)
            end = next_match.start() if next_match else len(raw_content)
            speaker_label = match.group(1)
            content = raw_content[start:end].strip()
            if content:
                speaker_turns.append({"speaker": speaker_label, "text": content})

    # 2. Run Tagging & Retention Engines
    print("[INFO] Running Tagging & Retention...")
    tags = tagger.generate_tags(raw_content)
    flashcards = retention.generate_flashcards(raw_content)
    quiz = retention.create_active_recall_quiz(raw_content)
    schedule = retention.get_spaced_repetition_schedule()
    
    # 3. Process Linguistic Structure (Summary & Key Points)
    print("[INFO] Processing Linguistic Structure...")
    blob = TextBlob(raw_content)
    sentences = list(blob.sentences)
    
    # NEW: Handle unpunctuated transcripts (e.g. from live voice)
    if len(sentences) == 1 and len(raw_content.split()) > 15:
        words = raw_content.split()
        chunk_size = 12
        sentences = [" ".join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)]
    
    # Ensure sentences are list of strings for downstream logic
    sentences = [str(s) for s in sentences]

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
        for s_str in segment:
            if len(s_str) < 30: continue # Skip trivial sentences
            
            # Scoring factors
            k_count = sum(1 for kw in top_keywords if kw in s_str.lower())
            
            # Re-evaluate sentiment since we converted to string earlier
            s_blob = TextBlob(s_str)
            subj = s_blob.sentiment.subjectivity
            pol = abs(s_blob.sentiment.polarity)
            
            score = (k_count * 3.0) + (subj * 5.0) + (pol * 2.0)
            scored_segment.append((s_str, score))
        
        # Take top 2-3 from each segment
        scored_segment.sort(key=lambda x: x[1], reverse=True)
        key_points.extend([item[0] for item in scored_segment[:3]])

    # Final Cap and Clean
    key_points = list(dict.fromkeys(key_points))[:12] # Deduplicate and cap
    if not key_points and sentences:
        key_points = [str(s) for s in sentences[:8]]

    # 3.3 Generate Summary
    if key_points:
        summary = " ".join(key_points[:2])
    elif sentences:
        summary = str(sentences[0])
    else:
        summary = raw_content[:200]

    # 4. Generate Sophisticated Graph (Co-occurrence Network)
    print("[INFO] Building Knowledge Graph...")
    # 4.1 Extract meaningful concepts
    concept_counts = Counter(keywords)
    top_concepts = [w.lower() for w, _ in concept_counts.most_common(10)]
    if not top_concepts: top_concepts = ["discussion"]

    nodes = []
    edges = []
    concept_to_id = {}

    # 4.2 Create Central Concept + Secondary Hubs
    for i, concept in enumerate(top_concepts, start=1):
        freq = concept_counts[concept]
        size = min(40, max(18, 18 + freq * 3))
        
        # Color group based on hierarchy and sentiment
        n_type = "concept" if i == 1 else "argument"
        
        # Detect friction points based on sentiment if available
        # Find which sentences this concept appears in
        sentiment_score = 0
        appearances = 0
        for s in sentences:
            if concept.lower() in str(s).lower():
                sentiment_score += TextBlob(str(s)).sentiment.polarity
                appearances += 1
        
        avg_sentiment = sentiment_score / appearances if appearances > 0 else 0
        if avg_sentiment < -0.1:
            n_type = "counter" # Friction Point
        elif i > 5:
            n_type = "unresolved" # Secondary Insights

        nodes.append({
            "id": i, 
            "type": n_type, 
            "label": concept.title(),
            "r": size
        })
        concept_to_id[concept] = i

    # 4.3 Detect Co-occurrence for meaningful links
    pair_weights = Counter()
    for sent in sentences:
        sent_words = set(str(sent).lower().split())
        # Find which of our top concepts are in this sentence
        present = [c for c in top_concepts if c in sent_words or any(w in c for w in sent_words)]
        
        # Link all concepts in the same sentence
        for idx, c1 in enumerate(present):
            for c2 in present[idx+1:]:
                pair_weights[tuple(sorted((c1, c2)))] += 1

    # 4.4 Build final edge list with weights
    for (c1, c2), weight in pair_weights.items():
        if c1 in concept_to_id and c2 in concept_to_id:
            edges.append({
                "source": concept_to_id[c1],
                "target": concept_to_id[c2],
                "weight": weight,
                "label": "Related" if weight < 2 else "Focus"
            })

    # 4.5 Ensure everything is at least connected to the center
    for i in range(2, len(nodes) + 1):
        if not any(e['source'] == 1 and e['target'] == i or e['source'] == i and e['target'] == 1 for e in edges):
            edges.append({"source": 1, "target": i, "weight": 1})

    # 5. Generate timeline data for 'Decision Replay'
    timeline = []
    chunk_size = max(1, len(sentences) // 10)
    for i in range(min(10, len(sentences) // chunk_size + 1)):
        start_idx = i * chunk_size
        end_idx = (i + 1) * chunk_size
        chunk = sentences[start_idx:end_idx]
        if not chunk: continue
        
        chunk_blob = TextBlob(" ".join([str(s) for s in chunk]))
        polarity = chunk_blob.sentiment.polarity
        status = "Agreement Rising" if polarity > 0.1 else "Debate Ongoing" if polarity < -0.1 else "Neutral Exploration"
        
        timeline.append({
            "timestamp": f"{i:02d}:{(i*6)%60:02d}",
            "insight": str(chunk[0]),
            "status": status,
            "sentiment": "positive" if polarity > 0.1 else "negative" if polarity < -0.1 else "neutral"
        })

    # 6. Generate retention data (ELI5 style)
    retention_data = []
    for point in key_points:
        simple = retention.generate_eli5(point)
        if not simple or len(simple) < 20 or simple.strip() == point.strip():
            retention_data.append(f"Strategic context: Core logic of {point[:30]}...")
        else:
            retention_data.append(simple)
    
    retention_data = retention_data[:len(key_points)]

    return {
        "analysis": {
            "summary": summary,
            "keyNodes": key_points if key_points else [raw_content[:100] + "..."],
            "tags": tags,
            "retention_data": retention_data,
            "timeline": timeline,
            "speaker_turns": speaker_turns,  # Populated if live debate recorded
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
    uvicorn.run(app, host="0.0.0.0", port=8005)
