import * as Moroxel8AISDK from 'moroxel8ai-sdk';
import { IVM } from '../_utils';

class JSVM implements IVM {
    private _state: any;

    constructor(state: any) {
        this._state = state;
        console.log(state);
    }

    tick(deltaTime: number): void {
        if (this._state.tick !== undefined) {
            this._state.tick(deltaTime);
        }
    }
}

/**
 * Initialize a new JS VM for running a script.
 * @param {string} script - script to inject
 * @param {Moroxel8AISDK.IMoroxel8AI} api - interface for the CPU
 * @returns {any} - new JS VM
 */
export function initJS(script: string | undefined, api: Moroxel8AISDK.IMoroxel8AI): IVM | undefined {
    const builtins: any = {
        SWIDTH: api.SWIDTH,
        SHEIGHT: api.SHEIGHT,
        P1: api.P1,
        P2: api.P2,
        BLEFT: api.BLEFT,
        BRIGHT: api.BRIGHT,
        BUP: api.BUP,
        BDOWN: api.BDOWN,
        print: api.print.bind(api),
        btn: api.btn.bind(api),
        // TILEMAP API
        tmap: api.tmap.bind(api),
        // MAP API
        mmode: api.mmode.bind(api),
        mclear: api.mclear.bind(api),
        mtile: api.mtile.bind(api),
        mscroll: api.mscroll.bind(api),
        // SPRITE API
        stile: api.stile.bind(api),
        sorigin: api.sorigin.bind(api),
        spos: api.spos.bind(api),
        sflip: api.sflip.bind(api),
        sscale: api.sscale.bind(api),
        srot: api.srot.bind(api),
    };

    const params = Object.keys(builtins);
    return new JSVM(new Function(...params, `${script}; try {return {tick}}catch(e){return {};};`)(...params.map(_ => builtins[_])));
}
