WIDTH = 256;
HEIGHT = 256;

function tick(deltaTime)
    tmap('tilemap');

    for i = 0, 16, 1
    do
        stile(i, 0);
        spos(i, i * 16, HEIGHT - 16);
    end

    stile(16, 2);
    spos(16, 3 * 16, HEIGHT - 48);
    stile(17, 3);
    spos(17, 4 * 16, HEIGHT - 48);
    stile(18, 4);
    spos(18, 3 * 16, HEIGHT - 32);
    stile(19, 5);
    spos(19, 4 * 16, HEIGHT - 32);
end
