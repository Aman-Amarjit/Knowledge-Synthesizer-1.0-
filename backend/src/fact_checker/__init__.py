from .claim_extractor import ClaimExtractor
from .evidence_retriever import EvidenceRetriever
from .reasoning_engine import ReasoningEngine
from .explainability import OutputFormatter

class FactCheckPipeline:
    def __init__(self):
        self.extractor = ClaimExtractor()
        self.retriever = EvidenceRetriever()
        self.engine = ReasoningEngine()
        self.formatter = OutputFormatter()

    async def run(self, text: str) -> dict:
        # 1. Extract claims & filter
        claim_data = self.extractor.process(text)
        if claim_data["score"] < 0.3:
            return self.formatter.format_unverifiable(
                text, 
                claim_data, 
                "Statement appears to be subjective or lacks verifiable entities."
            )

        # 2. Retrieve Evidence
        evidence_results = await self.retriever.retrieve(claim_data)
        
        # 3. Evaluate & Generate Verdict
        reasoning = await self.engine.evaluate(claim_data, evidence_results)
        
        # 4. Format Output
        return self.formatter.format_verdict(claim_data, evidence_results, reasoning)
