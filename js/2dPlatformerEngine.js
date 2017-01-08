//#region Constants and Globals

// ToDo: possibly conver this to a module pattern? Then use something like Constants.Input.Keyboard.Right = 39...
const DEBUG_LEVEL = 1,
    FRICTION_ICE = 0.75,
    FRICTION_LAND = 0.5,
    GRAVITY_AIR = 0.25,
    GRAVITY_AIR_MAX = 9,
    GRAVITY_WATER = 0.25,
    GRAVITY_WATER_MAX = 0.75,
    KEY_ENTER = 13, KEY_SHIFT = 16,
    KEY_LEFT = 37, KEY_UP = 38, KEY_RIGHT = 39, KEY_DOWN = 40,
    KEY_A = 65, KEY_D = 68, KEY_F = 70, KEY_M = 77, KEY_S = 83, KEY_U = 85,
    MAX_JUMPS = 2,
    PLAYER_SPEED_AIR = 3,
    PLAYER_SPEED_RUNNING_AIR = 4,
    PLAYER_SPEED_WATER = 2;

var canvas = document.getElementById("canvas"),
    ctx = canvas.getContext("2d"),
    canvasWidth = 0,
    canvasHeight = 0,
    objectsToRender = [], // All of the objects that need to be rendered in the player 1's viewport. This may need to change for split screen multiplayer.
    roomHeight = 0,
    roomWidth = 0,
    paused = false,
    manualUpdate = false,
    keys = [],
    keyUpPressed = false,
    keyUpReleased = true,
    KEY_CONFIG_TARGET = KEY_SHIFT,
    KEY_CONFIG_ACTION = KEY_S,
    KEY_CONFIG_PROJECTILE = KEY_D,
    KEY_CONFIG_WEAPON = KEY_F,
    KEY_CONFIG_JUMP = KEY_UP;
    // ToDo: Add LEFT & RIGHT

ctx.imageSmoothingEnabled = false;

// ToDo: load this on `init()` from JSON - in fact, load and create all fillStyles the room needs. Water? Grass? Sky?
// var mediumFillStyles = [];
var dirtGradient = ctx.createLinearGradient(0, 170, 0, 0);
dirtGradient.addColorStop(0, "#663300")
dirtGradient.addColorStop(1, "#000000");

function setCanvasDimensions() {
    "use strict";
    var w = window,
    d = document,
    e = d.documentElement,
    g = d.getElementsByTagName('body')[0],
    x = w.innerWidth || e.clientWidth || g.clientWidth,
    y = w.innerHeight || e.clientHeight || g.clientHeight;
    var minH = 35;
    var maxH = 400;
    var minW = 35;
    var maxW = 400;
    canvasWidth = (x < minW) ? minW : x - minW;
    canvasHeight = (y < minH) ? minH : ((y > maxH) ? maxH : y - minH);
}
setCanvasDimensions();

//#endregion Constants and Globals

//#region Event Listeners

document.body.addEventListener("keydown", function (e) {
    "use strict";

    //addDebugMessage(e.keyCode);

    // Enter: pause
    if (e.keyCode === KEY_ENTER) {
        if (paused === false) {
            paused = true;
            window.location.href = "#openModal";
        }
        else {
            paused = false;
            window.location.href = "#close";
            update();
        }
    }

    // M: manual update toggle
    if (e.keyCode === KEY_M) {
        if (manualUpdate === false) {
            manualUpdate = true;
        }
        else {
            manualUpdate = false;
            update();
        }
    }

    // U: manual update
    if (e.keyCode === KEY_U && manualUpdate) {
        update();
    }

    // Up: jump
    if (e.keyCode == KEY_CONFIG_JUMP && keyUpReleased) {
        keyUpPressed = true;
        keyUpReleased = false;
        keys[KEY_CONFIG_JUMP] = true;
    }
    else {
        // Everything else.
        // ToDo: Should this be in a separate `else` block from the Up?
        keys[e.keyCode] = true;
    }
});

document.body.addEventListener("keyup", function (e) {
    "use strict";
    keys[e.keyCode] = false;
    if (e.keyCode == KEY_CONFIG_JUMP) {
        keyUpReleased = true;
    }
});

//#endregion Event Listeners

var players = [
    {
        // Define properties that will be set via JSON to allow for semi-strong typing.
        x: 0, y: 0,
        velX: 0, velY: 0,
        prevX: 0, prevY: 0,
        dX: 0, dY: 0,
        width: 0, height: 0,
        speed: PLAYER_SPEED_RUNNING_AIR,
        facing: 1,
        jumping: false,
        grounded: false,
        collisions: "",
        state: "idleRight",
        statePrev: "idleRight",
        fillStyle: "",
        lastWallJump: 0,
        canExtraJump: true,
        jumpsLeft: MAX_JUMPS,
        friction: FRICTION_LAND,
        gravity: GRAVITY_AIR,
        gravityMax: GRAVITY_AIR_MAX,
        grabbedState: 0,
        grabbedRope: -1,
        grabbedLink: -1,
        grabbedOffsetV: 1,
        grabbedOffsetX: 0,
        grabbedOffsetY: 0,
        viewport: {
            x: 0, y: 0, width: 800, height: 300, fillStyle: "lime"
        }
    }
];

function setViewportPosition() {
    "use strict";
    players.forEach(function (p) {
        var viewportX2 = p.viewport.x + p.viewport.width,
            viewportY2 = p.viewport.y + p.viewport.height;

        // Initial set:
        p.viewport.x = p.x + (p.width / 2) - (p.viewport.width / 2);
        p.viewport.y = p.y + (p.height / 2) - (p.viewport.height / 2);

        // Correction for room dimensions:
        if (p.viewport.x < 0) {
            p.viewport.x = 0;
        }
        else {
            if (viewportX2 > roomWidth) {
                p.viewport.x = roomWidth - p.viewport.width;
            }
        }
        if (p.viewport.y < 0) {
            p.viewport.y = 0;
        }
        else {
            if (viewportY2 > roomHeight) {
                p.viewport.y = roomHeight - p.viewport.height;
            }
        }
    });
}
setViewportPosition();

var playerWeapons = {
    swordBasic: {
        frameTotal: 3,
        currentFrame: 3,
        dimensions: [
            { x: 0, y: 5, width: 15, height: 5 },
            { x: 0, y: 5, width: 20, height: 5 },
            { x: 0, y: 5, width: 30, height: 5 }
        ]
    }
};

var playerProjectiles = {
    fireBasic: {
        canTarget: true,
        fillStyle: "red",
        damage: 5,
        x: 0,
        y: 0,
        width: 9,
        height: 9,
        speed: 3,
        velX: 0,
        velY: 0
    }
};

var enemy = {
    x: 300,
    y: 60,
    width: 16,
    height: 16,
    speed: 3,
    velX: 0,
    velY: 0,
    jumping: false,
    grounded: false,
    fillStyle: "magenta",
    friction: FRICTION_LAND,
    gravity: GRAVITY_AIR,
    gravityMax: GRAVITY_AIR_MAX
};

var border;
var platformsAll = [];
var platformsMovable = [];
var platformsStatic = [];
var water = [];
var countdownToFire = 0;
var screenProjectiles = [];

function populateRopeLinks(newRopes) {
    "use strict";
    var initX = 0,
        initY = 0,
        iRopeLink = 0;
    newRopes.forEach(function (newRope) {
        for (iRopeLink = 0; iRopeLink <= newRope.linksCount; iRopeLink += 1) {
            initX = newRope.rootX;
            initY = newRope.rootY + (iRopeLink * newRope.linksLength);
            newRope.links.push({
                x: initX,
                y: initY,
                velX: null,
                velY: null,
                lastX: initX,
                lastY: initY,
                dX: 0,
                dY: 0
            });
        }
    });
}
var ropes = [
    {
        rootX: 221,
        rootY: 225,
        fillStyle: "black",
        atRest: true,
        linksCount: 4,
        linksLength: 25,
        links: []
    }
];
populateRopeLinks(ropes);

// Set the canvas dimensions: ToDo - do in renderInit?
canvas.width = canvasWidth;
canvas.height = canvasHeight;

//#region Rendering

function sprite(options) {

    var that = {},
        tickCount = 0,
        ticksPerFrame = options.frames[0].ticksPerFrame || 0,
        numberOfFrames = options.frames.length || 1,
        freezeOnLastFrame = options.freezeOnLastFrame; // || false?

    that.context = options.context;
    that.image = options.image;
    that.frames = options.frames;
    that.width = options.width;
    that.height = options.height;

    that.frameIndex = options.frameIndex || 0;

    that.reset = function () {
        that.frameIndex = 0;
        tickCount = 0;
    };

    that.update = function () {
        //freezeOnLastFrame

        tickCount += 1;
        if (tickCount > ticksPerFrame) {
            if (freezeOnLastFrame === false) {
                tickCount = 0;

                // If the current frame index is in range, go to the next frame; otherwise reset.
                that.frameIndex = (that.frameIndex < numberOfFrames - 1) ? that.frameIndex += 1 : 0;

                ticksPerFrame = options.frames[that.frameIndex].ticksPerFrame;
            }
        }
    };

    that.render = function (inputObject) {
        // Clear the canvas
        //that.context.clearRect(0, 0, that.width, that.height);
        // ^ ToDo: don't think I need to do that. We're clearing the canvas already, right?
        // If that's the case, I don't need to pass in ctx either. Delete that property then.

        // Draw the animation
        that.context.drawImage(
          that.image,
          that.frames[that.frameIndex].srcX,
          that.frames[that.frameIndex].srcY,
          that.frames[that.frameIndex].srcW,
          that.frames[that.frameIndex].srcH,
          that.frames[that.frameIndex].dstX + inputObject.x,
          that.frames[that.frameIndex].dstY + inputObject.y,
          that.frames[that.frameIndex].srcW,
          that.frames[that.frameIndex].srcH);
    };

    return that;
}

