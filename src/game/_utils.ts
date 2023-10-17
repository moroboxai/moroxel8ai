import type { GameSaveState } from "moroboxai-game-sdk";

/**
 * Functions to implement to be compatible with Moroxel8AI.
 */
export interface IGame {
    // Save the state of the game
    saveState(): GameSaveState;
    // Load the state of the game
    loadState(state?: GameSaveState): void;
    // Get the game state for an agent
    getStateForAgent(): object;
    // Tick the game
    tick(deltaTime: number): void;
}

export const GAME_FUNCTIONS = [
    "saveState",
    "loadState",
    "getStateForAgent",
    "tick"
];
