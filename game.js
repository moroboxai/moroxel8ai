const WIDTH = 256;
const HEIGHT = 256;

function Game(vm) {

    return {
        tick: (deltaTime) => {
            vm.tmap('tilemap');

            for (let i = 0; i < 16; ++i) {
                vm.stile(i, 0);
                vm.spos(i, i * 16, HEIGHT - 16);
            }

            vm.stile(16, 2);
            vm.spos(16, 3 * 16, HEIGHT - 48);
            vm.stile(17, 3);
            vm.spos(17, 4 * 16, HEIGHT - 48);
            vm.stile(18, 4);
            vm.spos(18, 3 * 16, HEIGHT - 32);
            vm.stile(19, 5);
            vm.spos(19, 4 * 16, HEIGHT - 32);
        }
    }
}

function boot(vm) {
    return Game(vm);
}

exports.boot = boot;