// Background - draw stars:
function drawNightSky() {
    "use strict";
    var starTotal = 200,
        starIndex = 0,
        xCo = 0,
        yCo = 0,
        skyGradient = ctx.createLinearGradient(0, 0, 0, 400);

    skyGradient.addColorStop(0, "#000044");
    skyGradient.addColorStop(1, "#0000FF");
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = "#ffffff";
    for (starIndex = 0; starIndex < starTotal; starIndex += 1) {
        xCo = Math.floor(Math.random() * canvasWidth); //min 0 max 499
        yCo = Math.floor(Math.random() * canvasHeight); //min 0 max 399
        ctx.fillRect(xCo, yCo, 1, 1);
    }
}

// Called once on load of the game, before the first update.
function renderInit() {
    "use strict";

    // Draw the background and save it so that it doesn't need to be redrawn every update:
    drawNightSky();
    canvas.style.backgroundImage = "url(" + canvas.toDataURL() + ")";
}

function drawTarget(enemy) {
    "use strict";
    var targetCenter = aquireTarget(enemy);
    
    var radius = ~~(0.5 + (Math.sqrt((enemy.width * enemy.width / 4) + (enemy.height * enemy.height / 4))));

    var targetLineWidth = 1;

    var piTimes2 = ~~(0.5 + (2 * Math.PI));

    ctx.beginPath();
    ctx.arc(targetCenter.x, targetCenter.y, radius + 2.5, 0, piTimes2, false);
    ctx.lineWidth = targetLineWidth;
    ctx.strokeStyle = "white";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(targetCenter.x, targetCenter.y, radius + 3.0, 0, piTimes2, false);
    ctx.lineWidth = targetLineWidth;
    ctx.strokeStyle = "yellow";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(targetCenter.x, targetCenter.y, radius + 3.5, 0, piTimes2, false);
    ctx.lineWidth = targetLineWidth;
    ctx.strokeStyle = "orange";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(targetCenter.x, targetCenter.y, radius + 4.0, 0, piTimes2, false);
    ctx.lineWidth = targetLineWidth;
    ctx.strokeStyle = "red";
    ctx.stroke();
}

function drawPlayerWeapon(weapon) {
    "use strict";
    ctx.fillStyle = "#FFFFFF";
    var frame = weapon.currentFrame;
    var weaponX = 0,
        weaponY = players[0].y + weapon.dimensions[frame].y,
        weaponW = 0,
        weaponH = weapon.dimensions[frame].height;
    if (players[0].facing > 0) {
        weaponX = players[0].x + players[0].width + weapon.dimensions[frame].x;
        weaponW = weapon.dimensions[frame].width;
    }
    else {
        weaponX = players[0].x - weapon.dimensions[frame].x;
        weaponW = -weapon.dimensions[frame].width;
    }
    // ToDo: apply rounding
    ctx.fillRect(weaponX, weaponY, weaponW, weaponH);
}

function drawRopes(ropesToDraw) {
    "use strict";
    var j = 0;
    ropesToDraw.forEach(function (ropeToDraw) {
        ctx.fillStyle = ropeToDraw.fillStyle;
        for (j = 0; j < ropeToDraw.linksCount; j += 1) {
            if (Math2D.intersectionRectanglePointSimple(players[0].viewport, ropeToDraw.links[j]) === true ||
                Math2D.intersectionRectanglePointSimple(players[0].viewport, ropeToDraw.links[j + 1]) === true) {

                // ToDo: apply rounding

                // Draw link:
                ctx.beginPath();
                ctx.moveTo(ropeToDraw.links[j].x, ropeToDraw.links[j].y);
                ctx.lineTo(ropeToDraw.links[j + 1].x, ropeToDraw.links[j + 1].y);
                ctx.strokeStyle = ropeToDraw.fillStyle;
                ctx.stroke();

                // Draw joint:
                ctx.beginPath();
                ctx.arc(ropeToDraw.links[j + 1].x, ropeToDraw.links[j + 1].y, 1, 0, 2 * Math.PI, false);
                ctx.lineWidth = 1;
                ctx.strokeStyle = ropeToDraw.fillStyle;
                ctx.stroke();
            }
        }
    });
}

function drawObject(obj) {
    "use strict";
    if (Math2D.intersectionRectanglesSimple(players[0].viewport, obj)) {
        var ctxX = ~~(0.5 + (obj.x));
        var ctxY = ~~(0.5 + (obj.y));
        ctx.fillStyle = obj.fillStyle;
        ctx.fillRect(ctxX, ctxY, obj.width, obj.height);
    }
}

function drawObjects(objectsToDraw) {
    "use strict";
    objectsToDraw.forEach(function (obj) {
        //drawObject(obj, drawObjectOffsetX, drawObjectOffsetY);
        drawObject(obj);
    });
}

function drawRectangle(rectangle) {
    var ctxX = ~~(0.5 + rectangle.x);
    var ctxY = ~~(0.5 + rectangle.y);
    ctx.beginPath();
    ctx.rect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    ctx.strokeStyle = rectangle.fillStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
}

//#endregion Rendering

var player1Sprite,
    player1SpriteSheet;

function render() {
    ctx.save();

    // Clear all previously drawn rectangles:
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Implement rounding for anti-aliasing on all render methods using the following technique:
    //   rounded = ~~ (0.5 + somenum);

    ctx.translate(-1 * (~~ (0.5 + players[0].viewport.x)), -1 * (~~ (0.5 + players[0].viewport.y)));

    // Environment:
    drawObjects(platformsMovable);
    drawObjects(platformsStatic);
    //drawGrassOnBoxes(platformsStatic);

    // Interactables:
    drawRopes(ropes);

    // Weapons/Projectiles:
    drawObject(screenProjectiles);

    // Enemies:
    drawObject(enemy);

    // Player:
    if (player1Sprite.hasOwnProperty(players[0].state)) {
        if (players[0].state !== players[0].statePrev) {
            player1Sprite[players[0].statePrev].reset();
        }

        player1Sprite[players[0].state].update();

        player1Sprite[players[0].state].render(players[0]);

        addDebugMessage("");
        addDebugMessage("sprite : \t" + player1Sprite[players[0].state].frames[player1Sprite[players[0].state].frameIndex].srcX);
        addDebugMessage("sprite : \t" + player1Sprite[players[0].state].frames[player1Sprite[players[0].state].frameIndex].srcY);
        addDebugMessage("sprite : \t" + player1Sprite[players[0].state].frames[player1Sprite[players[0].state].frameIndex].srcW);
        addDebugMessage("sprite : \t" + player1Sprite[players[0].state].frames[player1Sprite[players[0].state].frameIndex].srcH);
    }
    else {
        drawObject(players[0]);
    }

    // Anything that is "over" the environment (e.g. water, darkness, etc.):
    drawWater(water);

    // Display Viewport (for debugging):
    //drawRectangle(players[0].viewport);

    ctx.restore();
}

var initCompleteEngine = false,
    initCompleteLevel = false,
    initCompletePlayer1Sprite = false;
function initComplete() {
    if ((initCompleteEngine === true) &&
        (initCompleteLevel === true) &&
        (initCompletePlayer1Sprite === true)) {
        // Done loading, proceed with rendering:

        var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
        window.requestAnimationFrame = requestAnimationFrame;

        renderInit();
        update();
    }
}

