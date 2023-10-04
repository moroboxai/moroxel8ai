import * as Moroxel8AISDK from "moroxel8ai-sdk";
import * as MoroboxAILua from "moroboxai-lua";
import {
    getnumber,
    getboolean,
    getstring,
    getobject,
    push,
    nargs,
    func
} from "moroboxai-lua";
import { IVM } from "../_utils";
import { lua_State, lua, to_luastring } from "fengari-web";

class LuaVM implements IVM {
    private _instance: MoroboxAILua.IVM;

    get luaState(): lua_State {
        return this._instance.luaState;
    }

    constructor(instance: MoroboxAILua.IVM) {
        this._instance = instance;
    }

    saveState(): object {
        lua.lua_getglobal(this.luaState, to_luastring("saveState", true));
        if (lua.lua_call(this.luaState, 1, 0) !== lua.LUA_OK) {
            const err = getstring(this.luaState, -1);
            if (err) {
                throw new Error(err);
            }
        }
        return getobject(this.luaState, -1);
    }

    loadState(state: object): void {
        lua.lua_getglobal(this.luaState, to_luastring("loadState", true));
        push(this.luaState, state);
        if (lua.lua_call(this.luaState, 1, 0) !== lua.LUA_OK) {
            const err = getstring(this.luaState, -1);
            if (err) {
                throw new Error(err);
            }
        }
    }

    getStateForAgent(): object {
        lua.lua_getglobal(
            this.luaState,
            to_luastring("getStateForAgent", true)
        );
        if (lua.lua_call(this.luaState, 1, 0) !== lua.LUA_OK) {
            const err = getstring(this.luaState, -1);
            if (err) {
                throw new Error(err);
            }
        }
        return getobject(this.luaState, -1);
    }

