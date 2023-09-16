import * as Moroxel8AISDK from "moroxel8ai-sdk";
import { IVM } from "../_utils";
import {
    lua_State,
    lua,
    lauxlib,
    to_luastring,
    to_jsstring
} from "fengari-web";

class LuaVM implements IVM {
    private _luaState: lua_State;

    constructor(luaState: lua_State) {
        this._luaState = luaState;
    }

    saveState(): object {
        lua.lua_getglobal(this._luaState, to_luastring("saveState", true));
        if (lua.lua_call(this._luaState, 1, 0) !== lua.LUA_OK) {
            const err = getstring(this._luaState, -1);
            if (err) {
                throw new Error(err);
            }
        }
        return getobject(this._luaState, -1);
    }

    loadState(state: object): void {
        lua.lua_getglobal(this._luaState, to_luastring("loadState", true));
        pushobject(this._luaState, state);
        if (lua.lua_call(this._luaState, 1, 0) !== lua.LUA_OK) {
            const err = getstring(this._luaState, -1);
            if (err) {
                throw new Error(err);
            }
        }
    }

    getStateForAgent(): object {
        lua.lua_getglobal(
            this._luaState,
            to_luastring("getStateForAgent", true)
        );
        if (lua.lua_call(this._luaState, 1, 0) !== lua.LUA_OK) {
            const err = getstring(this._luaState, -1);
            if (err) {
                throw new Error(err);
            }
        }
        return getobject(this._luaState, -1);
    }