function initDataSprite(url) {
    "use strict";
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState == 4 && xmlhttp.responseText != undefined && xmlhttp.responseText !== "") {
            var myArr = JSON.parse(xmlhttp.responseText);
            myFunction(myArr);
        }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
    function myFunction(arr) {

        // ToDo: straighten out wall climb vs. wall cling vs. wall jump.

        player1SpriteSheet = new Image();
        var player1SpriteRunningSpeed = 9;
        player1Sprite = {
            idleRight: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: false,
                width: 52,
                height: 63,
                frames: [
                    {
                        srcX: 2, // 1
                        srcY: 1, // 1
                        srcW: 52,// 53
                        srcH: 63,// 64
                        dstX: 0,
                        dstY: -1,
                        ticksPerFrame: 16
                    },
                    {
                        srcX: 56,// 55
                        srcY: 1, // 1
                        srcW: 52,// 53
                        srcH: 63,// 64
                        dstX: 0,
                        dstY: -1,
                        ticksPerFrame: 16
                    },
                    {
                        srcX: 110,// 109
                        srcY: 1,  // 1
                        srcW: 51,// 52
                        srcH: 63,// 64
                        dstX: 0,
                        dstY: -1,
                        ticksPerFrame: 16
                    },
                    {
                        srcX: 56,// 55
                        srcY: 1, // 1
                        srcW: 52,// 53
                        srcH: 63,// 64
                        dstX: 0,
                        dstY: -1,
                        ticksPerFrame: 16
                    }
                ]
            }),
            idleLeft: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: false,
                width: 52,
                height: 63,
                frames: [
                    {
                        srcX: 2, // 1
                        srcY: 66,// 66
                        srcW: 52,// 53
                        srcH: 63,// 64
                        dstX: 0,
                        dstY: -1,
                        ticksPerFrame: 16
                    },
                    {
                        srcX: 56,// 55
                        srcY: 66,// 66
                        srcW: 52,// 53
                        srcH: 63,// 64
                        dstX: 0,
                        dstY: -1,
                        ticksPerFrame: 16
                    },
                    {
                        srcX: 110,// 109
                        srcY: 66,// 66
                        srcW: 51,// 52
                        srcH: 63,// 64
                        dstX: 0,
                        dstY: -1,
                        ticksPerFrame: 16
                    },
                    {
                        srcX: 56,// 55
                        srcY: 66,// 66
                        srcW: 52,// 53
                        srcH: 63,// 64
                        dstX: 0,
                        dstY: -1,
                        ticksPerFrame: 16
                    }
                ]
            }),
            runRight: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: false,
                width: 52,
                height: 63,
                frames: [
                    {
                        srcX: 221, // 220+1
                        srcY: 1,// 1
                        srcW: 45,// 46-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: player1SpriteRunningSpeed
                    },
                    {
                        srcX: 268,// 267+1
                        srcY: 1,// 1
                        srcW: 62,// 63-1
                        srcH: 63,// 64-1
                        dstX: -18,
                        dstY: -4,
                        ticksPerFrame: player1SpriteRunningSpeed
                    },
                    {
                        srcX: 332,// 331
                        srcY: 1,// 1
                        srcW: 54,// 55-1
                        srcH: 63,// 64-1
                        dstX: -13,
                        dstY: 0,//-1
                        ticksPerFrame: player1SpriteRunningSpeed
                    },
                    {
                        srcX: 388,// 387+1
                        srcY: 1,// 1
                        srcW: 45,// 46-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: player1SpriteRunningSpeed
                    },
                    {
                        srcX: 435,// 434+1
                        srcY: 1,// 1
                        srcW: 62,// 63-1
                        srcH: 63,// 64-1
                        dstX: -17,
                        dstY: -1,
                        ticksPerFrame: player1SpriteRunningSpeed
                    },
                    {
                        srcX: 499,// 498
                        srcY: 1,// 1
                        srcW: 54,// 55-1
                        srcH: 63,// 64-1
                        dstX: -13,
                        dstY: 0,//-1
                        ticksPerFrame: player1SpriteRunningSpeed
                    }
                ]
            }),
            runLeft: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: false,
                width: 52,
                height: 63,
                frames: [
                    {
                        srcX: 221, // 220+1
                        srcY: 66,// 66
                        srcW: 45,// 46-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: player1SpriteRunningSpeed
                    },
                    {
                        srcX: 268,// 267+1
                        srcY: 66,// 66
                        srcW: 62,// 63-1
                        srcH: 63,// 64-1
                        dstX: 1,
                        dstY: -5,
                        ticksPerFrame: player1SpriteRunningSpeed
                    },
                    {
                        srcX: 332,// 331
                        srcY: 66,// 66
                        srcW: 54,// 55-1
                        srcH: 63,// 64-1
                        dstX: 4,
                        dstY: 0,//-2
                        ticksPerFrame: player1SpriteRunningSpeed
                    },
                    {
                        srcX: 388,// 387+1
                        srcY: 66,// 66
                        srcW: 45,// 46-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: player1SpriteRunningSpeed
                    },
                    {
                        srcX: 435,// 434+1
                        srcY: 66,// 66
                        srcW: 62,// 63-1
                        srcH: 63,// 64-1
                        dstX: 1,
                        dstY: -1,//-1
                        ticksPerFrame: player1SpriteRunningSpeed
                    },
                    {
                        srcX: 499,// 498
                        srcY: 66,// 66
                        srcW: 54,// 55-1
                        srcH: 63,// 64-1
                        dstX: 4,
                        dstY: 0,//-4
                        ticksPerFrame: player1SpriteRunningSpeed
                    }
                ]
            }),
            jump1Right: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: true,
                width: 52,
                height: 89,
                frames: [
                    {
                        srcX: 2, // 1+1
                        srcY: 131,// 131
                        srcW: 36,// 37-1
                        srcH: 89,// 90-1
                        dstX: 0,
                        dstY: -26,
                        ticksPerFrame: 16
                    },
                    {
                        srcX: 40,// 39+1
                        srcY: 131,// 131
                        srcW: 52,// 53-1
                        srcH: 89,// 90-1
                        dstX: 0,
                        dstY: -26,
                        ticksPerFrame: 16
                    },
                    {
                        srcX: 94,// 93+1
                        srcY: 131,// 131
                        srcW: 59,// 60-1
                        srcH: 89,// 90-1
                        dstX: 0,
                        dstY: -26,
                        ticksPerFrame: 16
                    }
                ]
            }),
            jump1Left: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: true,
                width: 52,
                height: 89,
                frames: [
                    {
                        srcX: 270,// 269+1
                        srcY: 131,// 131
                        srcW: 36,// 37-1
                        srcH: 89,// 90-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 16
                    },
                    {
                        srcX: 216,// 215+1
                        srcY: 131,// 131
                        srcW: 52,// 53-1
                        srcH: 89,// 90-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 16
                    },
                    {
                        srcX: 155,// 154+1
                        srcY: 131,// 131
                        srcW: 59,// 60-1
                        srcH: 89,// 90-1
                        dstX: 0,
                        dstY: -26,//0
                        ticksPerFrame: 16
                    }
                ]
            }),
            jump2Right: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: false,
                width: 44,
                height: 44,
                frames: [
                    {
                        srcX: 308, // 307+1
                        srcY: 131,// 131
                        srcW: 41,// 42-1
                        srcH: 44,// 45-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 6
                    },
                    {
                        srcX: 351,// 350+1
                        srcY: 131,// 131
                        srcW: 44,// 45-1
                        srcH: 44,// 45-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 6
                    },
                    {
                        srcX: 397,// 396+1
                        srcY: 131,// 131
                        srcW: 40,// 41-1
                        srcH: 44,// 45-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 6
                    },
                    {
                        srcX: 439,// 438+1
                        srcY: 131,// 1
                        srcW: 44,// 45-1
                        srcH: 44,// 45-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 6
                    }
                ]
            }),
            jump2Left: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: false,
                width: 44,
                height: 44,
                frames: [
                    {
                        srcX: 442,// 441+1
                        srcY: 177,// 177
                        srcW: 41,// 42-1
                        srcH: 44,// 45-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 6
                    },
                    {
                        srcX: 396,// 395+1
                        srcY: 177,// 177
                        srcW: 44,// 45-1
                        srcH: 44,// 45-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 6
                    },
                    {
                        srcX: 354,// 353+1
                        srcY: 177,// 177
                        srcW: 40,// 41-1
                        srcH: 44,// 45-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 6
                    },
                    {
                        srcX: 308, // 307+1
                        srcY: 177,// 177
                        srcW: 44,// 45-1
                        srcH: 44,// 45-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 6
                    }
                ]
            }),
            wallClimbRight: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: true,
                frames: [
                    {
                        srcX: 221, // 220+1
                        srcY: 1,// 1
                        srcW: 45,// 46-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 48
                    },
                    {
                        srcX: 268,// 267+1
                        srcY: 1,// 1
                        srcW: 62,// 63-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 48
                    },
                    {
                        srcX: 332,// 331
                        srcY: 1,// 1
                        srcW: 54,// 55-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 48
                    },
                    {
                        srcX: 388,// 387+1
                        srcY: 1,// 1
                        srcW: 45,// 46-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 48
                    },
                    {
                        srcX: 435,// 434+1
                        srcY: 1,// 1
                        srcW: 62,// 63-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 48
                    },
                    {
                        srcX: 499,// 498
                        srcY: 1,// 1
                        srcW: 54,// 55-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 48
                    }
                ]
            }),
            wallClimbLeft: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: true,
                frames: [
                    {
                        srcX: 221, // 220+1
                        srcY: 1,// 1
                        srcW: 45,// 46-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 48
                    },
                    {
                        srcX: 268,// 267+1
                        srcY: 1,// 1
                        srcW: 62,// 63-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 48
                    },
                    {
                        srcX: 332,// 331
                        srcY: 1,// 1
                        srcW: 54,// 55-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 48
                    },
                    {
                        srcX: 388,// 387+1
                        srcY: 1,// 1
                        srcW: 45,// 46-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 48
                    },
                    {
                        srcX: 435,// 434+1
                        srcY: 1,// 1
                        srcW: 62,// 63-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 48
                    },
                    {
                        srcX: 499,// 498
                        srcY: 1,// 1
                        srcW: 54,// 55-1
                        srcH: 63,// 64-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 48
                    }
                ]
            }),
            crouchRight: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: true,
                width: 56,
                height: 42,
                frames: [
                    {
                        srcX: 163, // 162+1
                        srcY: 22,// 22
                        srcW: 56,// 57-1
                        srcH: 42,// 43-1
                        dstX: 0,
                        dstY: 18,
                        ticksPerFrame: 48
                    }
                ]
            }),
            crouchLeft: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: true,
                width: 56,
                height: 42,
                frames: [
                    {
                        srcX: 163, // 162+1
                        srcY: 87,// 22
                        srcW: 56,// 57-1
                        srcH: 42,// 43-1
                        dstX: 0,
                        dstY: 18,
                        ticksPerFrame: 48
                    }
                ]
            }),
            swingRight: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: true,
                width: 37,
                height: 92,
                frames: [
                    {
                        srcX: 105, // 104+1
                        srcY: 295,// 294
                        srcW: 37,// 39-1
                        srcH: 92,// 94-1
                        dstX: 10,
                        dstY: -5,
                        ticksPerFrame: 48
                    }
                ]
            }),
            swingLeft: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: true,
                width: 37,
                height: 92,
                frames: [
                    {
                        srcX: 429, // 428+1
                        srcY: 295,// 294
                        srcW: 37,// 39-1
                        srcH: 92,// 94-1
                        dstX: 5,
                        dstY: -3,
                        ticksPerFrame: 48
                    }
                ]
            }),
            freefallRight: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: true,
                width: 59,
                height: 89,
                frames: [
                    {
                        srcX: 94,// 93+1
                        srcY: 131,// 131
                        srcW: 59,// 60-1
                        srcH: 89,// 90-1
                        dstX: 0,
                        dstY: -26,//-26
                        ticksPerFrame: 16
                    }
                ]
            }),
            freefallLeft: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: true,
                width: 59,
                height: 89,
                frames: [
                    {
                        srcX: 155,// 154+1
                        srcY: 131,// 131
                        srcW: 59,// 60-1
                        srcH: 89,// 90-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 16
                    }
                ]
            }),
            walljumpRight: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: true,
                width: 59,
                height: 89,
                frames: [
                    {
                        srcX: 94,// 93+1
                        srcY: 131,// 131
                        srcW: 59,// 60-1
                        srcH: 89,// 90-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 16
                    }
                ]
            }),
            walljumpLeft: sprite({
                context: ctx,
                image: player1SpriteSheet,
                freezeOnLastFrame: true,
                width: 59,
                height: 89,
                frames: [
                    {
                        srcX: 155,// 154+1
                        srcY: 131,// 131
                        srcW: 59,// 60-1
                        srcH: 89,// 90-1
                        dstX: 0,
                        dstY: 0,
                        ticksPerFrame: 16
                    }
                ]
            })
        };

        player1SpriteSheet.src = "img\\sprites\\X-Men_2_Wolverine_Basic_100_Transparent.png";
		
        initCompletePlayer1Sprite = true;
        initComplete();
    }
}