    tick(deltaTime: number): void {
        lua.lua_getglobal(this.luaState, to_luastring("tick", true));
        push(this.luaState, deltaTime);
        if (lua.lua_call(this.luaState, 1, 0) !== lua.LUA_OK) {
            const err = getstring(this.luaState, -1);
            if (err) {
                throw new Error(err);
            }
        }
    }
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
    const instance = MoroboxAILua.initLua({
        globals: {
            SWIDTH: api.SWIDTH,
            SHEIGHT: api.SHEIGHT,
            TNUM: api.TNUM,
            SNUM: api.SNUM,
            P1: api.P1,
            P2: api.P2,
            BLEFT: api.BLEFT,
            BRIGHT: api.BRIGHT,
            BUP: api.BUP,
            BDOWN: api.BDOWN
        },
        api: {
            clear: func(
                "clear([c])",
                (n: number) => n === 0 || n === 1,
                (luaState: lua_State) => {
                    const size = nargs(luaState);

                    api.clear(size > 0 ? getnumber(luaState, 1) : 0);
                    return 0;
                }
            ),
            camera: func("camera(x, y)", 2, (luaState: lua_State) => {
                api.camera(getnumber(luaState, 1), getnumber(luaState, 2));
                return 0;
            }),
            print: (luaState: lua_State) => {
                console.log(lua.lua_tojsstring(luaState, -1));
                return 0;
            },
            // PLAYER API
            state: func(
                "state([pid], val)",
                (n: number) => n === 1 || n === 2,
                (luaState: lua_State) => {
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
                "btn([pid], bid)",
                (n: number) => n === 1 || n === 2,
                (luaState: lua_State) => {
                    const size = nargs(luaState);

                    push(
                        luaState,
                        api.btn(
                            size > 1 ? getnumber(luaState, 1) : api.P1,
                            getnumber(luaState, -1)
                        )
                    );
                    return 1;
                }
            ),
            pbound: func("pbound(pid)", 1, (luaState: lua_State) => {
                push(luaState, api.pbound(getnumber(luaState, 1)));
                return 1;
            }),
            plabel: func("plabel(pid)", 1, (luaState: lua_State) => {
                push(luaState, api.plabel(getnumber(luaState, 1)));
                return 1;
            }),
            // TILEMAP API
            tmap: func("tmap(id)", 1, (luaState: lua_State) => {
                push(luaState, api.tmap(getstring(luaState, 1)));
                return 1;
            }),
            tmode: func("tmode(val)", 1, (luaState: lua_State) => {
                api.tmode(getnumber(luaState, 1));
                return 0;
            }),
            // SPRITE API
            stile: func(
                "stile(id, i, j, [w, h])",
                (n: number) => n === 3 || n === 5,
                (luaState: lua_State) => {
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
            sorigin: func("sorigin(x, y)", 2, (luaState: lua_State) => {
                api.sorigin(getnumber(luaState, 1), getnumber(luaState, 2));
                return 0;
            }),
            sflip: func("sflip(h, v)", 2, (luaState: lua_State) => {
                api.sflip(getboolean(luaState, 1), getboolean(luaState, 2));
                return 0;
            }),
            sscale: func("sscale(x, y)", 2, (luaState: lua_State) => {
                api.sscale(getnumber(luaState, 1), getnumber(luaState, 2));
                return 0;
            }),
            srot: func("srot(a)", 1, (luaState: lua_State) => {
                api.srot(getnumber(luaState, 1));
                return 0;
            }),
            sclear: func("sclear()", 0, (luaState: lua_State) => {
                api.sclear();
                return 0;
            }),
            sdraw: func("sdraw(x, y)", 2, (luaState: lua_State) => {
                api.sdraw(getnumber(luaState, 1), getnumber(luaState, 2));
                return 0;
            }),
            sbox: func("sbox(x, y, w, h)", 4, (luaState: lua_State) => {
                api.sbox(
                    getnumber(luaState, 1),
                    getnumber(luaState, 2),
                    getnumber(luaState, 3),
                    getnumber(luaState, 4)
                );
                return 0;
            }),
            // TEXT API
            fnt: func("fnt(name)", 1, (luaState: lua_State) => {
                push(luaState, api.fnt(getstring(luaState, 1)));
                return 1;
            }),
            falign: func("falign(x, y)", 2, (luaState: lua_State) => {
                api.falign(getnumber(luaState, 1), getnumber(luaState, 2));
                return 0;
            }),
            fcolor: func("fcolor(c)", 1, (luaState: lua_State) => {
                api.fcolor(getnumber(luaState, 1));
                return 0;
            }),
            fclear: func("fclear()", 0, (luaState: lua_State) => {
                api.fclear();
                return 0;
            }),
            fdraw: func("fdraw(id, text, x, y)", 4, (luaState: lua_State) => {
                api.fdraw(
                    getnumber(luaState, 1),
                    getstring(luaState, 2),
                    getnumber(luaState, 3),
                    getnumber(luaState, 4)
                );
                return 0;
            }),
            // MATH API
            abs: func("abs(val)", 1, (luaState: lua_State) => {
                push(luaState, api.abs(getnumber(luaState, 1)));
                return 1;
            }),
            floor: func("floor(val)", 1, (luaState: lua_State) => {
                push(luaState, api.floor(getnumber(luaState, 1)));
                return 1;
            }),
            ceil: func("ceil(val)", 1, (luaState: lua_State) => {
                push(luaState, api.ceil(getnumber(luaState, 1)));
                return 1;
            }),
            sign: func("sign(val)", 1, (luaState: lua_State) => {
                push(luaState, api.sign(getnumber(luaState, 1)));
                return 1;
            }),
            min: func("min(a, b)", 2, (luaState: lua_State) => {
                push(
                    luaState,
                    api.min(getnumber(luaState, 1), getnumber(luaState, 2))
                );
                return 1;
            }),
            max: func("max(a, b)", 2, (luaState: lua_State) => {
                push(
                    luaState,
                    api.max(getnumber(luaState, 1), getnumber(luaState, 2))
                );
                return 1;
            }),
            clamp: func("clamp(val, min, max)", 3, (luaState: lua_State) => {
                push(
                    luaState,
                    api.clamp(
                        getnumber(luaState, 1),
                        getnumber(luaState, 2),
                        getnumber(luaState, 3)
                    )
                );
                return 1;
            }),
            cos: func("cos(val)", 1, (luaState: lua_State) => {
                push(luaState, api.cos(getnumber(luaState, 1)));
                return 1;
            }),
            sin: func("sin(val)", 1, (luaState: lua_State) => {
                push(luaState, api.sin(getnumber(luaState, 1)));
                return 1;
            })
        },
        script
    });

    return instance !== undefined ? new LuaVM(instance) : undefined;
}
