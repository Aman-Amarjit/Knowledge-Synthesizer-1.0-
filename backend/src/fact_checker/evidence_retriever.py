import asyncio
import httpx
from sklearn.feature_extraction.text import TfidfVectorizer
import re

class EvidenceRetriever:
    async def retrieve(self, claim_data: dict) -> dict:
        entities = claim_data.get('entities', [])
        claim_text = claim_data.get('claim', '')
        
        rag_task = self._fetch_wikipedia(entities, claim_text)
        kg_task = self._fetch_wikidata(entities)
        
        rag_results, kg_results = await asyncio.gather(rag_task, kg_task)
        
        return {
            "rag_passages": rag_results,
            "kg_triples": kg_results
        }
        
    async def _fetch_wikipedia(self, entities, claim_text):
        if not claim_text:
            return []
            
        passages = []
        async with httpx.AsyncClient(timeout=5.0) as client:
            headers = {'User-Agent': 'KnowledgeSynthesizerFactChecker/1.0'}
            try:
                # 1. Search Wikipedia for pages matching the claim
                search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={claim_text}&utf8=&format=json&srlimit=2"
                search_resp = await client.get(search_url, headers=headers)
                search_data = search_resp.json()
                
                search_results = search_data.get('query', {}).get('search', [])
                for result in search_results:
                    title = result['title']
                    # 2. Fetch page summary
                    summary_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
                    summary_resp = await client.get(summary_url, headers=headers)
                    if summary_resp.status_code == 200:
                        summary_data = summary_resp.json()
                        passage = summary_data.get('extract', '')
                        if passage:
                            passages.append({
                                "source": "Wikipedia",
                                "url": summary_data.get('content_urls', {}).get('desktop', {}).get('page', ''),
                                "passage": passage,
                                "credibility_weight": 0.8
                            })
            except Exception as e:
                print(f"Wikipedia fetch error: {e}")
                
        # Basic TF-IDF ranking against the claim
        if passages:
            try:
                vectorizer = TfidfVectorizer()
                docs = [claim_text] + [p['passage'] for p in passages]
                tfidf_matrix = vectorizer.fit_transform(docs)
                claim_vector = tfidf_matrix[0]
                
                for i, p in enumerate(passages):
                    doc_vector = tfidf_matrix[i+1]
                    sim = (claim_vector * doc_vector.T).toarray()[0][0]
                    p['relevance_score'] = round(float(sim), 2)
                    
                passages.sort(key=lambda x: x['relevance_score'], reverse=True)
            except:
                for p in passages:
                    p['relevance_score'] = 0.5
                    
        return passages[:3]

    async def _fetch_wikidata(self, entities):
        triples = []
        if not entities:
            return triples
            
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                # 1. Search for Wikidata QID using the first major entity
                query = entities[0]
                search_url = f"https://www.wikidata.org/w/api.php?action=wbsearchentities&search={query}&language=en&format=json&limit=1"
                headers = {'User-Agent': 'KnowledgeSynthesizerFactChecker/1.0'}
                resp = await client.get(search_url, headers=headers)
                data = resp.json()
                
                if data.get('search'):
                    qid = data['search'][0]['id']
                    label = data['search'][0]['label']
                    
                    # 2. Make a very lightweight SPARQL query using HTTP 
                    sparql_query = f"""
                    SELECT ?propertyLabel ?valueLabel WHERE {{
                      wd:{qid} ?property ?value.
                      ?property a wikibase:Property.
                      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
                    }}
                    LIMIT 5
                    """
                    sparql_url = "https://query.wikidata.org/sparql"
                    headers = {"Accept": "application/sparql-results+json", "User-Agent": "KnowledgeSynthesizerFactChecker/1.0"}
                    
                    sp_resp = await client.get(sparql_url, params={"query": sparql_query}, headers=headers)
                    if sp_resp.status_code == 200:
                        sp_data = sp_resp.json()
                        bindings = sp_data.get('results', {}).get('bindings', [])
                        for b in bindings:
                            prop = b.get('propertyLabel', {}).get('value', '')
                            val = b.get('valueLabel', {}).get('value', '')
                            
                            # Filter out URLs or overly complex Wikidata IDs (starts with http or Q)
                            if not val.startswith('http') and not re.match(r'^Q\d+$', val) and prop:
                                triples.append({"subject": label, "predicate": prop, "object": val})
                                if len(triples) >= 2: # Keep it concise
                                    break
            except Exception as e:
                print(f"Wikidata fetch error: {e}")
                
        return triples