function initDataLevel(url) {
    "use strict";
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState == 4 && xmlhttp.responseText != undefined && xmlhttp.responseText !== "") {
            var myArr = JSON.parse(xmlhttp.responseText);
            myFunction(myArr);
        }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
    function myFunction(arr) {

		// Required:
        roomHeight = arr.roomHeight;
        roomWidth = arr.roomWidth;
        border = arr.border;

		if (arr.players != undefined) {
			players = arr.players
			players.forEach(function (p) {
				p.prevX = p.x;
				p.prevY = p.y;

				// ToDo: set this based off of some sort of medium field. What if we start in water?
				p.speed = PLAYER_SPEED_RUNNING_AIR;
				p.jumpsLeft = MAX_JUMPS;
				p.friction = FRICTION_LAND;
				p.gravity = GRAVITY_AIR;
				p.gravityMax = GRAVITY_AIR_MAX;

				p.viewport.width = canvasWidth;
				p.viewport.height = canvasHeight;
			});
		}

		if (arr.platforms != undefined) {
			platformsAll = arr.platforms;
			platformsAll.forEach(function (p) {
				if (p.velX !== 0 || p.velY !== 0) {
					p.prevX = p.x;
					p.prevY = p.y;
					p.dX = 0;
					p.dY = 0;
					platformsMovable.push(p);
				}
				else {
					if (p.medium === "dirt" || p.medium === "grass") {
						p.fillStyle = dirtGradient;
					}
					platformsStatic.push(p);
				}
			});
		}

		if (arr.water != undefined) {
			water = arr.water;
		}

        initCompleteLevel = true;
        initComplete();
    }
}

function update() {
    "use strict";
    var i;
    var dirColPlayer = "";
    var dirColEnemy = "";
    var dirColProjectile = "";

    // ToDo:
    // [X] If I walk off a ledge, then hit Up, when I land I jump. Well, that's not right!
    // [X] If I push up against a block while standing, and the block isn't on the ground, it doesn't read as a collision.
    // -=> Solved by checking collisions with all platforms and the borders and grouping them together.
    // [_] Limit the vertical jumping potential during a wall jump. You're meant to go more out/laterally than up.

    if (paused) {
        return;
    }

    //#region Update Player(s)

    players[0].prevX = players[0].x;
    players[0].prevY = players[0].y;

    // Up arrow:
    if (keys[KEY_CONFIG_JUMP]) {
        if (keyUpPressed &&
        (players[0].jumpsLeft > 0) &&
        (!players[0].jumping || players[0].canExtraJump === true) && // if I'm not currently jumping
        (players[0].grounded || (-1 <= players[0].lastWallJump && players[0].lastWallJump <= 1) || players[0].canExtraJump === true)
        ) {
            players[0].jumping = true;
            players[0].grounded = false;
            players[0].velY = -players[0].speed * 2;
            keyUpPressed = false;

            // allow for more rope grabbing:
            players[0].grabbedState = (players[0].grabbedState > 0) ? -1 : 0;
            players[0].grabbedRope = -1;
            players[0].grabbedLink = -1;
            
            players[0].jumpsLeft -= 1;
            players[0].canExtraJump = false;

            if (players[0].lastWallJump === -1) {
                players[0].lastWallJump = -2;
            }
            else if (players[0].lastWallJump === 1) {
                players[0].lastWallJump = 2;
            }
        }
    }

    if (keys[KEY_DOWN]) {
        // allow for more rope grabbing:
        players[0].grabbedState = (players[0].grabbedState > 0) ? -1 : 0;
        players[0].grabbedRope = -1;
        players[0].grabbedLink = -1;
    }

    // Left and Right:
    if (players[0].grabbedState > 0) {
        movePlayerSwinging();
    }
    else {
        movePlayerRunningJumping();
    }

    players[0].x = players[0].x + players[0].velX;
    players[0].y = players[0].y + players[0].velY;

    if (players[0].velX !== 0) {
        players[0].facing = players[0].velX;
    }

    // Reset the player's color. After we check for collisions, it will either be white still if 
    // no collisions took place, or will have been colored with the last collision.
    //players[0].fillStyle = "white"; // ToDO: this should be a fillStyleDefault property.

    //#endregion

    //#region Update Enemy & Targets

    // ToDo - loop over all enemies.
    moveEnemy();

    dirColEnemy += collisionCheckBoxes(enemy, platformsStatic);
    groundEnemy(dirColEnemy, 0, 0, true);

    if (keys[KEY_CONFIG_TARGET]) {
        var intPoint = intBoxes(players[0], enemy, platformsStatic);
        var hiddenMe = (intPoint.x !== 0 && intPoint.y !== 0);
        if (!hiddenMe) {
            // face towards the target:
            if (players[0].x > enemy.x && players[0].facing > 0) {
                players[0].facing = -1;
            }
            // ToDo: have a property on an enemy like "enemy.targeted = true;" and
            // when we draw the enemy, we also draw the targer.
            drawTarget(enemy);
        }
    }

    //#endregion Update Enemy & Targets

    screenProjectiles.forEach(function (proj) {
        proj.x = proj.x + proj.velX;
        proj.y = proj.y + proj.velY;
        dirColProjectile = "";
        dirColProjectile += collisionCheckBoxes(proj, platformsStatic);
        if (dirColProjectile !== "") {
            // ToDo - use the whoShot index to access the players array and give point(s) to that player.
            // Points to any enemy too? Can enemies get "better"/more skilled?
            // It would be cool to say "here are the enemies that have hurt you the most throughout the game..."
            proj.velX = 0;
            proj.velY = 0;
        }
    });

    //dirColPlayer += collisionCheckBoxes(players[0], platformsStatic);
    dirColPlayer += collisionCheckForPlayerAndBoxes(platformsStatic);
    //groundPlayer(dirColPlayer, 0, 0, true);
    movePlatforms(dirColPlayer, platformsMovable);

    // ToDo: if there are no moving platforms in the water, and we're colliding with a moving platform,
    //   then we can skip the check for water. Or maybe we do the other way around. Whatever's more performant.
    checkPlayerMediumChanges(water, "water");

    processRopes();

    players[0].dX = players[0].x - players[0].prevX;
    players[0].dY = players[0].y - players[0].prevY;
    
    setPlayerState();

    if (players[0].velY >= -2) {
        players[0].canExtraJump = true;
    }

    //#region Weapons

    if (keys[KEY_CONFIG_WEAPON]) {
        if (playerWeapons.swordBasic.currentFrame > 0) {
            playerWeapons.swordBasic.currentFrame -= 1;
            drawPlayerWeapon(playerWeapons.swordBasic);
        }
    }
    else {
        playerWeapons.swordBasic.currentFrame = playerWeapons.swordBasic.frameTotal;
    }

    //#endregion Weapons

    //#region Projectiles

    if (keys[KEY_CONFIG_PROJECTILE]) {
        if (countdownToFire <= 0) {
            var targetCoordinates = { x: 0, y: 0 };
            // if Shift is held, get coordinates with targetCoordinates();
            if (!hiddenMe) {
                targetCoordinates = enemy;
            }

            // Fire projectile and reset the counter until the next fire can happen:
            addProjectileToScreen(playerProjectiles.fireBasic, targetCoordinates);
            countdownToFire = 20;
        }
        else {
            countdownToFire = countdownToFire - 1;
        }
    }
    else {
        if (countdownToFire > 0) {
            countdownToFire = countdownToFire - 1;
        }
    }

    //#endregion Projectiles

    // Rendering:
    setViewportPosition();
    render();

    //#region Debugging

    clearDebugMessage();

    addPlayerDebugMessages(players[0]);

    //#endregion Debugging

    // Update to next frame manually:
    if (!manualUpdate) {
        requestAnimationFrame(update);
    }
}

function setPlayerState() {

    // Get the player's "medium" property so we can change to swimming, etc.
    // It's valid to stand at the bottom of the water, but jumping should be swimming.

    players.forEach(function (p) {
        p.statePrev = p.state;

        if (p.facing > 0) {
            p.state = "Right";
        }
        else if (p.facing < 0) {
            p.state = "Left";
        }
        else {
            p.state = "?"; // in case we ever reach here and this throws an error as not existing.
        }

        // ToDo: do this based on medium!

        if (p.grounded) {
            if (p.velX !== 0) {
                if (keys[KEY_DOWN]) {
                    p.state = "crawl" + p.state;
                }
                else {
                    p.state = "run" + p.state;
                }
            }
            else {
                if (keys[KEY_DOWN]) {
                    p.state = "crouch" + p.state;
                }
                else {
                    if ((p.collisions.indexOf("l") > -1 && keys[KEY_LEFT]) || (p.collisions.indexOf("r") > -1 && keys[KEY_RIGHT])) {
                        //p.state = "push" + p.state;
                        p.state = "run" + p.state; // ToDo: the "pushing" setting works, but this makes it easier to debug the running sprite. After that's "done" set this back to "pushing" and not "running".
                    }
                    else {
                        p.state = "idle" + p.state;

                        // ToDo: do we really want to adjust the player's Y if we come out of freefall?
                        if (p.statePrev !== p.state) {
                            var displacementY = player1Sprite[p.statePrev].frames[player1Sprite[players[0].statePrev].frameIndex].dstY;
                            var diffHeight = player1Sprite[p.statePrev].height - player1Sprite[p.state].height;
                            //players[0].y += Math.abs(displacementY);
                        }
                    }
                }
            }
        }
        else if (p.grabbedState === 1) {
            p.state = "swing" + p.state;
        }
        else if (p.jumping) {
            // Jumping or wall jumping:
            p.state = "jump" + (MAX_JUMPS - p.jumpsLeft) + p.state;
        }
        else if (p.lastWallJump !== 0) {
            if (p.velX === 0) {
                p.state = "wallClimb" + p.state;
            }
            else {
                p.state = "walljump" + p.state;
            }
        }
        else if (p.velY >= 0) {
            p.state = "freefall" + p.state;
        }
        else {
            p.state = "unknown" + p.state;
        }

        //var p1State = players[0].state;
        //if (p1State !== "unknownLeft" && p1State !== "unknownRight") {
        //    players[0].width = player1Sprite[p1State].width;
        //    players[0].height = player1Sprite[p1State].height;
        //}
        //else {
        //    p1State = plaers[0].statePrev;
        //    if (p1State !== "unknownLeft" && p1State !== "unknownRight") {
        //        players[0].width = player1Sprite[p1State].width;
        //        players[0].height = player1Sprite[p1State].height;
        //    }
        //}

        // ToDo 2016/03/05 12:55AM - the smoothest scrolling is when the player is a constant width/height.
        // Transitioning from animation to animation just requires the displacement vector.
        // Smooth camera transitions are otherwise very difficult and complex (impossible?) without the constant W/H.
        players[0].width = 52;
        players[0].height = 63;
    });
}

