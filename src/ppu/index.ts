import * as constants from '../constants';
import * as PIXI from 'pixi.js';
import { FontHeader, TileMapHeader } from './header';
import { TileMap } from './tilemap';
import { PaletteColorFilter, Palette, palettize } from './palette';
import { RetroColorFilter } from './retrocolor';
export * from './header';

function clamp(v: number, a: number, b: number): number {
    return Math.max(Math.min(v, b), a);
}

class OAMText {
    private _text: PIXI.BitmapText | undefined;

    constructor() {
    }

    get text(): PIXI.BitmapText {
        if (this._text === undefined) {
            this._text = new PIXI.BitmapText("", {fontName: constants.DEFAULT_FONT});
        }
        
        return this._text;
    }

    set font(name: string) {
        this.text.fontName = name;
    }

    set color(c: number) {
        this.text.tint = c;
    }

    set value(val: string) {
        this.text.text = val;
    }

    get x(): number {
        return this.text.x;
    }

    set x(value: number) {
        this.text.x = value;
    }

    get y(): number {
        return this.text.y;
    }

    set y(value: number) {
        this.text.y = value;
    }

    clear(): void {
        this.text.fontName = constants.DEFAULT_FONT;
        this.text.position.set(0, 0);
        this.text.tint = 0xFFFFFF;
    }
}

class OAMSprite {
    sprite: PIXI.Sprite;
    private _fliph: number = 1;
    private _flipv: number = 1;
    private _scaleh: number = 1;
    private _scalev: number = 1;

    constructor() {
        this.sprite = new PIXI.Sprite();
        this.clear();
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

    clear(): void {
        this.texture = PIXI.Texture.EMPTY;
        this.sprite.position.set(0, 0);
        this.sprite.pivot.set(0, 0);
        this.sprite.angle = 0;
        this.sprite.scale.set(1, 1);
        this._fliph = 1;
        this._flipv = 1;
        this._scaleh = 1;
        this._scalev = 1;
    }
}

// RenderTexture used to render the game offscreen
class BackBuffer {
    public buffer: PIXI.RenderTexture;
    public sprite: PIXI.Sprite;

    constructor(width: number, height: number) {
        this.buffer = PIXI.RenderTexture.create({ width, height });
        this.sprite = new PIXI.Sprite(this.buffer);
        this.sprite.pivot.set(0, 0);
        this.sprite.position.set(0, 0);
    }

    postRender(): void {

    }
}

export class PPU extends BackBuffer {
    SWIDTH: number = constants.SCREEN_WIDTH;
    SHEIGHT: number = constants.SCREEN_WIDTH;
    TNUM: number = 64;
    SNUM: number = constants.NUM_SPRITES;

    // Buffer where the game will be rendered
    private _renderer: PIXI.Renderer;
    private _clearSprite: PIXI.Sprite;
    private _fonts: FontHeader[];
    private _tilemaps: TileMap[];
    private _text: OAMText;
    private _sprite: OAMSprite;
    private _spriteIndex: number = 0;
    private _palette: Palette = new Palette(constants.NUM_COLORS);
    private _paletteFilter: PaletteColorFilter;
    private _cameraX: number = 0;
    private _cameraY: number = 0;
    private _tilemapMode: number = constants.TILEMAP_RESOLUTION;
    drawEnabled: boolean; 

    constructor(renderer: PIXI.Renderer) {
        super(constants.SCREEN_WIDTH, constants.SCREEN_HEIGHT);
        this._renderer = renderer;
        this.sprite.position.set(0, 0);

        this._clearSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        this._clearSprite.width = constants.SCREEN_WIDTH;
        this._clearSprite.height = constants.SCREEN_HEIGHT;
        this._clearSprite.tint = 0;

        this._paletteFilter = new PaletteColorFilter(this._palette);

        this._fonts = new Array<FontHeader>();
        this._tilemaps = new Array<TileMap>();

        this._text = new OAMText();
        this._sprite = new OAMSprite();
        this._sprite.sprite.filters = [this._paletteFilter];

        this.drawEnabled = true;
    }

    preRender(): void {

    }

    postRender(): void {
        super.postRender();
        this._renderer.render(this.sprite);
        this._spriteIndex = 0;
    }

