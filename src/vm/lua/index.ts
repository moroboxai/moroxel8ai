import * as Moroxel8AISDK from 'moroxel8ai-sdk';
import { IVM } from '../_utils';
import {
    lua_State,
    lua,
    lauxlib,
    to_luastring,
    to_jsstring
} from 'fengari';

class LuaVM implements IVM {
    private _luaState: lua_State;

    constructor(luaState: lua_State) {
        this._luaState = luaState;
    }

    tick(deltaTime: number): void {
        lua.lua_getglobal(this._luaState, to_luastring("tick", true));
        pushnumber(this._luaState, deltaTime);
        if (lua.lua_call(this._luaState, 1, 0) !== lua.LUA_OK) {
            throw new Error(to_jsstring(lua.lua_tostring(this._luaState, -1)));
        }
    }
}

function pushboolean(L: lua_State, b: boolean): void {
    lua.lua_pushboolean(L, b);
}

function pushnumber(L: lua_State, n: number): void {
    lua.lua_pushnumber(L, n);
}

function pushstring(L: lua_State, s: string): void {
    lua.lua_pushstring(L, to_luastring(s));
}

function getboolean(L: lua_State, i: number): boolean {
    return lua.lua_toboolean(L, i);
}

function getnumber(L: lua_State, i: number): number {
    return lua.lua_tonumber(L, i);
}

function getstring(L: lua_State, i: number): string {
    return lua.lua_tojsstring(L, i);
}

function nargs(L: lua_State): number {
    return lua.lua_gettop(L);
}

function getset(L: lua_State, h: string, a: number, b: number, get: () => number, set: () => void): (o: lua_State) => number;
function getset(L: lua_State, h: string, checkGet: (n: number) => boolean, checkSet: (n: number) => boolean, get: () => number, set: () => void): (o: lua_State) => number;
function getset(L: lua_State, h: string, a: number | ((n: number) => boolean), b: number | ((n: number) => boolean), get: () => number, set: () => void): (o: lua_State) => number {
    if (typeof a === 'number') {
        a = nargsEquals(a);
    }

    if (typeof b === 'number') {
        b = nargsEquals(b);
    }

    return (_: lua_State) => {
        const size = nargs(L);
        if ((a as any)(size)) {
            return get();
        }

        if (!(b as any)(size)) {
            return lauxlib.luaL_error(to_luastring(h));
        }

        set();
        return;
    };
}

function nargsEquals(n: number): (n: number) => boolean {
    return (_: number) => n === n;
}

function func(L: lua_State, h: string, n: number, call: () => number): (o: lua_State) => number;
function func(L: lua_State, h: string, check: (n: number) => boolean, call: () => number): (o: lua_State) => number;
function func(L: lua_State, h: string, n: number | ((n: number) => boolean), call: () => number): (o: lua_State) => number {
    if (typeof n === 'number') {
        n = nargsEquals(n);
    }

    return (_: lua_State) => {
        const size = nargs(L);
        if (!(n as any)(size)) {
            return lauxlib.luaL_error(to_luastring(h));
        }

        return call();
    };
}

/**
 * Initialize a new Lua VM for running a script.
 * @param {string} script - script to inject
 * @param {Moroxel8AISDK.IMoroxel8AI} api - interface for the CPU
 * @returns {any} - new Lua VM
 */
