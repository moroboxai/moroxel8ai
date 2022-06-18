import * as MoroboxAIGameSDK from 'moroboxai-game-sdk';
import * as Moroxel8AISDK from 'moroxel8ai-sdk';
import { resolve } from 'path';
import * as PIXI from 'pixi.js';

const SCREEN_WIDTH = 256;
const SCREEN_HEIGHT = 256;
const PHYSICS_TIMESTEP = 0.01;

interface AssetHeader {
    id?: string;
    path?: string;
}

interface TileMapHeader extends AssetHeader {
    mode?: "8x8" | "16x16" | "32x32"
}

interface ExtendedGameHeader extends MoroboxAIGameSDK.GameHeader {
    assets?: AssetHeader[];
    main?: string;
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

function numberToColor(v: number): { r: number, g: number, b: number } {
    return {
        r: (((v >> 5) & 0x7) * 256) / 7,
        g: (((v >> 2) & 0x7) * 256) / 7,
        b: ((v & 0x3) * 256) / 7
    }
}

class TileMap {
    private _asset: AssetHeader;
    private _texture: PIXI.Texture;
    private _cellSize: number;
    private _columns: number;
    private _rows: number;

    constructor(asset: AssetHeader, texture: PIXI.Texture, cellSize: number) {
        this._asset = asset;
        this._texture = texture;
        this._cellSize = cellSize;
        this._columns = Math.floor(this._texture.width / this._cellSize);
        this._rows = Math.floor(this._texture.height / this._cellSize);
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

    getTile(id: number): PIXI.Texture {
        const i = id % this._columns;
        const j = Math.floor(id / this._columns);

        return new PIXI.Texture(this._texture.baseTexture, new PIXI.Rectangle(
            i * this._cellSize,
            j * this._cellSize,
            this._cellSize,
            this._cellSize
        ));
    }

    static from(asset: TileMapHeader, texture: PIXI.Texture): TileMap | undefined {
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

/**
 * Load the boot function and initialize the game.
 * @param {ExtendedGameHeader} header - game header
 * @param {MoroboxAIGameSDK.IGameServer} gameServer - game server for accessing files
 * @returns {Promise} - a promise
 */
function loadGame(header: ExtendedGameHeader, gameServer: MoroboxAIGameSDK.IGameServer): Promise<Moroxel8AISDK.IBoot> {
    if (header.main === undefined) {
        return new Promise((resolve, reject) => reject('main not specified'));
    }

    function getBootFunction(data: string): Moroxel8AISDK.IBoot | undefined {
        let _exports: any = {};
        let _module = { exports: { boot: undefined } };
        const result = (new Function('exports', 'module', 'define', data))(_exports, _module, undefined);
        if (_exports.boot !== undefined) {
            return _exports.boot;
        }

        if (_module.exports.boot !== undefined) {
            return _module.exports.boot;
        }

        if (result === 'object' && result.boot !== undefined) {
            return result.boot;
        }

        return undefined;
    }

    console.log('loading game...');
    return gameServer.get(header.main).then(data => {
        const boot = getBootFunction(data);

        if (boot === undefined) {
            return Promise.reject('missing boot function');
        }

        return Promise.resolve(boot);
    });
}

/**
 * Load a list of assets from the game server.
 * @param {AssetHeader[]} assets - list of assets to load
 * @param {MoroboxAIGameSDK.IGameServer} gameServer - game server for accessing files
 * @param {function} assetLoaded - function called for each loaded asset
 * @return {Promise} - a promise
 */
function loadAssets(assets: AssetHeader[] | undefined, gameServer: MoroboxAIGameSDK.IGameServer, assetLoaded: (asset: AssetHeader, res: PIXI.LoaderResource) => void): Promise<void> {
    return new Promise((resolve) => {
        if (assets === undefined || assets.length === 0) {
            // no assets to load
            resolve();
            return;
        }

        console.log("loading assets...");
        const loader = new PIXI.Loader();

        // add each asset to the loader
        const validAssets = new Array<AssetHeader>();
        assets.forEach(_ => {
            if (_.id === undefined) {
                console.error('skip asset without id');
                return;
            }

            if (_.path === undefined) {
                console.error('skip asset without path');
                return;
            }

            console.log(`loading ${_.path}...`);
            validAssets.push(_);
            loader.add(gameServer.href(`assets/${_.path}`));
        });

        loader.onComplete.add(() => {
            // dispatch loaded assets
            validAssets.forEach(_ => {
                assetLoaded(_, loader.resources[gameServer.href(`assets/${_.path}`)]);
            });

            console.log('assets loaded');
            resolve()
        });
        loader.load();
    });
}

/**
 * Load and initialize the game.
 * @param {MoroboxAIGameSDK.IPlayer} player - player instance 
 * @param {Moroxel8SDK.IMoroxel8AI} vm - Moroxel8 instance
 * @param {Function} assetLoaded - function called for each loaded asset
 * @return {Promise} - a promise
 */
function initGame(player: MoroboxAIGameSDK.IPlayer, vm: Moroxel8AISDK.IMoroxel8AI, assetLoaded: (asset: AssetHeader, res: PIXI.LoaderResource) => void): Promise<Moroxel8AISDK.IGame> {
    return new Promise<Moroxel8AISDK.IGame>((resolve) => {
        const header = player.header as ExtendedGameHeader;

        return loadGame(
            header,
            player.gameServer
        ).then((boot: Moroxel8AISDK.IBoot) => {
            return loadAssets(
                header.assets,
                player.gameServer,
                assetLoaded
            ).then(() => {
                const game = boot(vm);
                console.log(game);

                resolve(game);
            });
        });
    });
}

class Moroxel8AI implements MoroboxAIGameSDK.IGame, Moroxel8AISDK.IMoroxel8AI {
    private _player: MoroboxAIGameSDK.IPlayer;
    private _game?: Moroxel8AISDK.IGame;

    private _app?: PIXI.Application;
    // Buffer where the game will be rendered
    private _gameBuffer?: BackBuffer;
    // If the game has been attached and is playing
    private _isPlaying: boolean = false;
    private _physicsAccumulator: number = 0;
    private _tilemaps: { [key: string]: TileMap } = {};
    private _tilemap?: TileMap;
    private _sprites!: PIXI.Sprite[];

    constructor(player: MoroboxAIGameSDK.IPlayer) {
        this._player = player;

        initGame(player, this, (asset, res) => this._handleAssetLoaded(asset, res)).then((game) => {
            this._game = game;
            this._initPixiJS();
            player.ready();
        });
    }

    _handleAssetLoaded(asset: AssetHeader, res: PIXI.LoaderResource) {
        if (res.texture !== undefined) {
            const tilemap = TileMap.from(asset as TileMapHeader, res.texture);
            if (tilemap !== undefined) {
                this._tilemaps[tilemap.id] = tilemap;
            }
        }
    }

    /**
     * Initialize the PixiJS application.
     */
    _initPixiJS() {
        this._app = new PIXI.Application({
            backgroundColor: 0x0,
            resolution: window.devicePixelRatio || 1,
            width: this._player.width,
            height: this._player.height
        });

        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

        // attach PIXI view to root HTML element
        this._player.root.appendChild(this._app.view);

        // buffer for rendering game elements
        this._gameBuffer = new BackBuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
        this._gameBuffer.sprite.position.set(0, 0);

        this._sprites = new Array<PIXI.Sprite>();
        for (let i = 0; i < this.SNUM; ++i) {
            const s = new PIXI.Sprite();
            this._sprites.push(s);
            this._gameBuffer.container.addChild(s);
        }

        this._app.stage.addChild(this._gameBuffer.sprite);
    }

    // Physics loop
    private _update(deltaTime: number) {
        if (this._game === undefined) return;
        try {
            this._game.tick(deltaTime);
        } catch(e) {
            console.error(e);
        }
    }

    // Render loop
    private _render() {
        if (this._gameBuffer === undefined || this._app === undefined) return;
        this._gameBuffer.render(this._app.renderer);
    }

    private _tick(delta: number) {
        this._physicsAccumulator += delta * this._player.speed;
        while (this._physicsAccumulator > PHYSICS_TIMESTEP) {
            this._update(PHYSICS_TIMESTEP);
            this._physicsAccumulator -= PHYSICS_TIMESTEP;
        }

        this._render();
    }

    // IGame interface
    speed: number = 1;

    help(): string {
        return "";
    }

    play(): void {
        if (this._app === undefined || this._isPlaying) {
            return;
        }

        this._isPlaying = true;

        this.resize();

        // register the tick function
        this._app.ticker.add((delta: number) => this._tick(delta));
    }

    pause(): void {

    }

    stop(): void {

    }

    resize(): void {
        if (this._app === undefined || this._gameBuffer === undefined) return;

        // Scale the game view according to parent div
        const realWidth = this._player.width;
        const realHeight = this._player.height;

        this._app.renderer.resize(realWidth, realHeight);
        this._gameBuffer.sprite.scale.set(realWidth / SCREEN_WIDTH, realHeight / SCREEN_HEIGHT);
    }

    // IMoroxel8AI interface
    TNUM: number = 64;
    SNUM: number = 64;

    print(...values: any[]): void {
        console.log(...values);
    }

    color(): number;
    color(col: number): void;
    color(col?: unknown): number | void {
        throw new Error('Method not implemented.');
    }

    cls(col?: number | undefined): void {
        throw new Error('Method not implemented.');
    }

    tmap(): string;
    tmap(id?: string): string | void {
        if (id === undefined) {
            return this._tilemap === undefined ? "" : this._tilemap.id;
        }

        if (id in this._tilemaps) {
            this._tilemap = this._tilemaps[id];
        }
    }

    pget(x: number, y: number): number {
        throw new Error('Method not implemented.');
    }

    pset(x: number, y: number, col?: number | undefined): void {
        const rgb = numberToColor(col!);
    }

    stile(id: number): number;
    stile(id: number, tile: number): void;
    stile(id: number, tile?: number): number | void {
        if (tile === undefined) {
            return 0;
        }

        this._sprites[id].texture = this._tilemap!.getTile(tile);
    }

    spos(id: number): { x: number; y: number; };
    spos(id: number, x: number, y: number): void;
    spos(id: number, x?: number, y?: number): void | { x: number; y: number; } {
        if (x === undefined || y === undefined) {
            return this._sprites[id].position;
        }

        this._sprites[id].position.set(x, y);
    }

    sshow(id: number): boolean;
    sshow(id: number, v: boolean): void;
    sshow(id: unknown, v?: unknown): boolean | void {
        throw new Error('Method not implemented.');
    }

    sflip(id: number): { h: boolean; v: boolean; };
    sflip(id: number, h: boolean, v: boolean): void;
    sflip(id: unknown, h?: unknown, v?: unknown): void | { h: boolean; v: boolean; } {
        throw new Error('Method not implemented.');
    }

    sscale(id: number): { h: number; v: number; };
    sscale(id: number, h: number, v: number): void;
    sscale(id: unknown, h?: unknown, v?: unknown): void | { h: number; v: number; } {
        throw new Error('Method not implemented.');
    }

    srot(id: number): number;
    srot(id: number, a: number): void;
    srot(id: unknown, a?: unknown): number | void {
        throw new Error('Method not implemented.');
    }
}

export const boot: MoroboxAIGameSDK.IBoot = (player) => {
    return new Moroxel8AI(player);
};
