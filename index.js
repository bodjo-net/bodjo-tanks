let BodjoGame = require('@dkaraush/bodjo-game');
let bodjo = new BodjoGame(promptConfig('config.json'));

bodjo.initClient('./web/');

let clearScore = {kills: 0, deaths: 0, score: 0, combo: 0};
let consts = {
	TPS: 25,
	width: 20,
	height: 20,
	tankRadius: 0.3,
	bonusRadius: 0.5,
	bonusDuration: 25 * 5,
	bonusesCount: 5,
	tankSpeed: 0.1,
	bulletSpeed: 0.4,
	bulletDamage: 0.25,
	healSpeed: 0.5 / (25 * 5),
	colors: ['red', 'blue', 'black', 'green', 'beige'],
	walls: [
		[{x: 0, y: 0}, {x: 0, y: 20}],
		[{x: 0, y: 0}, {x: 20, y: 0}],
		[{x: 20, y: 0}, {x: 20, y: 20}],
		[{x: 0, y: 20}, {x: 20, y: 20}],

		[{x: 7.5, y: 2.5}, {x: 2.5, y: 2.5}],
		[{x: 2.5, y: 2.5}, {x: 2.5, y: 7.5}],
		[{x: 2.5, y: 12.5}, {x: 2.5, y: 17.5}],
		[{x: 2.5, y: 17.5}, {x: 7.5, y: 17.5}],

		[{x: 12.5, y: 2.5}, {x: 17.5, y: 2.5}],
		[{x: 17.5, y: 2.5}, {x: 17.5, y: 7.5}],
		[{x: 17.5, y: 12.5}, {x: 17.5, y: 17.5}],
		[{x: 17.5, y: 17.5}, {x: 12.5, y: 17.5}],

		[{x:14,y:10}, {x:13.6955,y:11.5307}],
		[{x:12.8284,y:12.8284}, {x:11.5307,y:13.6955}],
		[{x:10,y:14}, {x:8.4692,y:13.6955}],
		[{x:7.17157,y:12.8284}, {x:6.3044,y:11.5307}],
		[{x:6,y:10}, {x:6.3044,y:8.4692}],
		[{x:7.17157,y:7.1715}, {x:8.4692,y:6.3044}],
		[{x:10,y:6}, {x:11.5307,y:6.3044}],
		[{x:12.8284,y:7.1715}, {x:13.6955,y:8.4692}]
	]
};

const MAX8 = 255;
const MAX16 = 65535;

let T = 0;
let bonuses = [];
let bullets = [];
let players = {};

bodjo.scoreboard.sortFunction = function (a, b) {
	return b.score - a.score;
}
bodjo.scoreboard.updateWhenNeeded = false;

bodjo.on('connect', socket => {
	socket.emit('const', consts);
})
bodjo.on('player-connect', (player) => {
	let username = player.username,
		id = player.id, 
		playing = false;

	player.on('start', () => {
		if (playing)
			return;
		playing = true;
		let playerPos = getSpawnPos();
		players[username] = {
			id,
			username,
			x: playerPos.x,
			y: playerPos.y,
			vx: 0,
			vy: 0,
			vtime: 0,
			color: Math.round(Math.random() * (consts.colors.length-1)),
			socket: player,
			bonuses: {},
			hp: 1,
			lastShot: T,
			headAngle: 0
		};

		let score = bodjo.scoreboard.get(username) || clearScore;
		score.combo = 0;
		bodjo.scoreboard.push(username, score);
	});

	player.on('turn', (message) => {
		if (!players[username])
			return;
		if (message.length != 6)
			return;
		// if (message.readUInt8(0) != (T % MAX8))
			// return;

		let d1 = message.readUInt16BE(1);
		let shoot = d1 & 1;
		let headAngle = (d1 >> 1) / Math.pow(2, 15) * (Math.PI * 2);
		let angle = message.readUInt16BE(3) / MAX16 * (Math.PI * 2);
		let speed = message.readUInt8(5) / MAX8;

		let P = players[username];
		let vx = Math.cos(angle) * speed * (consts.tankSpeed);
		let vy = Math.sin(angle) * speed * (consts.tankSpeed);
		let newX = P.x + vx,
			newY = P.y + vy;

		if (noCollide(P.x,  newY, consts.tankRadius, id) ||
			noCollide(newX, newY, consts.tankRadius, id)) {
			P.y = newY;
			P.vy = vy;
		} else
			P.vy = 0;

		if (noCollide(newX, P.y,  consts.tankRadius, id) ||
			noCollide(newX, newY, consts.tankRadius, id)) {
			P.x = newX;
			P.vx = vx;
		} else
			P.vx = 0;
		
		P.vtime = T;

		P.headAngle = headAngle;
		if (shoot && (T - P.lastShot >= 16)) {
			P.lastShot = T;
			bullets.push({
				author: P,
				color: P.color,
				damage: consts.bulletDamage * (P.bonuses.ammo ? 2 : 1),
				angle: P.headAngle,
				x: P.x + Math.cos(P.headAngle) * (consts.tankRadius*1.1),
				y: P.y + Math.sin(P.headAngle) * (consts.tankRadius*1.1),
				vx: Math.cos(P.headAngle) * (consts.bulletSpeed),
				vy: Math.sin(P.headAngle) * (consts.bulletSpeed)
			});
		}
	});

	player.on('stop', () => {
		if (!playing)
			return;
		playing = false;
		delete players[username];
	});

	player.on('disconnect', () => {
		if (playing) {
			playing = false;
			delete players[username];
		}
	});
});

