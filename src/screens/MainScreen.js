(function (Ω) {

	"use strict";

	var MainScreen = Ω.Screen.extend({

		speed:  2,
		bird: null,
		pipes: null,

		score: 0,
		state: null,

		bg: 0,
		bgOffset: 0,

		sounds: {
			"point": new Ω.Sound("res/audio/sfx_point", 1),
			"hit": new Ω.Sound("res/audio/sfx_hit", 1)
		},

		shake: null,
		flash: null,

        pipeDist: 174,
        pipeGap: 114 / 2,

        buttons: null,

        m_state: {"vertical_distance":0,"horizontal_distance":0},
        m_state_dash: {"vertical_distance":0,"horizontal_distance":0},

        explore: 0.00,
        action_to_perform: "do_nothing",
        resolution: 4,
        alpha_QL: 0.7,
        vertical_dist_range: [-350,190],
        horizontal_dist_range: [0,180],
		when_to_save_Q: 0,
		
		init: function () {
			this.reset();
//			this.Q = new Array();
//			for(var vert_dist=0;vert_dist<(this.vertical_dist_range[1]-this.vertical_dist_range[0])/4;vert_dist++){
//			 	this.Q[vert_dist] = new Array();
//			 	for (var hori_dist=0; hori_dist<(this.horizontal_dist_range[1]-this.horizontal_dist_range[0])/4;hori_dist++){
//			 		this.Q[vert_dist][hori_dist] = {"click":0,"do_nothing":0};
//			 	}
//			}
//			console.log(this.Q)
			var trainQ;
			jQuery.ajaxSettings.async=false;
			jQuery.getJSON("TrainingData/10m.json",function(data){
				trainQ = data;	
			});
			this.Q = trainQ;

		},

		reset: function () {
			this.score = 0;
			var offset = Ω.env.w * 1;
			this.state = new Ω.utils.State("BORN");
			this.bird = new window.Bird(Ω.env.w * 0.24, Ω.env.h * 0.46, this);
			this.bg = Ω.utils.rand(2);
			this.bird.setColor(Ω.utils.rand(3));
			this.pipes = [
				new window.Pipe(0, "up", offset + Ω.env.w, Ω.env.h - 170, this.speed),
				new window.Pipe(0, "down", offset + Ω.env.w, - 100, this.speed),

				new window.Pipe(1, "up", offset + (Ω.env.w * 1.6), Ω.env.h - 170, this.speed),
				new window.Pipe(1, "down", offset + (Ω.env.w * 1.6), - 100, this.speed),

				new window.Pipe(2, "up", offset + (Ω.env.w * 2.2), Ω.env.h - 170, this.speed),
				new window.Pipe(2, "down", offset + (Ω.env.w * 2.2), - 100, this.speed)
			];

			this.setHeight(0);
			this.setHeight(1);
			this.setHeight(2);
		},


		tick: function () {
			this.state.tick();
			this.bird.tick();
			var valid = false;
			var reward = 0;
			switch (this.state.get()) {
				case "BORN":
					this.state.set("RUNNING");
					this.bird.state.set("CRUSING");
					break;

				case "RUNNING":
					if (this.state.first()) {
						this.bird.state.set("RUNNING");
					}
					this.tick_RUNNING();
					valid = true;
					reward = 1;
					break;

				case "DYING":
					this.state.set("GAMEOVER");
					valid = true;
					reward = -1000;
					break;

				case "GAMEOVER":
                    this.reset();
                    this.state.set("BORN")
                    break;
			}
			if (valid) {

				var horizontal_distance = 9999;
				var vertical_distance = 9999;

				for (var i = 0; i < 6; i++) {
					if (this.pipes[i].dir == "up" && this.pipes[i].x + this.pipes[i].w >= this.bird.x) {
						var diff = (this.pipes[i].x + this.pipes[i].w - this.bird.x);
						if (horizontal_distance > diff) {
							horizontal_distance = diff;//小鸟的相对横坐标，代表距离参考点的水平距离
							vertical_distance = (this.bird.y - this.pipes[i].y);//小鸟的相对纵坐标，代表距离参考点的垂直距离，正
						}
					}
				}

				this.m_state_dash.vertical_distance = vertical_distance;
				this.m_state_dash.horizontal_distance = horizontal_distance;

				//防止纵坐标越界 in case of y out of range
				var state_bin_v = 
				Math.max( 
					Math.min ( 
						Math.floor((this.vertical_dist_range[1]-this.vertical_dist_range[0]-1)/this.resolution), 
						Math.floor( (this.m_state.vertical_distance - this.vertical_dist_range[0])/this.resolution )
					), 
					0
				);
				//防止横坐标越界 in case of x out of range
				var state_bin_h = 
				Math.max( 
					Math.min ( 
						Math.floor((this.horizontal_dist_range[1]-this.horizontal_dist_range[0]-1)/this.resolution), 
						Math.floor( (this.m_state.horizontal_distance - this.horizontal_dist_range[0])/this.resolution )
					), 
					0
				);


				var state_dash_bin_v = 
				Math.max( 
					Math.min ( 
						Math.floor((this.vertical_dist_range[1]-this.vertical_dist_range[0]-1)/this.resolution), 
						Math.floor( (this.m_state_dash.vertical_distance - this.vertical_dist_range[0])/this.resolution )
					), 
					0
				);
				
				var state_dash_bin_h = 
				Math.max( 
					Math.min ( 
						Math.floor((this.horizontal_dist_range[1]-this.horizontal_dist_range[0]-1)/this.resolution), 
						Math.floor( (this.m_state_dash.horizontal_distance - this.horizontal_dist_range[0])/this.resolution )
					), 
					0
				);

				var click_v = this.Q[state_dash_bin_v][state_dash_bin_h]["click"];
				var do_nothing_v = this.Q[state_dash_bin_v][state_dash_bin_h]["do_nothing"]
				var V_s_dash_a_dash = Math.max(click_v, do_nothing_v);

				var Q_s_a = this.Q[state_bin_v][state_bin_h][this.action_to_perform];
				this.Q[state_bin_v][state_bin_h][this.action_to_perform] = 
					Q_s_a + this.alpha_QL * (reward + V_s_dash_a_dash - Q_s_a);

				this.m_state = clone(this.m_state_dash);

				if (Math.random() < this.explore) {
					this.action_to_perform = Ω.utils.rand(2) == 0 ? "click" : "do_nothing";
				}
				else {
					var state_bin_v = 
					Math.max( 
						Math.min ( 
							Math.floor((this.vertical_dist_range[1]-this.vertical_dist_range[0]-1)/this.resolution), 
							Math.floor( (this.m_state.vertical_distance - this.vertical_dist_range[0])/this.resolution )
						), 
						0
					);
					
					var state_bin_h = 
					Math.max( 
						Math.min ( 
							Math.floor((this.horizontal_dist_range[1]-this.horizontal_dist_range[0]-1)/this.resolution), 
							Math.floor( (this.m_state.horizontal_distance - this.horizontal_dist_range[0])/this.resolution )
						), 
						0
					);

					var click_v = this.Q[state_bin_v][state_bin_h]["click"];
					var do_nothing_v = this.Q[state_bin_v][state_bin_h]["do_nothing"]
					this.action_to_perform = click_v > do_nothing_v ? "click" : "do_nothing";
				}


				if (this.action_to_perform == "click") {
					this.bird.performJump();
				}
				
				this.when_to_save_Q += 1;
				if(this.when_to_save_Q == 50 * 600){ // 50 是1s
					this.when_to_save_Q = 0;
					var data = JSON.stringify(this.Q);
					//var blob = new Blob([data], {type: "text/plain;charset=utf-8"});
					//saveAs(blob, "hello world.txt");
					downloadFile("test",data);
				}
			}
			


			if (this.shake && !this.shake.tick()) {
				this.shake = null;
			}
			if (this.flash && !this.flash.tick()) {
				this.flash = null;
			}

		},

		tick_RUNNING: function () {

			this.moveLand();

			this.pipes = this.pipes.filter(function (p) {
				p.tick();
				if (!p.counted && p.x < this.bird.x) {
					p.counted = true;
					this.score += 0.5;
					this.sounds.point.play();
				}

				if (p.reset) {
					this.setHeight(p.group);
				}
				return true;
			}, this);

			Ω.Physics.checkCollision(this.bird, this.pipes);
		},

		moveLand: function () {
			this.bgOffset -= this.speed;
			if (this.bgOffset < -Ω.env.w) {
				this.bgOffset += Ω.env.w;
			}
		},

		setHeight: function (group) {
			var h = (Math.random() * 160 | 0) + 130;
			this.pipes.filter(function (p) {
				return p.group === group;
			}).forEach(function (p) {
				p.y = p.dir == "up" ? h + 65 : h - p.h - 65;
			});
		},

		render: function (gfx) {
			var atlas = window.game.atlas;

			gfx.ctx.save();

			this.shake && this.shake.render(gfx);

			this.renderBG(gfx, atlas);

			this.renderGame(gfx, atlas);

			switch (this.state.get()) {
				case "GETREADY":
					this.renderGetReady(gfx, atlas);
					this.renderFG(gfx, atlas);
					break;
				case "GAMEOVER":
					this.renderFG(gfx, atlas);
					this.renderGameOver(gfx, atlas);
					break;
				case "RUNNING":
					this.renderRunning(gfx, atlas);
					this.renderFG(gfx, atlas);
					break;
				default:
					this.renderFG(gfx, atlas);
					break;
			}


			gfx.ctx.restore();

			this.flash && this.flash.render(gfx);

		},

		renderBG: function (gfx, atlas) {
			atlas.render(gfx, "bg_" + (this.bg === 1 ? "night" : "day"), 0, 0);
		},

		renderGame: function (gfx) {
			this.pipes.forEach(function (p) {
				p.render(gfx);
			});
			this.bird.render(gfx);
		},

		renderFG: function (gfx, atlas) {
			atlas.render(gfx, "land", this.bgOffset, gfx.h - 112);
			atlas.render(gfx, "land", Ω.env.w + this.bgOffset, gfx.h - 112);
		},

		renderRunning: function (gfx, atlas) {
			if (this.state.count < 30) {
				gfx.ctx.globalAlpha = 1 - (this.state.count / 30);
				this.renderGetReady(gfx, atlas);
				gfx.ctx.globalAlpha = 1;
			}
			this.renderScore(gfx, atlas);
		},

		renderGameOver: function (gfx, atlas) {

			var count = this.state.count,
				yOff;

			if (count > 20) {
				yOff = Math.min(5, count - 20);
				atlas.render(gfx, "text_game_over", 40, gfx.h * 0.24 + yOff);
			}

			if (count > 70) {
				yOff = Math.max(0, 330 - (count - 70) * 20);
				atlas.render(gfx, "score_panel", 24, gfx.h * 0.38 + yOff);
				var sc = this.score + "",
					right = 218;
				for (var i = 0; i < sc.length; i++) {
					atlas.render(gfx, "number_score_0" + sc[sc.length - i - 1], right - i * 16, 231 + yOff);
				}

				sc = window.game.best + "";
				for (i = 0; i < sc.length; i++) {
					atlas.render(gfx, "number_score_0" + sc[sc.length - i - 1], right - i * 16, 272 + yOff);
				}

				var medal = "";
				if (this.score >= 5) medal = "3";
				if (this.score >= 10) medal = "2";
				if (this.score >= 20) medal = "1";
				if (this.score >= 30) medal = "0";
				if (medal) {
					atlas.render(gfx, "medals_" + medal, 55, 240 + yOff);
				}
			}

			if (count > 100) {
				atlas.render(gfx, "button_play", 20, gfx.h - 172);
				atlas.render(gfx, "button_score", 152, gfx.h - 172);
			}
		},

		renderGetReady: function (gfx, atlas) {
			//atlas.render(gfx, "text_ready", 46, gfx.h * 0.285);
			//atlas.render(gfx, "tutorial", 88, gfx.h * 0.425);

			this.renderScore(gfx, atlas);
		},

		renderScore: function (gfx, atlas) {
			var sc = this.score + "";
			for (var i = 0; i < sc.length; i++) {
				atlas.render(gfx, "font_0" + (48 + parseInt(sc[i], 10)), i * 18 + 130, gfx.h * 0.16);
			}
		}
	});

	window.MainScreen = MainScreen;

}(window.Ω));

