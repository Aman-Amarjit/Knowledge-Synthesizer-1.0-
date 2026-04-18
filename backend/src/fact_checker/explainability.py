class OutputFormatter:
    def format_verdict(self, claim_data: dict, evidence_results: dict, reasoning: dict) -> dict:
        return {
            "verified": True, # To maintain compat with older model handling
            "topic": ", ".join(claim_data.get('entities', [])[:2]),
            "claim": claim_data.get('claim', ''),
            "check_worthiness": claim_data.get('score', 0),
            "verdict": reasoning.get('verdict', 'UNVERIFIABLE'),
            "verdict_confidence": reasoning.get('confidence', 0),
            "harm_score": reasoning.get('harm_score', 1),
            "justification": reasoning.get('justification', ''),
            "missing_context": claim_data.get('missing_context_questions', []),
            "evidence": evidence_results.get('rag_passages', []),
            "kg_triples": evidence_results.get('kg_triples', []),
            "gray_zone": reasoning.get('has_conflict', False)
        }
        
    def format_unverifiable(self, text: str, claim_data: dict, reason: str) -> dict:
        return {
            "verified": False,
            "topic": "Unknown",
            "claim": claim_data.get('claim', text),
            "check_worthiness": claim_data.get('score', 0),
            "verdict": "UNVERIFIABLE",
            "verdict_confidence": 1.0,
            "harm_score": 1,
            "justification": reason,
            "missing_context": [],
            "evidence": [],
            "kg_triples": [],
            "gray_zone": True,
            "detail": reason
        }