bodjo.start();
bodjo.addBots(__dirname + '/bot.js', 5);

function tick() {
	let start = Date.now();
	let usernames = Object.keys(players);
	T++;

	let bulletEvents = [];
	for (let i = 0; i < bullets.length; ++i) {
		let bullet = bullets[i];
		let newPos = {x: bullet.x + bullet.vx,
					  y: bullet.y + bullet.vy};

		let bulletRemoved = false;
		if (newPos.x < -1 || newPos.x >= consts.width+1 ||
			newPos.y < -1 || newPos.y >= consts.height+1) {
			bulletRemoved = true;
		} else {
			for (let wall of consts.walls) {
				if (lineLine(bullet, newPos, wall[0], wall[1])) {
					let point = lineLinePoint(bullet, newPos, wall[0], wall[1]);
					bulletEvents.push(Object.assign(point, {to: 'wall'}));
					bulletRemoved = true;
					break;
				}
			}
		}

		if (!bulletRemoved) {
			for (let username of usernames) {
				let player = players[username];
				if (bullet.author.username == username)
					continue;
				if (lineCircle(bullet, newPos, player, consts.tankRadius)) {
					player.hp -= bullet.damage;
					if (player.hp <= 0) {
						player.hp = 1;
						let newPlayerPos = getSpawnPos();
						player.x = newPlayerPos.x;
						player.y = newPlayerPos.y;
						player.bonuses = {};

						let deadScore = bodjo.scoreboard.get(username) || Object.assign({}, clearScore);
						let killerScore = bodjo.scoreboard.get(bullet.author.username) || Object.assign({}, clearScore);
						deadScore.deaths++;
						deadScore.combo = 0;
						bodjo.scoreboard.push(username, deadScore);
						killerScore.score += 100 + 50 * killerScore.combo;
						killerScore.combo++;
						killerScore.kills++;
						bodjo.scoreboard.push(bullet.author.username, killerScore);
						console.log('"'+bullet.author.username+'" killed "' +username+'"');
					} else
						bulletEvents.push({to: 'player', id: player.id});
					bulletRemoved = true;
					break;
				}
			}
		}

		if (bulletRemoved) {
			bullets.splice(i, 1);
			i--;
			continue;
		}

		bullet.x = newPos.x;
		bullet.y = newPos.y;
	}

	for (let username of usernames) {
		let P = players[username];
		for (let i = 0; i < bonuses.length; ++i) {
			if (distance(P, bonuses[i]) <= consts.tankRadius + consts.bonusRadius) {
				P.bonuses[bonuses[i].type] = {
					taken: T
				};
				bonuses.splice(i, 1);
				i--;
			}
		}

		for (let bonusname in P.bonuses) {
			if (T - P.bonuses[bonusname].taken >= consts.bonusDuration)
				delete P.bonuses[bonusname];
			else if (bonusname == 'heal')
				P.hp = range(P.hp + consts.healSpeed, 0, 1);
		}
	}

	while (bonuses.length < consts.bonusesCount) {
		bonuses.push(Object.assign({
			type: Math.random() > 0.5 ? 'ammo' : 'heal'
		}, getSpawnPos(consts.bonusRadius)));
	}

	bodjo.broadcast('field', buff(
		UInt32(T),
		UInt8(usernames.length),
		Array.from(usernames, username => {
			let player = players[username];
			return [
				UInt8(player.id),
				UInt8(player.color),
				UInt8(player.vtime+1 >= T ? (player.vx + 1) / 2 * MAX8 : 0),
				UInt8(player.vtime+1 >= T ? (player.vy + 1) / 2 * MAX8 : 0),
				UInt8(player.headAngle / (Math.PI*2) * MAX8),
				UInt8(range(T - player.lastShot, 0, MAX8)),
				UInt8(player.hp * MAX8),
				UInt8((!!player.bonuses.heal-0) + (!!player.bonuses.ammo-0)*2),
				UInt16(player.x / consts.width * MAX16),
				UInt16(player.y / consts.height * MAX16)
			];
		}),
		UInt8(bullets.length),
		Array.from(bullets, bullet => [
			UInt16(bullet.x / consts.width * MAX16),
			UInt16(bullet.y / consts.height * MAX16),
			UInt8((bullet.angle+Math.PI)/(Math.PI*2)*MAX8),
			UInt8(bullet.damage / 1 * MAX8),
			UInt8(bullet.color),
			UInt8(bullet.author.id)
		]),
		UInt8(bulletEvents.length),
		Array.from(bulletEvents, bulletEvent => 
			(bulletEvent.to == 'wall' ? 
				[	
					UInt8(0),
					UInt8(bulletEvent.x / consts.width * MAX8),
					UInt8(bulletEvent.y / consts.height * MAX8)
				] 
					:
				[
					UInt8(1),
					UInt8(bulletEvent.id)
				]
			)
		),
		UInt8(bonuses.length),
		Array.from(bonuses, bonus => [
			UInt8(['heal', 'ammo'].indexOf(bonus.type)),
			UInt8(bonus.x / consts.width * MAX8),
			UInt8(bonus.y / consts.height * MAX8)
		])
	));

	bodjo.scoreboard.update();
	setTimeout(tick, Math.max(1000 / consts.TPS - (Date.now() - start), 2));
}
tick();

