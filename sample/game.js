// select tilemap.png as the tilemap
tmap('tilemap');
// assign the tile (0, 3) to sprite 0
stile(0, 0, 3, 1, 1);
// center sprite 0 on screen
sorigin(0, 8, 16);

let yFloor = 7 * 16;
let xPlayer = 0;
let yPlayer = yFloor;
let isOnFloor = true;
let xSpeed = 1.5;
let xDir = 1;
let xVel = 0;
let yVel = 0;
let time = 0;

function tick(deltaTime) {
    time += deltaTime;

    if (btn(P1, BRIGHT)) {
        xVel = xSpeed;
    } else if (btn(BLEFT)) {
        xVel = -xSpeed;
    } else {
        xVel = 0;
    }

    if (!isOnFloor) {
        yVel += deltaTime * 0.25;
        yPlayer += yVel * deltaTime;

        if (yPlayer >= yFloor) {
            isOnFloor = true;
            yPlayer = yFloor;
        }
    }

    if (btn(BUP) && isOnFloor) {
        isOnFloor = false;
        yVel -= 5;
    }

    xPlayer = xPlayer + xVel * deltaTime;
    if (xVel !== 0) {
        xDir = sign(xVel);
        stile(0, 0 + floor((time % 16) / 8), 3, 1, 1);
    } else {
        stile(0, 0, 3, 1, 1);
    }

    sflip(0, xDir < 0, false);

    spos(0, SWIDTH / 2, yPlayer);

    const dX = xPlayer - (SWIDTH / 2);

    mclear();
    mscroll(dX, 0);

    mmode(16);
    for (let i = -2; i < 9; ++i) {
        mtile(floor(dX / 16) + i, 0, 0, 0);
        mtile(floor(dX / 16) + i, 7, 0, 0);
    }
}
