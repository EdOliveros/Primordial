export const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPos;       // Quad vertices
layout(location = 1) in vec2 aWorldPos;  // Instance Position
layout(location = 2) in vec2 aVel;       // Instance Velocity
layout(location = 3) in float aEnergy;   // Instance Energy
layout(location = 4) in float aArch;     // Instance Archetype
layout(location = 5) in float aMass;     // Instance Mass

uniform vec2 uViewport;
uniform vec2 uCamera;
uniform float uZoom;

out vec3 vColor;
out float vGlow;
out float vMass;

void main() {
    // 10-Level Logarithmic Scale
    // Base radius = 8.0 (at mass 1)
    // Max radius = 80.0 (at mass 1000+)
    float radius = 8.0 * (1.0 + log(aMass) * 1.5); 
    
    // Scale by Zoom
    float size = radius * uZoom;

    // Quad expansion
    vec2 offset = aPos * size; 
    vec2 worldPos = aWorldPos + offset;

    // Camera Transform
    vec2 viewPos = (worldPos - uCamera) * uZoom;
    
    // Map to NDC [-1, 1]
    vec2 ndc = viewPos / (uViewport * 0.5);

    gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);

    // Color Logic (Simplified for Shader)
    vec3 color = vec3(0.5); // Default grey
    float glow = 0.0;

    int arch = int(aArch);
    if (arch == 1) { color = vec3(1.0, 0.2, 0.2); glow = 0.5; } // Predator
    else if (arch == 2) { color = vec3(0.2, 1.0, 0.2); glow = 0.3; } // Producer
    else if (arch == 3) { color = vec3(0.0, 0.5, 1.0); glow = 0.2; } // Tank
    else if (arch == 4) { color = vec3(1.0, 1.0, 1.0); glow = 0.8; } // Speedster
    
    // Colony Glow (Special Flag in color logic or passed differently)
    if (aMass > 1.5) {
        glow += 0.5; // Colonies glow more
    }

    vColor = color;
    vGlow = glow;
    vMass = aMass;
    
    // 3. Transform
    float sizeMult = max(1.0, log2(aMass)); // Scale size logarithmically with mass
    vec2 pos = aQuadPos * uCellSize * uZoom * sizeMult + viewPos;
    vec2 ndc = pos / (uViewportSize * 0.5); 
    // float sizeMult = max(1.0, log2(aMass)); // Scale size logarithmically with mass
    // vec2 pos = aQuadPos * uCellSize * uZoom * sizeMult + viewPos;
    // vec2 ndc = pos / (uViewportSize * 0.5); 
    // gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vColor;
in float vGlow;
in float vMass;
in vec2 viewPosDebug; // Not used but kept for interface matching if needed

uniform float uTime;

layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outGlow;

