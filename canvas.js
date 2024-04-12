const MAX_PARTICLE_COUNT = 100; // orange
const MAX_TRAIL_COUNT = 32; // blue

const colorScheme = ["#E69F66", "#DF843A", "#D8690F", "#B1560D", "#8A430A"]; // orange colors

let vertShader = `
	precision highp float;
	attribute vec3 aPosition;

	void main() {
		vec4 positionVec4 = vec4(aPosition, 1.0);
		positionVec4.xy = aPosition.xy * 2.0 - 1.0;
		gl_Position = positionVec4;
	}
`;

let fragShader = `
	precision highp float;
	
	uniform vec2 resolution;
	uniform int trailCount;
	uniform vec2 trail[${MAX_TRAIL_COUNT}];
	uniform int particleCount;
	uniform vec3 particles[${MAX_PARTICLE_COUNT}];
	uniform vec3 colors[${MAX_PARTICLE_COUNT}];

	void main() {
        vec2 st = gl_FragCoord.xy / resolution.xy;
        float canvasAspectRatio = resolution.x / resolution.y;

        if (canvasAspectRatio > 1.0) {
            st.x = (st.x - 0.5) * canvasAspectRatio + 0.5;
        } else {
            st.y = (st.y - 0.5) / canvasAspectRatio + 0.5;
        }
        
        float r = 0.0;
        float g = 0.0;
        float b = 0.0;

        for (int i = 0; i < ${MAX_TRAIL_COUNT}; i++) {
            if (i < trailCount) {
                vec2 trailPos = trail[i];
                vec2 adjustedTrailPos = trailPos;

                if (canvasAspectRatio > 1.0) {
                    adjustedTrailPos.x = (adjustedTrailPos.x - 0.5) * canvasAspectRatio + 0.5;
                } else {
                    adjustedTrailPos.y = (adjustedTrailPos.y - 0.5) / canvasAspectRatio + 0.5;
                }

                float value = float(i) / distance(st, adjustedTrailPos.xy) * 0.00015;
                g += value * 0.5;
                b += value;
            }
        }

        float mult = 0.00005;

        for (int i = 0; i < ${MAX_PARTICLE_COUNT}; i++) {
            if (i < particleCount) {
                vec3 particle = particles[i];
                vec2 pos = particle.xy;
                vec2 adjustedPos = pos;
    
                if (canvasAspectRatio > 1.0) {
                    adjustedPos.x = (adjustedPos.x - 0.5) * canvasAspectRatio + 0.5;
                } else {
                    adjustedPos.y = (adjustedPos.y - 0.5) / canvasAspectRatio + 0.5;
                }
    
                float mass = particle.z;
                vec3 color = colors[i];
    
                r += color.r / distance(st, adjustedPos) * mult * mass;
                g += color.g / distance(st, adjustedPos) * mult * mass;
                b += color.b / distance(st, adjustedPos) * mult * mass;
            }
        }
    
        gl_FragColor = vec4(r, g, b, 1.0);
	}
`;


class Particle {
	constructor(x, y, vx, vy) {
		this.pos = createVector(x, y);
		this.vel = createVector(vx, vy).mult(random(10)).rotate(radians(random(-25, 25)));
		this.mass = random(1, 20);
		this.airDrag = random(0.92, 0.98);
		this.colorIndex = int(random(colorScheme.length));

		this.initialHue = random(360); // Initial hue value (0-360)
        this.currentHue = this.initialHue; // Current hue value
	}

	move() {
		this.vel.mult(this.airDrag);
		this.pos.add(this.vel);

		// Update the current hue based on time
		this.currentHue = (this.initialHue + frameCount) % 360;
	}
}

let canvas;
let shaderTexture;
let theShader;
let trail = [];
let particles = [];
let canvasAspectRatio;
let initialWidth;
let initialHeight;



function preload() {
	theShader = new p5.Shader(this.renderer, vertShader, fragShader);
}


