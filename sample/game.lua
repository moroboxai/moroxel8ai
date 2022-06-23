-- select tilemap.png as the tilemap
tmap('tilemap')
-- assign the tile (0, 3) to sprite 0
stile(0, 0, 3, 1, 1)
-- center sprite 0 on screen
sorigin(0, 8, 16)

local yFloor = 7 * 16
local xPlayer = 0
local yPlayer = yFloor
local isOnFloor = true
local xSpeed = 1.5
local xDir = 1
local xVel = 0
local yVel = 0
local time = 0

function tick(deltaTime)
    time = time + deltaTime

    if btn(P1, BRIGHT) then
        xVel = xSpeed
    elseif btn(BLEFT) then
        xVel = -xSpeed
    else
        xVel = 0
    end

    if not isOnFloor then
        yVel = yVel + deltaTime * 0.25
        yPlayer = yPlayer + yVel * deltaTime

        if yPlayer >= yFloor then
            isOnFloor = true
            yPlayer = yFloor
        end
    end

    if btn(BUP) and isOnFloor then
        isOnFloor = false
        yVel = yVel - 5
    end

    xPlayer = xPlayer + xVel * deltaTime
    if xVel ~= 0 then
        xDir = sign(xVel)
        stile(0, 0 + floor((time % 16) / 8), 3, 1, 1)
    else
        stile(0, 0, 3, 1, 1)
    end

    sflip(0, xDir < 0, false)

    spos(0, SWIDTH / 2, yPlayer)

    local dX = xPlayer - (SWIDTH / 2)

    mclear()
    mscroll(dX, 0)

    mmode(16)
    for i = -2, 9, 1 do
        mtile(floor(dX / 16) + i, 0, 0, 0)
        mtile(floor(dX / 16) + i, 7, 0, 0)
    end
end
