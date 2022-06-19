mode(MDEFAULT)
-- select tilemap.png as the tilemap
tmap('tilemap')
-- assign the tile 0 to sprite 0
stile(0, 6)
-- origin of sprite 0 is the center
sorigin(0, 8, 8)
-- center sprite 0 on screen
spos(0, SWIDTH / 2, SHEIGHT / 2);

function tick(deltaTime)
    -- rotate sprite 0
    srot(0, srot(0) + deltaTime)
    if (btn(BLEFT)) then
        x, y = sscale(0)
        sscale(0, x + deltaTime / 10, y + deltaTime / 10)
    end
end
