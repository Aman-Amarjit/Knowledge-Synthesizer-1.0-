class UIManager {
    constructor(state, graphRenderer) {
        this.state = state;
        this.graphRenderer = graphRenderer;
        this.isDark = true;
    }

    removePreloader() {
        const preloader = document.getElementById('initial-preloader');
        if (preloader && !preloader.classList.contains('loaded')) {
            // Force scroll to top before removing preloader
            window.scrollTo(0, 0);
            setTimeout(() => {
                preloader.classList.add('loaded');
                document.documentElement.classList.remove('is-loading');
                document.body.classList.remove('is-loading');
            }, 1500);
        }
        // ALWAYS init scroll animations after a short delay, regardless of preloader
        setTimeout(() => {
            this.initScrollAnimations();
            if (this.lenis) this.lenis.scrollTo(0, { immediate: true });
        }, 1600);
    }

    initScrollAnimations() {
        console.log("Initializing Premium Scroll Experience...");

        const header = document.getElementById('mainHeader');

        // 1. Initialize Lenis (Smooth Momentum Scroll)
        if (window.Lenis) {
            this.lenis = new Lenis({
                duration: 0.8, // Snappier response
                easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                smoothWheel: true
            });
            const raf = (time) => { this.lenis.raf(time); requestAnimationFrame(raf); };
            requestAnimationFrame(raf);
            this.lenis.on('scroll', (e) => { 
                this.updateProgressBar(); 
                this.updateParallax(); 
                
                // Handle header scroll state
                if (header) {
                    if (e.scroll > 50) header.classList.add('scrolled');
                    else header.classList.remove('scrolled');
                }
            });
        } else {
            // Fallback: native scroll events (ONLY if Lenis fails)
            window.addEventListener('scroll', () => { 
                this.updateProgressBar(); 
                this.updateParallax(); 
                
                if (header) {
                    if (window.scrollY > 50) header.classList.add('scrolled');
                    else header.classList.remove('scrolled');
                }
            }, { passive: true });
        }

        // 2. Reveal on Scroll (Intersection Observer)
        const revealCallback = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal-visible');
                    observer.unobserve(entry.target);
                }
            });
        };
        const observer = new IntersectionObserver(revealCallback, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }

    updateProgressBar() {
        // Now handled by CSS animation-timeline in index.html
    }

    updateParallax() {
        const scrolled = window.scrollY;
        const yPos = -(scrolled * 0.05);
        document.documentElement.style.setProperty('--scroll-y', `${yPos}px`);
    }

    toggleTheme() {
        this.isDark = !this.isDark;
        const root = document.documentElement; // Target HTML instead of Body
        const themeBtnIcon = document.getElementById('themeBtnIcon');

        if (themeBtnIcon) {
            themeBtnIcon.className = this.isDark ? 'fas fa-moon' : 'fas fa-sun';
        }

        if (this.isDark) root.setAttribute('data-theme', 'dark');
        else root.removeAttribute('data-theme');

        if (this.graphRenderer && this.graphRenderer.setTheme) {
            this.graphRenderer.setTheme(this.isDark);
            // Ensure immediate re-render if data exists
            if (this.state.graphData && this.state.graphData.nodes.length > 0) {
                this.graphRenderer.draw(this.state.graphData);
            }
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
            const summaryEl = document.getElementById('resultSummary');
            const nodesEl = document.getElementById('resultKeyNodes');
            summaryEl.innerHTML = '<p><i class="fas fa-sync fa-spin"></i> Restoring Original...</p>';
            nodesEl.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:200px;"><i class="fas fa-sync fa-spin" style="font-size:2rem; color:var(--accent-color);"></i></div>';
            
            setTimeout(() => {
                this.renderResults(); // Re-render original
            }, 300);
            return;
        }

        const summaryEl = document.getElementById('resultSummary');
        const nodesEl = document.getElementById('resultKeyNodes');

        if (!this.state.analysisResult) return;

        try {
            console.log("Starting translation to:", lang);
            summaryEl.innerHTML = '<div class="reveal-visible" style="color:var(--accent-color); font-weight:600;"><i class="fas fa-sync fa-spin"></i> TRANSLATING EXECUTIVE SUMMARY...</div>';
            nodesEl.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; width:100%; text-align:center;">
                    <div class="loader-ring-tech" style="position:relative; width:60px; height:60px; margin-bottom:20px;">
                        <div class="ring-1"></div>
                        <div class="ring-2"></div>
                    </div>
                    <p style="font-family:'JetBrains Mono', monospace; color:#00f2ff; letter-spacing:2px; font-size:0.9rem; text-transform:uppercase; animation:blinkText 1s infinite; margin:0; padding:10px; text-shadow: 0 0 10px rgba(0,242,255,0.5);">Translating...</p>
                </div>
            `;

            // Give the UI a moment to paint the loader
            await new Promise(r => setTimeout(r, 100));

            const response = await fetch(`${APP_CONFIG.baseUrl}/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: this.state.analysisResult.summary,
                    target_lang: lang,
                    nodes: this.state.analysisResult.keyNodes,
                    retention_data: this.state.analysisResult.retention_data || []
                })
            });

            if (!response.ok) throw new Error("Translation failed");

            const data = await response.json();
            const translatedText = data.translatedText || this.state.analysisResult.summary || "";
            const translatedNodes = data.translatedNodes || [];
            const translatedRetention = data.translatedRetention || this.state.analysisResult.retention_data || [];

            // Update UI with translated content
            summaryEl.innerHTML = `<p>${translatedText.toString().replace(/\n/g, '<br>')}</p>`;

            nodesEl.innerHTML = '';
            translatedNodes.forEach((text, index) => {
                const backContent = translatedRetention[index] || "Strategic context: Core synthesis node.";

                const item = document.createElement('div');
                item.className = 'insight-item';
                item.innerHTML = `
                    <div class="insight-card-inner">
                        <div class="insight-front">
                            <span><i class="fas fa-chevron-right" style="margin-right:8px;"></i> ${text}</span>
                            <button onclick="uiManager.verifyInsight('${text.replace(/'/g, "\\'")}', this)" class="fact-check-btn" title="Fact Check">
                               <i class="fas fa-search"></i> Verify
                            </button>
                        </div>
                        <div class="insight-back">
                            <i class="fas fa-lightbulb"></i> ${backContent}
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

    async startReplay() {
        try {
            console.log("Attempting to start Decision Replay...");
            if (!this.state.analysisResult || !this.state.analysisResult.timeline) {
                console.error("No timeline data found for replay.");
                alert("No replay data available for this analysis.");
                return;
            }

            const timeline = this.state.analysisResult.timeline;
            console.log(`Starting replay with ${timeline.length} events.`);
            
            const nodesEl = document.getElementById('resultKeyNodes');
            const statusEl = document.getElementById('replayStatus');
            const timeEl = document.getElementById('replayTime');
            const slider = document.getElementById('timelineSlider');
            const btn = document.getElementById('replayBtn');

            if (!btn || !nodesEl || !statusEl || !timeEl || !slider) {
                console.error("Required UI elements for replay not found.");
                return;
            }

            btn.disabled = true;
            nodesEl.innerHTML = '';
            slider.value = 0;

            for (let i = 0; i < timeline.length; i++) {
                const event = timeline[i];
                const progress = ((i + 1) / timeline.length) * 100;

                // Update UI
                slider.value = progress;
                slider.style.setProperty('--p', `${progress}%`);
                statusEl.innerText = `Evolution Phase: ${event.status}`;
                timeEl.innerText = event.timestamp;

                // Add item to list
                const item = document.createElement('div');
                item.className = 'insight-item';
                item.style.animation = 'elasticSlideIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

                const backContent = (this.state.analysisResult.retention_data && this.state.analysisResult.retention_data[i])
                    || `Sequential Context: This insight emerged during the ${event.status} phase.`;

                item.innerHTML = `
                    <div class="insight-card-inner">
                        <div class="insight-front">
                            <span><i class="fas fa-history" style="margin-right:8px; color:var(--accent-color)"></i> ${event.insight}</span>
                            <button class="fact-check-btn">
                                <i class="fas fa-search"></i> Verify
                            </button>
                        </div>
                        <div class="insight-back">
                            <i class="fas fa-lightbulb" style="margin-right:8px;"></i> ${backContent}
                        </div>
                    </div>
                `;
                
                // Safe event attachment
                const verifyBtn = item.querySelector('.fact-check-btn');
                if (verifyBtn) {
                    verifyBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.verifyInsight(event.insight, verifyBtn);
                    };
                }

                nodesEl.prepend(item); // Show newest at top during replay

                try {
                    // Highlight Graph with pulsing effect
                    this.graphRenderer.highlightNodeByLabel(event.insight, true);
                } catch (err) {
                    console.warn("Graph highlight failed during replay:", err);
                }

                await new Promise(r => setTimeout(r, 1200));
            }

            statusEl.innerText = "Replay Complete";
            btn.disabled = false;
        } catch (globalErr) {
            console.error("Critical Replay Error:", globalErr);
            alert("An error occurred during replay. See console for details.");
            const btn = document.getElementById('replayBtn');
            if (btn) btn.disabled = false;
        }
    }

    seekTimeline(value) {
        if (!this.state.analysisResult || !this.state.analysisResult.timeline) return;
        const index = Math.floor((value / 100) * (this.state.analysisResult.timeline.length - 1));
        const event = this.state.analysisResult.timeline[index];
        document.getElementById('replayStatus').innerText = `Jumped to: ${event.status}`;
        document.getElementById('replayTime').innerText = event.timestamp;
    }

    renderResults() {
        console.log("Rendering results page...", this.state.analysisResult);
        const summaryEl = document.getElementById('resultSummary');
        const nodesEl = document.getElementById('resultKeyNodes');
        const totalPointsEl = document.getElementById('metaTotalPoints');
        const timestampEl = document.getElementById('resultTimestamp');
        const protocolEl = document.getElementById('protocolBadge');

        if (this.state.analysisResult) {
            // Update Meta Sidebar
            if (totalPointsEl) totalPointsEl.innerText = `${this.state.analysisResult.keyNodes.length} Insights`;
            if (timestampEl) timestampEl.innerText = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            if (protocolEl) protocolEl.innerText = this.state.discType.charAt(0).toUpperCase() + this.state.discType.slice(1);

            if (summaryEl) {
                summaryEl.innerHTML = this.state.analysisResult.summary
                    ? `<p>${this.state.analysisResult.summary.replace(/\n/g, '<br>')}</p>`
                    : `<p>Analysis complete. No summary available.</p>`;
            }

            nodesEl.innerHTML = '';

            const retentionPoints = this.state.analysisResult.retention_data || [];
            this.state.analysisResult.keyNodes.forEach((nodeText, index) => {
                const backContent = retentionPoints[index] || "Strategic context: This point represents a core synthesis node.";

                const item = document.createElement('div');
                item.className = 'insight-item';
                item.innerHTML = `
                    <div class="insight-card-inner">
                        <div class="insight-front">
                            <span><i class="fas fa-chevron-right" style="margin-right:8px;"></i> ${nodeText}</span>
                            <button class="fact-check-btn" title="Fact Check">
                               <i class="fas fa-search"></i> Verify
                            </button>
                        </div>
                        <div class="insight-back">
                            <i class="fas fa-lightbulb" style="margin-right:8px;"></i> ${backContent}
                        </div>
                    </div>
                `;

                // Safe event attachment
                const verifyBtn = item.querySelector('.fact-check-btn');
                if (verifyBtn) {
                    verifyBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.verifyInsight(nodeText, verifyBtn);
                    };
                }

                nodesEl.appendChild(item);
            });
        }
    }

    async verifyInsight(text, btn) {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
        btn.disabled = true;

        try {
            const response = await fetch(`${APP_CONFIG.baseUrl}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await response.json();

            // Place evidence OUTSIDE the 3D flip container to avoid mirroring
            // Try insight-item first, then fall back to the closest flex card ancestor
            const insightItem = btn.closest('.insight-item') || btn.closest('.insight-front') || btn.parentElement;
            let evidenceDiv = insightItem ? insightItem.querySelector('.evidence-box') : null;
            if (!evidenceDiv && insightItem) {
                evidenceDiv = document.createElement('div');
                evidenceDiv.className = 'evidence-box';
                evidenceDiv.style.cssText = 'width: 100%; margin-top: 16px; padding: 18px; background: rgba(10, 22, 40, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(0, 242, 255, 0.15); border-radius: 12px; font-size: 0.9rem; word-wrap: break-word; clear: both; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); transition: all 0.3s ease; position: relative; overflow: hidden;';
                // Append AFTER the card inner so it is outside the 3D transform
                const cardInner = btn.closest('.insight-card-inner');
                if (cardInner && cardInner.parentElement) {
                    cardInner.parentElement.appendChild(evidenceDiv);
                } else {
                    insightItem.appendChild(evidenceDiv);
                }
            }

            if (data.verdict) {
                let vColor = '#a0a0a0';
                let vIcon = 'fa-question-circle';
                if (data.verdict === 'SUPPORTED') { vColor = '#00ff9d'; vIcon = 'fa-check-circle'; }
                else if (data.verdict === 'REFUTED') { vColor = '#ff0055'; vIcon = 'fa-times-circle'; }
                else if (data.verdict === 'PARTIALLY_SUPPORTED') { vColor = '#ffaa00'; vIcon = 'fa-exclamation-circle'; }

                let html = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                        <span style="color:${vColor}; font-weight: 700; letter-spacing: 1px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                            <i class="fas ${vIcon}" style="font-size: 1.15rem; filter: drop-shadow(0 0 6px ${vColor});"></i> 
                            VERDICT: ${data.verdict.replace(/_/g, ' ')} <span style="opacity: 0.7; font-size: 0.75rem; margin-left: 4px;">(${Math.round(data.verdict_confidence * 100)}% CONFIDENCE)</span>
                        </span>
                        ${data.harm_score && data.harm_score > 3 ? `<span style="font-size: 0.7rem; color: #ff5555; background: rgba(255,85,85,0.1); border: 1px solid rgba(255,85,85,0.3); padding: 4px 10px; border-radius: 6px; font-weight: 700; letter-spacing: 0.5px;" title="Harm Score">⚠️ HARM: ${data.harm_score}/7</span>` : ''}
                    </div>
                `;

                if (data.justification) {
                    html += `<p style="margin-bottom: 16px; font-size: 0.95rem; line-height: 1.6; color: rgba(255, 255, 255, 0.9); font-weight: 300;">${data.justification}</p>`;
                }

                if (data.missing_context && data.missing_context.length > 0) {
                    html += `<div style="margin-bottom: 14px; display: flex; flex-wrap: wrap; gap: 8px;">`;
                    data.missing_context.forEach(q => {
                        html += `<span style="background: rgba(255,170,0,0.08); border: 1px solid rgba(255,170,0,0.25); color:#ffaa00; font-size:0.75rem; font-weight: 600; padding: 5px 12px; border-radius: 6px; letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(255,170,0,0.05);"><i class="fas fa-search-minus" style="margin-right: 4px; opacity: 0.8;"></i> MISSING CONTEXT: ${q}</span>`;
                    });
                    html += `</div>`;
                }

                if (data.kg_triples && data.kg_triples.length > 0) {
                    html += `<div style="background: rgba(0,0,0,0.25); border-radius: 8px; padding: 12px; margin-bottom: 14px; border: 1px solid rgba(255,255,255,0.03);">
                       <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;"><i class="fas fa-project-diagram" style="margin-right: 4px;"></i> Structured Entities (Knowledge Graph)</div>
                       <div style="font-size:0.85rem; color:#00f2ff; font-family: 'JetBrains Mono', monospace; line-height: 1.6;">`;
                    data.kg_triples.forEach(t => {
                        html += `<div><span style="opacity:0.7">[${t.subject}]</span> <i class="fas fa-arrow-right" style="font-size:0.6rem; opacity:0.5; margin: 0 6px;"></i> <b>${t.predicate}</b> <i class="fas fa-arrow-right" style="font-size:0.6rem; opacity:0.5; margin: 0 6px;"></i> <span style="color:#fff">${t.object}</span></div>`;
                    });
                    html += `</div></div>`;
                }

                if (data.evidence && data.evidence.length > 0) {
                    const topEv = data.evidence[0];
                    html += `<div style="border-left: 3px solid ${vColor}; background: linear-gradient(90deg, rgba(255,255,255, 0.04) 0%, transparent 100%); padding: 12px 14px; border-radius: 0 8px 8px 0; margin-top: 8px;">
                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;"><i class="fas fa-book-reader" style="margin-right: 4px;"></i> Source Evidence</div>
                        <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.75); line-height: 1.6; font-style: italic;">
                            "${topEv.passage.substring(0, 180)}..." 
                            <br/><a href="${topEv.url}" target="_blank" style="color:${vColor}; text-decoration:none; font-weight: 600; font-style: normal; display: inline-block; margin-top: 6px;">[${topEv.source} <i class="fas fa-external-link-alt" style="font-size:0.7rem; margin-left:4px;"></i>]</a>
                        </div>
                    </div>`;
                }

                if (evidenceDiv) evidenceDiv.innerHTML = html;
                btn.innerHTML = `<i class="fas ${vIcon}"></i> Reviewed`;
                btn.style.background = 'transparent';
                btn.style.color = vColor;
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.9';
            } else {
                const failReason = data.detail || data.evidence || "Server unreachable. Please try again.";
                if (evidenceDiv) evidenceDiv.innerHTML = `<div style="color:#ff0055; font-weight:600; margin-bottom:4px;"><i class="fas fa-exclamation-triangle"></i> Review Failed:</div><div style="color:rgba(255,255,255,0.8); font-size:0.9rem;">${failReason}</div>`;
                btn.innerHTML = '<i class="fas fa-redo"></i> Retry';
                btn.disabled = false;
            }
        } catch (e) {
            console.error("verifyInsight completely failed:", e);
            btn.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:#ff0055"></i> Error';
            btn.title = String(e);
            btn.disabled = false;

            const insightItem = btn.closest('.insight-item') || btn.closest('.insight-front') || btn.parentElement;
            let evidenceDiv = insightItem ? insightItem.querySelector('.evidence-box') : null;
            if (evidenceDiv) {
                evidenceDiv.innerHTML = `<div style="color:#ff0055; font-weight:bold;">Fatal Error:</div><div style="font-size:0.8rem; color:#fff;">${String(e)}</div>`;
            }
        }
    }
}
