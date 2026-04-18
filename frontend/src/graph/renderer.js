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

            if (this.draggedNode) this.canvas.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.draggedNode) return;
            const rect = this.canvas.getBoundingClientRect();
            this.draggedNode.x = e.clientX - rect.left;
            this.draggedNode.y = e.clientY - rect.top;
        });

        window.addEventListener('mouseup', () => {
            if (this.draggedNode) {
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

        graphData.nodes.forEach(n => {
            n.x = cx + (Math.random() - 0.5) * 400;
            n.y = cy + (Math.random() - 0.5) * 400;
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
        const nodes = this.graphData.nodes;
        const edges = this.graphData.edges;
        const k = 0.05; // Spring constant
        const repel = 1500; // Repulsion constant
        const friction = 0.85;

        // 1. Repulsion
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[j].x - nodes[i].x;
                const dy = nodes[j].y - nodes[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = repel / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                nodes[i].vx -= fx;
                nodes[i].vy -= fy;
                nodes[j].vx += fx;
                nodes[j].vy += fy;
            }
        }

        // 2. Attraction (Springs)
        edges.forEach(edge => {
            const s = nodes.find(n => n.id === edge.source);
            const t = nodes.find(n => n.id === edge.target);
            if (s && t) {
                const dx = t.x - s.x;
                const dy = t.y - s.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (dist - 150) * k;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                s.vx += fx;
                s.vy += fy;
                t.vx -= fx;
                t.vy -= fy;
            }
        });

        // 3. Center Gravity
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        nodes.forEach(n => {
            if (n === this.draggedNode) return;
            n.vx += (cx - n.x) * 0.01;
            n.vy += (cy - n.y) * 0.01;
            n.vx *= friction;
            n.vy *= friction;
            n.x += n.vx;
            n.y += n.vy;
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

            // Cinematic Glow
            const grad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, node.r * 2);
            grad.addColorStop(0, nodeColor);
            grad.addColorStop(1, 'transparent');
            
            this.ctx.globalAlpha = 0.15;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, node.r * 2, 0, Math.PI * 2);
            this.ctx.fillStyle = grad;
            this.ctx.fill();
            
            this.ctx.globalAlpha = 1.0;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, node.r, 0, Math.PI * 2);
            this.ctx.fillStyle = nodeColor;
            this.ctx.fill();
            
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Label
            this.ctx.fillStyle = this.isDark ? '#fff' : '#0A192F';
            this.ctx.font = 'bold 12px Inter, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(node.label, 0, node.r + 18);
            
            this.ctx.restore();
        });
    }

    animate() {
        this.applyPhysics();
        this.draw();
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    setTheme(isDark) { this.isDark = isDark; }
}
