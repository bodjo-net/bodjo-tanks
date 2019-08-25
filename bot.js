Object.getOwnPropertyNames(Math).forEach(k => global[k] = Math[k]);
function range(x, _min, _max) {
	return Math.max(Math.min(x, _max), _min);
}
module.exports = (function (port, username, token) {
	let ids = {};
	const MAX8 = 255;
	const MAX16 = 65535;

	let url = 'http://localhost:'+port+'?role=player&username='+username+'&token='+token;
	let socket = require('socket.io-client')(url);

	let lastField = null;
	let consts = {}
	socket.on('connect', () => {
		socket.emit('start');
		socket.on('const', _consts => {
			consts = _consts;
			for (let constName in _consts) {
				global[constName] = _consts[constName];
			}
		});
		socket.on('field', data => {
			let field = parseField(data);
			if (field.me) {
				
				turn(field);
			}
		});
		socket.on('_scoreboard', players => players.forEach(player => ids[player.id] = player.username))

		function turn(field) {
			let result = null;
			try {
				result = onTick(field);
			} catch (e) {
				console.error(e);
				return;
			}
			// console.log(field, result);

			if (typeof result !== 'object' ||
				Array.isArray(result) ||
				result == null ||
				!Array.isArray(result.move) ||
				result.move.length != 2 ||
				typeof result.move[0] !== 'number' ||
				typeof result.move[1] !== 'number' ||
				typeof result.headAngle !== 'number' ||
				typeof result.shoot === 'undefined') {
				console.error('invalid returned result: ' + JSON.stringify(result));
				return;
			}

			let d = Math.sqrt(Math.pow(result.move[0],2) + Math.pow(result.move[1],2));
			result.move[0] = result.move[0] / d;
			result.move[1] = result.move[1] / d;

			let buff = new ArrayBuffer(6);
			let buffView = new DataView(buff);
			let headAngle = result.headAngle % (Math.PI*2);
			if (headAngle < 0)
				headAngle = Math.PI*2 + headAngle;

			buffView.setUint8(0, field.time % MAX8);
			buffView.setUint16(1, (Math.round(headAngle / (Math.PI*2) * (Math.pow(2, 15)-1)) << 1) + (!!result.shoot-0));
			let angle = Math.atan2(result.move[1], result.move[0]);
			let speed = range(Math.sqrt(Math.pow(result.move[1], 2) + Math.pow(result.move[0], 2)), 0, 1);
			buffView.setUint16(3, angle / (Math.PI*2) * MAX16);
			buffView.setUint8(5, speed * MAX8);
			socket.emit('turn', buff);
		}
	});

	function parseField(data) {
		let O = {}, offset = 0;
		let time = data.slice(offset, offset+=4).readUInt32LE();
		O.time = time;

		O.width = consts.width;
		O.height = consts.height;

		let playersCount = new Uint8Array(data.slice(offset, offset+=1))[0];
		O.players = new Array(playersCount);
		O.enemies = new Array();
		for (let i = 0; i < playersCount; ++i) {
			let pO = {};
			let d1 = new Uint8Array(data.slice(offset, offset+=8));
			pO.id = d1[0];
			pO.username = ids[pO.id] || '...';
			pO.color = consts.colors[d1[1]];
			pO.vx = Math.round((d1[2] / MAX8 * 2 - 1) * 100) / 100 * consts.tankSpeed;
			pO.vy = Math.round((d1[3] / MAX8 * 2 - 1) * 100) / 100 * consts.tankSpeed;
			pO.angle = Math.atan2(pO.vy, pO.vx);
			pO.headAngle = d1[4] / MAX8 * (Math.PI*2);
			pO.lastShot = time - d1[5];
			pO.hp = d1[6] / MAX8;
			pO.bonuses = {
				heal: (d1[7] == 1 || d1[7] == 3),
				ammo: (d1[7] == 2 || d1[7] == 3)
			};

			pO.x = data.slice(offset, offset+=2).readUInt16LE() / MAX16 * consts.width;
			pO.y = data.slice(offset, offset+=2).readUInt16LE() / MAX16 * consts.height;
			O.players[i] = pO;
			if (ids[pO.id] == username) {
				O.me = pO;
			} else
				O.enemies.push(pO);
		}

		let bulletsCount = new Uint8Array(data.slice(offset, offset+=1))[0];
		O.bullets = new Array(bulletsCount);
		for (let i = 0; i < bulletsCount; ++i) {
			let bO = {};
			bO.x = data.slice(offset, offset+=2).readUInt16LE() / MAX16 * consts.width;
			bO.y = data.slice(offset, offset+=2).readUInt16LE() / MAX16 * consts.height;
			let d2 = new Uint8Array(data.slice(offset, offset+=4));
			bO.angle = d2[0] / MAX8 * (Math.PI*2) - Math.PI;
			bO.damage = d2[1] / MAX8;
			bO.vx = Math.cos(bO.angle) * consts.bulletSpeed;
			bO.vy = Math.sin(bO.angle) * consts.bulletSpeed;
			bO.color = consts.colors[d2[2]];
			bO.owner = ids[d2[3]] || '...';
			O.bullets[i] = bO;
		}

		let bulletEventsCount = new Uint8Array(data.slice(offset, offset+=1))[0];
		O.bulletEvents = new Array(bulletEventsCount);
		for (let i = 0; i < bulletEventsCount; ++i) {
			let buO = {};
			let type = new Uint8Array(data.slice(offset, offset+=1))[0];
			if (type == 0) {
				buO.to = 'wall';
				let d = new Uint8Array(data.slice(offset, offset+=2));
				buO.x = d[0] / MAX8 * consts.width;
				buO.y = d[1] / MAX8 * consts.height;
			} else if (type == 1) {
				buO.to = 'player';
				buO.username = ids[new Uint8Array(data.slice(offset, offset+=1))[0]] || '...';
			}
			O.bulletEvents[i] = buO;
		}

		let bonusesCount = new Uint8Array(data.slice(offset, offset+=1))[0];
		O.bonuses = new Array(bonusesCount);
		for (let i = 0; i < bonusesCount; ++i) {
			let bnO = {};
			let d = new Uint8Array(data.slice(offset, offset+=3));
			bnO.type = (['heal','ammo'])[d[0]];
			bnO.x = d[1] / MAX8 * consts.width;
			bnO.y = d[2] / MAX8 * consts.height;
			bnO.radius = consts.bonusRadius;
			O.bonuses[i] = bnO;
		}

		for (let constName in consts)
			O[constName] = consts[constName];
		return O;
	}


	// === bot logic ===
	function isBulletDangerous(bullet, me, walls) {
	    return lineCircle(bullet, {
	        x: bullet.x + bullet.vx*20,
	        y: bullet.y + bullet.vy*20
	    }, me, 10) && can(me, bullet, walls, true);
	}

	function can(me, B, walls, isBullet) {
	    let A = me, A1, A2;
	    let angle = atan2(A.y - B.y, A.x - B.x);
	    if (!isBullet) {
	        A1 = {x: me.x + cos(angle-PI/2)*tankRadius,
	              y: me.y + sin(angle-PI/2)*tankRadius}
	        A2 = {x: me.x + cos(angle+PI/2)*tankRadius,
	              y: me.y + sin(angle+PI/2)*tankRadius}
	    }
	    for (let i = 0; i < walls.length; ++i) {
	        let wall = walls[i];
	        if (lineLine(wall[0], wall[1], A, B) ||
	            (isBullet ? false : lineLine(wall[0], wall[1], A1, B) ||
	            lineLine(wall[0], wall[1], A2, B)))
	            return false;
	    }
	    return true;
	}
	function getNearestEnemy(enemies, me, walls) {
	    if (enemies.length == 0)
	        return null;

	    let res = null, d = -1;
	    for (let i = 0; i < enemies.length; ++i) {
	        let dist = distance(enemies[i], me);
	        let canShootValue = can(me, enemies[i], walls, false);
	        if (canShootValue && (dist < d || d == -1)) {
	            d = dist;
	            res = enemies[i];
	        }
	    }
	    return res;
	}
	function getNearestBonus(bonuses, me, walls) {
	    if (bonuses.length == 0)
	        return null;

	    let res = null, d = -1;
	    for (let i = 0; i < bonuses.length; ++i) {
	        let dist = distance(bonuses[i], me);
	        if (can(me, bonuses[i], walls, false) && 
	            (dist < d || d == -1)) {
	            d = dist;
	            res = bonuses[i];
	        }
	    }
	    return res;
	}
	function getDangerousBullet(bullets, me, walls) {
	    bullets = bullets.filter(b => b.owner != me.username);

	    let res = null, minDist = -1;
	    for (let i = 0; i < bullets.length; ++i) {
	        let bullet = bullets[i];
	        let dist = distance(bullet, me);
	        if (isBulletDangerous(bullet, me, walls) && (dist < minDist || minDist == -1)) {
	            minDist = dist;
	            res = bullet;
	        }
	    }
	    return res;
	}
	function getSide(a, b, c) {
	    return ((b.x - a.x)*(c.y - a.y) - (b.y - a.y)*(c.x - a.x)) > 0;
	}

	function onTick(field) {
	    let me = field.me;
	    
	    let dangerousBullet = getDangerousBullet(field.bullets, me, field.walls);
	    let bonus = getNearestBonus(field.bonuses, me, field.walls);
	    let enemy = getNearestEnemy(field.enemies, me, field.walls);

	    let move;
	    let shoot = false;
	    if (dangerousBullet != null) {
	        let side = getSide(dangerousBullet, {
	            x: dangerousBullet.x+dangerousBullet.vx, 
	            y: dangerousBullet.y+dangerousBullet.vy},
	        me);
	        let r = 0.75;
	        let side1 = can(me, {
	            x: me.x + cos(dangerousBullet.angle+PI/2)*r,
	            y: me.y + sin(dangerousBullet.angle+PI/2)*r
	        }, field.walls, false);
	        let side2 = can(me, {
	            x: me.x + cos(dangerousBullet.angle-PI/2)*r,
	            y: me.y + sin(dangerousBullet.angle-PI/2)*r
	        }, field.walls, false);
	        let back = can(me, {
	            x: me.x + cos(dangerousBullet.angle)*r,
	            y: me.y + sin(dangerousBullet.angle)*r
	        }, field.walls, false);
	        if ((!((side && side1) || (!side && side2)))) {
	            side = !side;
	        }
	        if ((!side1 && !back) || (!back && !side2) || (!side1 && !side2) || !back)
	            shoot = true;
	        let angle = dangerousBullet.angle+(side?1:-1)*PI/2;
	        move = [
	            cos(angle),
	            sin(angle)
	        ];
	    } else if (enemy && (me.username == 'pacifist' ? distance(me, enemy) < tankRadius*20 : true)) {
	        let angle = atan2(enemy.y - me.y, enemy.x - me.x);
	        let dist = distance(me, enemy);
	        let canGoBack = can(me, {x: me.x+cos(angle-PI), y: me.y+sin(angle-PI)}, field.walls, false);
	        if ((dist < tankRadius * 10 || me.username == 'pacifist') && canGoBack) {
	            angle -= PI;
	        }
	        move = [
	            cos(angle), sin(angle)  
	        ];
	    } else if (bonus) {
	        let angle = atan2(bonus.y - me.y, bonus.x - me.x);
	        move = [
	            cos(angle), sin(angle)  
	        ];
	    } else {
	        move = [
	            cos(Date.now()/1000*PI),
	            sin(Date.now()/3000*PI)
	        ];
	    }

	    return {
	        move,
	        headAngle: enemy ? toEnemy(me, enemy) : Date.now()/1000*PI,
	        shoot: shoot || !!enemy
	    };
	}

	function toEnemy(me, enemy) {
	    return atan2(enemy.y - me.y, enemy.x - me.x);
	}

	function distance(a, b) {
	    return sqrt(pow(a.x-b.x,2)+pow(a.y-b.y,2));
	}
	function lineLine(a, b, c, d) {
	    let s1_x = b.x - a.x
	    let s1_y = b.y - a.y
	    let s2_x = d.x - c.x
	    let s2_y = d.y - c.y
	    let s = (-s1_y * (a.x - c.x) + s1_x * (a.y - c.y)) / (-s2_x * s1_y + s1_x * s2_y)
	    let t = (s2_x * (a.y - c.y) - s2_y * (a.x - c.x)) / (-s2_x * s1_y + s1_x * s2_y)
	    return s >= 0 && s <= 1 && t >= 0 && t <= 1
	}
	function lineCircle(a, b, c, rc) {
	    let ac = {x: c.x - a.x, y: c.y - a.y}
	    let ab = {x: b.x - a.x, y: b.y - a.y}
	    let ab2 = dot(ab, ab)
	    let acab = dot(ac, ab)
	    let t = acab / ab2
	    t = (t < 0) ? 0 : t
	    t = (t > 1) ? 1 : t
	    let h = {x: (ab.x * t + a.x) - c.x, y: (ab.y * t + a.y) - c.y}
	    let h2 = dot(h, h)
	    return h2 <= rc * rc
	}
	function dot(a, b) {
	    return (a.x * b.x) + (a.y * b.y)
	} 
});