//#region Enemy functions

function moveEnemy() {
    "use strict";
    // Enemy X & Y
    if (enemy.velX > 0) {
        enemy.velX -= enemy.friction;
    }
    else if (enemy.velX < 0) {
        enemy.velX += enemy.friction;
    }
    if (enemy.grounded) {
        enemy.velY = 0;
    }
    else {
        if (enemy.velY < enemy.gravityMax) {
            enemy.velY += enemy.gravity;
        }
        // If I just went over the max, set it back to the max.
        if (enemy.velY > enemy.gravityMax) {
            enemy.velY = enemy.gravityMax;
        }
    }
    enemy.x += enemy.velX;
    enemy.y += enemy.velY;
    enemy.grounded = false;
}

function groundEnemy(dir, xDiff) {
    "use strict";
    // ToDo: rework this to be like ground Player function.
    if (dir !== null) {
        if (dir === "t") {
            enemy.velY *= 0;
            enemy.jumping = false;
        }
        else if (dir === "r") {
            enemy.velX = 0;
            enemy.jumping = false;
        } else if (dir === "b") {
            enemy.x += xDiff;
            enemy.grounded = true;
            enemy.jumping = false;
        } else if (dir === "l") {
            enemy.velX = 0;
            enemy.jumping = false;
        }
    }
}

//#endregion Enemy functions

//#region Targeting

function aquireTarget(enemy) {
    "use strict";
    var targetCoordinates = {
        x: ~~(0.5 + (enemy.x + (enemy.width / 2))),
        y: ~~(0.5 + (enemy.y + (enemy.width / 2)))
    };
    return targetCoordinates;
}

//#endregion Targeting

function addProjectileToScreen(projectile, targetCoordinates) {
    "use strict";
    var projectile1 = {
            canTarget: projectile.canTarget,
            fillStyle: projectile.fillStyle,
            damage: projectile.damage,
            x: projectile.x,
            y: projectile.y,
            width: projectile.width,
            height: projectile.height,
            speed: projectile.speed,
            velX: projectile.velX,
            velY: projectile.velY
        };

    var x1 = players[0].x,
        y1 = players[0].y,
        x2 = targetCoordinates.x,
        y2 = targetCoordinates.y,
        reach = 5, // arm's length / where the proj. starts away from the player's body.
        m = 0,
        b = 0;

    // Start:
    projectile1.x = (players[0].facing > 0) ? players[0].x + players[0].width + reach : players[0].x - reach;
    projectile1.y = players[0].y + reach;

    // Velocity:
    if (x2 === 0 && y2 === 0) {
        projectile1.velX = projectile1.speed;
        projectile1.velY = 0;
    }
    else {
        // Given the slope and the length of c (the projectile's speed) find
        // the triangle's legs a (Y velocity) and b (X velocity).
        m = ((y2 - y1) / (x2 - x1));
        b = (projectile1.speed / Math.sqrt((m * m) + 1));
        b = (x1 <= x2) ? b : b * -1;
        projectile1.velX = b; // b
        projectile1.velY = b * m; // a
    }

    screenProjectiles.push(projectile1);
}

//#region Draw Environment

function drawGrassOnBoxes(theBoxes) {
    "use strict";
    var i = 0,
        j = 0;
    const lineH = 2;

    for (i = 0; i < theBoxes.length; i += 1) {
        if (theBoxes[i].medium !== "grass") {
            continue;
        }

        ctx.fillStyle = "#007700";
        ctx.fillRect(theBoxes[i].x, theBoxes[i].y, theBoxes[i].width, 5);

        ctx.fillStyle = "#008800";
        ctx.fillRect(theBoxes[i].x, theBoxes[i].y + 5, theBoxes[i].width, 5);

        ctx.fillStyle = "#009900";
        ctx.fillRect(theBoxes[i].x, theBoxes[i].y + 10, theBoxes[i].width, 5);

        // Set the style properties.
        ctx.fillStyle = '#00BB00';
        ctx.strokeStyle = '#00AA00';
        ctx.lineWidth = lineH;

        var startX = 0;
        var startY = 0;
        var triangleWidth = 8;
        for (j = -6; j < theBoxes[i].width; j = j + triangleWidth + lineH) {
            ctx.beginPath();

            //startX = theBoxes[i].x + lineH + j
            startX = theBoxes[i].x + (lineH / 2) + j;
            startY = theBoxes[i].y + (lineH / 2);
            ctx.moveTo(startX, startY); // give the (x,y) coordinates
            ctx.lineTo(startX + triangleWidth, startY);
            ctx.lineTo(startX + 5, startY + triangleWidth);
            ctx.lineTo(startX, startY);

            ctx.fill();
            ctx.stroke();
        }
    }
}

function drawBorders(theBoxes) {
    "use strict";

    ctx.fillStyle = "#000000";

    // Top:
    ctx.fillRect(0,
                 0,
                 canvasWidth,
                 border.padTop);

    // Right:
    ctx.fillRect(canvasWidth - border.padRight,
                 border.padTop,
                 border.padRight,
                 canvasHeight - border.padTop - border.padBottom);

    // Bottom:
    ctx.fillRect(0,
                 canvasHeight - border.padBottom,
                 canvasWidth,
                 border.padBottom);

    // Left:
    ctx.fillRect(0,
                 border.padTop,
                 border.padLeft,
                 canvasHeight - border.padTop - border.padBottom);
}

function drawWater(waterMasses) {
    "use strict";
    var i = 0;
    if (waterMasses.length > 0) {
        ctx.save();

        for (i = 0; i < waterMasses.length; i += 1) {
            // ToDo: does moving the fill/alpha here allow for multiple values? Like could N be 0.3 and N+1 be 0.6?
            ctx.fillStyle = waterMasses[i].fillStyle;
            ctx.globalAlpha = waterMasses[i].globalAlpha;
            // ToDo: apply rounding
            ctx.fillRect(waterMasses[i].x, waterMasses[i].y, waterMasses[i].width, waterMasses[i].height);
        }

        ctx.restore();
    }
}

//#endregion Draw Environment

var moveCounter = 0; // Note: if we ever wanted to have a moving platform pause at its peak and/or valley, this would need to be made from just a counter to 4 values: current and max x and y for every platform. To have this do nothing for now, just set this as zero.
function movePlatforms(dirPlayer, theBoxes) {
    "use strict";

    // Note: I could move the platforms based on harmonic motion, not just simple up/down if I passed in what type of motion it is. Like a property is "linear" or "sin" with params a/b/c for the equation y = a*sin(b*x + c).

    var finalVelX = 0,
        finalVelY = 0,
        platformHardCollision = (dirPlayer !== "");

    theBoxes.forEach(function (b) {
        b.x += b.velX;
        b.y += b.velY;

        if (b.velX !== 0) {
            if (b.x === b.startX + b.maxX) {
                if (b.dX === 0) {
                    b.velX *= -1;
                }
                else {
                    b.x = b.prevX;
                }
            }
            else if (b.x === b.startX) {
                if (b.dX === 0) {
                    b.velX *= -1;
                }
                else {
                    b.x = b.prevX;
                }
            }
        }

        if (b.velY !== 0) {
            if (b.y === b.startY + b.maxY) {
                if (b.dY === 0) {
                    b.velY *= -1;
                }
                else {
                    b.y = b.prevY;
                }
            }
            else if (b.y === b.startY) {
                if (b.dY !== 0) {
                    b.y = b.prevY;
                }
                else {
                    if (moveCounter > 0) {
                        moveCounter -= 1;
                        b.y = b.prevY;
                    }
                    else {
                        moveCounter = 0;
                        b.velY = b.speed;
                    }
                }
            }
        }

        var curDirPlayer = colCheck(players[0], b, false, "land");
        if (curDirPlayer !== "") {
            if (curDirPlayer.indexOf("l") || curDirPlayer.indexOf("r")) {
                finalVelX += b.velX;
            }
            if (curDirPlayer.indexOf("b") || curDirPlayer.indexOf("t")) {
                finalVelY += b.velY + b.speed;
            }
            dirPlayer += "" + curDirPlayer;
        }

        b.dX = b.x - b.prevX;
        b.dY = b.y - b.prevY;
        b.prevX = b.x;
        b.prevY = b.y;
    });

    // [X] ToDo: the problem here is if we are 1 update cycle past riding a moving platform to its apex,
    // the "dirPlayer" variable will correctly say "b" but the finalVelY will still have the platform's "old"
    // value of -speed, not +speed. For example, the leftmost square has changed from -0.5 to 0.5, but the 
    // finalVelY says -0.5, and that's what causes that brief little blip of "floating" and the player going 
    // from grounded=true to grounded=false.
    // -=> solved by the following:
    // when our bottom side collides with a moving platform, make the final velocity (which will be zero at the apex)
    // the platform's velociy PLUS the platform's speed. It's the speed that really solves this so that we move down
    // at the speed of the platform.
    // I also moved the "colCheck" function to after we adjust the platform's velocity. This probably helps too.
    groundPlayer(dirPlayer, finalVelX, finalVelY, platformHardCollision);
}

