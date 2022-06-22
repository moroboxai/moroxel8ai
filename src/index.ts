import * as MoroboxAIGameSDK from 'moroboxai-game-sdk';
import * as Moroxel8AISDK from 'moroxel8ai-sdk';
import * as PIXI from 'pixi.js';
import { IVM, initVM } from './vm';
import { PPU, AssetHeader, TileMapHeader } from './ppu';

const PHYSICS_TIMESTEP = 0.01;

interface ExtendedGameHeader extends MoroboxAIGameSDK.GameHeader {
    assets?: AssetHeader[];
    main?: string;
    language?: string;
    script?: string;
}

interface GameScript {
    language: 'javascript' | 'lua',
    script: string;
}

/**
 * Load the main script indicated in game header.
 * @param {ExtendedGameHeader} header - game header
 * @param {MoroboxAIGameSDK.IGameServer} gameServer - game server for accessing files
 * @returns {Promise} - content of the main script
 */
function loadMain(header: ExtendedGameHeader, gameServer: MoroboxAIGameSDK.IGameServer): Promise<GameScript> {
    return new Promise<GameScript>((resolve, reject) => {
        if (header.script !== undefined) {
            if (header.language === undefined) {
                return reject('header is missing language attribute');
            }

            if (header.language !== 'javascript' && header.language !== 'lua') {
                return reject(`unknown script language ${header.language} in header`);
            }

            return resolve({
                language: header.language,
                script: header.script
            });
        }

        if (header.main === undefined) {
            return reject('header is missing main attribute with the path to your main script');
        }

        return gameServer.get(header.main).then(data => resolve({
            language: header.main!.endsWith('.js') ? 'javascript' : 'lua',
            script: data
        }));
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
 * @param {Function} assetLoaded - function called for each loaded asset
 * @returns {Promise} - content of the main script
 */
function initGame(player: MoroboxAIGameSDK.IPlayer, assetLoaded: (asset: AssetHeader, res: PIXI.LoaderResource) => void): Promise<GameScript> {
    return new Promise<GameScript>((resolve) => {
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

class Moroxel8AI implements MoroboxAIGameSDK.IGame, Moroxel8AISDK.IMoroxel8AI {
    private _player: MoroboxAIGameSDK.IPlayer;
    // Main Lua script of the game
    private _gameScript?: GameScript;
    // VM
    private _vm?: IVM;

    private _app?: PIXI.Application;
    private _ticker = (delta: number) => this._tick(delta);
    // If the game has been attached and is playing
    private _isPlaying: boolean = false;
    private _displayedTickError: boolean = false;
    private _physicsAccumulator: number = 0;
    private _ppu: PPU;

    constructor(player: MoroboxAIGameSDK.IPlayer) {
        this._player = player;
        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
        this._ppu = new PPU();

        // init the game and load assets
        initGame(player, (asset, res) => this._handleAssetLoaded(asset, res)).then((data) => {
            // received the game script
            this._gameScript = data;
            this._initPixiJS();

            // calling ready will call play
            player.ready();
        });
    }

    _handleAssetLoaded(asset: AssetHeader, res: PIXI.LoaderResource) {
        if (res.texture !== undefined) {
            this._ppu.addTileMap(asset as TileMapHeader, res.texture);
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
            height: this._player.height,
            antialias: false
        });

        // attach PIXI view to root HTML element
        this._player.root.appendChild(this._app.view);

        this._app.stage.addChild(this._ppu.sprite);
    }

    // Physics loop
    private _update(deltaTime: number) {
        if (this._vm === undefined) return;

        try {
            this._vm.tick(deltaTime);
        } catch (e) {
            if (!this._displayedTickError) {
                this._displayedTickError = true;
                console.error(e);
            }
        }
    }

    // Render loop
    private _render() {
        if (this._app === undefined) return;
        this._ppu.render(this._app.renderer);
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

        this._vm = initVM(this._gameScript!.language, this._gameScript?.script, this);
        if (this._vm === undefined) {
            console.error('failed to create the Lua VM, see errors in console');
            return;
        }

        this.resize();

        // register the tick function
        this._ticker = (delta: number) => this._tick(delta);
        this._app.ticker.add(this._ticker);
    }

    pause(): void {
        if (this._app !== undefined) {
            this._app.ticker.remove(this._ticker);
        }
    }

    stop(): void {
        if (this._app !== undefined) {
            this._app.destroy(true, {children: true, texture: true, baseTexture: true});
            this._app = undefined;
        }
    }

    resize(): void {
        if (this._app === undefined) return;

        // Scale the game view according to parent div
        const realWidth = this._player.width;
        const realHeight = this._player.height;

        this._app.renderer.resize(realWidth, realHeight);
        this._ppu.sprite.scale.set(realWidth / this.SWIDTH, realHeight / this.SHEIGHT);
    }

    // IMoroxel8AI interface
    get SWIDTH(): number { return this._ppu.SWIDTH; }
    get SHEIGHT(): number { return this._ppu.SHEIGHT; }
    get TNUM(): number { return this._ppu.TNUM; }
    get SNUM(): number { return this._ppu.SNUM; }
    BLEFT: number = 0;
    BRIGHT: number = 1;
    BUP: number = 2;
    BDOWN: number = 3;

    btn(id: number): boolean {
        const controller = this._player.controller(0);
        if (controller === undefined) return false;

        switch (id) {
            case this.BLEFT:
                return controller.inputs().left === true;
            case this.BRIGHT:
                return controller.inputs().right === true;
            case this.BUP:
                return controller.inputs().up === true;
            case this.BDOWN:
                return controller.inputs().down === true;
            default:
                return false;
        }
    }

    print(...values: any[]): void {
        console.log(...values);
    }

    tmap(id: string): void {
        this._ppu.tmap(id);
    }

    mmode(val: number): void {
        this._ppu.mmode(val);
    }

    mclear(): void {
        this._ppu.mclear();
    }

    mtile(x: number, y: number, i: number, j: number, w?: number, h?: number): void {
        this._ppu.mtile(x, y, i, j, w, h);
    }

    mscroll(x: number, y: number): void {
        return this._ppu.mscroll(x, y);
    }

    stile(id: number, i: number, j: number, w?: number, h?: number): void {
        this._ppu.stile(id, i, j, w, h);
    }

    sorigin(id: number): { x: number; y: number; };
    sorigin(id: number, x: number, y: number): void;
    sorigin(id: number, x?: number, y?: number): void | { x: number; y: number; } {
        return this._ppu.sorigin(id, x, y);
    }

    spos(id: number): { x: number; y: number; };
    spos(id: number, x: number, y: number): void;
    spos(id: number, x?: number, y?: number): void | { x: number; y: number; } {
        return this._ppu.spos(id, x, y);
    }

    sflip(id: number): { h: boolean; v: boolean; };
    sflip(id: number, h: boolean, v: boolean): void;
    sflip(id: number, h?: boolean, v?: boolean): void | { h: boolean; v: boolean; } {
        return this._ppu.sflip(id, h, v);
    }

    sscale(id: number): { x: number; y: number; };
    sscale(id: number, x: number, y: number): void;
    sscale(id: number, x?: number, y?: number): void | { x: number; y: number; } {
        return this._ppu.sscale(id, x, y);
    }

    srot(id: number): number;
    srot(id: number, a: number): void;
    srot(id: number, a?: number): number | void {
        return this._ppu.srot(id, a);
    }

    sdraw(id: number): void {
        return this._ppu.sdraw(id);
    }
}

export const boot: MoroboxAIGameSDK.IBoot = (player) => {
    return new Moroxel8AI(player);
};
