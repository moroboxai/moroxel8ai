export interface IVM {
    // Save the state of the game
    saveState(): object;
    // Load the state of the game
    loadState(state: object): void;
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