function checkPlayerMediumChanges(masses, massType) {
    "use strict";
    var dirColMass = "";
    masses.forEach(function (m) {
        dirColMass += colCheck(players[0], m, false, m.medium);
    });
    if (dirColMass !== "") {
        switch (massType) {
            case "water":
                players[0].gravity = GRAVITY_WATER;
                players[0].gravityMax = GRAVITY_WATER_MAX;
                players[0].speed = PLAYER_SPEED_WATER;
                players[0].jumpsLeft = 1000;
                break;
			default:
				players[0].gravity = GRAVITY_AIR;
				players[0].gravityMax = GRAVITY_AIR_MAX;
				players[0].speed = PLAYER_SPEED_AIR; // ToDo: speed running on ground should be faster than speed while falling.
                players[0].jumpsLeft = 1;
				break;				
        }
    }
    else {
        if (players[0].grabbedState !== 1) {
            players[0].gravity = GRAVITY_AIR;
            players[0].gravityMax = GRAVITY_AIR_MAX;
            players[0].speed = PLAYER_SPEED_RUNNING_AIR;

            // We just came out of water:
            if (players[0].jumpsLeft > MAX_JUMPS) {
                players[0].jumpsLeft = 1;
            }
        }
    }
}

function movePlayerRunningJumping() {
    "use strict";
    // If we're trying to go left and/or right and we're not going as fast as we can, go faster:
    if (keys[KEY_DOWN]) {
        // ToDo: crawling
    }
    else {
        players[0].velX = (keys[KEY_LEFT] && players[0].velX > -players[0].speed) ? players[0].velX - 1 : players[0].velX;
        players[0].velX = (keys[KEY_RIGHT] && players[0].velX < players[0].speed) ? players[0].velX + 1 : players[0].velX;
    }

    // Apply friction:
    if (players[0].velX > 0) {
        players[0].velX = (players[0].velX < players[0].friction) ? 0 : players[0].velX - players[0].friction;
    }
    else if (players[0].velX < 0) {
        players[0].velX = (players[0].velX > -players[0].friction) ? 0 : players[0].velX + players[0].friction;
    }

    if (players[0].grounded) {
        players[0].velY = 0;
    }
    else {
        if (players[0].velY < players[0].gravityMax) {
            players[0].velY += players[0].gravity;
        }
        // If I just went over the max, set it back to the max.
        if (players[0].velY > players[0].gravityMax) {
            players[0].velY = players[0].gravityMax;
        }
    }
}

function changePlayerColorBasedOnCollision(dir) {
    // Color the player to indicate collision(s):
    switch (dir) {
        case "t":
            players[0].fillStyle = "lime";
            break;
        case "r":
            players[0].fillStyle = "yellow";
            break;
        case "b":
            players[0].fillStyle = "lime";
            break;
        case "l":
            players[0].fillStyle = "red";
            break;

        case "tl":
        case "lt":
            players[0].fillStyle = "purple"; // + red
            break;

        case "tr":
        case "rt":
            players[0].fillStyle = "green"; // + yellow
            break;

        case "bl":
        case "lb":
            players[0].fillStyle = "purple";
            break;

        case "br":
        case "rb":
            players[0].fillStyle = "green";
            break;

        case "":
            players[0].fillStyle = "orange"; // ToDO: this should be a fillStyleDefault property.
            break;

        default:
            players[0].fillStyle = "white"; // bb perhaps on the floor?
    }
}

function groundPlayer(dir, xDiff, yDiff, hardCollision) {
    "use strict";
    if (dir !== "") {

        // Top ("t"), Left ("l", and Right ("r"):
        if (hardCollision === true) {
            if (dir.indexOf("t") > -1) {
                // Collision with my TOP:
                players[0].jumping = false;

                if (players[0].velY < 0) {
                    players[0].velY *= -0.5;
                }
            }

            if (dir.indexOf("l") > -1) {
                // Collision with my LEFT:
                players[0].jumping = false;
                players[0].velX = 0;

                if (players[0].lastWallJump !== -2) {
                    players[0].lastWallJump = -1;
                    if (players[0].jumpsLeft < MAX_JUMPS) {
                        players[0].jumpsLeft += 1;
                    }
                }
            }

            if (dir.indexOf("r") > -1) {
                // Collision with my RIGHT:
                players[0].jumping = false;
                players[0].velX = 0;

                if (players[0].lastWallJump !== 2) {
                    players[0].lastWallJump = 1;
                    if (players[0].jumpsLeft < MAX_JUMPS) {
                        players[0].jumpsLeft += 1;
                    }
                }
            }
        }

        // Bottom ("b"):
        if (dir.indexOf("b") > -1 && players[0].velY >= 0) {
            // Collision with my BOTTOM:
            players[0].jumping = false;

            // Collision movement on a platform. These are either 0 or whatever the platform's movement is.
            players[0].x += xDiff;
            players[0].y += yDiff;

            players[0].grounded = true;
            players[0].lastWallJump = 0;
            players[0].jumpsLeft = MAX_JUMPS;
            players[0].canExtraJump = true;
        }
        else {
            players[0].grounded = false;
        }
    }
    else {
        players[0].grounded = false;
    }

    players[0].collisions = dir;

    changePlayerColorBasedOnCollision(dir);
}

//#region Intersection and Collision functions

// ToDo: break this call up into separate pieces. If we colliding with the floor,
// I shouldn't have to check any other platform (static or moving). Or the ceiling (if there is one).
// If I'm colliding with the left wall, I don't need to check the right wall.
function collisionCheckForPlayerAndBoxes(theBoxes) {
    "use strict";
    var playerSidesColliding = "";
    theBoxes.forEach(function (shapeB) {
        // For rendering, first check if the object is in the player's viewport. If it is, then 
        //   check for a collision. If it's not, we can return and move on to the next object.

        // Get the midpoint coordinates:
        var midXBox = shapeB.x + (shapeB.width / 2);
        var midYBox = shapeB.y + (shapeB.height / 2);
        var midXPlayer = players[0].x + (players[0].width / 2);
        var midYPlayer = players[0].y + (players[0].height / 2);
        var midXVP = players[0].x + (shapeB.width / 2);
        var midYVP = players[0].y + (shapeB.height / 2);

        // Get the vectors to check against:
        var vXBoxPlayer = (midXPlayer - midXBox);
        var vYBoxPlayer = (midYPlayer - midYBox);
        var vXBoxVP = (midXVP - midXBox);
        var vYBoxVP = (midYVP - midYBox);

        // Add the half widths and half heights of the objects
        var hWidths = (players[0].width / 2) + (shapeB.width / 2);
        var hHeights = (players[0].height / 2) + (shapeB.height / 2);

        // If the x and y vector are less than the half width or half height,
        // they we must be inside the object, causing a collision
        //if (Math.abs(vX) <= hWidths && Math.abs(vY) <= hHeights) {
        if (Math.abs(vXBoxPlayer) <= hWidths && Math.abs(vYBoxPlayer) <= hHeights) {

            var oX = hWidths - Math.abs(vXBoxPlayer),
                oY = hHeights - Math.abs(vYBoxPlayer);
            if (oX > oY) {
                if (vYBoxPlayer > 0) {
                    playerSidesColliding += "t";
                    players[0].y += oY;
                } else {
                    playerSidesColliding += "b";
                    if (players[0].velY >= 0 && shapeB.medium !== "water") {
                        players[0].y -= oY;
                    }
                }
            }

            if (oX < oY) {
                if (vXBoxPlayer > 0) {
                    playerSidesColliding += "l";
                    players[0].x += oX;
                } else {
                    playerSidesColliding += "r";
                    players[0].x -= oX;
                }
            }
        }
    });

    return playerSidesColliding;
}

function collisionCheckBoxes(shapeA, theBoxes) {
    "use strict";
    var dirColA = "",
        i = 0;
    for (i = 0; i < theBoxes.length; i += 1) {
        dirColA += colCheck(shapeA, theBoxes[i], true, "land"); // ToDo - don't use magic string for "land".
    }
    return dirColA;
}

// ToDo - move to Math2D?
function intBoxes(who1, who2, boxes) {
    "use strict";
    var i = 0,
        bX = 0,
        bY = 0,
        bW = 0,
        bH = 0,
        iT = {
            x: 0, y: 0
        },
        iL = {
            x: 0, y: 0
        },
        iR = {
            x: 0, y: 0
        },
        iB = {
            x: 0, y: 0
        },
        noInt = {
            x: 0, y: 0
        };


    for (i = 0; i < boxes.length; i += 1) {
        bX = boxes[i].x;
        bY = boxes[i].y;
        bW = boxes[i].width;
        bH = boxes[i].height;

        iT = Math2D.lineIntersect(who1.x, who1.y, who2.x, who2.y, bX, bY, bX + bW, bY);
        if (iT.x !== 0 && iT.y !== 0) {
            return iT;
        }

        iR = Math2D.lineIntersect(who1.x, who1.y, who2.x, who2.y, bX + bW, bY, bX + bW, bY + bH);
        if (iR.x !== 0 && iR.y !== 0) {
            return iR;
        }

        iB = Math2D.lineIntersect(who1.x, who1.y, who2.x, who2.y, bX, bY + bH, bX + bW, bY + bH);
        if (iB.x !== 0 && iB.y !== 0) {
            return iB;
        }

        iL = Math2D.lineIntersect(who1.x, who1.y, who2.x, who2.y, bX, bY, bX, bY + bH);
        if (iL.x !== 0 && iL.y !== 0) {
            return iL;
        }
    }

    return noInt;
}