function noCollide(x, y, radius, except) {
	for (let wall of consts.walls)
		if (lineCircle(wall[0], wall[1], {x, y}, radius))
			return false;
	for (let username in players) {
		if (players[username].id == except)
			continue;
		if (distance(players[username], {x, y}) <= radius+consts.tankRadius)
			return false;
	}
	return true;
}
function getSpawnPos(radius) {
	if (typeof radius !== 'number')
		radius = consts.tankRadius;
	let x = Math.random() * consts.width,
		y = Math.random() * consts.height;
	while (!noCollide(x, y, radius)) {
		x = Math.random() * consts.width;
		y = Math.random() * consts.height;
	}
	return {x, y};
}

function range(a, _min, _max) {
	return Math.min(Math.max(a, _min), _max);
}
function flatten(input) {
	const stack = [...input];
	const res = [];
	while (stack.length) {
		const next = stack.pop();
		if (Array.isArray(next))
			stack.push(...next);
		else
			res.push(next);
	}
	return res.reverse();
}

// === Binary ===
function UInt8(n) {
	return new Uint8Array(Array.isArray(n) ? n : [n]).buffer;
}
function UInt16(n) {
	return new Uint16Array(Array.isArray(n) ? n : [n]).buffer;
}
function UInt32(n) {
	return new Uint32Array(Array.isArray(n) ? n : [n]).buffer;
}
function Float32(n) {
	return new Float32Array(Array.isArray(n) ? n : [n]).buffer;
}
function buff() {
	let array = flatten(Array.prototype.slice.apply(arguments));
	let sum = 0, offset = 0;
	for (let i = 0; i < array.length; ++i)
		sum += array[i].byteLength;
	let tmp = new Uint8Array(sum);
	for (let i = 0; i < array.length; ++i) {
		tmp.set(new Uint8Array(array[i]), offset);
		offset += array[i].byteLength;
	}
	return tmp.buffer;
}

// === Collisions ===
function distance(a, b) {
	return Math.sqrt(Math.pow(a.x-b.x,2) + Math.pow(a.y-b.y,2));
}
function lineCircle(a, b, c, rc) {
    var ac = [c.x - a.x, c.y - a.y];
    var ab = [b.x - a.x, b.y - a.y];
    var ab2 = dot(ab, ab);
    var acab = dot(ac, ab);
    var t = acab / ab2;
    t = (t < 0) ? 0 : t;
    t = (t > 1) ? 1 : t;
    var h = [(ab[0] * t + a.x) - c.x, (ab[1] * t + a.y) - c.y];
    var h2 = dot(h, h);
    return h2 <= rc * rc;
}
function dot(v1, v2) {
    return (v1[0] * v2[0]) + (v1[1] * v2[1]);
}
function lineLine(a, b, c, d) {
    var s1_x = b.x - a.x;
    var s1_y = b.y - a.y;
    var s2_x = d.x - c.x;
    var s2_y = d.y - c.y;
    var s = (-s1_y * (a.x - c.x) + s1_x * (a.y - c.y)) / (-s2_x * s1_y + s1_x * s2_y);
    var t = (s2_x * (a.y - c.y) - s2_y * (a.x - c.x)) / (-s2_x * s1_y + s1_x * s2_y);
    return s >= 0 && s <= 1 && t >= 0 && t <= 1;
}
function lineLinePoint(a, b, c, d) {
    var ua, ub, denom = (d.y - c.y)*(b.x - a.x) - (d.x - c.x)*(b.y - a.y);
    if (denom == 0) {
        return null;
    }
    ua = ((d.x - c.x)*(a.y - c.y) - (d.y - c.y)*(a.x - c.x))/denom;
    ub = ((b.x - a.x)*(a.y - c.y) - (b.y - a.y)*(a.x - c.x))/denom;
    return {
        x: a.x + ua * (b.x - a.x),
        y: a.y + ub * (b.y - a.y),
        seg1: ua >= 0 && ua <= 1,
        seg2: ub >= 0 && ub <= 1
    };
}