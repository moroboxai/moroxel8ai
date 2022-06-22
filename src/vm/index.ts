import { IMoroxel8AI } from 'moroxel8ai-sdk';
import { initJS } from './js';
import { initLua } from './lua';
import { IVM } from './_utils';
export { IVM } from './_utils';

export function initVM(language: 'javascript' | 'lua', script: string | undefined, api: IMoroxel8AI): IVM | undefined {
    switch (language) {
        case 'lua':
            return initLua(script, api);
        case 'javascript':
            return initJS(script, api);
        default:
            return undefined;
    }
}