float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
    float dist = length(gl_PointCoord - vec2(0.5)) * 2.0; // 0.0 to 1.0 (Unit Circle)
    if (dist > 1.0) discard;

    float alpha = 1.0;
    vec3 finalColor = vColor;
    float finalGlow = vGlow;

    // --- TIER SYSTEM ---
    
    // TIER 3: APEX ENTITY (Mass > 500)
    if (vMass > 500.0) {
        // Pulsing Core
        float pulse = 0.8 + 0.2 * sin(uTime * 3.0);
        float core = smoothstep(0.5 * pulse, 0.0, dist);
        
        // Orbiting Energy
        float orbit = 0.0;
        float angle = atan(gl_PointCoord.y - 0.5, gl_PointCoord.x - 0.5);
        float spirals = sin(angle * 5.0 + uTime * 2.0 - dist * 10.0);
        orbit = smoothstep(0.1, 0.0, abs(dist - 0.7 + spirals * 0.1));

        alpha = core + orbit;
        finalColor = mix(vColor, vec3(1.0, 1.0, 1.0), orbit); // White spirals
        finalGlow = 1.0; // Max Glow
    }
    // TIER 2: FORTRESS (Mass 50 - 500)
    else if (vMass > 50.0) {
        // Solid Core + Thick Membrane
        float core = smoothstep(0.6, 0.55, dist);
        float border = smoothstep(0.8, 0.75, dist) - smoothstep(0.65, 0.6, dist);
        
        alpha = core + border;
        finalColor = mix(vColor, vec3(1.0), border * 0.5); // Lighter border
        finalGlow = 0.8;
    }
    // TIER 1: COLONY / CELL (Mass < 50)
    else {
        // Soft Circle
        alpha = smoothstep(1.0, 0.8, dist);
        finalGlow = 0.5;
    }

    outColor = vec4(finalColor, alpha);
    outGlow = vec4(finalColor * finalGlow, alpha);

    if (alpha < 0.01) discard;
}
`;

export const BLOOM_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vTexCoord;
void main() {
    vTexCoord = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const BLOOM_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
in vec2 vTexCoord;
out vec4 outColor;
void main() {
    vec4 scene = texture(uScene, vTexCoord);
    vec4 bloom = texture(uBloom, vTexCoord);
    outColor = scene + bloom * 1.5;
}
`;

export class PrimordialRenderer {
    private gl: WebGL2RenderingContext;
    private program: WebGLProgram;
    private bloomProgram: WebGLProgram;
    private allianceProgram: WebGLProgram | null = null; // Guard against null

    private quadVAO!: WebGLVertexArrayObject;
    private instanceBuffer!: WebGLBuffer;

    private sceneFBO!: WebGLFramebuffer;
    private sceneTex!: WebGLTexture;
    private glowTex!: WebGLTexture;

    // Alliance Lines
    private lineProgram!: WebGLProgram;
    private lineVAO!: WebGLVertexArrayObject;
    private lineBuffer!: WebGLBuffer;
    private lineData: Float32Array = new Float32Array(4000); // Max 1000 lines (4 floats per vertex?) No, 2 floats per vertex. 2 vertices per line. = 4 floats per line. 1000 lines = 4000 floats.

    // Frustum Culling buffer (persistent to avoid re-allocation)
    private visibleBuffer: Float32Array;
    private readonly STRIDE = 16;

    constructor(canvas: HTMLCanvasElement) {
        const gl = canvas.getContext("webgl2", { antialias: false });
        if (!gl) throw new Error("WebGL 2 not supported");
        this.gl = gl;

        // Pre-allocate buffer for visible cells (max 100k cells)
        this.visibleBuffer = new Float32Array(100000 * this.STRIDE);

        this.initPrograms(); // Call the new initPrograms method
        this.initBuffers();
        this.initFBO();
    }

    private initFBO() {
        const gl = this.gl;
        this.sceneFBO = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO);

        const w = gl.canvas.width;
        const h = gl.canvas.height;

