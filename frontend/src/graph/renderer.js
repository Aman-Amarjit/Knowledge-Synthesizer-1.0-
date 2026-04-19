class GraphRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (this.canvas) {
            this.container = this.canvas.parentElement;
            this.ctx = this.canvas.getContext('2d');
        }
        this.animationId = null;
        this.isDark = true;
        this.draggedNode = null;
        this.dragOffset = { x: 0, y: 0 };
        this.highlightedNode = null;
        this.mousePos = { x: 0, y: 0 };
        this.graphData = { nodes: [], edges: [] };
        this.particles = [];
        this.setupEvents();
    }

    setupEvents() {
        if (!this.canvas) return;

        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            this.draggedNode = this.graphData.nodes.slice().reverse().find(node => {
                const dx = node.x - mouseX;
                const dy = node.y - mouseY;
                return Math.sqrt(dx * dx + dy * dy) <= node.r * 1.5;
            });

            if (this.draggedNode) {
                this.canvas.style.cursor = 'grabbing';
                this.dragOffset.x = mouseX - this.draggedNode.x;
                this.dragOffset.y = mouseY - this.draggedNode.y;
                this.draggedNode.vx = 0;
                this.draggedNode.vy = 0;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.draggedNode) return;
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            this.draggedNode.x = mouseX - this.dragOffset.x;
            this.draggedNode.y = mouseY - this.dragOffset.y;
            this.draggedNode.vx = 0;
            this.draggedNode.vy = 0;
        });

        window.addEventListener('mouseup', () => {
            if (this.draggedNode) {
                this.draggedNode.pinned = true; // Pin the node after drop
                this.draggedNode = null;
                this.canvas.style.cursor = 'grab';
            }
        });
    }

    init(graphData) {
        if (!this.canvas) return;
        this.graphData = graphData;
        this.canvas.width = this.container.offsetWidth;
        this.canvas.height = this.container.offsetHeight;

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        
        graphData.nodes.forEach((n, i) => {
            // Spiral layout for better distribution and less overlap
            const phi = i * 0.5 + 2; // Spiral spacing
            const radius = 40 * phi; // Grow outward
            const angle = 0.5 * phi;
            
            n.x = cx + Math.cos(angle) * radius;
            n.y = cy + Math.sin(angle) * radius;
            n.vx = 0;
            n.vy = 0;
            n.r = n.type === 'concept' ? 28 : 22;
        });

        // Setup particles for flow
        this.particles = [];
        graphData.edges.forEach((edge, i) => {
            this.particles.push({
                edge: edge,
                progress: Math.random(),
                speed: 0.002 + Math.random() * 0.005
            });
        });

        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animate();
    }

    applyPhysics() {
        const { nodes, edges } = this.graphData;
        const k = 0.05;
        const repel = 1800; // Stronger repulsion for distance
        const friction = 0.85; // Faster stabilization

        // 1. Repulsion (Always active to keep distance)
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[j].x - nodes[i].x;
                const dy = nodes[j].y - nodes[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                
                if (dist < 200) { // Only repel if too close
                    const force = repel / (dist * dist);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    
                    if (nodes[i] !== this.draggedNode && !nodes[i].pinned) {
                        nodes[i].vx -= fx;
                        nodes[i].vy -= fy;
                    }
                    if (nodes[j] !== this.draggedNode && !nodes[j].pinned) {
                        nodes[j].vx += fx;
                        nodes[j].vy += fy;
                    }
                }
            }
        }

        // Attraction and Center Gravity removed for "static" feel but "spaced" look
        // We only move nodes if they have velocity from repulsion or dragging release
        
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        nodes.forEach(n => {
            if (n === this.draggedNode || n.pinned) {
                n.vx = 0;
                n.vy = 0;
                return;
            }
            
            // Apply friction and movement
            n.vx *= friction;
            n.vy *= friction;
            n.x += n.vx;
            n.y += n.vy;

            // Contain within bounds with legend padding at top
            const pad = 60;
            const topPad = 120; // Extra room for legend at top
            if (n.x < pad) { n.x = pad; n.vx *= -1; }
            if (n.x > this.canvas.width - pad) { n.x = this.canvas.width - pad; n.vx *= -1; }
            if (n.y < topPad) { n.y = topPad; n.vy *= -1; }
            if (n.y > this.canvas.height - pad) { n.y = this.canvas.height - pad; n.vy *= -1; }
        });
    }

    getCSSVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

    draw() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const nodes = this.graphData.nodes;
        const edges = this.graphData.edges;

        // --- DRAW LINKS ---
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeStyle = this.isDark ? 'rgba(35, 53, 84, 0.4)' : 'rgba(200, 200, 200, 0.4)';
        
        edges.forEach(edge => {
            const s = nodes.find(n => n.id === edge.source);
            const t = nodes.find(n => n.id === edge.target);
            if (s && t) {
                this.ctx.beginPath();
                this.ctx.moveTo(s.x, s.y);
                this.ctx.lineTo(t.x, t.y);
                this.ctx.stroke();
            }
        });

        // --- DRAW FLOW PARTICLES ---
        this.particles.forEach(p => {
            const s = nodes.find(n => n.id === p.edge.source);
            const t = nodes.find(n => n.id === p.edge.target);
            if (s && t) {
                p.progress += p.speed;
                if (p.progress > 1) p.progress = 0;
                const x = s.x + (t.x - s.x) * p.progress;
                const y = s.y + (t.y - s.y) * p.progress;
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, 2, 0, Math.PI * 2);
                this.ctx.fillStyle = this.getCSSVar('--accent-color');
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = this.getCSSVar('--accent-color');
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            }
        });

        // --- DRAW NODES ---
        nodes.forEach(node => {
            const colorKey = node.type === 'argument' ? '--node-argument' : 
                             node.type === 'counter' ? '--node-counter' : 
                             node.type === 'unresolved' ? '--node-unresolved' : '--node-concept';
            
            const nodeColor = this.getCSSVar(colorKey);
            
            this.ctx.save();
            this.ctx.translate(node.x, node.y);
            
            // Pulsing highlight for replay
            if (node.pulsing) {
                const pulse = Math.sin(Date.now() / 200) * 5 + 10;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, node.r + pulse, 0, Math.PI * 2);
                this.ctx.strokeStyle = `rgba(0, 242, 255, ${0.5 - pulse/40})`;
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
            }

            // Node Shadow/Glow
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = 'rgba(0,0,0,0.3)';

            // Node Circle
            this.ctx.beginPath();
            this.ctx.arc(0, 0, node.r, 0, Math.PI * 2);
            this.ctx.fillStyle = nodeColor; 
            this.ctx.fill();
            
            // Inner Ring
            this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Label Background
            this.ctx.font = 'bold 11px Inter, sans-serif';
            const label = node.label;
            const metrics = this.ctx.measureText(label);
            const padding = 4;
            
            this.ctx.fillStyle = this.isDark ? 'rgba(2, 6, 23, 0.8)' : 'rgba(248, 250, 252, 0.8)';
            this.ctx.fillRect(-metrics.width/2 - padding, node.r + 8, metrics.width + padding*2, 16);

            // Label Text
            this.ctx.fillStyle = this.isDark ? '#fff' : '#0A192F';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(label, 0, node.r + 20);
            this.ctx.restore();
        });

        this.drawLegend();
    }

    drawLegend() {
        const categories = [
            { label: 'CORE NEXUS', color: this.getCSSVar('--node-concept') || '#fbbf24' },
            { label: 'SUPPORTING VECTOR', color: this.getCSSVar('--node-argument') || '#34d399' },
            { label: 'FRICTION POINT', color: this.getCSSVar('--node-counter') || '#fb7185' },
            { label: 'SECONDARY INSIGHTS', color: this.getCSSVar('--node-unresolved') || '#94a3b8' }
        ];

        const padding = 20;
        const itemGap = 30;
        let currentX = 25;
        const y = 30;

        this.ctx.save();
        
        // Semi-transparent background pill
        const pillWidth = 650;
        const pillHeight = 36;
        const r = 18;
        const px = 15;
        const py = 12;

        this.ctx.beginPath();
        this.ctx.moveTo(px + r, py);
        this.ctx.lineTo(px + pillWidth - r, py);
        this.ctx.quadraticCurveTo(px + pillWidth, py, px + pillWidth, py + r);
        this.ctx.lineTo(px + pillWidth, py + pillHeight - r);
        this.ctx.quadraticCurveTo(px + pillWidth, py + pillHeight, px + pillWidth - r, py + pillHeight);
        this.ctx.lineTo(px + r, py + pillHeight);
        this.ctx.quadraticCurveTo(px, py + pillHeight, px, py + pillHeight - r);
        this.ctx.lineTo(px, py + r);
        this.ctx.quadraticCurveTo(px, py, px + r, py);
        this.ctx.closePath();

        this.ctx.fillStyle = this.isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.9)';
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        this.ctx.stroke();

        categories.forEach(cat => {
            // Dot
            this.ctx.beginPath();
            this.ctx.arc(currentX + 10, y + 2, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = cat.color;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = cat.color;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Text
            this.ctx.font = 'bold 10px Inter, sans-serif';
            this.ctx.fillStyle = this.isDark ? '#fff' : '#1e293b';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(cat.label, currentX + 22, y + 4);

            const metrics = this.ctx.measureText(cat.label);
            currentX += metrics.width + itemGap + 20;
        });

        this.ctx.restore();
    }

    animate() {
        this.applyPhysics();
        this.draw();
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    setTheme(isDark) { this.isDark = isDark; }

    highlightNodeByLabel(text, pulse) {
        if (!text) return;
        const target = text.toLowerCase();
        
        // Find nodes where label is in text or text is in label
        // Rank by label length to avoid matching "a" or other small words incorrectly
        const matchingNodes = this.graphData.nodes.filter(n => {
            const label = n.label.toLowerCase();
            return label.length > 2 && (target.includes(label) || label.includes(target));
        });

        if (matchingNodes.length > 0) {
            // Sort by label length descending to get the most specific match
            matchingNodes.sort((a, b) => b.label.length - a.label.length);
            const node = matchingNodes[0];
            
            this.highlightedNode = node;
            if (pulse) {
                // Temporary highlight
                setTimeout(() => {
                    if (this.highlightedNode === node) this.highlightedNode = null;
                }, 3000);
            }
            return node;
        }
        return null;
    }
}
