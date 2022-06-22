export interface AssetHeader {
    id?: string;
    path?: string;
}

export interface TileMapHeader extends AssetHeader {
    mode?: "8x8" | "16x16" | "32x32"
}
