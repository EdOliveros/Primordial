export const COMPUTE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vTexCoord;
void main() {
    vTexCoord = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const COMPUTE_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uPosVel;     // RGBA32F: x, y, vx, vy
uniform sampler2D uBioData;    // RGBA32F: energy, archIdx, age, state
uniform sampler2D uGenome1;    // RGBA32F: SPD, AGG, PHO, SIZ
uniform sampler2D uGenome2;    // RGBA32F: DEF, VIS, MUT, LIF

uniform float uDeltaTime;
uniform vec2 uWorldSize;
uniform float uMutationRate;
uniform float uFoodAbundance;

layout(location = 0) out vec4 outPosVel;
layout(location = 1) out vec4 outBioData;

in vec2 vTexCoord;

void main() {
    vec4 posVel = texture(uPosVel, vTexCoord);
    vec4 bio = texture(uBioData, vTexCoord);
    vec4 g1 = texture(uGenome1, vTexCoord);
    vec4 g2 = texture(uGenome2, vTexCoord);

    vec2 pos = posVel.xy;
    vec2 vel = posVel.zw;
    float energy = bio.x;

    // --- 1. Movement Logic ---
    float speed = g1.x * 2.0;
    // Simple random wander (pseudo-random based on pos and time)
    float angle = fract(sin(dot(pos, vec2(12.9898, 78.233))) * 43758.5453) * 6.28;
    vec2 force = vec2(cos(angle), sin(angle)) * speed;
    
    vel += force * uDeltaTime;
    vel *= 0.98; // Friction
    pos += vel * uDeltaTime;

    // Bound checks
    if (pos.x < -uWorldSize.x * 0.5) { pos.x = uWorldSize.x * 0.5; }
    if (pos.x > uWorldSize.x * 0.5) { pos.x = -uWorldSize.x * 0.5; }
    if (pos.y < -uWorldSize.y * 0.5) { pos.y = uWorldSize.y * 0.5; }
    if (pos.y > uWorldSize.y * 0.5) { pos.y = -uWorldSize.y * 0.5; }

    // --- 2. Biological Logic ---
    // Photosynthesis
    float pho = g1.z;
    energy += pho * uFoodAbundance * 0.1 * uDeltaTime;
    
    // Metabolic drain
    float drain = (speed * 0.05 + g1.w * 0.02); // Size and speed cost
    energy -= drain * uDeltaTime;

    // Hard bounds
    energy = clamp(energy, 0.0, 100.0);

    // Outputs
    outPosVel = vec4(pos, vel);
    outBioData = vec4(energy, bio.y, bio.z + uDeltaTime, bio.w);
}
`;

export class GpuEngine {
    private gl: WebGL2RenderingContext;
    private computeProgram: WebGLProgram;
    private quadVAO: WebGLVertexArrayObject;

    private textureSize: number;
    private framebuffers: WebGLFramebuffer[] = [];
    private textures: { [key: string]: WebGLTexture[] } = {};
    private currentFB = 0;

    constructor(gl: WebGL2RenderingContext, maxCells: number) {
        this.gl = gl;
        // Float types require extension
        const ext = gl.getExtension("EXT_color_buffer_float");
        if (!ext) throw new Error("EXT_color_buffer_float not supported");

        this.textureSize = Math.ceil(Math.sqrt(maxCells));
        this.computeProgram = this.createProgram(COMPUTE_VERTEX, COMPUTE_FRAGMENT);
        this.quadVAO = this.initQuad();
        this.initBuffers();
    }

    private initQuad(): WebGLVertexArrayObject {
        const gl = this.gl;
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);
        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        return vao;
    }

    private initBuffers() {
        const gl = this.gl;
        const size = this.textureSize;

        // Create texture pairs for Ping-Pong
        this.textures.posVel = [this.createDataTex(size), this.createDataTex(size)];
        this.textures.bioData = [this.createDataTex(size), this.createDataTex(size)];

        // Static Genomes (don't need ping-pong yet unless they evolve on GPU)
        this.textures.genome1 = [this.createDataTex(size)];
        this.textures.genome2 = [this.createDataTex(size)];

        // Create Framebuffers
        for (let i = 0; i < 2; i++) {
            const fb = gl.createFramebuffer()!;
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures.posVel[i], 0);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.textures.bioData[i], 0);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
            this.framebuffers.push(fb);
        }
    }

    private createDataTex(size: number): WebGLTexture {
        const gl = this.gl;
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        return tex;
    }

    private createProgram(vsSource: string, fsSource: string): WebGLProgram {
        const gl = this.gl;
        const vs = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(vs));

        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(fs));

        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        return prog;
    }

    public uploadData(
        positions: Float32Array, // x, y, vx, vy
        bioData: Float32Array,   // energy, archIdx, age, 0
        genomes1: Float32Array,  // g1-g4
        genomes2: Float32Array   // g5-g8
    ) {
        const size = this.textureSize;

        this.updateTex(this.textures.posVel[this.currentFB], size, positions);
        this.updateTex(this.textures.bioData[this.currentFB], size, bioData);
        this.updateTex(this.textures.genome1[0], size, genomes1);
        this.updateTex(this.textures.genome2[0], size, genomes2);
    }

    private updateTex(tex: WebGLTexture, size: number, data: Float32Array) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RGBA, gl.FLOAT, data);
    }

    public step(worldSize: [number, number], mutationRate: number, foodAbundance: number) {
        const gl = this.gl;
        const nextFB = 1 - this.currentFB;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[nextFB]);
        gl.viewport(0, 0, this.textureSize, this.textureSize);

        gl.useProgram(this.computeProgram);
        gl.bindVertexArray(this.quadVAO);

        // Bind current state as textures
        this.bindTex(0, "uPosVel", this.textures.posVel[this.currentFB]);
        this.bindTex(1, "uBioData", this.textures.bioData[this.currentFB]);
        this.bindTex(2, "uGenome1", this.textures.genome1[0]);
        this.bindTex(3, "uGenome2", this.textures.genome2[0]);

        gl.uniform1f(gl.getUniformLocation(this.computeProgram, "uDeltaTime"), 0.016);
        gl.uniform2f(gl.getUniformLocation(this.computeProgram, "uWorldSize"), worldSize[0], worldSize[1]);
        gl.uniform1f(gl.getUniformLocation(this.computeProgram, "uMutationRate"), mutationRate);
        gl.uniform1f(gl.getUniformLocation(this.computeProgram, "uFoodAbundance"), foodAbundance);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        this.currentFB = nextFB;
    }

    private bindTex(unit: number, name: string, tex: WebGLTexture) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(this.computeProgram, name), unit);
    }

    public async getTelemetry(): Promise<{ counts: number[], total: number }> {
        const gl = this.gl;
        const size = this.textureSize;

        // Optimize: Only read a quarter of the texture for telemetry sampling at 1M cells
        // This keeps the frame rate stable while giving a very accurate estimation
        const sampleSize = size / 2;
        const pixels = new Float32Array(sampleSize * sampleSize * 4);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.currentFB]);
        gl.readBuffer(gl.COLOR_ATTACHMENT1); // BioData
        gl.readPixels(0, 0, sampleSize, sampleSize, gl.RGBA, gl.FLOAT, pixels);

        const counts = [0, 0, 0, 0, 0]; // Avg, Pred, Prod, Tank, Speed
        let sampledTotal = 0;

        for (let i = 0; i < sampleSize * sampleSize; i++) {
            const energy = pixels[i * 4];
            const arch = Math.floor(pixels[i * 4 + 1]);
            if (energy > 0.0) {
                counts[arch]++;
                sampledTotal++;
            }
        }

        // Extrapolate for 1M
        const multiplier = 4;
        return {
            counts: counts.map(c => c * multiplier),
            total: sampledTotal * multiplier
        };
    }

    public async getMinimapData(): Promise<Float32Array> {
        const gl = this.gl;
        const sampleSize = 64; // Low res for minimap
        const pixels = new Float32Array(sampleSize * sampleSize * 4);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.currentFB]);
        gl.readBuffer(gl.COLOR_ATTACHMENT0); // PosVel
        // Reading only the top-left corner as a representative sample
        gl.readPixels(0, 0, sampleSize, sampleSize, gl.RGBA, gl.FLOAT, pixels);

        return pixels;
    }

    public getStateTextures() {
        return {
            posVel: this.textures.posVel[this.currentFB],
            bioData: this.textures.bioData[this.currentFB],
            size: this.textureSize
        };
    }
}
