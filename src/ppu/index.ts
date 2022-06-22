import * as PIXI from 'pixi.js';
import { TileMapHeader } from './header';
import { TileMap } from './tilemap';
import { PaletteColorFilter, Palette, palettize } from './palette';
import { RetroColorFilter } from './retrocolor';
export * from './header';
export const SCREEN_WIDTH = 128;
export const SCREEN_HEIGHT = 128;
export const TILEMAP_RESOLUTION = 8;
export const NUM_SPRITES = 256;
export const NUM_COLORS = 64;

function clamp(v: number, a: number, b: number): number {
    return Math.max(Math.min(v, b), a);
}

function numberToColor(v: number): { r: number, g: number, b: number } {
    return {
        r: (((v >> 5) & 0x7) * 256) / 7,
        g: (((v >> 2) & 0x7) * 256) / 7,
        b: ((v & 0x3) * 256) / 7
    }
}

class OAMSprite {
    sprite: PIXI.Sprite;
    private _fliph: number = 1;
    private _flipv: number = 1;
    private _scaleh: number = 1;
    private _scalev: number = 1;
    tile: number = 0;

    constructor() {
        this.sprite = new PIXI.Sprite();
    }

    set texture(tex: PIXI.Texture) {
        this.sprite.texture = tex;
    }

    get x(): number {
        return this.sprite.x;
    }

    set x(value: number) {
        this.sprite.x = value;
    }

    get y(): number {
        return this.sprite.y;
    }

    set y(value: number) {
        this.sprite.y = value;
    }

    get originx(): number {
        return this.sprite.pivot.x;
    }

    set originx(value: number) {
        this.sprite.pivot.x = value;
    }

    get originy(): number {
        return this.sprite.pivot.y;
    }

    set originy(value: number) {
        this.sprite.pivot.y = value;
    }

    get angle(): number {
        return this.sprite.angle;
    }

    set angle(value: number) {
        this.sprite.angle = value;
    }

    get fliph(): boolean {
        return this._fliph < 0;
    }

    set fliph(value: boolean) {
        this._fliph = value ? -1 : 1;
        this.sprite.scale.x = this._scaleh * this._fliph;
    }

    get flipv(): boolean {
        return this._flipv < 0;
    }

    set flipv(value: boolean) {
        this._flipv = value ? -1 : 1;
        this.sprite.scale.y = this._scalev * this._flipv;
    }

    get scaleh(): number {
        return this._scaleh;
    }

    set scaleh(value: number) {
        this._scaleh = value;
        this.sprite.scale.x = this._scaleh * this._fliph;
    }

    get scalev(): number {
        return this._scalev;
    }

    set scalev(value: number) {
        this._scalev = value;
        this.sprite.scale.y = this._scalev * this._flipv;
    }
}

class OAMMap extends PIXI.Container {
    private _mode: number;
    private _columns: number;
    private _rows: number;
    private _tiles: OAMSprite[];
    private _scrollX: number = 0;
    private _scrollY: number = 0;

    constructor() {
        super();
        this._mode = 1;
        this._columns = Math.ceil(SCREEN_WIDTH / TILEMAP_RESOLUTION) + 1;
        this._rows = Math.ceil(SCREEN_HEIGHT / TILEMAP_RESOLUTION) + 1;
        this._tiles = new Array<OAMSprite>();
        for (let j = 0; j < this._rows; ++j) {
            for (let i = 0; i < this._columns; ++i) {
                const s = new OAMSprite();
                s.x = i * TILEMAP_RESOLUTION;
                s.y = j * TILEMAP_RESOLUTION;
                this.addChild(s.sprite);
                this._tiles.push(s);
            }
        }
    }

    set mode(val: number) {
        if (val < 16) this._mode = 1;
        else if (val < 32) this._mode = 2;
        else if (val < 64) this._mode = 4;
        else this._mode = 8;
    }

    private _tileAt(x: number, y: number): OAMSprite | undefined {
        if (x < 0 || y < 0 || x >= this._columns || y >= this._rows) return undefined;

        return this._tiles[Math.ceil(y) * this._columns + Math.ceil(x)];
    }

    private _setTile(x: number, y: number, tilemap: TileMap | undefined, i: number, j: number): void {
        for (let i2 = 0; i2 < this._mode; ++i2) {
            for (let j2 = 0; j2 < this._mode; ++j2) {
                const tile = this._tileAt(x + i2, y + j2);
                if (tile !== undefined) {
                    tile.texture = tilemap === undefined ? PIXI.Texture.EMPTY : tilemap.crop((i + i2) * 8, (j + j2) * 8, 8, 8);
                }
            }
        }
    }

    fill(x: number, y: number, tilemap: TileMap | undefined, i: number, j: number, w?: number, h?: number): void {
        w = w === undefined ? 1 : w;
        h = h === undefined ? 1 : h;

        // what is the top-left tile ?
        const tlx = this._scrollX < 0 ? Math.ceil(this._scrollX / 8) : Math.floor(this._scrollX / 8);
        const tly = this._scrollY < 0 ? Math.ceil(this._scrollY / 8) : Math.floor(this._scrollY / 8);

        for (let i2 = 0; i2 < w; ++i2) {
            for (let j2 = 0; j2 < h; ++j2) {
                this._setTile(
                    (x + i2) * this._mode - tlx,
                    (y + j2) * this._mode - tly,
                    tilemap,
                    i + i2 * this._mode,
                    j + j2 * this._mode
                );
            }
        }
    }