// ToDo - refactor based on what's in Math2D for rectangle collisions?
function colCheck(shapeA, shapeB, hardCollision, medium) {
    "use strict";

    // Get the midpoint coordinates:
    var midXA = shapeA.x + (shapeA.width / 2);
    var midXB = shapeB.x + (shapeB.width / 2);
    var midYA = shapeA.y + (shapeA.height / 2);
    var midYB = shapeB.y + (shapeB.height / 2);

    // Get the vectors to check against:
    var vX = (midXA - midXB);
    var vY = (midYA - midYB);

    // Add the half widths and half heights of the objects
    var hWidths = (shapeA.width / 2) + (shapeB.width / 2);
    var hHeights = (shapeA.height / 2) + (shapeB.height / 2);

    vX = vX.toFixed(2);
    vY = vY.toFixed(2);
    hWidths = hWidths.toFixed(2);
    hHeights = hHeights.toFixed(2);

    var colDir = "";

    // If the x and y vector are less than the half width or half height,
    // they we must be inside the object, causing a collision
    //if (Math.abs(vX) <= hWidths && Math.abs(vY) <= hHeights) {
    if (Math.abs(vX) <= hWidths && Math.abs(vY) <= hHeights) {

        var oX = hWidths - Math.abs(vX),
            oY = hHeights - Math.abs(vY);
        if (oX > oY) {
            if (vY > 0) {
                colDir += "t";
                if (hardCollision === true) {
                    shapeA.y += oY;
                }
            } else {
                colDir += "b";
                if (hardCollision === true || (players[0].velY >= 0 && medium !== "water")) {
                    shapeA.y -= oY;
                }
            }
        }

        if (oX < oY) {
            if (vX > 0) {
                colDir += "l";
                if (hardCollision === true) {
                    shapeA.x += oX;
                }
            } else {
                colDir += "r";
                if (hardCollision === true) {
                    shapeA.x -= oX;
                }
            }
        }
    }

    return colDir;
}

//#endregion Intersection and Collision functions

//#region Ropes

function movePlayerSwinging() {
    "use strict";

    // 0) Imagine a circle where the radius is the length of the fully extended rope.
    // http://gamedevelopment.tutsplus.com/tutorials/swinging-physics-for-player-movement-as-seen-in-spider-man-2-and-energy-hook--gamedev-8782

    // 0.1) Apply friction:
    var ropeFriction = players[0].friction / 100;
    if (players[0].velX > 0) {
        players[0].velX = (players[0].velX < ropeFriction) ? 0 : players[0].velX - ropeFriction;
    }
    else if (players[0].velX < 0) {
        players[0].velX = (players[0].velX > -ropeFriction) ? 0 : players[0].velX + ropeFriction;
    }

    // 0.2) Apply gravity:
    if (players[0].velY < players[0].gravityMax) {
        players[0].velY += players[0].gravity;

        // If I just went over the max, set it back to the max.
        if (players[0].velY > players[0].gravityMax) {
            players[0].velY = players[0].gravityMax;
        }
    }

    // 1) Process Newtonian Mechanics:
    var x2 = (players[0].x + players[0].velX),
        y2 = (players[0].y - players[0].velY + players[0].gravity);

    // 2) If the player is outside the circle then we need to constrain, otherwise let the player move freely.
    var grabbedRope = ropes[players[0].grabbedRope];
    var center = { h: grabbedRope.links[0].x, k: grabbedRope.links[0].y },
        radius = grabbedRope.linksCount * grabbedRope.linksLength;
    if (Math2D.pointInRelationToCircle(players[0].x + (players[0].width / 2), players[0].y, center.h, center.k, radius) !== 1) {
        // 2.1) Constrain the coordinates:
        // ToDo: figure out where the point [(players[0].x + diffX), (players[0].x + diffY)] intersects the radius.
        // move the player there, and call that [cX, cY].
        var x0 = players[0].x + (players[0].width / 2),
            y0 = players[0].y,
            x1 = center.h,
            y1 = center.k;

        var a = ((x1 - x0) * (x1 - x0)) + ((y1 - y0) * (y1 - y0));
        var b = (2 * (x1 - x0) * (x0 - center.h)) + (2 * (y1 - y0) * (y0 - center.k));
        var c = ((x0 - center.h) * (x0 - center.h)) + ((y0 - center.k) * (y0 - center.k)) - (radius * radius);
        var t = (2 * c) / (Math.sqrt((b * b) - (4 * a * c)) - b);
        var xT = ((x1 - x0) * t) + x0;
        var yT = ((y1 - y0) * t) + y0;
        x2 = xT - (players[0].width / 2);
        y2 = yT;

        // 3) Calculate the player's final velocity for the step:
        players[0].velX += (x2 - players[0].x);
        players[0].velY += (y2 - players[0].y);

        if (
        (-0.001 < players[0].velX && players[0].velX < 0.001) &&
        ((grabbedRope.links[0].x - grabbedRope.links[players[0].grabbedLink].x) * (grabbedRope.links[0].x - grabbedRope.links[players[0].grabbedLink].x)) < 5
        ) {
            players[0].velX = 0;
        }

        if (-0.001 < players[0].velY && players[0].velY < 0.001) {
            players[0].velY = 0;
        }

        players[0].x = x2;
        players[0].y = y2;
    }

    // 3.1) Use the velocity for the next step.
}

