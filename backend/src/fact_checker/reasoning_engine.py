import httpx

NEGATION_WORDS = {
    "not", "no", "never", "false", "incorrect", "wrong", "disproven",
    "debunked", "myth", "misinformation", "contrary", "contradict",
    "opposite", "refuted", "false"
}

STRONG_SUPPORT_PHRASES = [
    "is a fact", "is true", "has been confirmed", "is well established",
    "is widely accepted", "scientific consensus", "proven", "confirmed by",
    "it is known that", "according to", "demonstrates that"
]

class ReasoningEngine:
    async def evaluate(self, claim_data: dict, evidence_results: dict) -> dict:
        claim = claim_data.get('claim', '')
        rag_passages = evidence_results.get('rag_passages', [])
        kg_triples = evidence_results.get('kg_triples', [])

        # 1. Calculate Evidence Support Score with improved heuristics
        evidence_support_score = 0.0
        has_conflict = False

        if rag_passages:
            best_passage = max(rag_passages, key=lambda x: x.get('relevance_score', 0))
            
            claim_lower = claim.lower()
            passage_lower = best_passage['passage'].lower()
            
            # --- IMPROVED: Semantic word overlap (filter stopwords & short words) ---
            STOPWORDS = {
                "the", "a", "an", "is", "in", "it", "of", "to", "and", "or",
                "that", "this", "as", "be", "by", "for", "on", "are", "was",
                "at", "with", "its", "has", "have", "from"
            }
            claim_words = {w for w in claim_lower.split() if w not in STOPWORDS and len(w) > 2}
            passage_words = {w for w in passage_lower.split() if w not in STOPWORDS and len(w) > 2}
            intersection = claim_words.intersection(passage_words)
            
            # Base score from word overlap (normalized)
            if claim_words:
                overlap_ratio = len(intersection) / len(claim_words)
                evidence_support_score = min(0.5 + overlap_ratio * 0.5, 0.95)
            else:
                evidence_support_score = 0.3

            # Boost for strong support phrases
            for phrase in STRONG_SUPPORT_PHRASES:
                if phrase in passage_lower:
                    evidence_support_score = min(evidence_support_score + 0.15, 1.0)
                    break

            # --- IMPROVED conflict detection: require negation in close context to claim keywords ---
            # Only flag conflict if a negation word appears DIRECTLY near a claim keyword
            # NOT just anywhere in the passage (which caused the "Heliocentrism" false refute)
            has_conflict = self._detect_contextual_negation(claim_words, passage_lower)

        # Boost score slightly if KG triples are present
        if kg_triples:
            evidence_support_score = min(evidence_support_score + 0.1, 1.0)

        # 2. Veracity Classification
        if not rag_passages and not kg_triples:
            verdict = "INSUFFICIENT_EVIDENCE"
            confidence = 0.0
        elif has_conflict:
            verdict = "UNVERIFIABLE"
            confidence = 0.5
        elif evidence_support_score >= 0.65:
            verdict = "SUPPORTED"
            confidence = evidence_support_score
        elif evidence_support_score >= 0.4:
            verdict = "PARTIALLY_SUPPORTED"
            confidence = evidence_support_score
        else:
            verdict = "REFUTED"
            confidence = 1.0 - evidence_support_score

        # 3. Justification Generation
        justification = await self._generate_justification(claim, evidence_results, verdict)

        # 4. Harm Score (1-7)
        harm_score = self._calculate_harm(claim_data.get('entities', []), verdict)

        return {
            "verdict": verdict,
            "confidence": round(confidence, 2),
            "justification": justification,
            "has_conflict": has_conflict,
            "harm_score": harm_score
        }

    def _detect_contextual_negation(self, claim_words: set, passage_lower: str) -> bool:
        """
        Detects negation only when a negation word appears within a short window
        of a claim keyword. Prevents false conflicts from passages where 'not'
        appears in an unrelated sentence.
        """
        passage_tokens = passage_lower.split()
        WINDOW_SIZE = 8  # words before/after a claim keyword to check for negation

        for i, token in enumerate(passage_tokens):
            if token in claim_words:
                # Check a window around this token
                start = max(0, i - WINDOW_SIZE)
                end = min(len(passage_tokens), i + WINDOW_SIZE)
                window = set(passage_tokens[start:end])
                if window.intersection(NEGATION_WORDS):
                    return True
        return False

    async def _generate_justification(self, claim, evidence_results, verdict):
        rag_passages = evidence_results.get('rag_passages', [])
        evidence_text = "\n".join([p['passage'][:200] for p in rag_passages])

        # Try Ollama first
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                prompt = (
                    f"You are a fact-checker. Based ONLY on the following retrieved evidence, "
                    f"write a 1-2 sentence justification for the verdict '{verdict}'.\n"
                    f"CLAIM: {claim}\nEVIDENCE: {evidence_text}"
                )
                resp = await client.post("http://localhost:11434/api/generate", json={
                    "model": "llama3",
                    "prompt": prompt,
                    "stream": False
                })
                if resp.status_code == 200:
                    return resp.json().get('response', '').strip()
        except Exception:
            pass  # Fallback below

        # Fallback template
        if not rag_passages:
            return "No verifiable external evidence could be retrieved for this claim."

        best_passage = rag_passages[0]['passage'][:200] + "..."
        templates = {
            "SUPPORTED": f"External evidence directly supports this claim: \"{best_passage}\"",
            "REFUTED": f"Retrieved evidence does not support this claim. Context indicates: \"{best_passage}\"",
            "PARTIALLY_SUPPORTED": f"The claim is partially supported: \"{best_passage}\"",
            "UNVERIFIABLE": f"Retrieved evidence contains conflicting signals: \"{best_passage}\"",
            "INSUFFICIENT_EVIDENCE": "No verifiable external evidence could be retrieved."
        }
        return templates.get(verdict, f"Evidence found: \"{best_passage}\"")

    def _calculate_harm(self, entities, verdict):
        score = 1  # Baseline low — SUPPORTED claims should not be high-harm
        if verdict == "REFUTED":
            score += 2
        elif verdict == "UNVERIFIABLE":
            score += 1
        HIGH_RISK_TOPICS = {'government', 'budget', 'health', 'disease', 'vaccine', 'election', 'war', 'death'}
        if any(e.lower() in HIGH_RISK_TOPICS for e in entities):
            score += 2
        return min(score, 7)
