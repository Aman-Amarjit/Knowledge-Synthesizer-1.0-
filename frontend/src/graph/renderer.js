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
        this.setupEvents();
    }

    setupEvents() {
        if (!this.canvas) return;

        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Check if we hit a node
            this.draggedNode = this.graphData.nodes.slice().reverse().find(node => {
                const dx = node.x - mouseX;
                const dy = node.y - mouseY;
                return Math.sqrt(dx * dx + dy * dy) <= node.r;
            });

            if (this.draggedNode) {
                this.canvas.style.cursor = 'grabbing';
            }
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

        if (graphData.nodes.length > 0) {
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;

            const layoutMap = {
                1: { x: 0, y: 0 },
                2: { x: -100, y: -80 },
                3: { x: 100, y: -80 },
                4: { x: -80, y: 100 },
                5: { x: 80, y: 100 },
                6: { x: 150, y: 0 }
            };

            graphData.nodes.forEach(n => {
                const offset = layoutMap[n.id] || { x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 200 };
                n.x = cx + offset.x;
                n.y = cy + offset.y;
                n.r = n.type === 'concept' ? 25 : 20;
                if (n.type === 'unresolved') n.r = 15;
            });
        }

        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animate(graphData);

        if (this.canvas.resizeHandler) window.removeEventListener('resize', this.canvas.resizeHandler);
        this.canvas.resizeHandler = () => {
            this.canvas.width = this.container.offsetWidth;
            this.canvas.height = this.container.offsetHeight;
            this.draw(graphData);
        };
        window.addEventListener('resize', this.canvas.resizeHandler);
    }

    getCSSVar(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }

    draw(graphData) {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // --- DRAW LINKS ---
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = this.isDark ? '#233554' : '#ccc';
        
        graphData.edges.forEach(edge => {
            const start = graphData.nodes.find(n => n.id === edge.source);
            const end = graphData.nodes.find(n => n.id === edge.target);

            if (start && end) {
                this.ctx.beginPath();
                this.ctx.moveTo(start.x, start.y);
                this.ctx.lineTo(end.x, end.y);
                
                if (edge.dashed) this.ctx.setLineDash([5, 5]);
                else this.ctx.setLineDash([]);
                
                this.ctx.stroke();
            }
        });
        
        this.ctx.setLineDash([]);

        // --- DRAW NODES ---
        graphData.nodes.forEach(node => {
            const colorKey = node.type === 'argument' ? '--node-argument' : 
                             node.type === 'counter' ? '--node-counter' : 
                             node.type === 'unresolved' ? '--node-unresolved' : '--node-concept';
            
            const nodeColor = this.getCSSVar(colorKey);

            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
            this.ctx.fillStyle = nodeColor;
            this.ctx.fill();
            
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Label
            this.ctx.fillStyle = this.isDark ? '#fff' : '#0A192F';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(node.label, node.x, node.y + node.r + 15);
        });
    }

    animate(graphData) {
        this.draw(graphData);
        this.animationId = requestAnimationFrame(() => this.animate(graphData));
    }

    setTheme(isDark) {
        this.isDark = isDark;
    }
}
