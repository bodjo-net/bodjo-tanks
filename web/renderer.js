let debug = false;
let sprites = {
	tank: loadSprites({
        red: 	'/assets/sprites/tanks/tankRed.png',
        blue: 	'/assets/sprites/tanks/tankBlue.png',
        black: 	'/assets/sprites/tanks/tankBlack.png',
        green: 	'/assets/sprites/tanks/tankGreen.png',
        beige: 	'/assets/sprites/tanks/tankBeige.png'
    }),
    barrel: loadSprites({
        red: 	'/assets/sprites/tanks/barrelRed.png',
        blue: 	'/assets/sprites/tanks/barrelBlue.png',
        black: 	'/assets/sprites/tanks/barrelBlack.png',
        green: 	'/assets/sprites/tanks/barrelGreen.png',
        beige: 	'/assets/sprites/tanks/barrelBeige.png'
    }),
    bullet: loadSprites({
        red:  	'/assets/sprites/bullets/bulletRed.png',
        blue: 	'/assets/sprites/bullets/bulletBlue.png',
        black:	'/assets/sprites/bullets/bulletSilver.png',
        green:	'/assets/sprites/bullets/bulletGreen.png',
        beige:	'/assets/sprites/bullets/bulletBeige.png'
    }),
    bulletSilver: loadSprites({
        red:  	'/assets/sprites/bullets/bulletRedSilver.png',
        blue: 	'/assets/sprites/bullets/bulletBlueSilver.png',
        black:	'/assets/sprites/bullets/bulletSilverSilver.png',
        green:	'/assets/sprites/bullets/bulletGreenSilver.png',
        beige:	'/assets/sprites/bullets/bulletBeigeSilver.png'
    }),
    bg: loadSprites({
        dirt: 	'/assets/sprites/bg/dirt.png',
        grass: 	'/assets/sprites/bg/grass.png',
        sand: 	'/assets/sprites/bg/sand.png'
    }),
    whiteSmoke: loadSprites([
        '/assets/sprites/smoke/smokeWhite0.png',
        '/assets/sprites/smoke/smokeWhite1.png',
        '/assets/sprites/smoke/smokeWhite2.png',
        '/assets/sprites/smoke/smokeWhite3.png',
        '/assets/sprites/smoke/smokeWhite4.png',
        '/assets/sprites/smoke/smokeWhite5.png'
    ]),
    yellowSmoke: loadSprites([
        '/assets/sprites/smoke/smokeYellow0.png',
        '/assets/sprites/smoke/smokeYellow1.png',
        '/assets/sprites/smoke/smokeYellow2.png',
        '/assets/sprites/smoke/smokeYellow3.png',
        '/assets/sprites/smoke/smokeYellow4.png',
        '/assets/sprites/smoke/smokeYellow5.png'
    ]),
    orangeSmoke: loadSprites([
        '/assets/sprites/smoke/smokeOrange0.png',
        '/assets/sprites/smoke/smokeOrange1.png',
        '/assets/sprites/smoke/smokeOrange2.png',
        '/assets/sprites/smoke/smokeOrange3.png',
        '/assets/sprites/smoke/smokeOrange4.png',
        '/assets/sprites/smoke/smokeOrange5.png'
    ]),
    bonuses: loadSprites({
        heal: '/assets/sprites/bonuses/heal.png',
        ammo: '/assets/sprites/bonuses/ammo.png'
    })
}
const bonusesColors = {
    heal: 'rgba(0,185,0,0.5)',
    ammo: 'rgba(150,70,0,0.5)'
}
function loadSprites(obj) {
    let res = {};
    for (let k = 0; k < Object.keys(obj).length; ++k) {
        let key = Object.keys(obj)[k];
        res[key] = new Image();
        res[key].src = obj[key];
    }
    return res;
}

