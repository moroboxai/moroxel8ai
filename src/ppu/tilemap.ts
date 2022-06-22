import * as PIXI from 'pixi.js';
import { AssetHeader, TileMapHeader } from "./header";
import { IndexedTexture } from './palette';

export class TileMap {
    private _asset: AssetHeader;
    private _texture: IndexedTexture;
    private _cellSize: number;
    private _columns: number;
    private _rows: number;

    constructor(asset: AssetHeader, texture: IndexedTexture, cellSize: number) {
        this._asset = asset;
        this._texture = texture;
        this._cellSize = cellSize;
        this._columns = Math.ceil(this._texture.texture.width / this._cellSize);
        this._rows = Math.ceil(this._texture.texture.height / this._cellSize);
    }

    get id(): string {
        return this._asset.id!;
    }

    get columns(): number {
        return this._columns;
    }

    get rows(): number {
        return this._rows;
    }

    crop(x: number, y: number, w: number, h: number): PIXI.Texture {        
        return new PIXI.Texture(this._texture.texture.baseTexture, new PIXI.Rectangle(x, y, w, h));
    }

    getTile(i: number, j: number, w?: number, h?: number): PIXI.Texture {
        if (i < 0 || i >= this._columns || j < 0 || j >= this._rows) return PIXI.Texture.EMPTY;

        const x1 = Math.ceil(i) * this._cellSize;
        const y1 = Math.ceil(j) * this._cellSize;
        const x2 = Math.min(Math.max(x1 + Math.ceil((w === undefined ? 1 : w) * this._cellSize), 0), this._texture.texture.width);
        const y2 = Math.min(Math.max(y1 + Math.ceil((h === undefined ? 1 : h) * this._cellSize), 0), this._texture.texture.height);
        
        return new PIXI.Texture(this._texture.texture.baseTexture, new PIXI.Rectangle(x1, y1, x2 - x1, y2 - y1));
    }

    static from(asset: TileMapHeader, texture: IndexedTexture): TileMap | undefined {
        if (asset.mode === undefined) {
            console.error('mode not set on tilemap');
            return undefined;
        }

        let cellSize = undefined;
        switch (asset.mode) {
            case '8x8':
                cellSize = 8;
                break;
            case '16x16':
                cellSize = 16;
                break;
            case '32x32':
                cellSize = 32;
                break;
            default:
                console.error('unknown mode for tilemap');
                return undefined;
        }

        return new TileMap(asset, texture, cellSize);
    }
}
