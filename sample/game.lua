-- select tilemap.png as the tilemap
local tilemap = tmap('tilemap')
local font = fnt('MoroboxAIRetro')

local yFloor = 7 * 16
local xPlayer = 0
local yPlayer = yFloor
local isOnFloor = true
local xSpeed = 0.75
local xDir = 1
local xVel = 0
local yVel = 0
local time = 0

function tick(deltaTime)
    clear(0)
    tmode(16)
    
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
    camera(xPlayer, SHEIGHT / 2)

    -- Background
    sclear()
    stile(tilemap, 0, 0, 1, 1)

    for i = -4, 18, 1 do
        sdraw(floor((xPlayer / 16) + i) * 16, 0)
        sdraw(floor((xPlayer / 16) + i) * 16, 7 * 16)
    end

    -- Player
    sclear()
    sflip(xDir < 0, false)
    sorigin(8, 16)

    if xVel ~= 0 then
        xDir = sign(xVel)
        stile(tilemap, 0 + floor((time % 16) / 8), 3, 1, 1)
    else
        stile(tilemap, 0, 3, 1, 1)
    end

    sdraw(xPlayer, yPlayer)

    -- Text
    tmode(8)
    sclear()
    stile(tilemap, 0, 8, 3, 3)
    sbox(8, 24, 96, 32)
    
    fclear()
    fcolor(0xFFFFFF)
    falign(0.5, 0.5)
    fdraw(font, "LUA SAMPLE", 56, 40)
end
