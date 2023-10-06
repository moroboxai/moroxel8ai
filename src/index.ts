import * as MoroboxAIGameSDK from "moroboxai-game-sdk";
import type { Inputs } from "moroboxai-game-sdk";
import * as PixiMoroxel8AI from "piximoroxel8ai";
import type { IAPI } from "./api";
export type { IAPI } from "./api";
import { initGame as initGameScript } from "./game";
import type { IGame } from "./game";
import { PPU, AssetHeader, FontHeader, TileMapHeader } from "./ppu";

export const VERSION = "__VERSION__";

/**
 * Languages supported for the game.
 */
export type Language = "javascript" | "lua";

/**
 * Parameters passed to the entrypoint of the game.
 *
 * Those parameters are passed by PixiMoroxel8AI when booting the
 * game specified in the header.
 */
export interface MainOptions {}

/**
 * Entrypoint of the game.
 *
 * Passing the entrypoint in code can be useful in development mode,
 * where the default behavior of PixiMoroxel8AI, of making a big
 * eval of the main file of the game, can cause issues with imports
 * and exports.
 */
export interface MainFunction {
    (options: MainOptions): Promise<IGame>;
}

/**
 * Something that looks like an entrypoint.
 */
export type MainLike = string | MainFunction;

/**
 * Game header extended with settings for Moroxel8AI.
 */
export interface GameHeader extends MoroboxAIGameSDK.GameHeader {
    assets?: AssetHeader[];
    language?: Language;
    main?: MainLike;
}

interface GameScript {
    language: Language;
    script: MainLike;
}

/**
 * Load the main script indicated in game header.
 * @param {Moroxel8AI} vm - instance of Moroxel8AI
 * @param {MoroboxAIGameSDK.IGameServer} gameServer - game server for accessing files
 * @returns {Promise} - content of the main script
 */
function loadGame(
    vm: Moroxel8AI,
    gameServer: MoroboxAIGameSDK.IGameServer
): Promise<IGame | undefined> {
    return new Promise<IGame | undefined>((resolve, reject) => {
        // Override the main from header
        if (vm.options.main !== undefined) {
            vm.header.main = vm.options.main;
        }

        const main = vm.header.main;
        if (main === undefined) {
            return reject(
                "header is missing main attribute with the path to your main script"
            );
        }

        if (typeof main === "function") {
            // User passed a function acting as the entrypoint of the game
            return main({}).then((game) =>
                resolve(initGameScript("javascript", game, vm))
            );
        }

        return gameServer
            .get(main)
            .then((data) =>
                resolve(
                    initGameScript(
                        main!.endsWith(".js") ? "javascript" : "lua",
                        data,
                        vm
                    )
                )
            );
    });
}

/**
 * Load a list of assets from the game server.
 * @param {Moroxel8AI} vm - vm instance
 * @param {AssetHeader[]} assets - list of assets to load
 * @param {MoroboxAIGameSDK.IGameServer} gameServer - game server for accessing files
 * @param {function} assetLoaded - function called for each loaded asset
 * @returns {Promise} - a promise
 */
function loadAssets(
    vm: Moroxel8AI,
    gameServer: MoroboxAIGameSDK.IGameServer,
    assetLoaded: (asset: AssetHeader, res: PIXI.LoaderResource) => void
): Promise<void> {
    return new Promise((resolve) => {
        const assets = vm.header.assets;
        if (assets === undefined || assets.length === 0) {
            // no assets to load
            resolve();
            return;
        }

        console.log("loading assets...");
        const loader = new vm.PIXI.Loader();

        // add each asset to the loader
        const validAssets = new Array<AssetHeader>();
        assets.forEach((_) => {
            if (_.name === undefined) {
                console.error("skip asset without name");
                return;
            }

            if (_.path === undefined) {
                console.error("skip asset without path");
                return;
            }

            console.log(`loading ${_.path}...`);
            validAssets.push(_);
            loader.add(gameServer.href(`assets/${_.path}`));
        });

        loader.onComplete.add(() => {
            // dispatch loaded assets
            validAssets.forEach((_) => {
                assetLoaded(
                    _,
                    loader.resources[gameServer.href(`assets/${_.path}`)]
                );
            });

            console.log("assets loaded");
            return resolve();
        });
        loader.load();
    });
}

