import * as MoroboxAIGameSDK from 'moroboxai-game-sdk';
import * as Moroxel8AISDK from 'moroxel8ai-sdk';
import * as PIXI from 'pixi.js';

import {
    lua_State,
    lua,
	lauxlib,
    to_luastring,
    to_jsstring
} from 'fengari';

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
 * Load the main script indicated in game header.
 * @param {ExtendedGameHeader} header - game header
 * @param {MoroboxAIGameSDK.IGameServer} gameServer - game server for accessing files
 * @returns {Promise} - content of the main script
 */
function loadMain(header: ExtendedGameHeader, gameServer: MoroboxAIGameSDK.IGameServer): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        if (header.main === undefined) {
            return reject('header is missing a main attribute with the path to your main script');
        }

        return gameServer.get(header.main).then(resolve);
    });
}

/**
 * Load a list of assets from the game server.
 * @param {AssetHeader[]} assets - list of assets to load
 * @param {MoroboxAIGameSDK.IGameServer} gameServer - game server for accessing files
 * @param {function} assetLoaded - function called for each loaded asset
 * @returns {Promise} - a promise
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
 * @returns {Promise} - content of the main script
 */
function initGame(player: MoroboxAIGameSDK.IPlayer, vm: Moroxel8AISDK.IMoroxel8AI, assetLoaded: (asset: AssetHeader, res: PIXI.LoaderResource) => void): Promise<string> {
    return new Promise<string>((resolve) => {
        const header = player.header as ExtendedGameHeader;

        return loadMain(
            header,
            player.gameServer
        ).then((data) => {
            return loadAssets(
                header.assets,
                player.gameServer,
                assetLoaded
            ).then(() => resolve(data));
        });
    });
}

/**
 * Initialize a new Lua VM for running a script.
 * @param {string} script - script to inject
 * @param {Moroxel8AISDK.IMoroxel8AI} vm - interface for the CPU
 * @returns {lua_State} - new Lua VM
 */
function initLua(script: string | undefined, vm: Moroxel8AISDK.IMoroxel8AI): lua_State | undefined {
    const luaState: lua_State = lauxlib.luaL_newstate();
    lua.lua_register(luaState, 'print', (_: lua_State) => {
        console.log(lua.lua_tojsstring(_, -1));
        return 0;
    });

    lua.lua_register(luaState, 'tmap', (_: lua_State) => {
        const size = lua.lua_gettop(luaState);
        if (size === 0) {
            return 0;
        }

        if (size !== 1) {
            return lauxlib.luaL_error(to_luastring("tmap([id])"));
        }
        
        vm.tmap(lua.lua_tojsstring(_, -1));
        return 0;
    });

    lua.lua_register(luaState, 'stile', (_: lua_State) => {
        const size = lua.lua_gettop(luaState);
        if (size === 1) {
            return 0;
        }

        if (size !== 2) {
            return lauxlib.luaL_error(to_luastring("stile(id, [tile])"));
        }
        
        vm.stile(
            lua.lua_tonumber(luaState, 1),
            lua.lua_tonumber(luaState, 2),
        );
        return 0;
    });

    lua.lua_register(luaState, 'spos', (_: lua_State) => {
        const size = lua.lua_gettop(luaState);
        if (size === 1) {
            return 0;
        }

        if (size !== 3) {
            return lauxlib.luaL_error(to_luastring("spos(id, [x, y])"));
        }
        
        vm.spos(
            lua.lua_tonumber(luaState, 1),
            lua.lua_tonumber(luaState, 2),
            lua.lua_tonumber(luaState, 3),
        );
        return 0;
    });

    lua.lua_register(luaState, 'sorigin', (_: lua_State) => {
        const size = lua.lua_gettop(luaState);
        if (size === 1) {
            return 0;
        }

        if (size !== 3) {
            return lauxlib.luaL_error(to_luastring("sorigin(id, [x, y])"));
        }
        
        vm.sorigin(
            lua.lua_tonumber(luaState, 1),
            lua.lua_tonumber(luaState, 2),
            lua.lua_tonumber(luaState, 3),
        );
        return 0;
    });

    lua.lua_register(luaState, 'srot', (_: lua_State) => {
        const size = lua.lua_gettop(luaState);
        if (size === 1) {
            lua.lua_pushnumber(luaState, vm.srot(lua.lua_tonumber(luaState, 1)));
            return 1;
        }

        if (size !== 2) {
            return lauxlib.luaL_error(to_luastring("srot(id, [a])"));
        }
        
        vm.srot(
            lua.lua_tonumber(luaState, 1),
            lua.lua_tonumber(luaState, 2),
        );
        return 0;
    });

    if (script !== undefined) {
        if (lauxlib.luaL_dostring(luaState, to_luastring(script)) != lua.LUA_OK) {
            console.error(to_jsstring(lua.lua_tostring(luaState, -1)));
            return undefined;
        }
    }

    return luaState;
}

class Moroxel8AI implements MoroboxAIGameSDK.IGame, Moroxel8AISDK.IMoroxel8AI {
    private _player: MoroboxAIGameSDK.IPlayer;
    // Main Lua script of the game
    private _gameScript?: string;
    // Lua VM
    private _luaState?: lua_State;

    private _app?: PIXI.Application;
    // Buffer where the game will be rendered
    private _gameBuffer?: BackBuffer;
    // If the game has been attached and is playing
    private _isPlaying: boolean = false;
    private _displayedTickError: boolean = false;
    private _physicsAccumulator: number = 0;
    private _tilemaps: { [key: string]: TileMap } = {};
    private _tilemap?: TileMap;
    private _sprites!: PIXI.Sprite[];

    constructor(player: MoroboxAIGameSDK.IPlayer) {
        this._player = player;

        // init the game and load assets
        initGame(player, this, (asset, res) => this._handleAssetLoaded(asset, res)).then((data) => {
            // received the game script
            this._gameScript = data;
            this._initPixiJS();

            // calling ready will call play
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
        if (this._luaState === undefined) return;

        try {
            lua.lua_getglobal(this._luaState, to_luastring("tick", true));
            lua.lua_pushnumber(this._luaState, deltaTime);
            if (lua.lua_call(this._luaState, 1, 0) !== lua.LUA_OK && !this._displayedTickError) {
                this._displayedTickError = true;
                console.error(to_jsstring(lua.lua_tostring(this._luaState, -1)));
                return;
            }
        } catch(e) {
            if(!this._displayedTickError) {
                this._displayedTickError = true;
                console.error(e);
            }
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
        this._displayedTickError = false;

        this._luaState = initLua(this._gameScript, this);
        if (this._luaState === undefined) {
            console.error('failed to create the Lua VM, see errors in console');
            return;
        }

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

    sorigin(id: number): { x: number; y: number; };
    sorigin(id: number, x: number, y: number): void;
    sorigin(id: number, x?: number, y?: number): void | { x: number; y: number; } {
        if (x === undefined || y === undefined) {
            return this._sprites[id].pivot;
        }

        this._sprites[id].pivot.set(x, y);
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
    srot(id: number, a?: number): number | void {
        if (a === undefined) {
            return this._sprites[id].angle;
        }

        this._sprites[id].angle = a;
    }
}

export const boot: MoroboxAIGameSDK.IBoot = (player) => {
    return new Moroxel8AI(player);
};
