import type { GameHeader } from "moroboxai-game-sdk";
import {
    PluginImpl,
    PluginContext,
    LoadHeaderOptions
} from "moroboxai-player-sdk";
import type { IMoroxel8AI } from "moroxel8ai-sdk";
import type { IVM } from "./vm";

export interface IMain {
    (vm: IMoroxel8AI): Promise<IVM>;
}

export interface IInjectScriptOptions {
    script: string | IMain;
}

export const injectScript: PluginImpl<IInjectScriptOptions> = (
    options?: IInjectScriptOptions
) => {
    return {
        name: "injectScript",
        /**
         * Default loading of the header.
         * @param {LoadHeaderOptions} options - loading options
         * @returns the header
         */
        loadHeader(
            this: PluginContext,
            options_: LoadHeaderOptions
        ): Promise<GameHeader> {
            return new Promise<GameHeader>((resolve, reject) => {
                if (options_.header === undefined) {
                    return reject();
                }

                if (options !== undefined) {
                    (options_.header as any).script = options.script;
                }

                return resolve(options_.header);
            });
        }
    };
};
