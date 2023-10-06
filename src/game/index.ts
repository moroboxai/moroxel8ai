import type { IMoroxel8AI } from "moroxel8ai-sdk";
import type { IAPI } from "../api";
import { initJS } from "./js";
import { initLua } from "./lua";
import type { IGame } from "./_utils";
export type { IGame } from "./_utils";

export function initGame(
    language: "javascript" | "lua",
    script: string | IGame | undefined,
    api: IAPI
): IGame | undefined {
    if (script === undefined) {
        return undefined;
    }

    if (typeof script !== "string") {
        // The script is already a loaded game
        return script;
    }

    // Create a VM for running the script
    switch (language) {
        case "lua":
            return initLua(script, api);
        case "javascript":
            return initJS(script, api);
        default:
            return undefined;
    }
}
