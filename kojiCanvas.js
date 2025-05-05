class KojiCanvas {
  constructor(params) {
    this.params = params;
    this.state = {
      canvas: null,
      gl: null,
      program: null,
      vao: null,
      buffers: {},
      lastGrid: null,
      locations: {},
      gridSize: null,
      offsets: null,
      colors: null,
    };
    this.init();
  }

  init() {
    this.state.canvas = this.canvasInit(this.params.el.canvas);
    this.state.gl = this.contextInit(this.state.canvas);
    this.setupGL();

    // Attach resize event handler
    window.addEventListener("resize", () => {
      this.handleResize();
    });
  }

  handleResize() {
    const canvas = this.state.canvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = this.params.retina ? window.devicePixelRatio || 1 : 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    this.state.gl.viewport(0, 0, canvas.width, canvas.height);

    if (this.state.lastGrid) {
      this.drawFrame(this.state.lastGrid);
    }
  }

  canvasInit(canvasSelector) {
    const canvas = document.querySelector(canvasSelector);

    if (!canvas) throw new Error(`Canvas not found: ${canvasSelector}`);

    const rect = canvas.getBoundingClientRect();

    if (this.params.retina) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    } else {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
    return canvas;
  }

  contextInit(canvas) {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL2 not supported");
    return gl;
  }

  setupGL() {
    const gl = this.state.gl;

    // 1. Compile and link shaders
    this.state.program = this.createAndLinkProgram(gl);

    // 2. Cache uniform and attribute locations after program is linked
    this.cacheLocations(gl, this.state.program);

    // 3. Create VAO and vertex buffer
    this.state.vao = this.createVAOAndVertexBuffer(gl, this.state.program);

    // 4. Create instance buffers
    this.createInstanceBuffers(gl);
  }

  cacheLocations(gl, program) {
    // Cache uniform and attribute locations for performance
    this.state.locations = {
      u_resolution: gl.getUniformLocation(program, "u_resolution"),
      u_cellSize: gl.getUniformLocation(program, "u_cellSize"),
      a_offset: gl.getAttribLocation(program, "a_offset"),
      a_color: gl.getAttribLocation(program, "a_color"),
    };
  }

  createAndLinkProgram(gl) {
    const vs = `#version 300 es
    in vec2 a_pos;
    in vec2 a_offset;
    in vec4 a_color;
    uniform vec2 u_resolution;
    uniform float u_cellSize;
    out vec4 v_color;

    void main() {
      vec2 scaled = a_pos * u_cellSize;
      vec2 world = scaled + a_offset;
      vec2 clip = (world / u_resolution) * 2.0 - 1.0;
      gl_Position = vec4(clip * vec2(1, -1), 0, 1);
      v_color = a_color;
    }`;

    const fs = `#version 300 es
    precision mediump float;
    in vec4 v_color;
    out vec4 outColor;
    void main() {
      outColor = v_color;
    }`;

    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vs);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fs);
    return this.createProgram(vertexShader, fragmentShader);
  }

  createVAOAndVertexBuffer(gl, program) {
    // Square made of two triangles
    const quad = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Vertex buffer
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const a_pos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(a_pos);
    gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

    return vao;
  }

  createInstanceBuffers(gl) {
    // Instance buffers
    this.state.buffers.offset = gl.createBuffer();
    this.state.buffers.color = gl.createBuffer();
  }

  compileShader(type, source) {
    const gl = this.state.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      throw new Error("Shader compile failed");
    }

    return shader;
  }

  createProgram(vs, fs) {
    const gl = this.state.gl;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      throw new Error("Program link failed");
    }
    return program;
  }

  drawFrame(grid) {
    // Save last frame for resize
    this.state.lastGrid = grid;

    const gl = this.state.gl;
    const program = this.state.program;
    const canvas = this.state.canvas;
    const vao = this.state.vao;

    this.enableAlphaBlending(gl);

    const { cellSize, total, offsets, colors } = this.prepareGridData(
      grid,
      canvas
    );

    this.clearCanvas(gl, canvas);

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    this.setUniforms(gl, canvas, cellSize);
    this.updateInstanceBuffer(
      gl,
      this.state.buffers.offset,
      offsets,
      "a_offset",
      2
    );
    this.updateInstanceBuffer(
      gl,
      this.state.buffers.color,
      colors,
      "a_color",
      4
    );

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, total);
  }

  enableAlphaBlending(gl) {
    // Enable alpha blending for transparency support
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  prepareGridData(grid, canvas) {
    // Calculate cell size so that the grid fills the entire canvas and keeps proportions
    const rows = grid.length;
    const cols = grid[0].length;

    // Canvas size in pixels
    const width = canvas.width;
    const height = canvas.height;

    // Choose minimal cellSize so the whole grid fits and is not distorted
    const cellSizeX = width / cols;
    const cellSizeY = height / rows;
    const cellSize = Math.min(cellSizeX, cellSizeY);

    const total = rows * cols;

    // 🧹 Buffer reuse optimization
    // If grid size changed, reallocate buffers
    if (
      !this.state.gridSize ||
      this.state.gridSize.rows !== rows ||
      this.state.gridSize.cols !== cols
    ) {
      this.state.gridSize = { rows, cols };
      this.state.offsets = new Float32Array(total * 2);
      this.state.colors = new Float32Array(total * 4);
    }
    const offsets = this.state.offsets;
    const colors = this.state.colors;

    let i = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = i * 2;
        // Center the grid on the canvas
        const offsetX = x * cellSize + (width - cellSize * cols) / 2;
        const offsetY = y * cellSize + (height - cellSize * rows) / 2;
        offsets[idx] = offsetX;
        offsets[idx + 1] = offsetY;

        const color = grid[y][x];
        const cidx = i * 4;
        colors[cidx] = color[0] / 255;
        colors[cidx + 1] = color[1] / 255;
        colors[cidx + 2] = color[2] / 255;

        // If alpha is not set, assume 1 (opaque)
        colors[cidx + 3] = color.length > 3 ? color[3] / 255 : 1.0;
        i++;
      }
    }

    return { cellSize, total, offsets, colors };
  }

  clearCanvas(gl, canvas) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  setUniforms(gl, canvas, cellSize) {
    // Set uniforms using cached locations
    gl.uniform2f(
      this.state.locations.u_resolution,
      canvas.width,
      canvas.height
    );
    gl.uniform1f(this.state.locations.u_cellSize, cellSize);
  }

  updateInstanceBuffer(gl, buffer, data, attribName, size) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    // Use cached attribute location if available
    let attribLoc = this.state.locations[attribName];
    if (attribLoc === undefined) {
      // fallback for a_pos (not cached)
      attribLoc = gl.getAttribLocation(this.state.program, attribName);
    }
    gl.enableVertexAttribArray(attribLoc);
    gl.vertexAttribPointer(attribLoc, size, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(attribLoc, 1);
  }
}