/**
 * Load and initialize the game.
 * @param {Moroxel8AI} vm - vm instance
 * @param {MoroboxAIGameSDK.IPlayer} player - player instance
 * @param {Function} assetLoaded - function called for each loaded asset
 * @returns {Promise} - content of the main script
 */
function initGame(
    vm: Moroxel8AI,
    player: MoroboxAIGameSDK.IPlayer,
    assetLoaded: (asset: AssetHeader, res: PIXI.LoaderResource) => void
): Promise<IGame | undefined> {
    return new Promise<IGame | undefined>((resolve) => {
        return loadAssets(vm, player.gameServer, assetLoaded).then(() => {
            return loadGame(vm, player.gameServer).then((game) =>
                resolve(game)
            );
        });
    });
}

/**
 * Possible modes for running PixiMoroxel8AI.
 */
export type Mode = "development" | "production";

/**
 * Options for Moroxel8AI.
 */
export interface Moroxel8AIOptions {
    // Mode
    mode?: Mode;
    // Override the main defined in header
    main?: MainLike;
}

export interface IMoroxel8AI
    extends PixiMoroxel8AI.IGame,
        MoroboxAIGameSDK.IBootable {}

class Moroxel8AI implements IMoroxel8AI, IAPI {
    readonly options: Moroxel8AIOptions;
    // Instance of PixiMoroxel8AI
    private _pixiMoroxel8AI?: PixiMoroxel8AI.IVM;
    // Instance of game
    private _game?: IGame;
    // If the game has been attached and is playing
    private _ppu!: PPU;
    // Last received inputs
    private _inputs?: Inputs[];

    constructor(options?: Moroxel8AIOptions) {
        this.options = options ?? {};
    }

    get pixiMoroxel8AI(): PixiMoroxel8AI.IVM {
        return this._pixiMoroxel8AI!;
    }

    get PIXI(): typeof PIXI {
        return this._pixiMoroxel8AI!.PIXI;
    }

    get player(): MoroboxAIGameSDK.IPlayer {
        return this._pixiMoroxel8AI!.player;
    }

    get header(): GameHeader {
        return this._pixiMoroxel8AI?.header as GameHeader;
    }

    _handleAssetLoaded(asset: AssetHeader, res: PIXI.LoaderResource) {
        if (res.extension === "fnt") {
            this._ppu.addFont(asset as FontHeader);
        } else if (res.texture !== undefined) {
            this._ppu.addTileMap(asset as TileMapHeader, res.texture);
        }
    }

    /**
     * Boot function called by MoroxoAIPlayer.
     */
    boot: MoroboxAIGameSDK.BootFunction = (
        options: MoroboxAIGameSDK.BootOptions
    ): Promise<MoroboxAIGameSDK.IGame> => {
        return new Promise<MoroboxAIGameSDK.IGame>((resolve) => {
            // Initialize PixiMoroxel8AI with Moroxel8AI as the game
            const pixiMoroxel8AI = PixiMoroxel8AI.init({
                main: async (
                    mainOptions: PixiMoroxel8AI.MainOptions
                ): Promise<PixiMoroxel8AI.IGame> => {
                    // Get the instance of PixiMoroxel8AI
                    this._pixiMoroxel8AI = mainOptions.vm;
                    this._pixiMoroxel8AI.autoClearBackBuffer = false;
                    this._ppu = new PPU(
                        this._pixiMoroxel8AI.PIXI,
                        this._pixiMoroxel8AI.renderer,
                        this._pixiMoroxel8AI.backBuffer,
                        this._pixiMoroxel8AI.SWIDTH,
                        this._pixiMoroxel8AI.SHEIGHT
                    );

                    if (this.options.mode === "development") {
                        console.log("hook Moroxel8AI API");
                        this.hookAPI(window);
                    }

                    return new Promise<PixiMoroxel8AI.IGame>((resolve) =>
                        // Moroxel8AI already exists, so return this
                        resolve(this)
                    );
                }
            });

            // Make PixiMoroxel8AI boot
            return pixiMoroxel8AI.boot(options).then((game) =>
                // Here game is the instance of PixiMoroxel8AI
                resolve(game)
            );
        });
    };

