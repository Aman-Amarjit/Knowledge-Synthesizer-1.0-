import re
from textblob import TextBlob

class ClaimExtractor:
    def __init__(self):
        self.subjective_markers = ['i think', 'probably', 'might', 'maybe', 'perhaps', 'opinion', 'believe']

    def process(self, text: str) -> dict:
        blob = TextBlob(text)
        
        # Simple heuristic extraction of the best claim sentence if multi-sentence
        best_sentence = str(blob.sentences[0]) if blob.sentences else text
        
        # Entities & Score
        entities = []
        score = 0.5 # Baseline
        
        for word, pos in blob.tags:
            if pos.startswith('NNP'):  # Proper noun (approximate NER for Person/Org/Location)
                entities.append(word)
                score += 0.1
            elif pos == 'CD':  # Cardinal Digit (Quantifiers, percentages, money)
                score += 0.2
                entities.append(word)

        lower_text = best_sentence.lower()
        if any(marker in lower_text for marker in self.subjective_markers):
            score -= 0.4
            
        # Check interrogative/exclamatory
        if '?' in best_sentence:
            score -= 0.3
        
        score = min(max(score, 0.0), 1.0) # Clamp 0-1
        
        # Missing context questions
        missing_context = self._generate_context_questions(entities)
        
        return {
            "claim": best_sentence,
            "score": round(score, 2),
            "entities": list(set(entities)),
            "missing_context_questions": missing_context
        }

    def _generate_context_questions(self, entities):
        questions = []
        has_digit = any(any(char.isdigit() for char in e) for e in entities)
        if has_digit:
            questions.append("What is the timeframe for this statistic?")
            questions.append("What is the comparison baseline?")
        
        if len(entities) > 0 and len(questions) < 2:
            questions.append("In what specific context was this stated?")
            
        return questions[:2]
