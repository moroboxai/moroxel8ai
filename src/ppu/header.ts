export interface AssetHeader {
    name?: string;
    path?: string;
}

export interface FontHeader extends AssetHeader {}

export interface TileMapHeader extends AssetHeader {
    mode?: "8x8" | "16x16" | "32x32"
}