    load(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // init the game and load assets
            initGame(this, this.player, (asset, res) =>
                this._handleAssetLoaded(asset, res)
            ).then((game) => {
                this._game = game;

                if (this._game === undefined) {
                    console.error(
                        "failed to create the VM, see errors in console"
                    );
                    return reject();
                }
                return resolve();
            });
        });
    }

    saveState(): object {
        if (this._game?.saveState !== undefined) {
            return this._game.saveState();
        }

        return {};
    }

    loadState(state: object): void {
        if (this._game?.loadState !== undefined) {
            this._game.loadState(state);
        }
    }

    getStateForAgent(): object {
        if (this._game?.getStateForAgent !== undefined) {
            return this._game.getStateForAgent();
        }

        return {};
    }

    tick(inputs: Inputs[], delta: number, render: boolean): void {
        if (this._game?.tick === undefined) {
            return;
        }

        this._ppu.drawEnabled = render;
        this._ppu.preRender();
        this._inputs = inputs;
        this._game.tick(delta);
        this._ppu.postRender();
    }

    // IMoroxel8AI interface
    get SWIDTH(): number {
        return this._ppu.SWIDTH;
    }
    get SHEIGHT(): number {
        return this._ppu.SHEIGHT;
    }
    get TNUM(): number {
        return this._ppu.TNUM;
    }
    get SNUM(): number {
        return this._ppu.SNUM;
    }
    P1: number = 0;
    P2: number = 1;
    BLEFT: number = 0;
    BRIGHT: number = 1;
    BUP: number = 2;
    BDOWN: number = 3;

    clear(): void;
    clear(c?: number): void {
        this._ppu.clear(c !== undefined ? c : 0);
    }

    camera(x: number, y: number): void {
        this._ppu.camera(x, y);
    }

    print(...values: any[]): void {
        console.log(...values);
    }

    state(val: any): void;
    state(pid: number, val: any): void;
    state(pid: any | number, val?: any): void {}

    btn(bid: number): boolean;
    btn(pid: number, bid: number): boolean;
    btn(pid: number, bid?: number): boolean {
        if (this._inputs === undefined) {
            return false;
        }

        if (bid === undefined) {
            bid = pid;
            pid = this.P1;
        }

        if (this._inputs.length <= pid) {
            return false;
        }

        switch (bid) {
            case this.BLEFT:
                return this._inputs[pid].left === true;
            case this.BRIGHT:
                return this._inputs[pid].right === true;
            case this.BUP:
                return this._inputs[pid].up === true;
            case this.BDOWN:
                return this._inputs[pid].down === true;
            default:
                return false;
        }
    }

    pbound(pid: number): boolean {
        const player = this.player.getController(pid);
        return player === undefined ? false : player.isBound;
    }

    plabel(pid: number): string {
        const player = this.player.getController(pid);
        return player === undefined ? "" : player.label;
    }

    tmap(name: string): number {
        return this._ppu.tmap(name);
    }

    tmode(val: number): void {
        this._ppu.tmode(val);
    }

    stile(id: number, i: number, j: number, w?: number, h?: number): void {
        this._ppu.stile(id, i, j, w, h);
    }

    sorigin(x: number, y: number): void {
        this._ppu.sorigin(x, y);
    }

    sflip(h: boolean, v: boolean): void {
        this._ppu.sflip(h, v);
    }

    sscale(x: number, y: number): void {
        return this._ppu.sscale(x, y);
    }

    srot(a: number): void {
        this._ppu.srot(a);
    }

    sclear(): void {
        this._ppu.sclear();
    }

    sdraw(x: number, y: number): void {
        this._ppu.sdraw(x, y);
    }

    sbox(x: number, y: number, w: number, h: number): void {
        this._ppu.sbox(x, y, w, h);
    }

    fnt(name: string): number {
        return this._ppu.fnt(name);
    }

    falign(x: number, y: number): void {
        this._ppu.falign(x, y);
    }

    fcolor(c: number): void {
        this._ppu.fcolor(c);
    }

    fclear(): void {
        this._ppu.fclear();
    }

    fdraw(id: number, text: string, x: number, y: number): void {
        this._ppu.fdraw(id, text, x, y);
    }

    abs = Math.abs;
    floor = Math.floor;
    ceil = Math.ceil;
    sign = Math.sign;
    min = Math.min;
    max = Math.max;
    clamp(val: number, min: number, max: number): number {
        return Math.min(Math.max(val, min), max);
    }
    cos = Math.cos;
    sin = Math.sin;

    hookAPI(target: any) {
        target.SWIDTH = this.SWIDTH;
        target.SHEIGHT = this.SHEIGHT;
        target.TNUM = this.TNUM;
        target.SNUM = this.SNUM;
        target.P1 = this.P1;
        target.P2 = this.P2;
        target.BLEFT = this.BLEFT;
        target.BRIGHT = this.BRIGHT;
        target.BUP = this.BUP;
        target.BDOWN = this.BDOWN;
        target.clear = this.clear.bind(this);
        target.camera = this.camera.bind(this);
        target.print = this.print.bind(this);
        target.state = this.state.bind(this);
        target.btn = this.btn.bind(this);
        target.pbound = this.pbound.bind(this);
        target.plabel = this.plabel.bind(this);
        target.tmap = this.tmap.bind(this);
        target.tmode = this.tmode.bind(this);
        target.stile = this.stile.bind(this);
        target.sorigin = this.sorigin.bind(this);
        target.sflip = this.sflip.bind(this);
        target.sscale = this.sscale.bind(this);
        target.srot = this.srot.bind(this);
        target.sclear = this.sclear.bind(this);
        target.sdraw = this.sdraw.bind(this);
        target.sbox = this.sbox.bind(this);
        target.fnt = this.fnt.bind(this);
        target.falign = this.falign.bind(this);
        target.fcolor = this.fcolor.bind(this);
        target.fclear = this.fclear.bind(this);
        target.fdraw = this.fdraw.bind(this);
        target.abs = this.abs.bind(this);
        target.floor = this.floor.bind(this);
        target.ceil = this.ceil.bind(this);
        target.sign = this.sign.bind(this);
        target.min = this.min.bind(this);
        target.max = this.max.bind(this);
        target.clamp = this.clamp.bind(this);
        target.cos = this.cos.bind(this);
        target.sin = this.sin.bind(this);
    }
}