function processRopes() {
    "use strict";
    var ropesToCheck = ropes;
    var i = 0, // the Nth rope on the screen.
        j = 0,
        holdingLink = 0, // the Nth link in the current rope.
        shapeMidX = players[0].x + (players[0].width / 2),
        shapeEndEffector = { x: 0, y: 0 };

    // ToDo: if we grab midway through the rope, the bottom length should just hang down.

    if (ropesToCheck.length > 0) {
        for (i = 0; i < ropesToCheck.length; i += 1) {
            switch (players[0].grabbedState) {

                // The shape just released the rope. Don't let the shape grab that same rope again until the shape is not 
                // colliding with that rope or if the shape is now colliding with a new rope (i.e. rope swinging maybe?).
                case -1:

                    //#region Released Rope

                    if (ropesToCheck[i].links[ropesToCheck[i].linksCount].velX === null) {
                        ropesToCheck[i].links[ropesToCheck[i].linksCount].velX = players[0].velX / 2;
                    }
                    else {
                        // Apply friction:
                        if (ropesToCheck[i].links[ropesToCheck[i].linksCount].velX > 0) {
                            ropesToCheck[i].links[ropesToCheck[i].linksCount].velX = (ropesToCheck[i].links[ropesToCheck[i].linksCount].velX < players[0].friction) ? 0 : ropesToCheck[i].links[ropesToCheck[i].linksCount].velX - players[0].friction;
                        }
                        else if (ropesToCheck[i].links[ropesToCheck[i].linksCount].velX < 0) {
                            ropesToCheck[i].links[ropesToCheck[i].linksCount].velX = (ropesToCheck[i].links[ropesToCheck[i].linksCount].velX > -players[0].friction) ? 0 : ropesToCheck[i].links[ropesToCheck[i].linksCount].velX + players[0].friction;
                        }
                    }
                    if (ropesToCheck[i].links[ropesToCheck[i].linksCount].velY === null) {
                        ropesToCheck[i].links[ropesToCheck[i].linksCount].velY = players[0].velY / 2;
                    }
                    else {
                        // Apply gravity:
                        if (ropesToCheck[i].links[ropesToCheck[i].linksCount].velY < players[0].gravityMax) {
                            ropesToCheck[i].links[ropesToCheck[i].linksCount].velY += players[0].gravity;
                        }
                        // If I just went over the max, set it back to the max.
                        if (ropesToCheck[i].links[ropesToCheck[i].linksCount].velY > players[0].gravityMax) {
                            ropesToCheck[i].links[ropesToCheck[i].linksCount].velY = players[0].gravityMax;
                        }
                    }
                    ropesToCheck[i].links[ropesToCheck[i].linksCount].x = ropesToCheck[i].links[ropesToCheck[i].linksCount].x + ropesToCheck[i].links[ropesToCheck[i].linksCount].velX;
                    ropesToCheck[i].links[ropesToCheck[i].linksCount].y = ropesToCheck[i].links[ropesToCheck[i].linksCount].y + ropesToCheck[i].links[ropesToCheck[i].linksCount].velY;

                    shapeEndEffector = ropesToCheck[i].links[ropesToCheck[i].linksCount];
                    drawArm2(ropesToCheck[i], ropesToCheck[i].linksCount, shapeEndEffector, players[0].facing);
                    for (j = ropesToCheck[i].linksCount - 1; j > 1; j -= 1) {
                        drawArm2(ropesToCheck[i], j, shapeEndEffector, players[0].facing);
                    }

                    // If the shape is not colliding with the rope, then 
                    // let that rope be able to be grabbed again:
                    holdingLink = collisionDetectionRope(i, ropesToCheck[i], players[0]);
                    if (holdingLink === -1) {
                        players[0].grabbedState = 0;
                        players[0].grabbedRope = -1;
                        players[0].grabbedLink = -1;
                        players[0].grabbedOffsetX = 0;
                        players[0].grabbedOffsetY = 0;
                        players[0].friction = FRICTION_LAND;
                    }

                    //#endregion Released Rope

                    break;

                // The shape was not holding a rope last frame, so check if it is now.
                case 0:

                    //#region Not Holding Rope

                    if (ropesToCheck[i].atRest === false) {
                        if (ropesToCheck[i].links[ropesToCheck[i].linksCount].velX !== null) {
                            // Apply friction:
                            if (ropesToCheck[i].links[ropesToCheck[i].linksCount].velX > 0) {
                                ropesToCheck[i].links[ropesToCheck[i].linksCount].velX = (ropesToCheck[i].links[ropesToCheck[i].linksCount].velX < players[0].friction) ? 0 : ropesToCheck[i].links[ropesToCheck[i].linksCount].velX - players[0].friction;
                            }
                            else if (ropesToCheck[i].links[ropesToCheck[i].linksCount].velX < 0) {
                                ropesToCheck[i].links[ropesToCheck[i].linksCount].velX = (ropesToCheck[i].links[ropesToCheck[i].linksCount].velX > -players[0].friction) ? 0 : ropesToCheck[i].links[ropesToCheck[i].linksCount].velX + players[0].friction;
                            }
                            ropesToCheck[i].links[ropesToCheck[i].linksCount].x = ropesToCheck[i].links[ropesToCheck[i].linksCount].x + ropesToCheck[i].links[ropesToCheck[i].linksCount].velX;
                            ropesToCheck[i].links[ropesToCheck[i].linksCount].dX = ropesToCheck[i].links[ropesToCheck[i].linksCount].x - ropesToCheck[i].links[ropesToCheck[i].linksCount].lastX;
                            ropesToCheck[i].links[ropesToCheck[i].linksCount].lastX = ropesToCheck[i].links[ropesToCheck[i].linksCount].x;
                        }
                        if (ropesToCheck[i].links[ropesToCheck[i].linksCount].velY !== null) {
                            // ToDo: should I definte the gravity/max gravity on the rope or should it stay 
                            // based on the player? Based on the player keeps the rope behaving similar to 
                            // the player in different mediums (air, water, etc) so that helps...I guess.

                            // Apply gravity:
                            if (ropesToCheck[i].links[ropesToCheck[i].linksCount].velY < players[0].gravityMax) {
                                ropesToCheck[i].links[ropesToCheck[i].linksCount].velY += players[0].gravity;
                            }
                            // If I just went over the max, set it back to the max.
                            if (ropesToCheck[i].links[ropesToCheck[i].linksCount].velY > players[0].gravityMax) {
                                ropesToCheck[i].links[ropesToCheck[i].linksCount].velY = players[0].gravityMax;
                            }
                            ropesToCheck[i].links[ropesToCheck[i].linksCount].y = ropesToCheck[i].links[ropesToCheck[i].linksCount].y + ropesToCheck[i].links[ropesToCheck[i].linksCount].velY;
                            ropesToCheck[i].links[ropesToCheck[i].linksCount].dY = ropesToCheck[i].links[ropesToCheck[i].linksCount].y - ropesToCheck[i].links[ropesToCheck[i].linksCount].lastY;
                            ropesToCheck[i].links[ropesToCheck[i].linksCount].lastY = ropesToCheck[i].links[ropesToCheck[i].linksCount].y;
                        }
                        var vertDiff = ropesToCheck[i].links[ropesToCheck[i].linksCount].x - ropesToCheck[i].links[ropesToCheck[i].linksCount - 1].x;
                        if (Math.abs(ropesToCheck[i].links[ropesToCheck[i].linksCount].dX) < 0.1 &&
                            Math.abs(ropesToCheck[i].links[ropesToCheck[i].linksCount].dY) < 0.1 &&
                            (Math.abs(vertDiff) < 1)) {
                            ropesToCheck[i].atRest = true;
                        }
                    }
                    shapeEndEffector = ropesToCheck[i].links[ropesToCheck[i].linksCount];
                    drawArm2(ropesToCheck[i], ropesToCheck[i].linksCount, shapeEndEffector, players[0].facing);
                    for (j = ropesToCheck[i].linksCount - 1; j > 1; j -= 1) {
                        drawArm2(ropesToCheck[i], j, shapeEndEffector, players[0].facing);
                    }

                    // If the shape is colliding with the rope, then set the shape's grabbing properties:
                    holdingLink = collisionDetectionRope(i, ropesToCheck[i], players[0]);
                    if (holdingLink > -1) {
                        ropesToCheck[i].atRest = false;

                        ropesToCheck[i].links[ropesToCheck[i].linksCount].velX = null;
                        ropesToCheck[i].links[ropesToCheck[i].linksCount].velY = null;

                        players[0].grabbedState = 1;
                        players[0].grabbedRope = i;
                        players[0].grabbedLink = holdingLink;
                        players[0].grabbedOffsetX = (players[0].x + players[0].width / 2) - ropesToCheck[i].links[holdingLink].x;
                        players[0].grabbedOffsetY = players[0].y - ropesToCheck[i].links[holdingLink].y;
                    }

                    //#endregion Not Holding Rope

                    break;

                // The shape is holding a rope, so move the shape accordingly.
                case 1:

                    //#region Holding Rope

                    // If the current rope is the one we're holding, move the shape,
                    // else: ToDO: animate the rope anyway.
                    if (players[0].grabbedRope === i) {
                        shapeMidX = players[0].x + (players[0].width / 2);
                        shapeEndEffector = {
                            x: shapeMidX,
                            y: players[0].y
                        };
                        for (j = ropesToCheck[i].linksCount; j > 1; j -= 1) {
                            drawArm2(ropesToCheck[i], j, shapeEndEffector, players[0].facing);
                        }

                        // ToDo: do we want to move the player here?
                        players[0].x += ropesToCheck[i].links[holdingLink].dX;
                        players[0].y += ropesToCheck[i].links[holdingLink].dY;
                    }

                    //#endregion Holding Rope

                    break;
            }
        }
    }
    //return shape;
}

function collisionDetectionRope(ropeIndex, ropeToCheck, shape) {
    "use strict";
    var grabbingARope = -1,
        j = 0,
        pX = 0,
        pY = 0;

    for (j = ropeToCheck.linksCount; j >= 0; j -= 1) {
        pX = ropeToCheck.links[j].x;
        pY = ropeToCheck.links[j].y;
        if (shape.x <= pX && pX <= (shape.x + shape.width) && shape.y <= pY && pY <= (shape.y + shape.height)) {
            grabbingARope = j;
            break;
        }
    }

    return grabbingARope;
}

function drawArm2(ropeToMove, currentLink, endEffector, preferredRotation) {
    "use strict";
    var root = {
            x: ropeToMove.links[currentLink - 2].x,
            y: ropeToMove.links[currentLink - 2].y
        },
        poleVector = {
            x: ropeToMove.links[currentLink - 1].x,
            y: ropeToMove.links[currentLink - 1].y
        },
        endEffectorX = endEffector.x,
        endEffectorY = endEffector.y,
        segmentLength = ropeToMove.linksLength,
        dirx = endEffectorX - root.x,
        diry = endEffectorY - root.y,
           len = Math.sqrt(dirx * dirx + diry * diry),
        disc = segmentLength * segmentLength - len * len / 4;

    dirx = dirx / len;
    diry = diry / len;

    if (disc < 0) {
        poleVector.x = root.x + dirx * segmentLength;
        poleVector.y = root.y + diry * segmentLength;
        endEffectorX = root.x + dirx * segmentLength * 2;
        endEffectorY = root.y + diry * segmentLength * 2;
    } else {
        poleVector.x = root.x + dirx * len / 2;
        poleVector.y = root.y + diry * len / 2;
        disc = Math.sqrt(disc);
        if (preferredRotation < 0) {
            disc = -disc; // Make it a negative number
        }
        poleVector.x -= diry * disc;
        poleVector.y += dirx * disc;
    }

    ropeToMove.links[currentLink - 1].x = poleVector.x;
    ropeToMove.links[currentLink - 1].y = poleVector.y;

    ropeToMove.links[currentLink].dX = endEffectorX - ropeToMove.links[currentLink].x;
    ropeToMove.links[currentLink].dY = endEffectorY - ropeToMove.links[currentLink].y;

    ropeToMove.links[currentLink].x = endEffectorX;
    ropeToMove.links[currentLink].y = endEffectorY;
}

//#endregion Ropes

//#region A.I.

function getClosestJump(who, theBoxes) {
    "use strict";
    var i;
    for (i = 0; i < theBoxes.length; i += 1) {
        if (canMakeJump(who, theBoxes[i].x, theBoxes[i].y)) {
            return i;
        }
    }
}

/*function canMakeJump(who, x2, y2) {
    "use strict";
    var x1 = who.x,
        y1 = who.y,
        h = who.height,
        w = who.width;



    return false;
}*/

//#endregion A.I.

//#region Debugging

function addPlayerDebugMessages(p) {
    switch (DEBUG_LEVEL) {

        // None:
        case 0:
            break;

            // Minor:
        case 1:
            addDebugMessage("");
            addDebugMessage("x:    \t\t" + p.x);
            addDebugMessage("y:    \t\t" + p.y);
            addDebugMessage("velX:   \t" + p.velX);
            addDebugMessage("velY:   \t" + p.velY);
            addDebugMessage("width:  \t" + p.width);
            addDebugMessage("height: \t" + p.height);
            addDebugMessage("state:  \t" + p.state);
            addDebugMessage("coll:   \t" + p.collisions);

            if (player1Sprite.hasOwnProperty(players[0].state)) {
                addDebugMessage("");
                addDebugMessage("spriteX : \t" + player1Sprite[players[0].state].frames[player1Sprite[players[0].state].frameIndex].srcX);
                addDebugMessage("spriteY : \t" + player1Sprite[players[0].state].frames[player1Sprite[players[0].state].frameIndex].srcY);
                addDebugMessage("spriteW : \t" + player1Sprite[players[0].state].frames[player1Sprite[players[0].state].frameIndex].srcW);
                addDebugMessage("spriteH : \t" + player1Sprite[players[0].state].frames[player1Sprite[players[0].state].frameIndex].srcH);
            }

            break;

            // All:
        case 2:
            addDebugMessage("");
            Object.keys(p).forEach(function (key, index) {
                addDebugMessage(key + ": " + p[key]);
            });
            setDebugEnemyCanSeeMe(hiddenMe);
            break;
    }
}

//#endregion Debugging

window.addEventListener("load", function () {
    "use strict";
    try {
        initCompleteEngine = true;
        initComplete();
    }
    catch (ex) {
        alert(ex.message);
    }
});