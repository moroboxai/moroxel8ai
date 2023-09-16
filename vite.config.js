import { defineConfig } from "vite";

export default defineConfig({
    define: {
        "process.env.FENGARICONF": void 0,
        "process.versions": process.versions
    },
    base: "/moroxel8ai/"
});
