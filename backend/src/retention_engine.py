import re
import random
from typing import List, Dict, Any
from datetime import datetime, timedelta
from textblob import TextBlob

class RetentionEngine:
    """
    Handles Phase 3 Retention features: Flashcards, ELI5, 
    Active Recall Quizzes, and Knowledge Gaps.
    """

    def __init__(self):
        # Spaced repetition intervals (in days)
        self.intervals = [1, 7, 30]

    def generate_flashcards(self, text: str) -> List[Dict[str, str]]:
        """Creates front/back study cards based on noun phrases and facts."""
        blob = TextBlob(text)
        cards = []
        
        # Extract meaningful noun phrases
        phrases = [np for np in blob.noun_phrases if len(np.split()) >= 1]
        
        for phrase in list(set(phrases))[:10]:
            # Find a sentence containing this phrase to provide context
            context_sentence = ""
            for sent in blob.sentences:
                if phrase.lower() in str(sent).lower():
                    context_sentence = str(sent)
                    break
            
            if context_sentence:
                cards.append({
                    "front": f"What is the significance of '{phrase.title()}' in this context?",
                    "back": context_sentence,
                    "type": "concept"
                })
        
        return cards

    def generate_eli5(self, text: str) -> str:
        """Converts complex text into simpler language using basic linguistic rules."""
        blob = TextBlob(text)
        simple_sentences = []
        
        for sent in blob.sentences:
            words = sent.words
            # Simpler heuristic: If sentence is long, extract the core S-V-O if possible
            # For now, we'll just take the first half and prepend a simplifying prefix
            if len(words) > 15:
                # Instead of truncating mid-sentence, we'll keep the full sentence 
                # but ensure we only take the most significant ones.
                simple_sentences.append(f"In simple terms: {sent}")
            else:
                simple_sentences.append(str(sent))
                
        # Return up to 2 meaningful simplified sentences
        return " ".join(simple_sentences[:2]).strip()

    def create_active_recall_quiz(self, text: str) -> List[Dict[str, Any]]:
        """Generates short questions based on key insights."""
        blob = TextBlob(text)
        quiz = []
        
        # Identify key sentences (punchlines)
        sentences = sorted(blob.sentences, key=lambda s: s.sentiment.subjectivity, reverse=True)
        
        for sent in sentences[:5]:
            sent_str = str(sent)
            words = sent_str.split()
            # Only process reasonably long sentences to avoid trivial questions
            if len(words) > 10:
                # Find the longest word that isn't a common stopword (basic filter)
                candidates = [w for w in words if len(w) > 5 and w.lower() not in ['because', 'however', 'therefore']]
                if not candidates:
                    continue
                    
                target_word = max(candidates, key=len)
                # Ensure we only replace whole words
                question = re.sub(rf'\b{re.escape(target_word)}\b', "__________", sent_str, flags=re.IGNORECASE)
                
                quiz.append({
                    "question": f"Complete the thought: {question}",
                    "answer": target_word
                })
                
        return quiz

    def detect_knowledge_gaps(self, user_notes: str, transcript: str) -> List[str]:
        """Compares user notes against the full transcript to find missed topics."""
        user_blob = TextBlob(user_notes.lower())
        transcript_blob = TextBlob(transcript.lower())
        
        user_concepts = set(user_blob.noun_phrases)
        transcript_concepts = set(transcript_blob.noun_phrases)
        
        # Concepts in transcript but NOT in user notes
        missed = transcript_concepts - user_concepts
        
        # Filter for significant misses (longer phrases)
        significant_misses = [m.title() for m in missed if len(m.split()) > 1]
        return significant_misses[:5]

    def get_spaced_repetition_schedule(self, session_date: datetime = None) -> List[Dict[str, Any]]:
        """Calculates review dates for the 1-7-30 day rule."""
        if not session_date:
            session_date = datetime.now()
            
        schedule = []
        for days in self.intervals:
            review_date = session_date + timedelta(days=days)
            schedule.append({
                "interval": f"{days} Day",
                "date": review_date.strftime("%Y-%m-%d"),
                "remind": True
            })
        return schedule

    def format_confused_request(self, snippet: str, timestamp: str) -> str:
        """Formats a help request for the AI Tutor based on a 'Confused' marker."""
        return (f"Teacher, I was confused by this part at {timestamp}: "
                f"'{snippet}'. Could you explain this using an analogy?")

    def calculate_streak(self, login_days: List[str]) -> int:
        """Calculates gamified streak based on consecutive daily reviews."""
        if not login_days:
            return 0
            
        # Convert strings to date objects and sort
        dates = sorted([datetime.strptime(d, "%Y-%m-%d").date() for d in login_days], reverse=True)
        
        streak = 0
        current_check = datetime.now().date()
        
        for date in dates:
            if date == current_check:
                streak += 1
                current_check -= timedelta(days=1)
            else:
                break
        return streak
