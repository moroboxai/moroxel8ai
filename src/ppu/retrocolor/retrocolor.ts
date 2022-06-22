import { Filter } from 'pixi.js';

const fragment = 'precision mediump float;' +

'varying vec2 vTextureCoord;' +

'uniform sampler2D uSampler;' +

'void main(void)' +
'{' +
'   vec4 color = texture2D(uSampler, vTextureCoord);' +
'   gl_FragColor.r = ((floor(color.r * 7.0) * 256.0) / 7.0) / 256.0;' +
'   gl_FragColor.g = ((floor(color.g * 7.0) * 256.0) / 7.0) / 256.0;' +
'   gl_FragColor.b = ((floor(color.b * 3.0) * 256.0) / 3.0) / 256.0;' +
'   gl_FragColor.a = color.a;' +
'}';

class RetroColorFilter extends Filter
{
    constructor()
    {
        super('', fragment);
    }
}

export { RetroColorFilter };