function clone(obj){
	if(null == obj || "object" != typeof obj) return obj;
	var copy = obj.constructor();
	for(var attr in obj){
		if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
	}
	return copy;
}

function downloadFile(fileName, content){
    var uri = URL.createObjectURL(new Blob([content]));
	window.open (uri, "newwindow", "height=600, width=900");
}

var saveAs=saveAs||function(e){"use strict";if(typeof e==="undefined"||typeof navigator!=="undefined"&&/MSIE [1-9]\./.test(navigator.userAgent)){return}var t=e.document,n=function(){return e.URL||e.webkitURL||e},r=t.createElementNS("http://www.w3.org/1999/xhtml","a"),o="download"in r,a=function(e){var t=new MouseEvent("click");e.dispatchEvent(t)},i=/constructor/i.test(e.HTMLElement)||e.safari,f=/CriOS\/[\d]+/.test(navigator.userAgent),u=function(t){(e.setImmediate||e.setTimeout)(function(){throw t},0)},s="application/octet-stream",d=1e3*40,c=function(e){var t=function(){if(typeof e==="string"){n().revokeObjectURL(e)}else{e.remove()}};setTimeout(t,d)},l=function(e,t,n){t=[].concat(t);var r=t.length;while(r--){var o=e["on"+t[r]];if(typeof o==="function"){try{o.call(e,n||e)}catch(a){u(a)}}}},p=function(e){if(/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(e.type)){return new Blob([String.fromCharCode(65279),e],{type:e.type})}return e},v=function(t,u,d){if(!d){t=p(t)}var v=this,w=t.type,m=w===s,y,h=function(){l(v,"writestart progress write writeend".split(" "))},S=function(){if((f||m&&i)&&e.FileReader){var r=new FileReader;r.onloadend=function(){var t=f?r.result:r.result.replace(/^data:[^;]*;/,"data:attachment/file;");var n=e.open(t,"_blank");if(!n)e.location.href=t;t=undefined;v.readyState=v.DONE;h()};r.readAsDataURL(t);v.readyState=v.INIT;return}if(!y){y=n().createObjectURL(t)}if(m){e.location.href=y}else{var o=e.open(y,"_blank");if(!o){e.location.href=y}}v.readyState=v.DONE;h();c(y)};v.readyState=v.INIT;if(o){y=n().createObjectURL(t);setTimeout(function(){r.href=y;r.download=u;a(r);h();c(y);v.readyState=v.DONE});return}S()},w=v.prototype,m=function(e,t,n){return new v(e,t||e.name||"download",n)};if(typeof navigator!=="undefined"&&navigator.msSaveOrOpenBlob){return function(e,t,n){t=t||e.name||"download";if(!n){e=p(e)}return navigator.msSaveOrOpenBlob(e,t)}}w.abort=function(){};w.readyState=w.INIT=0;w.WRITING=1;w.DONE=2;w.error=w.onwritestart=w.onprogress=w.onwrite=w.onabort=w.onerror=w.onwriteend=null;return m}(typeof self!=="undefined"&&self||typeof window!=="undefined"&&window||this.content);if(typeof module!=="undefined"&&module.exports){module.exports.saveAs=saveAs}else if(typeof define!=="undefined"&&define!==null&&define.amd!==null){define("FileSaver.js",function(){return saveAs})}