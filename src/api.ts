/**
 * API exposed by Moroxel8AI for the games.
 */
export interface IAPI {
    /** Screen width (128) */
    readonly SWIDTH: number;

    /** Screen height (128) */
    readonly SHEIGHT: number;

    /** Maximum number of tilemaps */
    readonly TNUM: number;

    /** Maximum number of sprites */
    readonly SNUM: number;

    /** First player */
    readonly P1: number;

    /** Second player */
    readonly P2: number;

    /** Left button */
    readonly BLEFT: number;

    /** Right button */
    readonly BRIGHT: number;

    /** Up button */
    readonly BUP: number;

    /** Down button */
    readonly BDOWN: number;

    /**
     * Clear the screen.
     */
    clear(): void;
    clear(c: number): void;

    /**
     * Set camera position.
     *
     * @param {number} x - x-coordinate
     * @param {number} y - y-coordinate
     */
    camera(x: number, y: number): void;

    /**
     * Print a message to the console.
     * @param {any[]} values - what to print
     */
    print(...values: any[]): void;

    //############
    // PLAYER API
    //############

    /**
     * Send the game state to all players.
     * @param {any} val - game state
     */
    state(val: any): void;

    /**
     * Send the game state to selected player.
     * @param {number} pid - player id
     * @param {any} val - game state
     */
    state(pid: number, val: any): void;

    /**
     * Get the state of a button for P1.
     * @param {number} bid - button id
     * @returns true if pressed
     */
    btn(bid: number): boolean;

    /**
     * Get the state of a button.
     * @param {number} pid - player id
     * @param {number} bid - button id
     * @returns true if pressed
     */
    btn(pid: number, bid: number): boolean;

    /**
     * Get if an AI is bound to a player controller.
     * @param {number} pid - player id
     * @returns {boolean} true if AI bound
     */
    pbound(pid: number): boolean;

    /**
     * Get the label of a player.
     * @param {number} pid - player id
     * @returns {string} player label
     */
    plabel(pid: number): string;

    //############
    // TILEMAP API
    //############

    /**
     * Get id of a tilemap identified by a unique name.
     * @param {string} name - tilemap unique name
     * @returns {number} tilemap id
     */
    tmap(name: string): number;

    /**
     * Select map mode (8 | 16 | 32 | 64) pixels.
     *
     * This allows mtile to works on 8x8, 16x16, ... tiles.
     *
     * @param {number} val - new mode
     */
    tmode(val: number): void;

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
    stile(id: number, i: number, j: number, w?: number, h?: number): void;

    /**
     * Set the origin attribute of next sprite.
     * @param {number} x - x-coordinate
     * @param {number} y - y-coordinate
     */
    sorigin(x: number, y: number): void;

    /**
     * Set the flips attributes of next sprite.
     * @param {number} h - horizontal flip
     * @param {number} v - vertical flip
     */
    sflip(h: boolean, v: boolean): void;

    /**
     * Set the scales attributes of next sprite.
     * @param {number} x - horizontal scale
     * @param {number} y - vertical scale
     */
    sscale(x: number, y: number): void;

    /**
     * Set the rotation attribute of next sprite.
     * @param {number} a - angle in degrees
     */
    srot(a: number): void;

    /**
     * Clear all attributes of next sprite.
     */
    sclear(): void;

    /**
     * Draw next sprite.
     *
     * @param {number} x - x-coordinate
     * @param {number} y - y-coordinate
     */
    sdraw(x: number, y: number): void;

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
    sbox(x: number, y: number, w: number, h: number): void;

    //###########
    // TEXT API
    //###########

    /**
     * Get id of a font identified by a unique name.
     * @param {string} name - font unique name
     * @returns {number} font id
     */
    fnt(name: string): number;

    /**
     * Set the align attribute of next text.
     * @param {number} x - horizontal alignment
     * @param {number} y - vertical alignment
     */
    falign(x: number, y: number): void;

    /**
     * Set the color attribute of next text.
     * @param {number} c - hexadecimal color
     */
    fcolor(c: number): void;

    /**
     * Clear all attributes of next text.
     */
    fclear(): void;

    /**
     * Draw next text.
     * @param {number} id - font id
     * @param {string} text - text to draw
     * @param {number} x - x-coordinate
     * @param {number} y - y-coordinate
     */
    fdraw(id: number, text: string, x: number, y: number): void;

    //###########
    // MATH API
    //###########

    abs(val: number): number;
    floor(val: number): number;
    ceil(val: number): number;
    sign(val: number): number;
    min(a: number, b: number): number;
    max(a: number, b: number): number;
    clamp(val: number, min: number, max: number): number;
    cos(val: number): number;
    sin(val: number): number;
}
