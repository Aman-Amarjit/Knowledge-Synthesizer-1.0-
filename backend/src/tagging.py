import re
from typing import List
from textblob import TextBlob
from collections import Counter

class SmartTagger:
    """
    Analyzes text to automatically generate relevant hashtags.
    Detects: Dates, Formulas, Action Items, and Key Concepts.
    """
    
    def generate_tags(self, text: str) -> List[str]:
        tags = set()
        lower_text = text.lower()
        
        # 1. Date Detection
        # Regex for years (19xx or 20xx)
        if re.search(r'\b(19|20)\d{2}\b', text):
            tags.add("#Date")
        
        # Regex for months
        months = ['january', 'february', 'march', 'april', 'may', 'june', 
                  'july', 'august', 'september', 'october', 'november', 'december']
        if any(m in lower_text for m in months):
            tags.add("#Date")

        # 2. Math/Formula Detection
        # Look for explicit words or equation symbols
        math_keywords = ['formula', 'equation', 'theorem', 'hypothesis', 
                         'calculate', 'integral', 'derivative', 'geometry']
        if any(k in lower_text for k in math_keywords):
            tags.add("#Formula")
        # Look for math operations (e.g., "x = y" or "5 + 5")
        elif re.search(r'\b[a-z0-9]+\s*=\s*[a-z0-9]+\b', lower_text): 
             tags.add("#Formula")

        # 3. Action Items / Decisions
        action_keywords = ['deadline', 'submit', 'approved', 'rejected', 'todo', 'action item']
        if any(k in lower_text for k in action_keywords):
            tags.add("#ActionItem")

        # 4. Key Concepts (Top Nouns as Hashtags)
        blob = TextBlob(text)
        phrases = []
        
        # Extract and format noun phrases (e.g., "machine learning" -> "#MachineLearning")
        for np in blob.noun_phrases:
            if len(np) > 3 and len(np) < 25: # Filter out noise
                # Remove spaces and TitleCase
                formatted = "".join(w.title() for w in np.split())
                phrases.append(formatted)
        
        # Add top 5 most frequent concepts
        if phrases:
            # exclude generic words if they slip through
            stop_hashes = {'Speaker', 'Today', 'Hello', 'Think', 'Know', 'Something', 'Discussion'}
            clean_phrases = [p for p in phrases if p not in stop_hashes and len(p) > 2]
            
            top_concepts = [item[0] for item in Counter(clean_phrases).most_common(5)]
            for concept in top_concepts:
                tags.add(f"#{concept}")

        return sorted(list(tags))
