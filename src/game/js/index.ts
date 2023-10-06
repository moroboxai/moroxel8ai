import type { IAPI } from "../../api";
import { GAME_FUNCTIONS } from "../_utils";
import type { IGame } from "../_utils";

/**
 * Game loaded from a JS script.
 */
class JSGame implements IGame {
    private _fun: Function;
    private _context: any;

    constructor(fun: Function, context: any) {
        this._fun = fun;
        this._context = context;
    }

    saveState(): object {
        if (this._context.saveState !== undefined) {
            return this._context.saveState();
        }

        return {};
    }

    loadState(state: object): void {
        if (this._context.loadState !== undefined) {
            this._context.loadState(state);
        }
    }

    getStateForAgent(): object {
        if (this._context.getStateForAgent !== undefined) {
            return this._context.getStateForAgent();
        }

        return {};
    }

    tick(deltaTime: number): void {
        if (this._context.tick !== undefined) {
            this._context.tick(deltaTime);
        }
    }
}

/**
 * Initialize a new JS VM for running a script.
 * @param {string} script - script to inject
 * @param {IAPI} api - interface for the CPU
 * @returns {IVM} - new JS VM
 */
export function initJS(script: string | undefined, api: IAPI): JSGame {
    const context = {};
    const builtins: any = {
        // For exposing functions from game
        exports: context,
        // Builtin constants and functions
        SWIDTH: api.SWIDTH,
        SHEIGHT: api.SHEIGHT,
        P1: api.P1,
        P2: api.P2,
        BLEFT: api.BLEFT,
        BRIGHT: api.BRIGHT,
        BUP: api.BUP,
        BDOWN: api.BDOWN,
        clear: api.clear.bind(api),
        camera: api.camera.bind(api),
        print: api.print.bind(api),
        // PLAYER API
        state: api.state.bind(api),
        btn: api.btn.bind(api),
        pbound: api.pbound.bind(api),
        plabel: api.plabel.bind(api),
        // TILEMAP API
        tmap: api.tmap.bind(api),
        tmode: api.tmode.bind(api),
        // SPRITE API
        stile: api.stile.bind(api),
        sorigin: api.sorigin.bind(api),
        sflip: api.sflip.bind(api),
        sscale: api.sscale.bind(api),
        srot: api.srot.bind(api),
        sclear: api.sclear.bind(api),
        sdraw: api.sdraw.bind(api),
        sbox: api.sbox.bind(api),
        // TEXT API
        fnt: api.fnt.bind(api),
        falign: api.falign.bind(api),
        fcolor: api.fcolor.bind(api),
        fclear: api.fclear.bind(api),
        fdraw: api.fdraw.bind(api),
        // MATH API
        abs: api.abs.bind(api),
        floor: api.floor.bind(api),
        ceil: api.ceil.bind(api),
        sign: api.sign.bind(api),
        min: api.min.bind(api),
        max: api.max.bind(api),
        clamp: api.clamp.bind(api),
        cos: api.cos.bind(api),
        sin: api.sin.bind(api)
    };

    const params = Object.keys(builtins);
    const fun = new Function(
        ...params,
        `${script}\n; ${GAME_FUNCTIONS.map(
            (name) =>
                `if (typeof ${name} !== "undefined") exports.${name} = ${name}`
        ).join(";")}`
    );

    fun(...params.map((_) => builtins[_]));
    return new JSGame(fun, context);
}
