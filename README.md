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

## License

This content is released under the [MIT](http://opensource.org/licenses/MIT) License.
