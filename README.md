# Quick Guide to Using KojiCanvas

## 1. Include the `kojiCanvas.js` file in your HTML

```html
<script src="kojiCanvas.js"></script>
```

## 2. Add a `<canvas>` element with the desired class or id

Example:

```html
<canvas class="canvas"></canvas>
```

## 3. Create a `KojiCanvas` object

Pass parameters:

- `el.canvas` — selector for your canvas (e.g., `.canvas`)
- `retina` — `true` to support Retina displays

Example:

```javascript
const params = {
  el: { canvas: ".canvas" },
  retina: true,
};

const kojiCanvas = new KojiCanvas(params);
```

## 4. Draw a frame using `drawFrame`

Call the `drawFrame` method and pass a 2D array of colors.  
Each color is an array in **RGBA** format (values from 0–255, where alpha is transparency):

```javascript
kojiCanvas.drawFrame([
  [
    [255, 0, 0, 128], // semi-transparent red
    [0, 255, 0, 255], // opaque green
  ],
  [
    [0, 0, 255, 64], // very transparent blue
    [255, 255, 0, 200], // semi-transparent yellow
  ],
]);
```

## 5. Canvas auto-resizing

The canvas automatically resizes to fit the browser window.

---

## 📘 Method Documentation

- `drawFrame(grid)` — draw a color grid from a 2D array of RGBA values.
- `clearCanvas(gl, canvas)` — clear the entire canvas.

---

You can now use **KojiCanvas** to easily render pixel-style frames on a WebGL canvas!
