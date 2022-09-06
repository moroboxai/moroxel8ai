import * as PIXI from 'pixi.js';

function hash(r: number, g: number, b: number, a: number): number {
    return (r << 24) | (g << 16) | (b << 8) | a;
}

function numberToColor(v: number): { r: number, g: number, b: number } {
    return {
        r: ((v >> 16) & 0xFF),
        g: ((v >> 8) & 0xFF),
        b: v & 0xFF
    }
}

export class Palette {
    private _capacity: number;
    private _colors: Uint8Array;
    private _idByColor: {[key: number]: number} = {};
    private _index: number = 0;
    private _texture: PIXI.Texture;

    /**
     * Create a palette with a maximum of capacity colors.
     * @param {number} capacity - maximum number of colors
     */
    constructor(capacity: number) {
        this._capacity = capacity;
        this._colors = new Uint8Array(capacity * 4);
        this._texture = PIXI.Texture.EMPTY;
        this.push(0, 0, 0, 0);
    }

    get texture(): PIXI.Texture {
        return this._texture;
    }

    get colors(): Uint8Array {
        return this._colors;
    }

    /** Get the number of colors on this palette */
    get length(): number {
        return this._index;
    }

    color(index: number): {r: number, g: number, b: number, a: number} | undefined {
        if (index < 0 || index >= this._index) {
            return undefined;
        }

        index *= 4;
        return {
            r: this._colors[index],
            g: this._colors[index + 1],
            b: this._colors[index + 2],
            a: this._colors[index + 3]
        };
    }

    /**
     * Get the index of a color on this palette.
     * @param {number} color - color
     * @returns its index or undefined
     */
    index(c: number): number | undefined;
    index(r: number, g: number, b: number, a: number): number | undefined;
    index(r: number, g?: number, b?: number, a?: number): number | undefined {
        if (g === undefined || b === undefined || a === undefined) {
            const rgb = numberToColor(r);
            r = rgb.r;
            g = rgb.g;
            b = rgb.b;
            a = 0xFF;
        }

        const color = hash(r, g, b, a);
        return this._idByColor[color];
    }

    /**
     * Push a new color on palette and return its index.
     * @param {number} color - new color
     * @returns index or 0 if the capacity is exceeded
     */
    push(c: number): number;
    push(r: number, g: number, b: number, a: number): number;
    push(r: number, g?: number, b?: number, a?: number): number {
        if (g === undefined || b === undefined || a === undefined) {
            const rgb = numberToColor(r);
            r = rgb.r;
            g = rgb.g;
            b = rgb.b;
            a = 0xFF;
        }

        const color = hash(r, g, b, a);
        if (color in this._idByColor) {
            return this._idByColor[color];
        }

        if (this.length >= this._capacity) {
            return 0;
        }

        this._idByColor[color] = this._index;
        const bufferIndex = this._index * 4;
        this._colors[bufferIndex] = r;
        this._colors[bufferIndex + 1] = g;
        this._colors[bufferIndex + 2] = b;
        this._colors[bufferIndex + 3] = a;
        this._index++;
        return this._index - 1;
    }

    update(): void {
        this._texture = PIXI.Texture.fromBuffer(this._colors, this.length, 1);
        this._texture.update();
    }
}

export class IndexedTexture {
    texture: PIXI.Texture;
    private _numColors: number;

    constructor(texture: PIXI.Texture, numColors: number) {
        this.texture = texture;
        this._numColors = numColors;
    }

    get numColors(): number {
        return this._numColors;
    }
}

/**
 * Index colors on a texture.
 * @param {PIXI.Renderer} renderer - app renderer
 * @param {Palette} palette - palette to use/fill
 * @param {PIXI.Texture} texture - texture to index
 * @returns {IndexedTexture} a texture with indexed colors
 */
export function palettize(renderer: PIXI.Renderer, palette: Palette, texture: PIXI.Texture): IndexedTexture {
    const colors = renderer.extract.pixels(new PIXI.Sprite(texture));
    let index: number = 0;
    let indices = new Set();
    for (let i = 0, i2 = 0; i < texture.width; ++i) {
        for (let j = 0; j < texture.height; ++j, i2 += 4) {
            index = palette.push(colors[i2], colors[i2 + 1], colors[i2 + 2], colors[i2 + 3]);
            indices.add(index);
            colors[i2] = 0;
            colors[i2 + 1] = 0;
            colors[i2 + 2] = index;
            colors[i2 + 3] = 255;
        }
    }
    const tex = PIXI.Texture.fromBuffer(colors, texture.width, texture.height);
    tex.update();
    return new IndexedTexture(tex, indices.size);
}

const fragment = 'precision mediump float;' +

'varying vec2 vTextureCoord;' +

'uniform sampler2D uSampler;' +

'uniform sampler2D colors;' +

'uniform float numColors;' +

'void main(void)' +
'{' +
'   vec4 col = texture2D(uSampler, vTextureCoord);' +
'   gl_FragColor = texture2D(colors, vec2((col.b * 256.0) / numColors, 0.0));' + 
'}';

export class PaletteColorFilter extends PIXI.Filter
{
    constructor(palette: Palette)
    {
        super('', fragment);
        this.setPalette(palette);
    }

    setPalette(value: Palette) {
        this.uniforms.colors = value.texture;
        this.uniforms.numColors = value.length;
    }
}