/**
 * Initialize a new Moroxel8AI instance.
 *
 * This function is not called by MoroboxAIPlayer and is only meant
 * for libraries embedding Moroxel8AI in the browser.
 *
 * This creates and initializes a new Moroxel8AI instance, without
 * loading the game yet.
 * @param {Moroxel8AIOptions} options - options for Moroxel8AI
 * @returns the new instance
 */
export function init(options?: Moroxel8AIOptions): IMoroxel8AI {
    return new Moroxel8AI(options);
}

/**
 * Boot function called by MoroboxAIPlayer.
 */
export const boot: MoroboxAIGameSDK.BootFunction = (
    options: MoroboxAIGameSDK.BootOptions
): Promise<MoroboxAIGameSDK.IGame> => {
    return new Promise<MoroboxAIGameSDK.IGame>((resolve) => {
        // Create Moroxel8AI
        const vm = new Moroxel8AI();
        // Boot the game
        return vm.boot(options).then((game) => {
            // Return to the player
            return resolve(game);
        });
    });
};

/**
 * Declare the API for games.
 */
declare global {
    /** Screen width (128) */
    const SWIDTH: number;

    /** Screen height (128) */
    const SHEIGHT: number;

    /** Maximum number of tilemaps */
    const TNUM: number;

    /** Maximum number of sprites */
    const SNUM: number;

    /** First player */
    const P1: number;

    /** Second player */
    const P2: number;

    /** Left button */
    const BLEFT: number;

    /** Right button */
    const BRIGHT: number;

    /** Up button */
    const BUP: number;

    /** Down button */
    const BDOWN: number;

    /**
     * Clear the screen.
     */
    function clear(): void;
    function clear(c: number): void;

    /**
     * Set camera position.
     *
     * @param {number} x - x-coordinate
     * @param {number} y - y-coordinate
     */
    function camera(x: number, y: number): void;

    /**
     * Print a message to the console.
     * @param {any[]} values - what to print
     */
    function print(...values: any[]): void;

    //############
    // PLAYER API
    //############

    /**
     * Send the game state to all players.
     * @param {any} val - game state
     */
    function state(val: any): void;

    /**
     * Send the game state to selected player.
     * @param {number} pid - player id
     * @param {any} val - game state
     */
    function state(pid: number, val: any): void;

    /**
     * Get the state of a button for P1.
     * @param {number} bid - button id
     * @returns true if pressed
     */
    function btn(bid: number): boolean;

    /**
     * Get the state of a button.
     * @param {number} pid - player id
     * @param {number} bid - button id
     * @returns true if pressed
     */
    function btn(pid: number, bid: number): boolean;

    /**
     * Get if an AI is bound to a player controller.
     * @param {number} pid - player id
     * @returns {boolean} true if AI bound
     */
    function pbound(pid: number): boolean;

    /**
     * Get the label of a player.
     * @param {number} pid - player id
     * @returns {string} player label
     */
    function plabel(pid: number): string;

    //############
    // TILEMAP API
    //############

    /**
     * Get id of a tilemap identified by a unique name.
     * @param {string} name - tilemap unique name
     * @returns {number} tilemap id
     */
    function tmap(name: string): number;

    /**
     * Select map mode (8 | 16 | 32 | 64) pixels.
     *
     * This allows mtile to works on 8x8, 16x16, ... tiles.
     *
     * @param {number} val - new mode
     */
    function tmode(val: number): void;

    //###########
    // SPRITE API
    //###########

    /**
     * Set the tile for next sprite.
     * @param {number} id - tilemap id
     * @param {number} i - tile position
     * @param {number} j - tile position
     * @param {number} w - tile width
     * @param {number} h - tile height
     */
    function stile(
        id: number,
        i: number,
        j: number,
        w?: number,
        h?: number
    ): void;

    /**
     * Set the origin attribute of next sprite.
     * @param {number} x - x-coordinate
     * @param {number} y - y-coordinate
     */
    function sorigin(x: number, y: number): void;

    /**
     * Set the flips attributes of next sprite.
     * @param {number} h - horizontal flip
     * @param {number} v - vertical flip
     */
    function sflip(h: boolean, v: boolean): void;

    /**
     * Set the scales attributes of next sprite.
     * @param {number} x - horizontal scale
     * @param {number} y - vertical scale
     */
    function sscale(x: number, y: number): void;

    /**
     * Set the rotation attribute of next sprite.
     * @param {number} a - angle in degrees
     */
    function srot(a: number): void;

    /**
     * Clear all attributes of next sprite.
     */
    function sclear(): void;

    /**
     * Draw next sprite.
     *
     * @param {number} x - x-coordinate
     * @param {number} y - y-coordinate
     */
    function sdraw(x: number, y: number): void;

    /**
     * Draw a box using the tiles assigned with stile.
     *
     * This is not affected by:
     * - the camera position
     * - the sprite attributes
     *
     * This is affected by:
     * - the tile attribute
     *
     * @param {number} x - top-left x-coordinate
     * @param {number} y - top-left y-coordinate
     * @param {number} w - width
     * @param {number} h - height
     */
    function sbox(x: number, y: number, w: number, h: number): void;

    //###########
    // TEXT API
    //###########

    /**
     * Get id of a font identified by a unique name.
     * @param {string} name - font unique name
     * @returns {number} font id
     */
    function fnt(name: string): number;

    /**
     * Set the align attribute of next text.
     * @param {number} x - horizontal alignment
     * @param {number} y - vertical alignment
     */
    function falign(x: number, y: number): void;

    /**
     * Set the color attribute of next text.
     * @param {number} c - hexadecimal color
     */
    function fcolor(c: number): void;

    /**
     * Clear all attributes of next text.
     */
    function fclear(): void;

    /**
     * Draw next text.
     * @param {number} id - font id
     * @param {string} text - text to draw
     * @param {number} x - x-coordinate
     * @param {number} y - y-coordinate
     */
    function fdraw(id: number, text: string, x: number, y: number): void;

    //###########
    // MATH API
    //###########

    function abs(val: number): number;
    function floor(val: number): number;
    function ceil(val: number): number;
    function sign(val: number): number;
    function min(a: number, b: number): number;
    function max(a: number, b: number): number;
    function clamp(val: number, min: number, max: number): number;
    function cos(val: number): number;
    function sin(val: number): number;
}
