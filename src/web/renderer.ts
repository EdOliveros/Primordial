export const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPos;

uniform sampler2D uPosTex;
uniform sampler2D uBioTex;
uniform int uTexSize;

uniform vec2 uWorldSize;
uniform float uCellSize;
uniform vec2 uCameraPos;
uniform float uZoom;

out vec4 vColor;
out float vGlow;

void main() {
    int x = gl_InstanceID % uTexSize;
    int y = gl_InstanceID / uTexSize;
    vec2 uv = (vec2(float(x), float(y)) + 0.5) / float(uTexSize);

    vec4 posVel = texture(uPosTex, uv);
    vec4 bio = texture(uBioTex, uv);

    // Filter out inactive cells (energy <= 0)
    if (bio.x <= 0.0) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // Off-screen
        return;
    }

    // Determine color based on archetype index (stored in bio.y)
    int arch = int(bio.y);
    vec3 color = vec3(0.4); // Default gray
    float glow = 0.0;
    
    if (arch == 1) { color = vec3(1.0, 0.0, 0.2); glow = 1.0; } // Pred
    if (arch == 2) { color = vec3(0.2, 1.0, 0.0); glow = 1.0; } // Prod
    if (arch == 3) { color = vec3(0.0, 0.8, 1.0); glow = 1.0; } // Tank
    if (arch == 4) { color = vec3(1.0, 1.0, 1.0); glow = 1.0; } // Speed

    vColor = vec4(color, 1.0);
    vGlow = glow;
    
    vec2 worldPos = aPos * uCellSize + posVel.xy;
    vec2 viewPos = (worldPos - uCameraPos) * uZoom;
    vec2 normalized = viewPos / (uWorldSize * 0.5); 
    gl_Position = vec4(normalized.x, -normalized.y, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `#version 300 es
// ... (stays the same as before, but I'll redefine it for completeness in the chunk)
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
    outColor = scene + bloom * 1.5; // Add bloom
}
`;

export class PrimordialRenderer {
    private gl: WebGL2RenderingContext;
    private program: WebGLProgram;
    private bloomProgram: WebGLProgram;

    private quadVAO!: WebGLVertexArrayObject;
    private instancePosBuffer!: WebGLBuffer;
    private instanceColorBuffer!: WebGLBuffer;

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

        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);

        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        return prog;
    }

    private initBuffers() {
        const gl = this.gl;
        this.quadVAO = gl.createVertexArray()!;
        gl.bindVertexArray(this.quadVAO);

        // Cell Geometry (Square)
        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        // Instance Positions
        this.instancePosBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instancePosBuffer);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(1, 1);

        // Instance Colors
        this.instanceColorBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceColorBuffer);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(2, 1);
    }

    private createTexture(w: number, h: number): WebGLTexture {
        const gl = this.gl;
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
    }

    render(
        worldSize: [number, number],
        stateTextures: { posVel: WebGLTexture, bioData: WebGLTexture, size: number },
        count: number,
        cameraPos: [number, number],
        zoom: number
    ) {
        const gl = this.gl;

        // 1. Render Scene to FBO
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.01, 0.01, 0.01, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);
        gl.bindVertexArray(this.quadVAO);

        // Bind Textures
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, stateTextures.posVel);
        gl.uniform1i(gl.getUniformLocation(this.program, "uPosTex"), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, stateTextures.bioData);
        gl.uniform1i(gl.getUniformLocation(this.program, "uBioTex"), 1);

        gl.uniform1i(gl.getUniformLocation(this.program, "uTexSize"), stateTextures.size);
        gl.uniform2f(gl.getUniformLocation(this.program, "uWorldSize"), worldSize[0], worldSize[1]);
        gl.uniform1f(gl.getUniformLocation(this.program, "uCellSize"), 3.0);
        gl.uniform2f(gl.getUniformLocation(this.program, "uCameraPos"), cameraPos[0], cameraPos[1]);
        gl.uniform1f(gl.getUniformLocation(this.program, "uZoom"), zoom);

        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);

        // 2. Final Pass (Combine)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(this.bloomProgram);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
        gl.uniform1i(gl.getUniformLocation(this.bloomProgram, "uScene"), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.glowTex);
        gl.uniform1i(gl.getUniformLocation(this.bloomProgram, "uBloom"), 1);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
