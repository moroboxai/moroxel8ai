import * as PIXI from "pixi.js";
import * as constants from "@/constants";
import { AssetHeader, TileMapHeader } from "./header";
import { IndexedTexture } from "./palette";

export class TileMap {
    private _pixi: typeof PIXI;
    private _asset: AssetHeader;
    private _texture: IndexedTexture;
    private _cellSize: number = constants.TILEMAP_RESOLUTION;
    private _columns: number;
    private _rows: number;

    constructor(
        pixi: typeof PIXI,
        asset: AssetHeader,
        texture: IndexedTexture
    ) {
        this._pixi = pixi;
        this._asset = asset;
        this._texture = texture;
        this._columns = Math.ceil(this._texture.texture.width / this._cellSize);
        this._rows = Math.ceil(this._texture.texture.height / this._cellSize);
    }

    get name(): string {
        return this._asset.name!;
    }

    get columns(): number {
        return this._columns;
    }

    get rows(): number {
        return this._rows;
    }

    crop(x: number, y: number, w: number, h: number): PIXI.Texture {
        return new this._pixi.Texture(
            this._texture.texture.baseTexture,
            new this._pixi.Rectangle(x, y, w, h)
        );
    }

    getTile(
        i: number,
        j: number,
        w?: number,
        h?: number,
        cellSize?: number
    ): PIXI.Texture {
        if (i < 0 || i >= this._columns || j < 0 || j >= this._rows)
            return PIXI.Texture.EMPTY;
        if (w === undefined) w = 1;
        if (h === undefined) h = 1;
        if (cellSize === undefined) cellSize = this._cellSize;

        const x1 = Math.ceil(i) * cellSize;
        const y1 = Math.ceil(j) * cellSize;
        const x2 = Math.min(
            Math.max(x1 + Math.ceil(w * cellSize), 0),
            this._texture.texture.width
        );
        const y2 = Math.min(
            Math.max(y1 + Math.ceil(h * cellSize), 0),
            this._texture.texture.height
        );

        return new this._pixi.Texture(
            this._texture.texture.baseTexture,
            new this._pixi.Rectangle(x1, y1, x2 - x1, y2 - y1)
        );
    }

    static from(
        pixi: typeof PIXI,
        asset: TileMapHeader,
        texture: IndexedTexture
    ): TileMap | undefined {
        return new TileMap(pixi, asset, texture);
    }
}
