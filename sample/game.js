// select tilemap.png as the tilemap
let tilemap = tmap('tilemap');
let font = fnt('MoroboxAIRetro');

let yFloor = 7 * 16;
let xPlayer = 0;
let yPlayer = yFloor;
let isOnFloor = true;
let xSpeed = 0.75;
let xDir = 1;
let xVel = 0;
let yVel = 0;
let time = 0;

function tick(deltaTime) {
    clear(0);
    tmode(16);
    
    time = time + deltaTime;

    if (btn(P1, BRIGHT)) {
        xVel = xSpeed;
    } else if (btn(BLEFT)) {
        xVel = -xSpeed;
    } else {
        xVel = 0;
    }

    if (!isOnFloor) {
        yVel = yVel + deltaTime * 0.25;
        yPlayer = yPlayer + yVel * deltaTime;

        if (yPlayer >= yFloor) {
            isOnFloor = true;
            yPlayer = yFloor;
        }
    }

    if (btn(BUP) && isOnFloor) {
        isOnFloor = false;
        yVel = yVel - 5;
    }

    xPlayer = xPlayer + xVel * deltaTime;
    camera(xPlayer, SHEIGHT / 2);

    // Background
    sclear();
    stile(tilemap, 0, 0, 1, 1);

    for (let i = -4; i < 18; ++i) {
        sdraw(floor((xPlayer / 16) + i) * 16, 0);
        sdraw(floor((xPlayer / 16) + i) * 16, 7 * 16);
    }

    // Player
    sclear();
    sflip(xDir < 0, false);
    sorigin(8, 16);

    if (xVel != 0) {
        xDir = sign(xVel);
        stile(tilemap, 0 + floor((time % 16) / 8), 3, 1, 1);
    } else {
        stile(tilemap, 0, 3, 1, 1);
    }

    sdraw(xPlayer, yPlayer);

    // Text
    tmode(8);
    sclear();
    stile(tilemap, 0, 8, 3, 3);
    sbox(8, 24, 96, 32);
    
    fclear();
    fcolor(0xFFFFFF);
    falign(0.5, 0.5);
    fdraw(font, "JS SAMPLE", 56, 40);
}