export function initLua(script: string | undefined, api: Moroxel8AISDK.IMoroxel8AI): IVM | undefined {
    const luaState: lua_State = lauxlib.luaL_newstate();

    const setnameval = function(name: string, val: number) {
        pushnumber(luaState, val);
        lua.lua_setglobal(luaState, to_luastring(name));
    };

    setnameval('SWIDTH', api.SWIDTH);
    setnameval('SHEIGHT', api.SHEIGHT);
    setnameval('TNUM', api.TNUM);
    setnameval('SNUM', api.SNUM);
    setnameval('P1', api.P1);
    setnameval('P2', api.P2);
    setnameval('BLEFT', api.BLEFT);
    setnameval('BRIGHT', api.BRIGHT);
    setnameval('BUP', api.BUP);
    setnameval('BDOWN', api.BDOWN);

    const funs = {
        print: (_: lua_State) => {
            console.log(lua.lua_tojsstring(_, -1));
            return 0;
        },
        btn: func(luaState, "btn([pid], bid)",
            (n: number) => n === 1 || n === 2,
            () => {
                const size = nargs(luaState);

                pushboolean(luaState, api.btn(
                    size > 1 ? getnumber(luaState, 1) : api.P1,
                    getnumber(luaState, -1),
                ));
                return 1;
            }
        ),
        // TILEMAP API
        tmap: func(luaState, "tmap(id)", 1,
            () => {
                api.tmap(getstring(luaState, 1));
                return 0;
            }
        ),
        // MAP API
        mmode: func(luaState, "mmode(val)", 1,
            () => {
                api.mmode(getnumber(luaState, 1));
                return 0;
            }
        ),
        mclear: func(luaState, "mclear()", 0,
            () => {
                api.mclear();
                return 0;
            }
        ),
        mtile: func(luaState, "mtile(x, y, i, j, [w, h])",
            (n: number) => n === 4 || n === 6,
            () => {
                const size = nargs(luaState);

                api.mtile(
                    getnumber(luaState, 1),
                    getnumber(luaState, 2),
                    getnumber(luaState, 3),
                    getnumber(luaState, 4),
                    size > 4 ? getnumber(luaState, 5) : undefined,
                    size > 5 ? getnumber(luaState, 6) : undefined
                )
                return 0;
            }
        ),
        mscroll: func(luaState, "mscroll(x, y)", 2,
            () => {
                api.mscroll(
                    getnumber(luaState, 1),
                    getnumber(luaState, 2)
                );
                return 0;
            }
        ),
        // SPRITE API
        stile: func(luaState, "stile(id, i, j, [w, h])",
            (n: number) => n === 3 || n === 5,
            () => {
                const size = nargs(luaState);

                api.stile(
                    getnumber(luaState, 1),
                    getnumber(luaState, 2),
                    getnumber(luaState, 3),
                    size > 3 ? getnumber(luaState, 4) : undefined,
                    size > 4 ? getnumber(luaState, 5) : undefined
                )
                return 0;
            }
        ),
        sorigin: getset(luaState, "sorigin(id, [x, y])", 1, 3,
            () => {
                const pos = api.sorigin(getnumber(luaState, 1));
                pushnumber(luaState, pos.x);
                pushnumber(luaState, pos.y);
                return 2;
            },
            () => api.sorigin(
                getnumber(luaState, 1),
                getnumber(luaState, 2),
                getnumber(luaState, 3),
            )
        ),
        spos: getset(luaState, "spos(id, [x, y])", 1, 3,
            () => {
                const pos = api.spos(getnumber(luaState, 1));
                pushnumber(luaState, pos.x);
                pushnumber(luaState, pos.y);
                return 2;
            },
            () => api.spos(
                getnumber(luaState, 1),
                getnumber(luaState, 2),
                getnumber(luaState, 3),
            )
        ),
        sflip: getset(luaState, "sflip(id, [h, v])", 1, 2,
            () => {
                const scale = api.sflip(getnumber(luaState, 1));
                pushboolean(luaState, scale.h);
                pushboolean(luaState, scale.v);
                return 2;
            },
            () => api.sflip(
                getnumber(luaState, 1),
                getboolean(luaState, 2),
                getboolean(luaState, 3),
            )
        ),
        sscale: getset(luaState, "sscale(id, [x, y])", 1, 3,
            () => {
                const scale = api.sscale(getnumber(luaState, 1));
                pushnumber(luaState, scale.x);
                pushnumber(luaState, scale.y);
                return 2;
            },
            () => api.sscale(
                getnumber(luaState, 1),
                getnumber(luaState, 2),
                getnumber(luaState, 3),
            )
        ),
        srot: getset(luaState, "srot(id, [a])", 1, 2,
            () => {
                pushnumber(luaState, api.srot(getnumber(luaState, 1)));
                return 1;
            },
            () => api.srot(
                getnumber(luaState, 1),
                getnumber(luaState, 2),
            )
        )
    };

    Object.entries(funs).forEach((k, v) => lua.lua_register(luaState, k, v));

    if (script !== undefined) {
        if (lauxlib.luaL_dostring(luaState, to_luastring(script)) != lua.LUA_OK) {
            console.error(to_jsstring(lua.lua_tostring(luaState, -1)));
            return undefined;
        }
    }

    return new LuaVM(luaState);
}
