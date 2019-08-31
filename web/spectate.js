let colors = ['red', 'blue', 'black', 'green', 'beige'];
const MAX8 = 255;
const MAX16 = 65535;

let lastField = null;
window.consts = {};
bodjo.on('connect', socket => {
	socket.on('const', _consts => {
		window.consts = _consts;
		for (let constName in _consts)
			window[constName] = _consts[constName];
	});
	socket.on('field', data => {
		bodjo.callRender('', parseField(data));
	});
});

bodjo.on('scoreboard', (scoreboard) => {
	bodjo.renderScoreboard(['Place', 'Score', 'Username', 'Kills (Combo)', 'Deaths', 'KD'], 
						   scoreboard.map(player => [
						   		'<b>'+player.place+'</b>',
						   		player.score,
						   		Player(player.username),
						   		player.kills + ' (' + player.combo + ')',
						   		player.deaths,
						   		(player.kills / player.deaths).toFixed(2)
						   ])
	);
});

function parseField(data) {
	let offset = 0;
	let O = {};
	let time = new Uint32Array(data.slice(offset, offset+=4))[0];
	O.time = time;

	O.width = consts.width;
	O.height = consts.height;

	let playersCount = new Uint8Array(data.slice(offset, offset+=1))[0];
	O.players = new Array(playersCount);
	O.enemies = new Array();
	for (let i = 0; i < playersCount; ++i) {
		let pO = {};
		let d1 = new Uint8Array(data.slice(offset, offset+=8));
		let d2 = new Uint16Array(data.slice(offset, offset+=4));
		pO.id = d1[0];
		pO.username = bodjo.ids[pO.id] || '...';
		pO.color = colors[d1[1]];
		pO.vx = (d1[2] / MAX8 * 2 - 1) * consts.tankSpeed;
		pO.vy = (d1[3] / MAX8 * 2 - 1) * consts.tankSpeed;
		pO.angle = atan2(pO.vy, pO.vx);
		pO.headAngle = d1[4] / MAX8 * (Math.PI*2);
		pO.lastShot = time - d1[5];
		pO.hp = d1[6] / MAX8;
		pO.bonuses = {
			heal: (d1[7] == 1 || d1[7] == 3),
			ammo: (d1[7] == 2 || d1[7] == 3)
		};
		pO.x = d2[0] / MAX16 * consts.width;
		pO.y = d2[1] / MAX16 * consts.height;
		pO.radius = consts.tankRadius;
		O.players[i] = pO;
		if (bodjo.ids[pO.id] == bodjo.username) {
			O.me = pO;
		} else
			O.enemies.push(pO);
	}

	let bulletsCount = new Uint8Array(data.slice(offset, offset+=1))[0];
	O.bullets = new Array(bulletsCount);
	for (let i = 0; i < bulletsCount; ++i) {
		let bO = {};
		let d1 = new Uint16Array(data.slice(offset, offset+=4));
		let d2 = new Uint8Array(data.slice(offset, offset+=4));
		bO.x = d1[0] / MAX16 * consts.width;
		bO.y = d1[1] / MAX16 * consts.height;
		bO.angle = d2[0] / MAX8 * (Math.PI*2) - Math.PI;
		bO.damage = d2[1] / MAX8;
		bO.vx = Math.cos(bO.angle) * consts.bulletSpeed;
		bO.vy = Math.sin(bO.angle) * consts.bulletSpeed;
		bO.color = colors[d2[2]];
		bO.owner = bodjo.ids[d2[3]] || '...';
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
			buO.username = bodjo.ids[new Uint8Array(data.slice(offset, offset+=1))[0]] || '...';
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