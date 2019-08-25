let colors = ['red', 'blue', 'black', 'green', 'beige'];
const MAX8 = 255;
const MAX16 = 65535;

let lastField = null;
window.consts = {};
bodjo.on('connect', socket => {
	let playing = false;

	let compiledFunction = null;

	socket.on('const', _consts => {
		window.consts = _consts;
		for (let constName in _consts)
			window[constName] = _consts[constName];
	});
	socket.on('field', data => {
		lastField = parseField(data);
		if (lastField.time == 100)
			console.log(lastField)

		if (playing && lastField.me)
			turn(lastField);

		bodjo.render(lastField);
	});

	function turn(field) {
		try {
			compiledFunction = new Function(bodjo.editor.getValue())();
		} catch (e) {
			bodjo.showError(e);
			playing = false;
			compiledFunction = null;
			updatePlayingStatus();
			socket.emit('stop');
			return;
		}

		let result = null;
		try {
			result = compiledFunction(field);
		} catch (e) {
			bodjo.showError(e);
			playing = false;
			compiledFunction = null;
			updatePlayingStatus();
			socket.emit('stop');
			return;
		}

		if (typeof result !== 'object' ||
			Array.isArray(result) ||
			result == null ||
			!Array.isArray(result.move) ||
			result.move.length != 2 ||
			typeof result.move[0] !== 'number' ||
			typeof result.move[1] !== 'number' ||
			typeof result.headAngle !== 'number' ||
			typeof result.shoot === 'undefined') {
			bodjo.showError('invalid returned result');
			playing = false;
			compiledFunction = null;
			updatePlayingStatus();
			socket.emit('stop');
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
		buffView.setUint16(1, (round(headAngle / (Math.PI*2) * (Math.pow(2, 15)-1)) << 1) + (!!result.shoot-0));
		let angle = Math.atan2(result.move[1], result.move[0]);
		let speed = range(Math.sqrt(Math.pow(result.move[1], 2) + Math.pow(result.move[0], 2)), 0, 1);
		buffView.setUint16(3, angle / (Math.PI*2) * MAX16);
		buffView.setUint8(5, speed * MAX8);
		socket.emit('turn', buff);
	}

	socket.on('disconnect', function () {
		playing = false;
		updatePlayingStatus();
	});

	bodjo.controls = [
		Button('play', () => {
			if (playing) return;
			
			playing = true;
			updatePlayingStatus();
			socket.emit('start');
		}),
		Button('pause', () => {
			if (!playing) return;

			compiledFunction = null;
			playing = false;
			updatePlayingStatus();
			socket.emit('stop');
		}),
		Button('debug', () => {
			debug = !debug;
			bodjo.getControl('debug').setActive(debug);
		})
	];

	function updatePlayingStatus() {
		bodjo.getControl('play').setActive(playing);
	}
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

function point(a, color) {
    if (typeof a === 'undefined' || lastField == null)
        return;
    if (!Array.isArray(lastField._render))
        lastField._render = [];
    lastField._render.push({color: color, a: a, type: 'point'});
}
function line(a, b, color) {
    if (typeof a === 'undefined' || typeof b === 'undefined' || lastField == null)
        return;
    if (!Array.isArray(lastField._render))
        lastField._render = [];
    lastField._render.push({color: color, a: a, b: b, type: 'line'});
}
function circle(a, r, color) {
    if (typeof a === 'undefined' || lastField == null)
        return;
    if (!Array.isArray(lastField._render))
        lastField._render = [];
    lastField._render.push({color: color, a: a, r: r, type: 'circle'});
}
function text(string, a, color) {
    if (typeof a === 'undefined' || lastField == null)
        return;
    if (!Array.isArray(lastField._render))
        lastField._render = [];
    lastField._render.push({color: color, text: string, a: a, type: 'text'});
}

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