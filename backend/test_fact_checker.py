import asyncio
from src.fact_checker import FactCheckPipeline
import json

async def run_test():
    pipeline = FactCheckPipeline()
    claims = [
        "The current unemployment rate in the US is 3.5%.",
        "The Eiffel Tower is located in Berlin.",
        "A regular exercise routine might be good for learning."
    ]
    
    for claim in claims:
        print(f"--- FACT CHECKING: {claim} ---")
        result = await pipeline.run(claim)
        print(json.dumps(result, indent=2))
        print("\\n")

if __name__ == "__main__":
    asyncio.run(run_test())