function setup() {
	const myCanvas = document.getElementById('myCanvas');
	initialWidth = windowWidth;
	initialHeight = windowHeight;
	initialdeviceOrientation = deviceOrientation;
	console.log(`initialWidth = ${initialWidth}`);
	console.log(`initialHeight = ${initialHeight}`);
	pixelDensity(1);
	// если экран горизонтальный, то создаёт канвас размером с экран
	// если экран вертикальный (как на смартфонах), то создается квадратный канвас
	// (это необходимо чтобы при повороте экрана смартфона в горизонтальный режим, 
	// канвас не становился гигантским и не отображающем эффекты)
	
	if (min(initialHeight, initialWidth) <= '700') {
		canvasAspectRatio = 1;
		canvas= createCanvas(
			max(windowWidth, windowHeight),
			max(windowWidth, windowHeight),
			WEBGL,
			myCanvas);
	} else {
		canvasAspectRatio = windowWidth / windowHeight;
		canvas= createCanvas(
			windowWidth,
			windowHeight,
			WEBGL,
			myCanvas);
	}
	// oncontextmenu = () => false;
	noCursor();

	shaderTexture = createGraphics(width, height, WEBGL);
	shaderTexture.noStroke();
}


function draw() {
	background(0);
	noStroke();
	
	// Trim end of trail.
	trail.push([mouseX, mouseY]);
	
	let removeCount = 1;

	for (let i = 0; i < removeCount; i++) {
		if (trail.length == 0) {
			break;
		}

		if (trail.length > MAX_TRAIL_COUNT) {
			trail.splice(0, 1);
		}
	}

	// Spawn particles.
	if (trail.length > 1 && particles.length < MAX_PARTICLE_COUNT) {
		let mouse = createVector(mouseX - pmouseX, mouseY - pmouseY);
		if (mouse.mag() > 10) {
			mouse.normalize();
			particles.push(new Particle(pmouseX, pmouseY, mouse.x, mouse.y));
		}
	}

	// Move and kill particles.
	for (let i = particles.length - 1; i > -1; i--) {
		particles[i].move();
		if (particles[i].vel.mag() < 0.1) {
			particles.splice(i, 1);
		}
	}

	shaderTexture.shader(theShader);

	let data = serializeSketch();

	theShader.setUniform("resolution", [width, height]);
	theShader.setUniform("trailCount", trail.length);
	theShader.setUniform("trail", data.trails);
	theShader.setUniform("particleCount", particles.length);
	theShader.setUniform("particles", data.particles);
	theShader.setUniform("colors", data.colors);

	shaderTexture.rect(0, 0, width, height);
	texture(shaderTexture);
	rect(-width/2, -height/2, width, height);
}





let huemue = 0;
function serializeSketch() {
	let data = {
		"trails": [],
		"particles": [],
		"colors": []
	};
	huemue = huemue + 1
	if (huemue >= 360 ) {
		huemue = 0;
	}
	for (let i = 0; i < trail.length; i++) {
		data.trails.push(
			trail[i][0] / width,  // Нормализация координат следов
			1.0 - trail[i][1] / height);  // Инверсия, так как y в шейдере идет от 0 до 1 вниз
	}

	for (let i = 0; i < particles.length; i++) {
		data.particles.push(
			particles[i].pos.x / width,
			1.0 - particles[i].pos.y / height,
			particles[i].mass * particles[i].vel.mag() / 100);
		// Calculate the color based on the currentHue value
        let itsColor = color(`hsl(${huemue}, 90%, 70%)`);
        data.colors.push(red(itsColor), green(itsColor), blue(itsColor));
	}

	return data;
}


let newWidth;
let newHeight;
let scale;
let scaleX;
let scaleY;


windowResized = () => {
	newWidth = windowWidth;
	newHeight = windowHeight;
	scaleX = newWidth / initialWidth;
	scaleY = newHeight / initialHeight;
	scale  = Math.max(scaleX, scaleY);

	console.log(`scale = ${scale}`);
	console.log(`newWidth = ${newWidth}`);
	console.log(`newHeight = ${newHeight}`);

		// Если смартфон	
	if (min(initialHeight, initialWidth) <= '700') {
		if (newHeight > initialHeight || newWidth > initialHeight) {
			resizeCanvas(initialHeight * scale, initialHeight * scale);
		}
	}
	else { // Если ПК
		if (newHeight > initialHeight || newWidth > initialWidth) {
			resizeCanvas(initialWidth * scale, initialHeight * scale);
		}
	}
	theShader.setUniform("resolution", [width, height]); // Update the resolution uniform in the shader
    canvasAspectRatio = width / height; // Update the canvas aspect ratio
}