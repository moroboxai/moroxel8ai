import * as PIXI from "pixi.js";

export class NineSliceTexture {
    private _pixi: typeof PIXI;
    private _tex: PIXI.Texture;
    private _frame: PIXI.Rectangle;
    private _sliceWidth: number;
    private _sliceHeight: number;
    private _sliceFrame: PIXI.Rectangle;
    private _slices: Array<PIXI.Texture | undefined>;

    constructor(pixi: typeof PIXI, tex: PIXI.Texture) {
        this._pixi = pixi;
        this._tex = tex;
        this._frame = tex.frame;
        this._sliceWidth = Math.floor(this._frame.width / 3);
        this._sliceHeight = Math.floor(this._frame.height / 3);
        this._sliceFrame = new pixi.Rectangle(
            0,
            0,
            this._sliceWidth,
            this._sliceHeight
        );
        this._slices = new Array<PIXI.Texture>(9);
    }

    get sliceWidth(): number {
        return this._sliceWidth;
    }

    get sliceHeight(): number {
        return this._sliceHeight;
    }

    private _createSlice(i: number, j: number): PIXI.Texture {
        this._sliceFrame.x = this._frame.x + i * this._sliceWidth;
        this._sliceFrame.y = this._frame.y + j * this._sliceHeight;
        return new this._pixi.Texture(this._tex.baseTexture, this._sliceFrame);
    }

    slice(i: number, j: number): PIXI.Texture {
        i = Math.max(0, Math.min(2, i));
        j = Math.max(0, Math.min(2, j));

        const index = j * 3 + i;
        if (!this._slices[index]) {
            this._slices[index] = this._createSlice(i, j);
        }

        return this._slices[index]!;
    }
}

export class NineSliceSprite {
    private _pixi: typeof PIXI;
    private _sprite: PIXI.Sprite;
    texture?: NineSliceTexture;
    private _lastWidth: number = 0;
    private _lastHeight: number = 0;

    constructor(pixi: typeof PIXI) {
        this._pixi = pixi;
        this._sprite = new pixi.Sprite();
    }

    get sprite(): PIXI.Sprite {
        return this._sprite;
    }

    private _render(
        x: number,
        y: number,
        i: number,
        j: number,
        tileX: number,
        tileY: number,
        renderer: PIXI.Renderer,
        buffer: PIXI.RenderTexture,
        budget: number
    ): number {
        if (!this.texture || budget <= 0 || tileX <= 0 || tileY <= 0) {
            return 0;
        }

        let drawn = 0;
        const sliceWidth = this.texture.sliceWidth;
        const sliceHeight = this.texture.sliceHeight;
        this._sprite.texture = this.texture?.slice(i, j);
        this._sprite.x = x;

        for (
            let i2 = 0;
            i2 < tileX && drawn < budget;
            ++i2, this._sprite.x += sliceWidth
        ) {
            this._sprite.y = y;

            for (
                let j2 = 0;
                j2 < tileY && drawn < budget;
                ++j2, this._sprite.y += sliceHeight
            ) {
                renderer.render(this._sprite, buffer);
                ++drawn;
            }
        }

        return drawn;
    }

    render(
        x: number,
        y: number,
        width: number,
        height: number,
        renderer: PIXI.Renderer,
        buffer: PIXI.RenderTexture,
        budget: number
    ): number {
        if (!this.texture) {
            return 0;
        }

        const tmpBudget = budget;
        const hTiles = Math.ceil(width / this.texture.sliceWidth);
        const vTiles = Math.ceil(height / this.texture.sliceHeight);
        const minLoopX = x + this.texture.sliceWidth;
        const minLoopY = y + this.texture.sliceHeight;
        const maxLoopX = x + width - this.texture.sliceWidth;
        const maxLoopY = y + height - this.texture.sliceHeight;

        // top-left corner
        budget -= this._render(x, y, 0, 0, 1, 1, renderer, buffer, budget);

        // top border
        budget -= this._render(
            minLoopX,
            y,
            1,
            0,
            hTiles - 2,
            1,
            renderer,
            buffer,
            budget
        );

        // top-right corner
        budget -= this._render(
            maxLoopX,
            y,
            2,
            0,
            1,
            1,
            renderer,
            buffer,
            budget
        );

        // left border
        budget -= this._render(
            x,
            minLoopY,
            0,
            1,
            1,
            vTiles - 2,
            renderer,
            buffer,
            budget
        );

        // center
        budget -= this._render(
            minLoopX,
            minLoopY,
            1,
            1,
            hTiles - 2,
            vTiles - 2,
            renderer,
            buffer,
            budget
        );

        // right border
        budget -= this._render(
            maxLoopX,
            minLoopY,
            2,
            1,
            1,
            vTiles - 2,
            renderer,
            buffer,
            budget
        );

        // bottom-left corner
        budget -= this._render(
            x,
            maxLoopY,
            0,
            2,
            1,
            1,
            renderer,
            buffer,
            budget
        );

        // bottom border
        budget -= this._render(
            minLoopX,
            maxLoopY,
            1,
            2,
            hTiles - 2,
            1,
            renderer,
            buffer,
            budget
        );

        // bottom-right corner
        budget -= this._render(
            maxLoopX,
            maxLoopY,
            2,
            2,
            1,
            1,
            renderer,
            buffer,
            budget
        );

        return tmpBudget - budget;
    }
}
