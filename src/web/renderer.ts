export const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aQuadPos;
// Instance Attributes
layout(location = 1) in vec2 aWorldPos;
layout(location = 2) in vec2 aVel;
layout(location = 3) in float aEnergy;
layout(location = 4) in float aArch;

uniform vec2 uViewportSize;
uniform vec2 uCameraPos;
uniform float uZoom;
uniform float uCellSize;

out vec4 vColor;
out float vGlow;

void main() {
    // 1. Frustum Culling & Activity Check
    if (aEnergy <= 0.0) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
    }

    vec2 viewPos = (aWorldPos - uCameraPos) * uZoom;

    // Simple culling: if outside NDC range (+ margin for cell size)
    float margin = uCellSize * uZoom + 10.0;
    if (abs(viewPos.x) > uViewportSize.x * 0.5 + margin || 
        abs(viewPos.y) > uViewportSize.y * 0.5 + margin) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
    }

    // 2. Color Classification
    int arch = int(aArch);
    vec3 color = vec3(0.4);
    float glow = 0.0;
    
    if (arch == 1) { color = vec3(1.0, 0.0, 0.2); glow = 1.0; } // Pred
    if (arch == 2) { color = vec3(0.2, 1.0, 0.0); glow = 1.0; } // Prod
    if (arch == 3) { color = vec3(0.0, 0.8, 1.0); glow = 1.0; } // Tank
    if (arch == 4) { color = vec3(1.0, 1.0, 1.0); glow = 1.0; } // Speed

    vColor = vec4(color, 1.0);
    vGlow = glow;
    
    // 3. Transform
    vec2 pos = aQuadPos * uCellSize * uZoom + viewPos;
    vec2 ndc = pos / (uViewportSize * 0.5); 
    gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 vColor;
in float vGlow;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outGlow;
void main() {
    outColor = vColor;
    outGlow = vColor * vGlow;
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

    private quadVAO!: WebGLVertexArrayObject;
    private instanceBuffer!: WebGLBuffer;

    private sceneFBO!: WebGLFramebuffer;
    private sceneTex!: WebGLTexture;
    private glowTex!: WebGLTexture;

    constructor(canvas: HTMLCanvasElement) {
        const gl = canvas.getContext("webgl2", { antialias: false });
        if (!gl) throw new Error("WebGL 2 not supported");
        this.gl = gl;

        this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
        this.bloomProgram = this.createProgram(BLOOM_VERTEX, BLOOM_FRAGMENT);

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
        const gl = this.gl;

        // Re-create textures if size changed
        if (this.sceneTex) gl.deleteTexture(this.sceneTex);
        if (this.glowTex) gl.deleteTexture(this.glowTex);

        this.sceneTex = this.createTexture(w, h);
        this.glowTex = this.createTexture(w, h);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneTex, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.glowTex, 0);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    render(
        viewportSize: [number, number],
        cells: Float32Array,
        count: number,
        cameraPos: [number, number],
        zoom: number
    ) {
        const gl = this.gl;

        // Upload instance data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
        // Stride is 16
        gl.bufferData(gl.ARRAY_BUFFER, cells.subarray(0, count * 16), gl.DYNAMIC_DRAW);

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

        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);

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
    }
}
