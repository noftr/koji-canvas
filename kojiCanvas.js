class KojiCanvas {
  constructor(params) {
    this.params = params;
    this.state = {
      canvas: null,
      ctx: null,
    };
    this.init();
  }

  init() {
    // Здесь можно добавить инициализацию канваса, если потребуется
  }
}

const params = {
  el: {
    canvas: ".canvas",
  },
};

new KojiCanvas(params);