    addFont(asset: FontHeader): void {
        console.log(`new font ${asset.name}`);
        this._fonts.push(asset);
    }

    addTileMap(asset: TileMapHeader, texture: PIXI.Texture): void {
        const tex = palettize(this._renderer, this._palette, texture);
        this._palette.update();
        console.log(`indexed ${asset.path} with ${tex.numColors} colors`);
        this._paletteFilter.setPalette(this._palette);
        const tilemap = TileMap.from(asset, tex);
        if (tilemap !== undefined) {
            this._tilemaps.push(tilemap);
        }
    }

    private _getTile(id: number, i: number, j: number, w?: number, h?: number): PIXI.Texture {
        if (id >= 0 && id < this._tilemaps.length) {
            return this._tilemaps[id].getTile(i, j, w, h, this._tilemapMode);
        }

        return PIXI.Texture.EMPTY;
    }

    private _getColorIndex(c: number): number {
        let col = this._palette.index(c);
        if (col === undefined) {
            return 0;
        }

        return col;
    }

    clear(c: number): void {
        if (!this.drawEnabled) return;

        this._clearSprite.tint = this._getColorIndex(c);
        this._renderer.render(this._clearSprite, this.buffer);
    }

    camera(x: number, y: number): void {
        if (!this.drawEnabled) return;
        
        this._cameraX = x - this.SWIDTH / 2;
        this._cameraY = y - this.SHEIGHT / 2;
    }

    tmap(name: string): number {
        for (let i = 0; i < this._tilemaps.length; ++i) {
            if (this._tilemaps[i].name == name) {
                return i;
            }
        }

        return -1;
    }

    tmode(val: number): void {
        switch(val) {
            case 8:
            case 16:
            case 24:
            case 32:
            case 64:
            case 128:
                break;
            default:
                val = constants.TILEMAP_RESOLUTION;
                break;
        }

        this._tilemapMode = val;
    }

    stile(id: number, i: number, j: number, w?: number, h?: number): void {
        if (!this.drawEnabled) return;
        
        this._sprite.texture = this._getTile(id, i, j, w, h);
    }

    sorigin(x: number, y: number): void {
        if (!this.drawEnabled) return;
        
        this._sprite.originx = x;
        this._sprite.originy = y;
    }

    sflip(h: boolean, v: boolean): void {
        if (!this.drawEnabled) return;
        
        this._sprite.fliph = h;
        this._sprite.flipv = v;
    }

    sscale(x: number, y: number): void {
        if (!this.drawEnabled) return;
        
        this._sprite.scaleh = x;
        this._sprite.scalev = y;
    }

    srot(a: number): void {
        if (!this.drawEnabled) return;
        
        this._sprite.angle = a;
    }

    sclear(): void {
        if (!this.drawEnabled) return;
        
        this._sprite.clear();
    }

    sdraw(x: number, y: number): void {
        if (!this.drawEnabled) return;

        this._sprite.x = x - this._cameraX;
        this._sprite.y = y - this._cameraY;
        
        if (this._spriteIndex < constants.NUM_SPRITES) {
            this._renderer.render(this._sprite.sprite, this.buffer);
            this._spriteIndex += 1;
        }
    }

    fnt(name: string): number {
        for (let i = 0; i < this._fonts.length; ++i) {
            if (this._fonts[i].name == name) {
                return i;
            }
        }

        return -1;
    }

    falign(x: number, y: number): void {
        if (!this.drawEnabled) return;
        

    }

    fcolor(c: number): void {
        if (!this.drawEnabled) return;
        
        this._text.color = this._getColorIndex(c);
    }

    fclear(): void {
        if (!this.drawEnabled) return;
        
        this._text.clear();
    }

    fdraw(id: number, text: string, x: number, y: number): void {
        if (!this.drawEnabled) return;
        
        this._text.x = x;
        this._text.y = y;

        if (id >= 0 && id < this._fonts.length) {
            this._text.font = this._fonts[id].name!;
            this._text.value = text;
            this._text.text.filters = [this._paletteFilter];
            this._renderer.render(this._text.text, this.buffer);
        }
    }
}