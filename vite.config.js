import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
    base: "/moroxel8ai/",
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src")
        }
    }
});