    tick(deltaTime: number): void {
        lua.lua_getglobal(this._luaState, to_luastring("tick", true));
        pushnumber(this._luaState, deltaTime);
        if (lua.lua_call(this._luaState, 1, 0) !== lua.LUA_OK) {
            const err = getstring(this._luaState, -1);
            if (err) {
                throw new Error(err);
            }
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

function pushobject(L: lua_State, o: object): void {}

function getboolean(L: lua_State, i: number): boolean {
    return lua.lua_toboolean(L, i);
}

function getnumber(L: lua_State, i: number): number {
    return lua.lua_tonumber(L, i);
}

function getstring(L: lua_State, i: number): string {
    return lua.lua_tojsstring(L, i);
}

function getobject(L: lua_State, i: number): any {
    return lua.lua_touserdata(L, i);
}

function nargs(L: lua_State): number {
    return lua.lua_gettop(L);
}

function getset(
    L: lua_State,
    h: string,
    a: number,
    b: number,
    get: () => number,
    set: () => void
): (o: lua_State) => number;
function getset(
    L: lua_State,
    h: string,
    checkGet: (n: number) => boolean,
    checkSet: (n: number) => boolean,
    get: () => number,
    set: () => void
): (o: lua_State) => number;
function getset(
    L: lua_State,
    h: string,
    a: number | ((n: number) => boolean),
    b: number | ((n: number) => boolean),
    get: () => number,
    set: () => void
): (o: lua_State) => number {
    if (typeof a === "number") {
        a = nargsEquals(a);
    }

    if (typeof b === "number") {
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
        return 0;
    };
}

function nargsEquals(n: number): (n: number) => boolean {
    return (_: number) => _ === n;
}

function func(
    L: lua_State,
    h: string,
    n: number,
    call: () => number
): (o: lua_State) => number;
function func(
    L: lua_State,
    h: string,
    check: (n: number) => boolean,
    call: () => number
): (o: lua_State) => number;
function func(
    L: lua_State,
    h: string,
    n: number | ((n: number) => boolean),
    call: () => number
): (o: lua_State) => number {
    if (typeof n === "number") {
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
export function initLua(
    script: string | undefined,
    api: Moroxel8AISDK.IMoroxel8AI
): IVM | undefined {
    const luaState: lua_State = lauxlib.luaL_newstate();

    const setnameval = function (name: string, val: number) {
        pushnumber(luaState, val);
        lua.lua_setglobal(luaState, to_luastring(name));
    };

    setnameval("SWIDTH", api.SWIDTH);
    setnameval("SHEIGHT", api.SHEIGHT);
    setnameval("TNUM", api.TNUM);
    setnameval("SNUM", api.SNUM);
    setnameval("P1", api.P1);
    setnameval("P2", api.P2);
    setnameval("BLEFT", api.BLEFT);
    setnameval("BRIGHT", api.BRIGHT);
    setnameval("BUP", api.BUP);
    setnameval("BDOWN", api.BDOWN);

    const funs = {
        clear: func(
            luaState,
            "clear([c])",
            (n: number) => n === 0 || n === 1,
            () => {
                const size = nargs(luaState);

                api.clear(size > 0 ? getnumber(luaState, 1) : 0);
                return 0;
            }
        ),
        camera: func(luaState, "camera(x, y)", 2, () => {
            api.camera(getnumber(luaState, 1), getnumber(luaState, 2));
            return 0;
        }),
        print: (_: lua_State) => {
            console.log(lua.lua_tojsstring(_, -1));
            return 0;
        },
        // PLAYER API
        state: func(
            luaState,
            "state([pid], val)",
            (n: number) => n === 1 || n === 2,
            () => {
                const size = nargs(luaState);
                const o = getobject(luaState, -1);

                api.state(
                    size > 1 ? getnumber(luaState, 1) : o,
                    size === 1 ? undefined : o
                );
                return 0;
            }
        ),
        btn: func(
            luaState,
            "btn([pid], bid)",
            (n: number) => n === 1 || n === 2,
            () => {
                const size = nargs(luaState);

                pushboolean(
                    luaState,
                    api.btn(
                        size > 1 ? getnumber(luaState, 1) : api.P1,
                        getnumber(luaState, -1)
                    )
                );
                return 1;
            }
        ),
        pbound: func(luaState, "pbound(pid)", 1, () => {
            pushboolean(luaState, api.pbound(getnumber(luaState, 1)));
            return 1;
        }),
        plabel: func(luaState, "plabel(pid)", 1, () => {
            pushstring(luaState, api.plabel(getnumber(luaState, 1)));
            return 1;
        }),
        // TILEMAP API
        tmap: func(luaState, "tmap(id)", 1, () => {
            pushnumber(luaState, api.tmap(getstring(luaState, 1)));
            return 1;
        }),
        tmode: func(luaState, "tmode(val)", 1, () => {
            api.tmode(getnumber(luaState, 1));
            return 0;
        }),
        // SPRITE API
        stile: func(
            luaState,
            "stile(id, i, j, [w, h])",
            (n: number) => n === 3 || n === 5,
            () => {
                const size = nargs(luaState);

                api.stile(
                    getnumber(luaState, 1),
                    getnumber(luaState, 2),
                    getnumber(luaState, 3),
                    size > 3 ? getnumber(luaState, 4) : undefined,
                    size > 4 ? getnumber(luaState, 5) : undefined
                );
                return 0;
            }
        ),
        sorigin: func(luaState, "sorigin(x, y)", 2, () => {
            api.sorigin(getnumber(luaState, 1), getnumber(luaState, 2));
            return 0;
        }),
        sflip: func(luaState, "sflip(h, v)", 2, () => {
            api.sflip(getboolean(luaState, 1), getboolean(luaState, 2));
            return 0;
        }),
        sscale: func(luaState, "sscale(x, y)", 2, () => {
            api.sscale(getnumber(luaState, 1), getnumber(luaState, 2));
            return 0;
        }),
        srot: func(luaState, "srot(a)", 1, () => {
            api.srot(getnumber(luaState, 1));
            return 0;
        }),
        sclear: func(luaState, "sclear()", 0, () => {
            api.sclear();
            return 0;
        }),
        sdraw: func(luaState, "sdraw(x, y)", 2, () => {
            api.sdraw(getnumber(luaState, 1), getnumber(luaState, 2));
            return 0;
        }),
        sbox: func(luaState, "sbox(x, y, w, h)", 4, () => {
            api.sbox(
                getnumber(luaState, 1),
                getnumber(luaState, 2),
                getnumber(luaState, 3),
                getnumber(luaState, 4)
            );
            return 0;
        }),
        // TEXT API
        fnt: func(luaState, "fnt(name)", 1, () => {
            pushnumber(luaState, api.fnt(getstring(luaState, 1)));
            return 1;
        }),
        falign: func(luaState, "falign(x, y)", 2, () => {
            api.falign(getnumber(luaState, 1), getnumber(luaState, 2));
            return 0;
        }),
        fcolor: func(luaState, "fcolor(c)", 1, () => {
            api.fcolor(getnumber(luaState, 1));
            return 0;
        }),
        fclear: func(luaState, "fclear()", 0, () => {
            api.fclear();
            return 0;
        }),
        fdraw: func(luaState, "fdraw(id, text, x, y)", 4, () => {
            api.fdraw(
                getnumber(luaState, 1),
                getstring(luaState, 2),
                getnumber(luaState, 3),
                getnumber(luaState, 4)
            );
            return 0;
        }),
        // MATH API
        abs: func(luaState, "abs(val)", 1, () => {
            pushnumber(luaState, api.abs(getnumber(luaState, 1)));
            return 1;
        }),
        floor: func(luaState, "floor(val)", 1, () => {
            pushnumber(luaState, api.floor(getnumber(luaState, 1)));
            return 1;
        }),
        ceil: func(luaState, "ceil(val)", 1, () => {
            pushnumber(luaState, api.ceil(getnumber(luaState, 1)));
            return 1;
        }),
        sign: func(luaState, "sign(val)", 1, () => {
            pushnumber(luaState, api.sign(getnumber(luaState, 1)));
            return 1;
        }),
        min: func(luaState, "min(a, b)", 2, () => {
            pushnumber(
                luaState,
                api.min(getnumber(luaState, 1), getnumber(luaState, 2))
            );
            return 1;
        }),
        max: func(luaState, "max(a, b)", 2, () => {
            pushnumber(
                luaState,
                api.max(getnumber(luaState, 1), getnumber(luaState, 2))
            );
            return 1;
        }),
        clamp: func(luaState, "clamp(val, min, max)", 3, () => {
            pushnumber(
                luaState,
                api.clamp(
                    getnumber(luaState, 1),
                    getnumber(luaState, 2),
                    getnumber(luaState, 3)
                )
            );
            return 1;
        }),
        cos: func(luaState, "cos(val)", 1, () => {
            pushnumber(luaState, api.cos(getnumber(luaState, 1)));
            return 1;
        }),
        sin: func(luaState, "sin(val)", 1, () => {
            pushnumber(luaState, api.sin(getnumber(luaState, 1)));
            return 1;
        })
    };

    Object.entries(funs).forEach(([k, v]) => {
        lua.lua_register(luaState, k, (_: lua_State) => {
            try {
                return v(_);
            } catch (e) {
                throw new Error(`error in ${k} implementation: ${e}`);
            }
        });
    });

    if (script !== undefined) {
        if (
            lauxlib.luaL_dostring(luaState, to_luastring(script)) != lua.LUA_OK
        ) {
            console.error(to_jsstring(lua.lua_tostring(luaState, -1)));
            return undefined;
        }
    }

    return new LuaVM(luaState);
}