    scroll(x: number, y: number): void {
        this._scrollX = x;
        this._scrollY = y;
        this.position.set(-(x % 8), -(y % 8));
    }

    clear(): void {
        this._tiles.forEach(_ => _.texture = PIXI.Texture.EMPTY);
    }
}

// RenderTexture used to render the game offscreen
class BackBuffer {
    public container: PIXI.Container;
    public buffer: PIXI.RenderTexture;
    public sprite: PIXI.Sprite;

    constructor(width: number, height: number) {
        this.container = new PIXI.Container();
        this.buffer = PIXI.RenderTexture.create({ width, height });
        this.sprite = new PIXI.Sprite(this.buffer);
        this.sprite.pivot.set(0, 0);
        this.sprite.position.set(0, 0);
    }

    public render(renderer: PIXI.Renderer) {
        renderer.render(this.container, this.buffer);
    }
}

export class PPU extends BackBuffer {
    SWIDTH: number = SCREEN_WIDTH;
    SHEIGHT: number = SCREEN_WIDTH;
    TNUM: number = 64;
    SNUM: number = NUM_SPRITES;

    // Buffer where the game will be rendered
    private _renderer: PIXI.Renderer;
    private _tilemaps: { [key: string]: TileMap } = {};
    private _tilemap?: TileMap;
    private _sprites!: OAMSprite[];
    private _map: OAMMap;
    private _palette: Palette = new Palette(NUM_COLORS);
    private _paletteFilter: PaletteColorFilter;

    constructor(renderer: PIXI.Renderer) {
        super(SCREEN_WIDTH, SCREEN_HEIGHT);
        this._renderer = renderer;
        this.sprite.position.set(0, 0);

        this._map = new OAMMap();
        this.container.addChild(this._map);
        this._paletteFilter = new PaletteColorFilter(this._palette);
        this.container.filters = [this._paletteFilter];

        this._sprites = new Array<OAMSprite>();
        for (let i = 0; i < NUM_SPRITES; ++i) {
            const s = new OAMSprite();
            this._sprites.push(s);
            this.container.addChild(s.sprite);
        }
    }

    addTileMap(asset: TileMapHeader, texture: PIXI.Texture): void {
        const tex = palettize(this._renderer, this._palette, texture);
        this._palette.update();
        console.log(`indexed ${asset.path} with ${tex.numColors} colors`);
        this._paletteFilter.setPalette(this._palette);
        const tilemap = TileMap.from(asset, tex);
        if (tilemap !== undefined) {
            this._tilemaps[tilemap.id] = tilemap;
        }
    }

    private _getSprite(id: number): OAMSprite | undefined {
        return (id >= 0 && id < this._sprites.length) ? this._sprites[id] : undefined;
    }

    private _getTile(i: number, j: number, w?: number, h?: number): PIXI.Texture {
        return this._tilemap === undefined ? PIXI.Texture.EMPTY : this._tilemap.getTile(i, j, w, h);
    }

    tmap(id: string): void {
        this._tilemap = this._tilemaps[id];
    }

    mmode(val: number): void {
        this._map.mode = val;
    }

    mclear(): void {
        this._map.clear();
    }

    mtile(x: number, y: number, i: number, j: number, w?: number, h?: number): void {
        this._map.fill(x, y, this._tilemap, i, j, w, h);
    }

    mscroll(x: number, y: number): void {
        this._map.scroll(x, y);
    }

    stile(id: number, i: number, j: number, w?: number, h?: number): void {
        const s = this._getSprite(id);
        if (s !== undefined) {
            s.texture = this._getTile(i, j, w, h);
        }
    }

    sorigin(id: number, x?: number, y?: number): void | { x: number; y: number; } {
        const s = this._getSprite(id);

        if (x === undefined || y === undefined) {
            return s !== undefined ? {
                x: s.originx,
                y: s.originy
            } : { x: 0, y: 0 };
        }

        if (s !== undefined) {
            s.originx = x;
            s.originy = y;
        }
    }

    spos(id: number, x?: number, y?: number): void | { x: number; y: number; } {
        const s = this._getSprite(id);

        if (x === undefined || y === undefined) {
            return s !== undefined ? {
                x: s.x,
                y: s.y
            } : { x: 0, y: 0 };
        }

        if (s !== undefined) {
            s.x = x;
            s.y = y;
        }
    }

    sflip(id: number, h?: boolean, v?: boolean): void | { h: boolean; v: boolean; } {
        const s = this._getSprite(id);

        if (h === undefined || v === undefined) {
            return s !== undefined ? {
                h: s.fliph,
                v: s.flipv
            } : { h: false, v: false };
        }

        if (s !== undefined) {
            s.fliph = h;
            s.flipv = v;
        }
    }

    sscale(id: number, x?: number, y?: number): void | { x: number; y: number; } {
        const s = this._getSprite(id);

        if (x === undefined || y === undefined) {
            return s !== undefined ? {
                x: s.scaleh,
                y: s.scalev
            } : { x: 1, y: 1 };
        }

        if (s !== undefined) {
            s.scaleh = x;
            s.scalev = y;
        }
    }

    srot(id: number, a?: number): number | void {
        const s = this._getSprite(id);

        if (a === undefined) {
            return s !== undefined ? s.angle : 0;
        }

        if (s !== undefined) {
            s.angle = a;
        }
    }

    sdraw(id: number): void {
        const s = this._getSprite(id);

        if (s !== undefined) {
            
        }
    }
}