        this.sceneTex = this.createTexture(w, h);
        this.glowTex = this.createTexture(w, h);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneTex, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.glowTex, 0);

        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    private createProgram(vsSource: string, fsSource: string): WebGLProgram {
        const gl = this.gl;
        const vs = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            console.error("Vertex Shader Error:", gl.getShaderInfoLog(vs));
        }

        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error("Fragment Shader Error:", gl.getShaderInfoLog(fs));
        }

        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);

        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error("Program Link Error:", gl.getProgramInfoLog(prog));
        }

        return prog;
    }

    private initPrograms() {
        this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
        this.bloomProgram = this.createProgram(BLOOM_VERTEX, BLOOM_FRAGMENT);

        // Initialize Alliance Program
        this.initAllianceProgram();
    }

    private initAllianceProgram() {
        const ALLIANCE_VS = `#version 300 es
        layout(location = 0) in vec2 aPos;
        uniform vec2 uViewport;
        uniform vec2 uCamera;
        uniform float uZoom;
        void main() {
            vec2 viewPos = (aPos - uCamera) * uZoom;
            vec2 ndc = viewPos / (uViewport * 0.5);
            gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
        }`;

        const ALLIANCE_FS = `#version 300 es
        precision mediump float;
        out vec4 outColor;
        void main() {
            outColor = vec4(0.0, 1.0, 1.0, 0.3); // Cyan, faint
        }`;

        this.allianceProgram = this.createProgram(ALLIANCE_VS, ALLIANCE_FS);
    }

    private initBuffers() {
        const gl = this.gl;
        this.quadVAO = gl.createVertexArray()!;
        gl.bindVertexArray(this.quadVAO);

        // Unit Quad
        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        // Instance Data (Interleaved)
        this.instanceBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);

        const stride = 16 * 4; // 16 floats * 4 bytes

        // Location 1: aWorldPos (x, y)
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0);
        gl.vertexAttribDivisor(1, 1);

        // Location 2: aVel (vx, vy) - Optional for shader but good for layout
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 2 * 4);
        gl.vertexAttribDivisor(2, 1);

        // Location 3: aEnergy
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 4 * 4);
        gl.vertexAttribDivisor(3, 1);

        // Location 4: aArch
        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 5 * 4);
        gl.vertexAttribDivisor(4, 1);

        // Location 5: aMass
        gl.enableVertexAttribArray(5);
        gl.vertexAttribPointer(5, 1, gl.FLOAT, false, stride, 6 * 4);
        gl.vertexAttribDivisor(5, 1);

        // --- Line Setup ---
        this.lineVAO = gl.createVertexArray()!;
        gl.bindVertexArray(this.lineVAO);
        this.lineBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.lineData.byteLength, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        // Restore Quad VAO default
        gl.bindVertexArray(this.quadVAO);
    }

    private createTexture(w: number, h: number): WebGLTexture {
        const gl = this.gl;
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return tex;
    }

    public resize(w: number, h: number) {
        if (w <= 0 || h <= 0) return;

        const gl = this.gl;
        gl.viewport(0, 0, w, h);

        // Re-create textures if size changed
        if (this.sceneTex) gl.deleteTexture(this.sceneTex);
        if (this.glowTex) gl.deleteTexture(this.glowTex);

        this.sceneTex = this.createTexture(w, h);
        this.glowTex = this.createTexture(w, h);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneTex, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.glowTex, 0);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

        // Check FBO status
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error("Framebuffer/Resize Error:", status);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    private drawWorldBoundary(_viewportSize: [number, number], _cameraPos: [number, number], _zoom: number) {
        // Method implemented to prevent crash. 
        // Boundary rendering is implicitly handled by camera constraints (0-1000).
    }


    render(
        viewportSize: [number, number],
        cells: Float32Array,
        count: number,
        cameraPos: [number, number],
        zoom: number,
        allianceId?: Int32Array
    ) {
        const gl = this.gl;

        // === FRUSTUM CULLING (CPU-side) ===
        // Calculate world-space viewport bounds with margin
        const halfWidth = (viewportSize[0] / 2) / zoom;
        const halfHeight = (viewportSize[1] / 2) / zoom;
        const margin = 50; // Extra margin to prevent popping at edges

        const minX = cameraPos[0] - halfWidth - margin;
        const maxX = cameraPos[0] + halfWidth + margin;
        const minY = cameraPos[1] - halfHeight - margin;
        const maxY = cameraPos[1] + halfHeight + margin;

        let visibleCount = 0;
        for (let i = 0; i < count; i++) {
            const offset = i * this.STRIDE;
            const x = cells[offset];
            const y = cells[offset + 1];
            const energy = cells[offset + 4];

            // Skip inactive or out-of-bounds cells
            if (energy <= 0) continue;
            if (x < minX || x > maxX || y < minY || y > maxY) continue;

            // Copy visible cell to visibleBuffer
            const destOffset = visibleCount * this.STRIDE;
            for (let j = 0; j < this.STRIDE; j++) {
                this.visibleBuffer[destOffset + j] = cells[offset + j];
            }
            visibleCount++;
        }

        // Upload only visible cells
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.visibleBuffer.subarray(0, visibleCount * this.STRIDE), gl.DYNAMIC_DRAW);

        // 1. Scene Pass
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);
        gl.bindVertexArray(this.quadVAO);

        gl.uniform2f(gl.getUniformLocation(this.program, "uViewportSize"), viewportSize[0], viewportSize[1]);
        gl.uniform2f(gl.getUniformLocation(this.program, "uCameraPos"), cameraPos[0], cameraPos[1]);
        gl.uniform1f(gl.getUniformLocation(this.program, "uZoom"), zoom);
        gl.uniform1f(gl.getUniformLocation(this.program, "uCellSize"), 4.0);
        gl.uniform1f(gl.getUniformLocation(this.program, "uTime"), performance.now() / 1000.0);

        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, visibleCount);

        // Draw world boundary (1000x1000)
        // Safety check to prevent crash if method is missing
        if (typeof this.drawWorldBoundary === 'function') {
            this.drawWorldBoundary(viewportSize, cameraPos, zoom);
        }

        // 2. Final / Bloom Addition Pass
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.useProgram(this.bloomProgram);
        gl.bindVertexArray(this.quadVAO); // Re-bind for aPos

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
        gl.uniform1i(gl.getUniformLocation(this.bloomProgram, "uScene"), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.glowTex);
        gl.uniform1i(gl.getUniformLocation(this.bloomProgram, "uBloom"), 1);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        if (allianceId) {
            this.drawAllianceLinks(gl, cells, count, allianceId, viewportSize, cameraPos, zoom);
        }
    }

    private drawAllianceLinks(
        gl: WebGL2RenderingContext,
        cells: Float32Array,
        count: number,
        allianceId: Int32Array,
        viewportSize: [number, number],
        cameraPos: [number, number],
        zoom: number
    ) {
        let lineCount = 0;
        const stride = this.STRIDE;

        // Map<AllianceID, List<Index>>
        const alliances: Record<number, number[]> = {};

        for (let i = 0; i < count; i++) {
            const aid = allianceId[i];
            if (aid > 0) {
                if (!alliances[aid]) alliances[aid] = [];
                alliances[aid].push(i);
            }
        }

        // Generate lines
        let dPtr = 0;
        for (const id in alliances) {
            const members = alliances[id];
            if (members.length < 2) continue;

            // Connect members
            for (let i = 0; i < members.length; i++) {
                for (let j = i + 1; j < members.length; j++) {
                    const idxA = members[i];
                    const idxB = members[j];

                    const offA = idxA * stride;
                    const offB = idxB * stride;

                    this.lineData[dPtr++] = cells[offA];     // x1
                    this.lineData[dPtr++] = cells[offA + 1]; // y1
                    this.lineData[dPtr++] = cells[offB];     // x2
                    this.lineData[dPtr++] = cells[offB + 1]; // y2
                    lineCount++;

                    if (lineCount >= 2000) break;
                }
            }
        }

        if (lineCount > 0) {
            gl.useProgram(this.allianceProgram);
            gl.bindVertexArray(this.lineVAO);

            // Uniforms
            const uRes = gl.getUniformLocation(this.allianceProgram, 'uResolution');
            gl.uniform2f(gl.getUniformLocation(this.allianceProgram, "uViewport"), viewportSize[0], viewportSize[1]);
            gl.uniform2f(gl.getUniformLocation(this.allianceProgram, "uCamera"), cameraPos[0], cameraPos[1]);
            gl.uniform1f(gl.getUniformLocation(this.allianceProgram, "uZoom"), zoom);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lineData.subarray(0, dPtr));

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
            gl.drawArrays(gl.LINES, 0, lineCount * 2);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
    }
}
