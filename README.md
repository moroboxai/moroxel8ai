# moroxel8ai

[![NPM version](https://img.shields.io/npm/v/moroxel8ai.svg)](https://www.npmjs.com/package/moroxel8ai)
![Node.js CI](https://github.com/moroboxai/moroxel8ai/workflows/Node.js%20CI/badge.svg)
[![gitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/moroboxai/moroxel8ai/blob/master/LICENSE)
[![Code Quality: Javascript](https://img.shields.io/lgtm/grade/javascript/g/moroboxai/moroxel8ai.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/moroboxai/moroxel8ai/context:javascript)
[![Total Alerts](https://img.shields.io/lgtm/alerts/g/moroboxai/moroxel8ai.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/moroboxai/moroxel8ai/alerts)

Fantasy 8-bit CPU for [MoroboxAI](https://github.com/moroboxai).

## Why

MoroboxAI by itself is a generic framework that can run any JavaScript code that exports a **boot** function.

Moroxel8AI is a layer of abstraction on top of that and:
  * Uses [PixiJS](https://pixijs.com/) as a renderer
  * Uses [fengari](https://github.com/fengari-lua/fengari) for running your game written in Lua
  * Implements all the boilerplate for being compatible with MoroboxAI
  * Takes care of loading all your assets
  * Provides a simple interface for controlling the graphics, audio, and inputs

To sum up, Moroxel8AI takes care of all the boilerplate required for initializing and running your game in MoroboxAI, and lets you focus on coding the game logic in Lua.

## Minimal game

For the purpose of this tutorial, we will create a `sample` folder with the following structure:

```bash
sample/
├─ assets/
│  ├─ tilemap.png
├─ game.lua
├─ header.json
├─ index.html
```

The `assets` directory is where Moroxel8AI loads assets from. Here is `tilemap.png`, this is a 16x16 pixels tilemap taken from Mario on NES:

![Preview](https://github.com/moroboxai/moroxel8ai/raw/media/tilemap.png)

The `header.json` contains some metadata about assets and how to run the game:

```json
{
    "assets": [
        {"id": "tilemap", "path": "tilemap.png", "mode": "16x16"}
    ],
    "boot": "Moroxel8AI",
    "main": "game.lua"
}
```

All the game logic is written in `game.lua`:

```lua
WIDTH = 256;
HEIGHT = 256;

-- select tilemap.png as the tilemap
tmap('tilemap');
-- assign the tile 0 to sprite 0
stile(0, 6);
-- origin of sprite 0 is the center
sorigin(0, 8, 8);
-- center sprite 0 on screen
spos(0, WIDTH / 2, HEIGHT / 2);

function tick(deltaTime)
    -- rotate sprite 0
    srot(0, srot(0) + deltaTime)
end
```

Now, all remain is `index.html` which is simply loading MoroboxAI + Moroxel8AI and initializing the game:

```html
<html>
    <head>
        <title>moroxel8ai</title>
        <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/moroboxai-player-web@0.1.0-alpha.10/lib/umd/moroboxai-player-web.min.js"></script>
        <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/moroxel8ai@0.1.0-alpha.1/lib/umd/moroxel8ai.min.js"></script>
    </head>
    <body>
        <div id="player"></div>
    </body>
    <script type="text/javascript">
        (function() {
            console.log(`moroboxai-player-web v${MoroboxAIPlayer.VERSION}`);
            
            player = MoroboxAIPlayer.init(document.getElementById("player"), {
                url: `./`,
                resizable: false,
                autoPlay: true,
                onReady: () => console.log("ready")
            });
        })();
    </script>

    <style type="text/css">
        body {
            height: 100%;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }

        #player {
            background-color: black;
            background-size: cover;
            width: 256px;
            height: 256px;
        }
    </style>
</html>
```

## Run on the web

Testing on the web requires you to run a local HTTP server to avoid CORS errors when loading local files.

For that you can install **http-server**:

```bash
npm install http-server -g
```

Open a command prompt in the `sample` folder and run:

```bash
http-server
```

Now you can access the page on **localhost** and the port opened by **http-server**.

## License

This content is released under the [MIT](http://opensource.org/licenses/MIT) License.
