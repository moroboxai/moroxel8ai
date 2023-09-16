import * as MoroboxAIGameSDK from "moroboxai-game-sdk";
import * as Moroxel8AISDK from "moroxel8ai-sdk";
import * as PixiMoroxel8AI from "piximoroxel8ai";
import { IVM, initVM } from "./vm";
import { PPU, AssetHeader, FontHeader, TileMapHeader } from "./ppu";

export const VERSION = "0.1.0-alpha.8";

interface ExtendedGameHeader extends MoroboxAIGameSDK.GameHeader {
    assets?: AssetHeader[];
    main?: string;
    language?: string;
    script?: string;
}

interface GameScript {
    language: "javascript" | "lua";
    script: string;
}

/**
 * Load the main script indicated in game header.
 * @param {ExtendedGameHeader} header - game header
 * @param {MoroboxAIGameSDK.IGameServer} gameServer - game server for accessing files
 * @returns {Promise} - content of the main script
 */
function loadMain(
    header: ExtendedGameHeader,
    gameServer: MoroboxAIGameSDK.IGameServer
): Promise<GameScript> {
    return new Promise<GameScript>((resolve, reject) => {
        if (header.script !== undefined) {
            if (header.language === undefined) {
                return reject("header is missing language attribute");
            }

            if (header.language !== "javascript" && header.language !== "lua") {
                return reject(
                    `unknown script language ${header.language} in header`
                );
            }

            return resolve({
                language: header.language,
                script: header.script
            });
        }

        if (header.main === undefined) {
            return reject(
                "header is missing main attribute with the path to your main script"
            );
        }

        return gameServer.get(header.main).then((data) =>
            resolve({
                language: header.main!.endsWith(".js") ? "javascript" : "lua",
                script: data
            })
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
    assets: AssetHeader[] | undefined,
    gameServer: MoroboxAIGameSDK.IGameServer,
    assetLoaded: (asset: AssetHeader, res: PIXI.LoaderResource) => void
): Promise<void> {
    return new Promise((resolve) => {
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
): Promise<GameScript> {
    return new Promise<GameScript>((resolve) => {
        const header = player.header as ExtendedGameHeader;

        return loadMain(header, player.gameServer).then((data) => {
            return loadAssets(
                vm,
                header.assets,
                player.gameServer,
                assetLoaded
            ).then(() => resolve(data));
        });
    });
}

class Moroxel8AI implements PixiMoroxel8AI.IGame, Moroxel8AISDK.IMoroxel8AI {
    // Instance of PixiMoroxel8AI
    private _pixiMoroxel8AI?: PixiMoroxel8AI.IPixiMoroxel8AI;
    // Main Lua script of the game
    private _gameScript?: GameScript;
    // Instance of VM running the game script
    private _vm?: IVM;
    // If the game has been attached and is playing
    private _ppu!: PPU;
    // Last received inputs
    private _inputs?: MoroboxAIGameSDK.IInputs[];

    get pixiMoroxel8AI(): PixiMoroxel8AI.IPixiMoroxel8AI {
        return this._pixiMoroxel8AI!;
    }

    get PIXI(): typeof PIXI {
        return this._pixiMoroxel8AI!.PIXI;
    }

    get player(): MoroboxAIGameSDK.IPlayer {
        return this._pixiMoroxel8AI!.player;
    }

    _handleAssetLoaded(asset: AssetHeader, res: PIXI.LoaderResource) {
        if (res.extension === "fnt") {
            this._ppu.addFont(asset as FontHeader);
        } else if (res.texture !== undefined) {
            this._ppu.addTileMap(asset as TileMapHeader, res.texture);
        }
    }

    // IGame interface
    init(pixiMoroxel8AI: PixiMoroxel8AI.IPixiMoroxel8AI): void {
        this._pixiMoroxel8AI = pixiMoroxel8AI;
        pixiMoroxel8AI.autoClearBackBuffer = false;
        this._ppu = new PPU(
            pixiMoroxel8AI.PIXI,
            pixiMoroxel8AI.renderer,
            pixiMoroxel8AI.backBuffer
        );
    }

    load(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // init the game and load assets
            initGame(this, this.player, (asset, res) =>
                this._handleAssetLoaded(asset, res)
            ).then((data) => {
                // received the game script
                this._gameScript = data;

                // initialize the VM for game script
                this._vm = initVM(data.language, data.script, this);
                if (this._vm === undefined) {
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
        return {};
    }

    loadState(state: object): void {}

    getStateForAgent(): object {
        return {};
    }

    tick(inputs: MoroboxAIGameSDK.IInputs[], delta: number): void {
        if (this._vm === undefined) {
            return;
        }

        this._ppu.drawEnabled = true;
        this._ppu.preRender();
        this._inputs = inputs;
        this._vm.tick(delta);
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
}

export const boot: MoroboxAIGameSDK.IBoot = (
    player: MoroboxAIGameSDK.IPlayer
) => {
    return PixiMoroxel8AI.init({ player, game: new Moroxel8AI() });
};