let bulletEvents = [];
bodjo.on('render', function (data) {
    let tankRadius = consts.tankRadius,
        width = data.width,
        height = data.height,
        d = sqrt(width*width+height*height),
        W = canvas.width,
        H = canvas.height,
        D = sqrt(W*W+H*H),
        S = W / width;

    lastData = data;

    if (aspectRatio != (data.width / data.height))
        resizeCanvas(data.width / data.height);

	ctx.fillStyle = ctx.createPattern(sprites.bg.sand, 'repeat');
    ctx.fillRect(0,0,W,H);

    ctx.strokeStyle = '#9d9783';
    ctx.lineWidth = tankRadius * 0.7 *S;
    ctx.lineCap = 'round';
    ctx.strokeRect(0,0,W-1,H-1);

    var players = data.players;

    for (var i = 0; i < players.length; ++i) {
        var player = players[i];
        ctx.translate((player.x)*S, 
                      (player.y)*S);
        ctx.rotate(player.angle%(PI*2)-PI/2);
        ctx.drawImage(sprites.tank[player.color], 
            -tankRadius*S*1.5*sqrt(2)/2, 
            -tankRadius*S*1.5*sqrt(2)/2, 
            tankRadius*S*1.5*sqrt(2), 
            tankRadius*S*1.5*sqrt(2));
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        var shootAnimation = range(player.lastShot, 0, 10) / 10;
        var r = sin(shootAnimation*PI) * tankRadius*2 *S;
        ctx.drawImage(sprites.whiteSmoke[~~(shootAnimation*5)],
            (player.x + cos(player.headAngle)*tankRadius)*S-r/2, 
            (player.y + sin(player.headAngle)*tankRadius)*S-r/2, r, r);

        var barrelSprite = sprites.barrel[player.color];
        ctx.translate(player.x*S, player.y*S);
        ctx.rotate(player.headAngle%(PI*2)-PI/2);
        ctx.drawImage(barrelSprite,
            -(barrelSprite.width / barrelSprite.height) * (tankRadius*1.5*S) / 2, 
            -tankRadius*(sin(shootAnimation*PI)/2+0.25)*S, 
            (barrelSprite.width / barrelSprite.height) * (tankRadius*1.5*S), 
            tankRadius*1.5*S
            );
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        var bonuses = Object.keys(player.bonuses);
        for (var j = 0; j < bonuses.length; ++j) {
            if (player.bonuses[bonuses[j]]) {
                // var t = range(data.time - bonus.start, 0, bonus.duration) / bonus.duration;
                // var r = (-pow(t-0.5,10)*1000+1);
                ctx.fillStyle = bonusesColors[bonuses[j]];
                ctx.beginPath();
                ctx.arc(player.x*S, player.y*S, /*r**/tankRadius*2*S, 0, PI*2);
                ctx.fill();
            }
        }
    }

    if (data.bonuses) {
        for (var i = 0; i < data.bonuses.length; ++i) {
            var bonus = data.bonuses[i];
            // var t = range(data.time-bonus.spawnTime, 0, 10) / 10;
            // var r = (-pow((t-1)*0.5,4)*16+1);
            ctx.fillStyle = bonusesColors[bonus.type];
            ctx.beginPath();
            ctx.arc(bonus.x*S, bonus.y*S, /*r**/bonus.radius*S, 0, PI*2);
            ctx.fill();
            var sprite = sprites.bonuses[bonus.type];
            if (sprite) {
                var w = /*r**/bonus.radius*S;
                ctx.drawImage(sprite, bonus.x*S-w/2, bonus.y*S-w/2, w, w);
            }
        }
    }

    if (data.bullets) {
        for (var i = 0; i < data.bullets.length; ++i) {
            var bullet = data.bullets[i];
            var bulletSprite = sprites[bullet.type?'bulletSilver':'bullet'][bullet.color];
            ctx.translate(bullet.x*S, bullet.y*S);
            ctx.rotate(bullet.angle-PI/2+PI);
            ctx.drawImage(bulletSprite,
                -(bulletSprite.width/bulletSprite.height)*(tankRadius*S)/2, 
                0, 
                (bulletSprite.width/bulletSprite.height)*(tankRadius*S), 
                tankRadius*S);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
    }


    ctx.strokeStyle = '#9d9783';
    ctx.lineWidth = tankRadius * 0.7 *S;
    ctx.lineCap = 'round';
    for (var i = 0; i < data.walls.length; ++i) {
        var wall = data.walls[i];
        ctx.beginPath();
        ctx.moveTo(wall[0].x*S, wall[0].y*S);
        ctx.lineTo(wall[1].x*S, wall[1].y*S);
        ctx.stroke();
    }

    if (data.bulletEvents) {
        for (var i = 0; i < data.bulletEvents.length; ++i) {
            var event = data.bulletEvents[i];
            event.time = data.time;
            bulletEvents.push(event);
        }
    }
    for (var i = 0; i < bulletEvents.length; ++i) {
        var event = bulletEvents[i];
        var t = range(data.time - event.time, 0, 8) / 8;
        var r = (-pow(t-0.5,4)*16+1) * tankRadius*1.75 *S;
        var sprite = sprites[event.to == 'wall' ? 'yellowSmoke' : 'orangeSmoke'][round(t*5)];
        var w = r * (100 / sprite.width), a = sprite.width / sprite.height,
            h = w / a;
        if (event.to == 'wall') {
            ctx.drawImage(sprite,
                event.x*S-w/2, 
                event.y*S-h/2, w, h);
        } else if (event.to == 'player') {
            var player = players.find(function (p) {
                return p.username == event.username;
            });
            if (player) {
                ctx.drawImage(sprite,
                    player.x*S-w/2, 
                    player.y*S-h/2, w, h);
            }
        }
        if (t == 1) {
            bulletEvents.splice(i, 1);
            i--;
        }
    }

    for (var i = 0; i < players.length; ++i) {
        var player = players[i];

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = window.devicePixelRatio * 1.5;
        ctx.fillStyle = '#ff0000';
        ctx.strokeRect((player.x-tankRadius)*S, (player.y-tankRadius*1.4)*S, tankRadius*S*2, tankRadius*S*0.25);
        ctx.fillRect((player.x-tankRadius)*S, (player.y-tankRadius*1.4)*S, (tankRadius*S*2)*player.hp, tankRadius*S*0.25);

        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#ffffff';
        ctx.font = tankRadius*S*1.5 + 'px \'Source Code Pro\'';
        var text = ctx.measureText(player.username);
        ctx.fillText(player.username, (player.x)*S-text.width/2, (player.y-tankRadius*1.6)*S);
    }

    if (data._render) {
        for (var i = 0; i < data._render.length; ++i) {
            var m = data._render[i];
            if (m.type == 'point') {
                ctx.beginPath();
                ctx.fillStyle = m.color || 'red';
                ctx.arc(m.a.x*S, m.a.y*S, 3, 0, PI*2);
                ctx.fill()
            } else if (m.type == 'text') {
                ctx.fillStyle = m.color || 'red';
                ctx.font = tankRadius*S*1.5 + 'px monospace';
                ctx.fillText(m.text, m.a.x*S+5, m.a.y*S+5);
            } else if (m.type == 'line') {
                ctx.beginPath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = m.color || 'red';
                ctx.moveTo(m.a.x*S, m.a.y*S);
                ctx.lineTo(m.b.x*S, m.b.y*S);
                ctx.stroke();
            } else if (m.type == 'circle') {
                ctx.beginPath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = m.color || 'red';
                ctx.arc(m.a.x*S, m.a.y*S, m.r*S, 0, PI*2);
                ctx.stroke();
            }
        }
    }

    if (debug) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, W, H);

        function label(X, Y, strings) {
            let h = window.devicePixelRatio * data.tankRadius * S;
            ctx.font = "300 " + h + "px 'Source Code Pro'";
            for (let i = 0; i < strings.length; ++i) {
                let x = 0;
                for (let j = 0; j < strings[i].length; ++j) {
                    let string = strings[i][j];
                    let bold = string[0] == 'B';
                    if (bold)
                        string = string.substring(1);
                    ctx.font = (bold ? '700' : '300') + " " + h + "px 'Source Code Pro'";
                    ctx.fillText(string,
                                 X + x,
                                 Y + i*h);
                    x += ctx.measureText(string).width;
                }
            }
        }

        ctx.strokeStyle = '#0000aa';
        ctx.lineWidth = 2 * window.devicePixelRatio;
        for (let wall of data.walls) {
            ctx.beginPath();
            ctx.moveTo(wall[0].x*S, wall[0].y*S);
            ctx.lineTo(wall[1].x*S, wall[1].y*S);
            ctx.stroke();
        }


        for (let bonus of data.bonuses) {
            ctx.fillStyle = bonus.type == 'heal' ? 'rgba(0,185,0,0.5)' : 'rgba(150,70,0,0.5)';
            ctx.beginPath();
            ctx.arc(bonus.x*S, bonus.y*S, bonus.radius*S, 0, PI*2);
            ctx.fill();
        }

        for (let player of data.players) {
            let own = data.me && data.me.username == player.username;
            ctx.strokeStyle = (own ? '#00FF00' : '#AAAA00');
            ctx.fillStyle = (own ? '#00FF00' : '#AAAA00');
            ctx.beginPath();
            ctx.arc(
                player.x*S,
                player.y*S,
                player.radius*S,
                0, PI*2
            );
            ctx.moveTo(player.x*S,
                       player.y*S);
            ctx.lineTo(player.x*S + cos(player.angle) * player.radius*S,
                       player.y*S + sin(player.angle) * player.radius*S);
            ctx.lineTo(player.x*S + cos(player.angle) * player.radius*S + cos(player.angle-PI+PI/8)*player.radius*S*0.5,
                       player.y*S + sin(player.angle) * player.radius*S + sin(player.angle-PI+PI/8)*player.radius*S*0.5);
            ctx.moveTo(player.x*S + cos(player.angle) * player.radius*S,
                       player.y*S + sin(player.angle) * player.radius*S);
            ctx.lineTo(player.x*S + cos(player.angle) * player.radius*S + cos(player.angle-PI-PI/8)*player.radius*S*0.5,
                       player.y*S + sin(player.angle) * player.radius*S + sin(player.angle-PI-PI/8)*player.radius*S*0.5);
            ctx.lineWidth = 2 * window.devicePixelRatio;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(player.x*S,
                       player.y*S);
            ctx.lineTo(player.x*S + cos(player.headAngle) * player.radius*1.25*S,
                       player.y*S + sin(player.headAngle) * player.radius*1.25*S);
            ctx.lineWidth = 4 * window.devicePixelRatio;
            ctx.stroke();

            ctx.strokeStyle = (own ? 'rgba(0,255,0,0.25)' : 'rgba(170,170,0,0.25)');
            ctx.moveTo(player.x*S, player.y*S);
            ctx.lineTo(player.x*S + cos(player.headAngle)*D,
                       player.y*S + sin(player.headAngle)*D);
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.stroke();
            ctx.setLineDash([0]);

            label(player.x*S + player.radius*S*1.25,
                  player.y*S - player.radius*S*1.25,
            [
                ['B"'+player.username + '" (id='+player.id+')'], 
                ['Bhp: ', player.hp.toFixed(2)],
                ['Bx: ', player.x.toFixed(2), ', ', 'By: ', player.y.toFixed(2)],
                // ['Bvx: ', player.vx.toFixed(3), ', ', 'Bvy: ', player.vy.toFixed(3)],
                ['Bcan shoot: ', (data.time - player.lastShot >= 16 ? 'yes' : 'no (' + (data.time - player.lastShot) + ' left)')],
                ['Bbonuses: ', Object.keys(player.bonuses).filter(b => player.bonuses[b]).join(', ')]
            ]);
        }

        for (let bullet of data.bullets) {
            ctx.fillStyle = (data.me && data.me.username == bullet.owner ? '#00FF00' : '#AAAA00');
            ctx.beginPath();
            ctx.arc(bullet.x*S,
                    bullet.y*S,
                    consts.tankRadius*0.2*S, 0, PI*2);
            ctx.fill();
        }

        for (let event of bulletEvents) {
            if (event.to == 'wall') {
                ctx.beginPath();
                ctx.fillStyle = '#FF0000';
                ctx.arc(event.x*S, event.y*S,
                        consts.tankRadius*0.5*S, 0, PI*2);
                ctx.fill();
            }
        }

        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 3 * window.devicePixelRatio;
        ctx.beginPath();
        ctx.moveTo(0, 1);
        ctx.lineTo(W, 1);
        ctx.lineTo(W + cos(-PI/2-(PI/2-PI/8))*W*0.025,
                   1 - sin(-PI/2-(PI/2-PI/8))*H*0.025);
        ctx.moveTo(1, 0);
        ctx.lineTo(1, H);
        ctx.lineTo(1 + cos(PI/2-PI/8)*W*0.025,
                   H - sin(PI/2-PI/8)*H*0.025);
        ctx.stroke();

        ctx.fillStyle = '#00FFFF';
        let h = window.devicePixelRatio * data.tankRadius * S;
        ctx.font = '700 '+h+'px \'Source Code Pro\'';
        ctx.fillText('(x=0, y=0)', 10, h+10);
        let a = '(x='+data.width+', y=0)';
        ctx.fillText(a, W-10-ctx.measureText(a).width, h+10);
        let b = '(x=0, y='+data.height+')';
        ctx.fillText(b, 10, H-10);
        ctx.beginPath();
        ctx.arc(0, 0, 0.5 * window.devicePixelRatio * data.tankRadius * S, 0, PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(W, 0, 0.5 * window.devicePixelRatio * data.tankRadius * S, 0, PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, H, 0.5 * window.devicePixelRatio * data.tankRadius * S, 0, PI*2);
        ctx.fill();
    }
});