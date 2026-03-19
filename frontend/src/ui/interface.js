class UIManager {
    constructor(state, graphRenderer) {
        this.state = state;
        this.graphRenderer = graphRenderer;
        this.isDark = true;
    }

    removePreloader() {
        const preloader = document.getElementById('initial-preloader');
        if (preloader && !preloader.classList.contains('loaded')) {
            setTimeout(() => {
                preloader.classList.add('loaded');
            }, 1500);
        }
    }

    toggleTheme() {
        this.isDark = !this.isDark;
        const body = document.body;
        const btnImg = document.getElementById('themeBtnImg');

        if (btnImg) {
            btnImg.src = this.isDark ? 'assets/team_symbol_dark.png' : 'assets/team_symbol_light.png';
        }

        if (this.isDark) body.setAttribute('data-theme', 'dark');
        else body.removeAttribute('data-theme');

        this.graphRenderer.setTheme(this.isDark);
        if (this.state.graphData.nodes.length > 0) {
            this.graphRenderer.draw(this.state.graphData);
        }
    }

    selectOption(el, group, value) {
        Array.from(el.parentElement.children).forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');

        this.state[group] = value;
        this.state.isRecording = false;
        document.getElementById('uploadArea').classList.remove('recording');

        if (group === 'inputType') {
            this.updateUploadArea(value);
        }
    }

    updateUploadArea(value) {
        const area = document.getElementById('uploadArea');
        const textSpan = document.getElementById('uploadText');

        const existingPreview = area.querySelector('.preview');
        if (existingPreview) existingPreview.remove();

        const existingTextarea = area.querySelector('textarea');
        if (existingTextarea) existingTextarea.remove();

        textSpan.style.display = 'block';

        if (value === 'live') {
            textSpan.innerText = 'Click to Activate Microphone...';
            area.style.pointerEvents = 'all';
        } else if (value === 'text') {
            textSpan.style.display = 'none';
            const textarea = document.createElement('textarea');
            textarea.placeholder = "Paste your raw data (transcript) here...";
            textarea.onclick = (e) => e.stopPropagation();
            area.appendChild(textarea);
            area.style.pointerEvents = 'all';
        } else {
            textSpan.innerText = 'Click or Drop file here...';
            area.style.pointerEvents = 'all';
        }
    }

    handleFileSelect(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            this.state.selectedFile = file;

            const area = document.getElementById('uploadArea');
            const textSpan = document.getElementById('uploadText');

            const old = area.querySelector('.preview');
            if (old) old.remove();

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.classList.add('preview');
                    area.insertBefore(img, textSpan);
                    textSpan.innerText = file.name;
                }
                reader.readAsDataURL(file);
            } else {
                textSpan.innerText = `Selected: ${file.name}`;
            }
        }
    }

    toggleStudyMode(enabled) {
        const dashboard = document.querySelector('.results-dashboard');
        if (enabled) dashboard.classList.add('study-mode');
        else dashboard.classList.remove('study-mode');
    }

    async translateResults(lang) {
        if (lang === 'en') {
            this.renderResults(); // Re-render original
            return;
        }

        const summaryEl = document.getElementById('resultSummary');
        const nodesEl = document.getElementById('resultKeyNodes');
        
        summaryEl.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Translating...</p>';
        
        try {
            // 1. Translate Summary
            const sumResp = await fetch('/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: this.state.analysisResult.summary, target_lang: lang })
            });
            const sumData = await sumResp.json();
            summaryEl.innerHTML = `<p>${sumData.translatedText}</p>`;

            // 2. Translate Key Nodes
            const translatedNodes = await Promise.all(this.state.analysisResult.keyNodes.map(async (text) => {
                const resp = await fetch('/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, target_lang: lang })
                });
                const data = await resp.json();
                return data.translatedText;
            }));

            // 3. Re-render list with translated text
            nodesEl.innerHTML = '';
            translatedNodes.forEach((text, index) => {
                const retentionPoints = this.state.analysisResult.retention_data || [];
                const backContent = retentionPoints[index] || "Dive deep...";

                const item = document.createElement('div');
                item.className = 'insight-item';
                item.innerHTML = `
                    <div class="insight-card-inner">
                        <div class="insight-front">
                            <span><i class="fas fa-chevron-right" style="margin-right:8px;"></i> ${text}</span>
                            <a href="https://www.google.com/search?q=${encodeURIComponent(text)}" 
                               target="_blank" class="fact-check-btn" title="Fact Check">
                               <i class="fas fa-search"></i> Verify
                            </a>
                        </div>
                        <div class="insight-back">
                            <i class="fas fa-lightbulb" style="margin-right:8px;"></i> ${backContent}
                        </div>
                    </div>
                `;
                nodesEl.appendChild(item);
            });

        } catch (e) {
            console.error("Translation failed:", e);
            summaryEl.innerHTML = '<p style="color:red;">Translation error. Please try again.</p>';
        }
    }

    renderResults() {
        const summaryEl = document.getElementById('resultSummary');
        const nodesEl = document.getElementById('resultKeyNodes');

        if (this.state.analysisResult) {
            summaryEl.innerHTML = `<p>${this.state.analysisResult.summary}</p>`;
            
            nodesEl.innerHTML = '';
            
            const retentionPoints = this.state.analysisResult.retention_data || [];

            this.state.analysisResult.keyNodes.forEach((nodeText, index) => {
                const backContent = retentionPoints[index] || "Dive deep into this concept for better retention.";
                
                const item = document.createElement('div');
                item.className = 'insight-item';
                item.innerHTML = `
                    <div class="insight-card-inner">
                        <div class="insight-front">
                            <span><i class="fas fa-chevron-right" style="margin-right:8px;"></i> ${nodeText}</span>
                            <a href="https://www.google.com/search?q=${encodeURIComponent(nodeText)}" 
                               target="_blank" class="fact-check-btn" title="Fact Check">
                               <i class="fas fa-search"></i> Verify
                            </a>
                        </div>
                        <div class="insight-back">
                            <i class="fas fa-lightbulb" style="margin-right:8px;"></i> ${backContent}
                        </div>
                    </div>
                `;
                nodesEl.appendChild(item);
            });
        }
    }
}
