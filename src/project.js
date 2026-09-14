//THEMISTOKLIS KOUTSOURIS - TUC - GRAPHICS COURSE - BLOXORZ IMPLEMENTED WITH WEBGL
import vertexShaderSource from './shaders/cube.vert?raw';
import fragmentShaderSource from './shaders/cube.frag?raw';
import { glob as game } from './state';
import { beginLevel, startLoop, stopLoop, saveCurrentGame, MOVE_FRAMES } from './loop';
import { loadGame, getTopScore, setTopScore } from './save';
import { play } from './audio';
import { m4 } from './m4';

var glob={};//webGL state: context, shader program, buffers, textures, matrices
glob.gl=null;//webGl context, every call to the state machine will be done through this variable
glob.shaderProgram=null;
glob.mvMatrix=m4.create();//ModelView and Projection matrices
glob.mvMatrixStack=[];
glob.pMatrix=m4.create();
glob.cubeVertexPosBuf=null; //contains coordinates
glob.cubeVertexColorBuf=null; //contains color per vertex
glob.cubeVertexIndexBuf=null; //contains indices for chains of vertices to draw triangles/other geometry

var textureCoordAttribute,cubeVerticesTextureCoordBuffer;
var starting=false;	//true from a start request until the level runs, so a double Enter can't start two loops


//binds the menu handlers, once
export function initUI(){
	var promptArr=document.getElementsByClassName("prompt");
	for(var i=promptArr.length;i--;){
		promptArr[i].addEventListener("pointerdown",startFromMenu);
	}
	window.addEventListener("resize",function(){ if(glob.gl)resizeCanvas(); });
}

//manipulates the web page
export function pageUI(result){
	document.getElementById("c").style.display="none";
	document.getElementById("help").style.display="block";
	if(result===-1){	//if game lost
		document.getElementById("promptLose").style.display="block";
	}else if(loadGame()){
		document.getElementById("promptCont").style.display="block";//if game was stopped
	}else{
		document.getElementById("promptPlay").style.display="block";
	}
	refreshScore();
}

export function startFromMenu(){
	if(starting)return;
	starting=true;
	var promptArr=document.getElementsByClassName("prompt");
	for(var i=promptArr.length;i--;){
		promptArr[i].style.transform='scale(200)';
	}
	document.getElementById("help").style.opacity=0;
	window.setTimeout(webGLStart,500);
}

export function isPlaying(){
	return game.lvl!==null&&game.canvas.style.display!=="none";
}

//Escape: back to the menu, CONTINUE resumes from the last resting position
export function pause(){
	if(game.newGame!==-1||game.wonGame!==-1||game.lostGame!==-1)return;
	if(game.count===-1)saveCurrentGame();
	stopLoop();
	game.canvas.style.display="none";
	document.getElementById("help").style.display="block";
	document.getElementById("promptCont").style.display="block";
	game.startTime=null;
	game.lvl=null;
}

//[Q] : changes quality
export function changeQuality(){
	if(game.glQuality>2){
		game.glQuality=1;
		popup("Quality up");
	}else{
		game.glQuality=game.glQuality+0.34;
		popup("Quality down");
	}
	resizeCanvas();
}

//0~9 : changes volume
export function setVolume(digit){
	var vol=game.volume,next=digit/10;
	if(vol!==next){
		if(digit===0)popup("Volume down (mute)");
		else if(digit===9)popup("Volume up (max)");
		else popup((vol>next?"Volume down (":"Volume up (")+digit+")");
	}
	game.volume=next;
}

//starts the webGL game
export function webGLStart(){
	initGL();
	initShaders();
	initBuffers();
	initTextures();
	window.setTimeout(function(){
		var min,max,gl=glob.gl,save=loadGame();
		gl.clearColor(0.0, 0.0, 0.0, 0.0);//Background Color: Color assigned for all pixels with no corresponding fragments
		gl.enable(gl.DEPTH_TEST);//Enable z-buffer for depth sorting
		if(save){	//if game was stopped
			game.score=save.score;
			game.topScoreShown=save.topScoreShown;
			beginLevel(save.lvl,save.heroPos);
		}else{//else loads a new randomly generated level (size is partially determined by score thus far)
			max=Math.floor((game.score/5)+5)*2;
			min=Math.floor((game.score/5)+5);
			beginLevel(randomLevelGenerator((Math.floor(Math.random()*(max-min+1))+min), (Math.floor(Math.random()*(max-min+1))+min)),null);
		}
		game.randEffect=Math.floor(Math.random()*4);	//create a random effect for loading the level
		resizeCanvas();
		scoreCheck();	//checks if time bonus / top score apply
		starting=false;
		startLoop();
	},250);
}

//check and update the player's score
function scoreCheck(){
	var currTime=Date.now();	//if quick enough, add extra point
	if(game.startTime&&game.lvl&&(currTime-game.startTime)/1000<(3+game.lvl.length+game.lvl[0].length)/3){
		play("score");
		var glassImg=document.getElementById("glass").style;
		glassImg.display='block';
		glassImg.opacity=1;
		var promptTimeStyle=document.getElementById("promptTime").style;
		promptTimeStyle.display='block';
		window.setTimeout(function(){	//show fast prompt & play sound, wait 0.5 sec, scale up, wait 0.5 sec, reset prompt
			glassImg.opacity=0;
			promptTimeStyle.transform='scale(1)';
			promptTimeStyle.bottom='0.2em';
			promptTimeStyle.left='0.4em';
			window.setTimeout(function(){
				game.score++;
				resetPrompt();
				refreshScore();
			},600);	//wait, reset prompts and check for top score
		},500);
	}else{
		refreshScore();	//else check for top score and update
	}
	game.startTime=Date.now();	//time restarts
}


//Refreshes score
function refreshScore(){
	var topScore=getTopScore();
	if(!game.topScoreShown&&topScore<=game.score-1){	//if top score surpassed, show top score prompt
		play("score");
		game.topScoreShown=true;
		var glassImg=document.getElementById("glass").style;
		glassImg.display='block';
		glassImg.opacity=1;
		var promptTopStyle=document.getElementById("promptTop").style;
		promptTopStyle.display='block';
		window.setTimeout(function(){	//show top score & play sound, wait 0.5 sec, scale up, wait 0.5 sec, reset prompt
			glassImg.opacity=0;
			promptTopStyle.transform='scale(1)';
			promptTopStyle.bottom='0.2em';
			promptTopStyle.left='0.4em';
			window.setTimeout(function(){
				resetPrompt();
			},600);
		},500);
	}
	if(topScore<game.score){	//if current score superior, make changes to top score
		topScore=game.score;
		setTopScore(topScore);
	}
	if(game.canvas.style.display=="none"||game.topScoreShown){
		document.getElementById("score").textContent="TOP SCORE: "+topScore;
	}else{
		document.getElementById("score").textContent="SCORE: "+game.score;
	}
}


//reset and hide prompts
function resetPrompt(){
	var glassImg=document.getElementById("glass").style;
	glassImg.display='none';
	glassImg.opacity=1;
	var promptArr=document.getElementsByClassName("prompt");
	for(var i=promptArr.length;i--;){
		promptArr[i].style.display="none";
		promptArr[i].style.transform='scale(1.9)';
	}
	promptArr=document.getElementsByClassName("scorePrompt");
	for(var i=promptArr.length;i--;){
		promptArr[i].style.display="none";
		promptArr[i].style.transform='scale(4)';
		promptArr[i].style.bottom='50%';
		promptArr[i].style.left='20%';
	}
	document.getElementById("help").style.opacity="0.5";
}

//Initialize WebGL
function initGL(){
	var canvas=game.canvas;
	resetPrompt();
	glob.gl=canvas.getContext("webgl");
	if(!glob.gl){
		alert("Browser does not support webGL");
		return null;
	}
	canvas.style.display="block";
	document.getElementById("help").style.display="none";
}

//canvas resolution = window size divided by the quality setting; CSS stretches it back to full size
function resizeCanvas(){
	var canvas=game.canvas;
	canvas.width=Math.round(window.innerWidth/game.glQuality);
	canvas.height=Math.round(window.innerHeight/game.glQuality);
}

//deploy imformation popup
function popup(text){
	var pop=document.getElementById("popup"),popStyle=pop.style,wait,canvas=game.canvas;
	popStyle.opacity>0?wait=1000:wait=0;//if popup deployed already, wait
	window.setTimeout(function(){
		if(canvas.style.display!=="none"&&popStyle.display!=="block"){
			popStyle.display="block";	//show popup to let user know of the change
			pop.textContent=text;
			window.setTimeout(function(){
				popStyle.opacity=0.5;
				window.setTimeout(function(){
					popStyle.opacity=0;
					window.setTimeout(function(){
						popStyle.display="none";
						pop.textContent="";
					},300);
				},1000);
			},10);
		}
	},wait);
}


//Creates a program from a vertex + fragment shader pair
function initShaders(){
	var local=glob,gl=local.gl,fragmentShader=compileShader(gl,gl.FRAGMENT_SHADER,fragmentShaderSource), vertexShader=compileShader(gl,gl.VERTEX_SHADER,vertexShaderSource);
	glob.shaderProgram = gl.createProgram();
	var shProgram=glob.shaderProgram;
	gl.attachShader(shProgram, vertexShader);
	gl.attachShader(shProgram, fragmentShader);
	gl.linkProgram(shProgram);	//link the compiled binaries
	if(!gl.getProgramParameter(shProgram, gl.LINK_STATUS)) {	//check for errors
		console.log("Could not initialise shaders");
		return null;
	}
	gl.useProgram(shProgram);//activate current program. This sandbox has only on shader pair, many are possible
	//Update attributes for the vertex shader
	//attrs are accessible only from vertex shader, use uniforms or varyings to forward to fragment shader
	shProgram.vertexPositionAttribute = gl.getAttribLocation(shProgram,"aVertexPosition");//Vertex position data
	gl.enableVertexAttribArray(shProgram.vertexPositionAttribute);
	shProgram.vertexColorAttribute = gl.getAttribLocation(shProgram,"aVertexColor");//Vertex color data
	gl.enableVertexAttribArray(shProgram.vertexColorAttribute);
	textureCoordAttribute = gl.getAttribLocation(shProgram, "aTextureCoord");
	gl.enableVertexAttribArray(textureCoordAttribute);
	
	shProgram.pMatrixUniform = gl.getUniformLocation(shProgram,"uPMatrix");//Update uniform variables (accessed from both vertex & fragment shader)
	shProgram.mvMatrixUniform = gl.getUniformLocation(shProgram,"uMVMatrix");
}


//Compile a shader of the given type (vertex or fragment) from GLSL source
function compileShader(gl,type,source){
	var shader=gl.createShader(type);
	gl.shaderSource(shader, source);	//give code and ask WebGL to compile shader
	gl.compileShader(shader);
	if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){	//check for errors
		console.log("Shader compilation error:\n"+gl.getShaderInfoLog(shader));
		return null;
	}
	return shader;
}

//Initialize vertices, indices and colors
function initBuffers(){
	var gl=glob.gl;
	glob.cubeVertexPosBuf = gl.createBuffer();	//Vertex Buffer Object
	gl.bindBuffer(gl.ARRAY_BUFFER, glob.cubeVertexPosBuf);	//Bind buffer to ARRAY_BUFFER
	var vertices=[
		-1.0, -1.0,  1.0,	//00	Front face (cel shaded outline)
		 1.0, -1.0,  1.0,	//01
		 1.0,  1.0,  1.0,	//02
		-1.0,  1.0,  1.0,	//03
		-0.95, -0.95,  1.0,	//04
		 0.95, -0.95,  1.0,	//05
		 0.95,  0.95,  1.0,	//06
		-0.95,  0.95,  1.0,	//07
		-0.95, -0.95,  1.0,	//08	Front inner face (for textures)
		 0.95, -0.95,  1.0,	//09
		 0.95,  0.95,  1.0,	//10
		-0.95,  0.95,  1.0,	//11
		
		-1.0, -1.0, -1.0,	//12	Back face (cel shaded outline)
		 1.0, -1.0, -1.0,	//13
		 1.0,  1.0, -1.0,	//14
		-1.0,  1.0, -1.0,	//15
		-0.95, -0.95, -1.0,	//16
		 0.95, -0.95, -1.0,	//17
	 	 0.95,  0.95, -1.0,	//18
		-0.95,  0.95, -1.0,	//19
		-0.95, -0.95, -1.0,	//20	Back inner face (for textures)
		 0.95, -0.95, -1.0,	//21
		 0.95,  0.95, -1.0,	//22
		-0.95,  0.95, -1.0,	//23
		
		-1.0,  1.0, -1.0,	//24	Top face (cel shaded outline)
		 1.0,  1.0, -1.0,	//25
		 1.0,  1.0,  1.0,	//26
		-1.0,  1.0,  1.0,	//27
		-0.95,  1.0, -0.95,	//28
		 0.95,  1.0, -0.95,	//29
		 0.95,  1.0,  0.95,	//30
		-0.95,  1.0,  0.95,	//31
		-0.95,  1.0, -0.95,	//32	Top inner face (for textures)
		 0.95,  1.0, -0.95,	//33
		 0.95,  1.0,  0.95,	//34
		-0.95,  1.0,  0.95,	//35
		
		-1.0, -1.0, -1.0,	//36	Bottom face (cel shaded outline)
		 1.0, -1.0, -1.0,	//37
		 1.0, -1.0,  1.0,	//38
		-1.0, -1.0,  1.0,	//39
		-0.95, -1.0, -0.95,	//40
		 0.95, -1.0, -0.95,	//41
		 0.95, -1.0,  0.95,	//42
		-0.95, -1.0,  0.95,	//43
		-0.95, -1.0, -0.95,	//44	Bottom inner face (for textures)
		 0.95, -1.0, -0.95,	//45
		 0.95, -1.0,  0.95,	//46
		-0.95, -1.0,  0.95,	//47
		
		 1.0, -1.0, -1.0,	//48	Right face (cel shaded outline)
		 1.0,  1.0, -1.0,	//49
		 1.0,  1.0,  1.0,	//50
		 1.0, -1.0,  1.0,	//51
		 1.0, -0.95, -0.95,	//52
		 1.0,  0.95, -0.95,	//53
		 1.0,  0.95,  0.95,	//54
		 1.0, -0.95,  0.95,	//55
		 1.0, -0.95, -0.95,	//56	Right inner face (for textures)
		 1.0,  0.95, -0.95,	//57
		 1.0,  0.95,  0.95,	//58
		 1.0, -0.95,  0.95,	//59
		 
		-1.0, -1.0, -1.0,	//60	Left face (cel shaded outline)
		-1.0,  1.0, -1.0,	//61
		-1.0,  1.0,  1.0,	//62
		-1.0, -1.0,  1.0,	//63
		-1.0, -0.95, -0.95,	//64
		-1.0,  0.95, -0.95,	//65
		-1.0,  0.95,  0.95,	//66
		-1.0, -0.95,  0.95,	//67
		-1.0, -0.95, -0.95,	//68	Left inner face (for textures)
		-1.0,  0.95, -0.95,	//69
		-1.0,  0.95,  0.95,	//70
		-1.0, -0.95,  0.95];//71

	gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
	glob.cubeVertexPosBuf.itemSize=3;	//every item has 3 coordinates (x,y,z)
	glob.cubeVertexPosBuf.numItems=72;	//we have 72 vertices
	
	
	glob.cubeVertexColorBuf=gl.createBuffer();	//Color
	gl.bindBuffer(gl.ARRAY_BUFFER, glob.cubeVertexColorBuf);
	var colors=[
		[1.0, 1.0, 1.0, 1.0],	//white mask
		[0.25, 0.25, 0.25, 1.0]];	//Black mask
	var unpackedColors=[];
	for (var j=glob.cubeVertexPosBuf.numItems;j;){	//unpack colors for each vertex
		for (var i=8;i--;){	//Applying black mask
			unpackedColors = unpackedColors.concat(colors[1]);
			j--;
		}
		for (var i=4;i--;){	//Applying white mask
			unpackedColors = unpackedColors.concat(colors[0]);
			j--;
		}
	}
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(unpackedColors), gl.STATIC_DRAW);
	glob.cubeVertexColorBuf.itemSize = 4;	//rgba contains 4 values
	glob.cubeVertexColorBuf.numItems = 72;	//72 color values - we have 72 vertices to color

	cubeVerticesTextureCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer);
	var textureCoordinates = [
		0.0,0.0,  0.0,0.0,  0.0,0.0,  0.0,0.0,  
		0.0,0.0,  0.0,0.0,  0.0,0.0,  0.0,0.0,
		0.0,  0.0,  //Front
		1.0,  0.0,
		1.0,  1.0,
		0.0,  1.0,
		
		0.0,0.0,  0.0,0.0,  0.0,0.0,  0.0,0.0,
		0.0,0.0,  0.0,0.0,  0.0,0.0,  0.0,0.0,
		0.0,  0.0,  //Back
		1.0,  0.0,
		1.0,  1.0,
		0.0,  1.0,
		
		0.0,0.0,  0.0,0.0,  0.0,0.0,  0.0,0.0,
		0.0,0.0,  0.0,0.0,  0.0,0.0,  0.0,0.0,
		0.0,  0.0,  //Top
		1.0,  0.0,
		1.0,  1.0,
		0.0,  1.0,
		
		0.0,0.0,  0.0,0.0,  0.0,0.0,  0.0,0.0,
		0.0,0.0,  0.0,0.0,  0.0,0.0,  0.0,0.0,
		0.0,  0.0,  //Bottom
		1.0,  0.0,
		1.0,  1.0,
		0.0,  1.0,
		
		0.0,0.0,  0.0,0.0,  0.0,0.0,  0.0,0.0,
		0.0,0.0,  0.0,0.0,  0.0,0.0,  0.0,0.0,
		0.0,  0.0,  //Right
		1.0,  0.0,
		1.0,  1.0,
		0.0,  1.0,
		
		0.0,0.0,  0.0,0.0,  0.0,0.0,  0.0,0.0,
		0.0,0.0,  0.0,0.0,  0.0,0.0,  0.0,0.0,
		0.0,  0.0,  //Left
		1.0,  0.0,
		1.0,  1.0,
		0.0,  1.0];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates),gl.STATIC_DRAW); //in mozilla, WebGLFloatArray instead of Float32Array
	
	
	glob.cubeVertexIndexBuf = gl.createBuffer();	//Index Buffer Object, joins sets of vertices into faces
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glob.cubeVertexIndexBuf);
	var cubeVertexIndices=[	//this numbers are positions in the VBO array above
	 0,  1,  4,	//Front outer face
	 0,  3,  4,
	 3,  4,  7,
	 2,  3,  7,
	 2,  6,  7,
	 1,  2,  6,
	 1,  5,  6,
	 1,  4,  5,
	 8,  9, 11,	//Front inner face
	 9, 10, 11,
	 
	12, 13, 16,	//Back outer face
	12, 15, 16,
	15, 16, 19,
	14, 15, 19,
	14, 18, 19,
	13, 14, 18,
	13, 17, 18,
	13, 16, 17,
	20, 21, 23,	//Back inner face
	21, 22, 23,
	
	24, 25, 28,	//Top outer face
	24, 27, 28,
	27, 28, 31,
	26, 27, 31,
	26, 30, 31,
	25, 26, 30,
	25, 29, 30,
	25, 28, 29,
	32, 33, 35,	//Top inner face
	33, 34, 35,
	
	36, 37, 40,	//Bottom outer face
	36, 39, 40,
	39, 40, 43,
	38, 39, 43,
	38, 42, 43,
	37, 38, 42,
	37, 41, 42,
	37, 40, 41,
	44, 45, 47,	//Bottom inner face
	45, 46, 47,
	
	48, 49, 52,	//Right outer face
	48, 51, 52,
	51, 52, 55,
	50, 51, 55,
	50, 54, 55,
	49, 50, 54,
	49, 53, 54,
	49, 52, 53,
	56, 57, 59,	//Right inner face
	57, 58, 59,
	
	60, 61, 64,	//Left outer face
	60, 63, 64,
	63, 64, 67,
	62, 63, 67,
	62, 66, 67,
	61, 62, 66,
	61, 65, 66,
	61, 64, 65,
	68, 69, 71,	//Left inner face
	69, 70, 71];
	
  
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
	glob.cubeVertexIndexBuf.itemSize = 1;	//we have one item - the cube
	glob.cubeVertexIndexBuf.numItems = 180;	//we have 180 indices (6 faces, every face has 10 triangles, each triangle 3 vertices: 10x3x6=180)
}

//initiate textures, provide handling on load event
//NOTE1: texture width and height must be pow of 2, in px
//NOTE2: --allow-file-access-from-files must be added to chrome, to bypass same origin policy
function initTextures(){
  glob.block = glob.gl.createTexture();
  var blockImage = new Image();
  blockImage.onload = function() { handleTextureLoaded(blockImage, glob.block); }
  blockImage.src = "projectTextures/block.bmp";
  
  glob.end = glob.gl.createTexture();
  var endImage = new Image();
  endImage.onload = function() { handleTextureLoaded(endImage, glob.end); }
  endImage.src = "projectTextures/end.bmp";
  
  glob.endD = glob.gl.createTexture();
  var endDImage = new Image();
  endDImage.onload = function() { handleTextureLoaded(endDImage, glob.endD); }
  endDImage.src = "projectTextures/endD.bmp";
  
  glob.endDL = glob.gl.createTexture();
  var endDLImage = new Image();
  endDLImage.onload = function() { handleTextureLoaded(endDLImage, glob.endDL); }
  endDLImage.src = "projectTextures/endDL.bmp";
  
  glob.endDR = glob.gl.createTexture();
  var endDRImage = new Image();
  endDRImage.onload = function() { handleTextureLoaded(endDRImage, glob.endDR); }
  endDRImage.src = "projectTextures/endDR.bmp";
  
  glob.endL = glob.gl.createTexture();
  var endLImage = new Image();
  endLImage.onload = function() { handleTextureLoaded(endLImage, glob.endL); }
  endLImage.src = "projectTextures/endL.bmp";
  
  glob.endR = glob.gl.createTexture();
  var endRImage = new Image();
  endRImage.onload = function() { handleTextureLoaded(endRImage, glob.endR); }
  endRImage.src = "projectTextures/endR.bmp";
  
  glob.endU = glob.gl.createTexture();
  var endUImage = new Image();
  endUImage.onload = function() { handleTextureLoaded(endUImage, glob.endU); }
  endUImage.src = "projectTextures/endU.bmp";
  
  glob.endUL = glob.gl.createTexture();
  var endULImage = new Image();
  endULImage.onload = function() { handleTextureLoaded(endULImage, glob.endUL); }
  endULImage.src = "projectTextures/endUL.bmp";
  
  glob.endUR = glob.gl.createTexture();
  var endURImage = new Image();
  endURImage.onload = function() { handleTextureLoaded(endURImage, glob.endUR); }
  endURImage.src = "projectTextures/endUR.bmp";
  
  glob.start = glob.gl.createTexture();
  var startImage = new Image();
  startImage.onload = function() { handleTextureLoaded(startImage, glob.start); }
  startImage.src = "projectTextures/start.bmp";
  
  glob.hero = glob.gl.createTexture();
  var heroImage = new Image();
  heroImage.onload = function() { handleTextureLoaded(heroImage, glob.hero); }
  heroImage.src = "projectTextures/hero.bmp";
}

//onload texture handler
function handleTextureLoaded(image,texture){
	var gl=glob.gl;
	gl.bindTexture(gl.TEXTURE_2D, texture);	//bind texture as current texture
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);//pass to texImage2D, to write image data in texture
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);//linear filtering on scale up of texture
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);//mipmap on scale down of texture
	gl.generateMipmap(gl.TEXTURE_2D);		//generate the mipmap
	gl.bindTexture(gl.TEXTURE_2D, null);	//done manipulating texture, set current to null
}

//For every frame this function draws the complete scene from the beginning
export function drawScene() {
	var gl=glob.gl,lvl=game.lvl,centerY=Math.ceil(lvl.length/2), centerX=Math.ceil(lvl[0].length/2),heroPos=game.heroPos,finishPos=game.finishPos,randEffect=game.randEffect;
	
	gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);	//viewport = the canvas' actual resolution (smaller than the window when quality is lowered)
	gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);	//frame & depth buffers cleaned (depth buf for sorting fragments, find visible one per pixel)
	m4.perspective(45,gl.drawingBufferWidth/gl.drawingBufferHeight,0.1,100.0,glob.pMatrix);	//projection matrix: FoV deg, aspect ratio, near & far plane
	//LEVEL
	for(var i=lvl.length;i--;){	//iterate level rows
		var row=lvl[i];
		for(var j=lvl[0].length;j--;){	//iterate level cells per row
			if(row[j]!==-99){	//if not empty tile
				var height=0.05;
				if(row[j]>0&&row[j]<98){//set tile height
					height=0.05+row[j]/20;
				}
				mvPushMatrix();	//stack to employ a local transformation
				m4.identity(glob.mvMatrix);	//modelview Matrix initialized with Identity Matrix
				
				m4.translate(glob.mvMatrix, [0, -(centerY+centerX)/3.5, -(centerY+centerX)*1.75]);	
				m4.rotate(glob.mvMatrix, degToRad(game.xTrans*centerX*8), [0, 1, 0]);//rotations with mouse events
				m4.rotate(glob.mvMatrix, degToRad(game.yTrans*centerY*8), [-1, 0, 0.3]);
				
				if(game.lostGame>0){	//Animation for losing the game
					m4.rotate(glob.mvMatrix, degToRad(-(100-game.lostGame)/4+Math.pow(100-game.lostGame,2)/(20*4)), [-0.3, 0.3, 0]);
				}
				if(game.newGame>33){	//Animation for starting the game
					if(randEffect===1||randEffect===2){
						m4.translate(glob.mvMatrix, [0, 0, -Math.pow(game.newGame-33,2)/50]);
					}
					if(randEffect===2||randEffect===3){
						m4.rotate(glob.mvMatrix, degToRad((game.newGame-33)*360/66),[0,1,1]);
					}
				}
				m4.translate(glob.mvMatrix, [0, 0, (centerY+centerX)*2]);
				m4.rotate(glob.mvMatrix, degToRad(-66), [1, 0, 0]);
				m4.rotate(glob.mvMatrix, degToRad(25), [0, 0, 1]);
				if(game.newGame>0){	//Animation for starting the game
					m4.translate(glob.mvMatrix, [j+centerX*0.2, -i+centerY*4, (-5+height)+
						Math.max(0,game.newGame-33)/(Math.log(2+Math.abs((j-heroPos[0])*(i-heroPos[1])))/Math.LN2)]);
						//pseudorandom numbers, but static for the two seeds, through three linear congruential generators
					m4.rotate(glob.mvMatrix, degToRad(Math.pow(Math.max(0,game.newGame-33),1.5)) , [ ((97*i+j)%23) , ((79*i+j)%11) , ((83*i+j)%17) ]);
				}else if(game.wonGame>0){	//Animation for winning the level
					if(row[j]===99){	//Animation for finish tile when winning the level
						m4.translate(glob.mvMatrix,[
							j+centerX*0.2, 
							-i+centerY*4, 
							(-5+height)+(100-game.wonGame)/5-Math.pow(100-game.wonGame,2)/150
						]);
					}else{
						m4.translate(glob.mvMatrix,[
							j+centerX*0.2, 
							-i+centerY*4, 
							(-5+height)-Math.pow(100-game.wonGame,2)/(40*Math.log(2+Math.abs((j-heroPos[0])*(i-heroPos[1])))/Math.LN2)
						]);
					}
					m4.rotate(glob.mvMatrix, degToRad((100-game.wonGame)*5), [j-finishPos[0], i-finishPos[1], 1]);
				}else if(game.lostGame>0){	//Animation for losing the game
					m4.translate(glob.mvMatrix, [j+centerX*0.2, -i+centerY*4, (-5+height)+
					Math.pow(100-game.lostGame,2)/150]);
				}else{
					m4.translate(glob.mvMatrix, [j+centerX*0.2, -i+centerY*4, -5+height]);
				}
				if(row[j]===99){	//finish tile
					m4.translate(glob.mvMatrix, [0, 0, 0.3+Math.sin(degToRad(game.rCube))/6]);
					m4.rotate(glob.mvMatrix, degToRad(game.rCube), [Math.sin(degToRad(game.rCube/2)), Math.sin(degToRad(game.rCube*4)), Math.sin(degToRad(game.rCube*2))]);
					m4.scale(glob.mvMatrix, [0.35, 0.35, height]);
				}else{
					m4.scale(glob.mvMatrix, [0.5, 0.5, height]);
				}
				gl.bindBuffer(gl.ARRAY_BUFFER, glob.cubeVertexPosBuf);	//we bind the buffer for the cube vertices
				gl.vertexAttribPointer(glob.shaderProgram.vertexPositionAttribute, glob.cubeVertexPosBuf.itemSize, gl.FLOAT, false, 0, 0);
				gl.bindBuffer(gl.ARRAY_BUFFER, glob.cubeVertexColorBuf);	//we bind the buffer for the cube colors
				gl.vertexAttribPointer(glob.shaderProgram.vertexColorAttribute, glob.cubeVertexColorBuf.itemSize, gl.FLOAT, false, 0, 0);
				gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer);
				gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);
				gl.activeTexture(gl.TEXTURE0);
				if(row[j]===99) gl.bindTexture(gl.TEXTURE_2D, glob.end);	//finish tile
				else if(row[j]===98) gl.bindTexture(gl.TEXTURE_2D, glob.start);	//start tile
				else if(j+1===finishPos[0] && i===finishPos[1]) gl.bindTexture(gl.TEXTURE_2D, glob.endL);	//moving clockwise around finish tile
				else if(j+1===finishPos[0] && i+1===finishPos[1]) gl.bindTexture(gl.TEXTURE_2D, glob.endDL);
				else if(j===finishPos[0] && i+1===finishPos[1]) gl.bindTexture(gl.TEXTURE_2D, glob.endD);
				else if(j-1===finishPos[0] && i+1===finishPos[1]) gl.bindTexture(gl.TEXTURE_2D, glob.endDR);
				else if(j-1===finishPos[0] && i===finishPos[1]) gl.bindTexture(gl.TEXTURE_2D, glob.endR);
				else if(j-1===finishPos[0] && i-1===finishPos[1]) gl.bindTexture(gl.TEXTURE_2D, glob.endUR);
				else if(j===finishPos[0] && i-1===finishPos[1]) gl.bindTexture(gl.TEXTURE_2D, glob.endU);
				else if(j+1===finishPos[0] && i-1===finishPos[1]) gl.bindTexture(gl.TEXTURE_2D, glob.endUL);
				else gl.bindTexture(gl.TEXTURE_2D, glob.block);
				gl.uniform1i(gl.getUniformLocation(glob.shaderProgram, "uSampler"), 0);
				
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glob.cubeVertexIndexBuf);	//we bind the buffer for the cube vertex indices
				setMatrixUniforms();	//we update the uniforms for the shaders
				gl.drawElements(gl.TRIANGLES, glob.cubeVertexIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);	//webGL draw call, Triangles mode
				mvPopMatrix();	//we pop the matrix and now the active ModelView matrix is the global one
			}
		}
	}	

	//hero
	mvPushMatrix();	//we use the matrix stack to employ a local transformation to the cube
	m4.identity(glob.mvMatrix);	//the modelview Matrix is initialized with the Identity Matrix	
	m4.translate(glob.mvMatrix, [0, -(centerY+centerX)/3.5, -(centerY+centerX)*1.75]);	
	m4.rotate(glob.mvMatrix, degToRad(game.xTrans*centerX*8), [0, 1, 0]);//rotations with mouse events
	m4.rotate(glob.mvMatrix, degToRad(game.yTrans*centerY*8), [-1, 0, 0.3]);
	m4.translate(glob.mvMatrix, [0, 0, (centerY+centerX)*2]);
	m4.rotate(glob.mvMatrix, degToRad(-66), [1, 0, 0]);
	m4.rotate(glob.mvMatrix, degToRad(25), [0, 0, 1]);
	
	var animT=MOVE_FRAMES,count=game.count===-1?animT:game.count,hp=game.hp,hpp=game.hpp;
	var hhp=game.spring?game.hhp+0.1*(count+1):game.hhp;	//add "spring" to step
	if(game.newGame>0){	//Animation for starting the game
		m4.translate(glob.mvMatrix,[
			heroPos[0]+game.heroFixPos[0]+centerX*0.2, 
			-heroPos[1]+game.heroFixPos[1]+centerY*4,
			-3.9+game.heroHeight+game.newGame+2	//add extra height to smooth transition
		]);
		m4.rotate(glob.mvMatrix, degToRad(game.rotX), [1, 0, 0]);
		m4.rotate(glob.mvMatrix, degToRad(game.rotY), [0, 1, 0]);
		m4.rotate(glob.mvMatrix, degToRad(game.rotZ), [0, 0, 1]);
	}else if(game.wonGame>0){	//Animation for winning the level
		m4.translate(glob.mvMatrix,[
			finishPos[0]+game.heroFixPos[0]+centerX*0.2, 
			-finishPos[1]+game.heroFixPos[1]+centerY*4,
			-3.9+game.heroHeight+(100-game.wonGame)/3-Math.pow(100-game.wonGame,2)/150
		]);
		m4.rotate(glob.mvMatrix, degToRad(Math.pow(100-game.wonGame,2)/20), [finishPos[0]/2, finishPos[1]/2, 1]);
	}else if(game.lostGame>0){	//Animation for losing the game
		var distJump=[0,0];	//extra distance to jump
		if(heroPos[1]<lvl.length-1 && lvl[heroPos[1]+1][heroPos[0]]!==-99){		distJump[1]+=-1; }
		if(heroPos[1]>0 && lvl[heroPos[1]-1][heroPos[0]]!==-99){				distJump[1]+= 1; }
		if(heroPos[0]<lvl[0].length-1 && lvl[heroPos[1]][heroPos[0]+1]!==-99){	distJump[0]+=-1; }
		if(heroPos[0]>0 && lvl[heroPos[1]][heroPos[0]-1]!==-99){				distJump[0]+= 1; }
		if(heroPos[1]<lvl.length-2 && lvl[heroPos[1]+2][heroPos[0]]!==-99){		distJump[1]+=-1; }
		if(heroPos[1]>1 && lvl[heroPos[1]-2][heroPos[0]]!==-99){				distJump[1]+= 1; }
		if(heroPos[0]<lvl[0].length-2 && lvl[heroPos[1]][heroPos[0]+2]!==-99){	distJump[0]+=-1; }
		if(heroPos[0]>1 && lvl[heroPos[1]][heroPos[0]-2]!==-99){				distJump[0]+= 1; }
		m4.translate(glob.mvMatrix,[
			(distJump[0]*(100-game.lostGame)/20+heroPos[0])+game.heroFixPos[0]+centerX*0.2, 
			-(distJump[1]*(100-game.lostGame)/20+heroPos[1])+game.heroFixPos[1]+centerY*4, 
			-3.9+game.heroHeight-Math.pow(95-game.lostGame,2)/120
		]);
		m4.rotate(glob.mvMatrix, degToRad((game.rotX*(100-game.lostGame)/15)+(game.rotXprev*game.lostGame/100)), [1, 0, 0]);
		m4.rotate(glob.mvMatrix, degToRad((game.rotY*(100-game.lostGame)/15)+(game.rotYprev*game.lostGame/100)), [0, 1, 0]);
		m4.rotate(glob.mvMatrix, degToRad((game.rotZ*(100-game.lostGame)/15)+(game.rotZprev*game.lostGame/100)), [0, 0, 1]);
		m4.rotate(glob.mvMatrix, degToRad(Math.pow(100-game.lostGame,2)/30), [1, 1, 1]);
	}else{	//rolling (or resting, when count===animT)
		m4.translate(glob.mvMatrix,[
			(hp[0]*count/animT)+(hpp[0]*(animT-count)/animT)+(game.heroFixPos[0]*count/animT)+(game.heroFixPosPrev[0]*(animT-count)/animT)+centerX*0.2, 
			-(hp[1]*count/animT+hpp[1]*(animT-count)/animT)+(game.heroFixPos[1]*count/animT)+(game.heroFixPosPrev[1]*(animT-count)/animT)+centerY*4, 
			-3.9+(game.heroHeight*count/animT)-(hhp*(count-animT)/animT)
		]);
		m4.rotate(glob.mvMatrix, degToRad((game.rotX*count/animT)+(game.rotXprev*(animT-count)/animT)), [1, 0, 0]);
		m4.rotate(glob.mvMatrix, degToRad((game.rotY*count/animT)+(game.rotYprev*(animT-count)/animT)), [0, 1, 0]);
		m4.rotate(glob.mvMatrix, degToRad((game.rotZ*count/animT)+(game.rotZprev*(animT-count)/animT)), [0, 0, 1]);
	}
	
	m4.scale(glob.mvMatrix, [0.5, 0.5, 1]);
	gl.bindBuffer(gl.ARRAY_BUFFER, glob.cubeVertexPosBuf);	//we bind the buffer for the cube vertices
	gl.vertexAttribPointer(glob.shaderProgram.vertexPositionAttribute, glob.cubeVertexPosBuf.itemSize, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, glob.cubeVertexColorBuf);	//we bind the buffer for the cube colors
	gl.vertexAttribPointer(glob.shaderProgram.vertexColorAttribute, glob.cubeVertexColorBuf.itemSize, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer);
	gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);
	gl.bindTexture(gl.TEXTURE_2D, glob.hero);
	gl.uniform1i(gl.getUniformLocation(glob.shaderProgram, "uSampler"), 0);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glob.cubeVertexIndexBuf);	//we bind the buffer for the cube vertex indices
	setMatrixUniforms();	//we update the uniforms for the shaders
	gl.drawElements(gl.TRIANGLES, glob.cubeVertexIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);	//webGL draw call, Triangles mode
	mvPopMatrix();	//we pop the matrix and now the active ModelView matrix is the global one
}


//The matrix stack operation are implemented below to handle local transformations
function mvPushMatrix(){	//Push Matrix Operation
	var copy=m4.create();
	m4.set(glob.mvMatrix,copy);
	glob.mvMatrixStack.push(copy);
}
function mvPopMatrix(){	//Pop Matrix Operation
	var mvMatrixStack=glob.mvMatrixStack;
	if(mvMatrixStack.length===0){
		console.log("Invalid popMatrix!");
		return null;
	}
	glob.mvMatrix=mvMatrixStack.pop();
}


//Sets + Updates matrix uniforms
function setMatrixUniforms() {
	var gl=glob.gl,shProgram=glob.shaderProgram;
	gl.uniformMatrix4fv(shProgram.pMatrixUniform,false,glob.pMatrix);
	gl.uniformMatrix4fv(shProgram.mvMatrixUniform,false,glob.mvMatrix);
}

//Randomly creates rooms and connects them
function randomLevelGenerator(x,y){
	var startX=0,startY=0,endX=x,endY=y,room1X,room1Y,room2X,room2Y,room3X,room3Y,lvl=[],x1PadS=0,y1PadS=0,x1PadE=0,y1PadE=0,x1Pad1=0,y1Pad1=0,x1Pad2=0,y1Pad2=0,x1Pad3=0,y1Pad3=0,x2PadS=0,y2PadS=0,x2PadE=0,y2PadE=0,x2Pad1=0,y2Pad1=0,x2Pad2=0,y2Pad2=0,x2Pad3=0,y2Pad3=0;
	x--,y--; //arrays start from 0
	
	do{	//calculate random start/end positions (and room padding). Must be at least 1/2.5 of the level apart
		startX=Math.floor(Math.random()*x)+1;
		startY=Math.floor(Math.random()*y)+1;
		endX=Math.floor(Math.random()*x)+1;
		endY=Math.floor(Math.random()*y)+1;
		x1PadS=Math.floor(Math.random()*3); //Math.floor(Math.random()*(max-min+1))+min
		y1PadS=Math.floor(Math.random()*3);
		x2PadS=Math.floor(Math.random())+4-x1PadS;
		y2PadS=Math.floor(Math.random())+4-y1PadS;
		x1PadE=Math.floor(Math.random()*3);
		y1PadE=Math.floor(Math.random()*3);
		x2PadE=Math.floor(Math.random())+4-x1PadE;
		y2PadE=Math.floor(Math.random())+4-y1PadE;
	}while(endY-(y/2.5)<=startY&&startY<=endY+(y/2.5)&&endX-(x/2.5)<=startX&&startX<=endX+(x/2.5));
	
	if(x*y>=81){
		do{	//calculate random room center. Must be at least 1/5 of the previous positions apart
			room1X=Math.floor(Math.random()*(x+1));
			room1Y=Math.floor(Math.random()*(y+1));
			x1Pad1=Math.floor(Math.random()*3);
			y1Pad1=Math.floor(Math.random()*3);
			x2Pad1=Math.floor(Math.random()*2)+3-x1Pad1;
			y2Pad1=Math.floor(Math.random()*2)+3-y1Pad1;
		}while((endY-(y/5)<=room1Y&&room1Y<=endY+(y/5)&&endX-(x/5)<=room1X&&room1X<=endX+(x/5))||
		(startY-(y/5)<=room1Y&&room1Y<=startY+(y/5)&&startX-(x/5)<=room1X&&room1X<=startX+(x/5)));
	}
	
	if(x*y>=196){
		do{	//calculate more random room centers. Must be at least 1/5 of the previous positions apart
			room2X=Math.floor(Math.random()*(x+1));
			room2Y=Math.floor(Math.random()*(y+1));
			x1Pad2=Math.floor(Math.random()*3);
			y1Pad2=Math.floor(Math.random()*3);
			x2Pad2=Math.floor(Math.random()*2)+3-x1Pad2;
			y2Pad2=Math.floor(Math.random()*2)+3-y1Pad2;
		}while((endY-(y/5)<=room2Y&&room2Y<=endY+(y/5)&&endX-(x/5)<=room2X&&room2X<=endX+(x/5))||
		(startY-(y/5)<=room2Y&&room2Y<=startY+(y/5)&&startX-(x/5)<=room2X&&room2X<=startX+(x/5))||
		(room1Y-(y/5)<=room2Y&&room2Y<=room1Y+(y/5)&&room1X-(x/5)<=room2X&&room2X<=room1X+(x/5)));
	}
	
	if(x*y>=361){
		do{	//calculate more random room centers. Must be at least 1/5 of the previous positions apart
			room3X=Math.floor(Math.random()*(x+1));
			room3Y=Math.floor(Math.random()*(y+1));
			x1Pad3=Math.floor(Math.random()*3);
			y1Pad3=Math.floor(Math.random()*3);
			x2Pad3=Math.floor(Math.random()*2)+3-x1Pad3;
			y2Pad3=Math.floor(Math.random()*2)+3-y1Pad3;
		}while((endY-(y/5)<=room3Y&&room3Y<=endY+(y/5)&&endX-(x/5)<=room3X&&room3X<=endX+(x/5))||
		(startY-(y/5)<=room3Y&&room3Y<=startY+(y/5)&&startX-(x/5)<=room3X&&room3X<=startX+(x/5))||
		(room2Y-(y/5)<=room3Y&&room3Y<=room2Y+(y/5)&&room2X-(x/5)<=room3X&&room3X<=room2X+(x/5))||
		(room1Y-(y/5)<=room3Y&&room3Y<=room1Y+(y/5)&&room1X-(x/5)<=room3X&&room3X<=room1X+(x/5)));
	}
	
	//98: start, 99: end, -99: empty, else height of level
	for(var i=y+1;i--;){	//create map with rooms
		lvl[i]=[];
		var row=lvl[i];
		for(var j=x+1;j--;){
			if(i-y1PadS<=startY&&startY<=i+y2PadS&&j-x1PadS<=startX&&startX<=j+x2PadS){ row[j]=0; }	//fill around start
			else if(i-y1PadE<=endY&&endY<=i+y2PadE&&j-x1PadE<=endX&&endX<=j+x2PadE){ row[j]=0; }	//fill around end
			else if(y1Pad1>0&&i-y1Pad1<=room1Y&&room1Y<=i+y2Pad1&&j-x1Pad1<=room1X&&room1X<=j+x2Pad1){ row[j]=0; }	//fill around room1
			else if(y1Pad2>0&&i-y1Pad2<=room2Y&&room2Y<=i+y2Pad2&&j-x1Pad2<=room2X&&room2X<=j+x2Pad2){ row[j]=0; }	//fill around room2
			else if(y1Pad3>0&&i-y1Pad3<=room3Y&&room3Y<=i+y2Pad3&&j-x1Pad3<=room3X&&room3X<=j+x2Pad3){ row[j]=0; }	//fill around room3
			else{ row[j]=-99; } //else is empty
		}
	}
	
	var arrMid=[[startX,startY],[endX,endY]];	//find shortest path between rooms for one of 3 sizes of map
	if(x*y>=81){arrMid=[[startX,startY],[room1X,room1Y],[endX,endY]];}
	if(x*y>=196){
		if(Math.abs(startX-room1X)+Math.abs(startY-room1Y)<Math.abs(startX-room2X)+Math.abs(startY-room2Y)){
			if(x*y>=361){
				if(Math.abs(endX-room3X)+Math.abs(endY-room3Y)<Math.abs(endX-room2X)+Math.abs(endY-room2Y)){
					arrMid=[[startX,startY],[room1X,room1Y],[room2X,room2Y],[room3X,room3Y],[endX,endY]];
				}else{arrMid=[[startX,startY],[room1X,room1Y],[room3X,room3Y],[room2X,room2Y],[endX,endY]];}
			}else{arrMid=[[startX,startY],[room1X,room1Y],[room2X,room2Y],[endX,endY]];}
		}else{
			if(x*y>=361){
				if(Math.abs(endX-room3X)+Math.abs(endY-room3Y)<Math.abs(endX-room1X)+Math.abs(endY-room1Y)){
					arrMid=[[startX,startY],[room2X,room2Y],[room1X,room1Y],[room3X,room3Y],[endX,endY]];
				}else{arrMid=[[startX,startY],[room2X,room2Y],[room3X,room3Y],[room1X,room1Y],[endX,endY]];}
			}else{arrMid=[[startX,startY],[room2X,room2Y],[room1X,room1Y],[endX,endY]];}
		}
	}
	
	//draw lines between closest rooms
	for(var i=arrMid.length-1;i--;){
		lvl=drawLine(lvl,arrMid[i][0],arrMid[i][1],arrMid[i+1][0],arrMid[i+1][1]);
	}
	
	lvl[startY][startX]=98; //set start
	lvl[endY][endX]=99; //set end
	
	//empty padding around map
	for(var i=lvl.length;i--;){
		lvl[i].unshift(-99);
		lvl[i].unshift(-99);
		lvl[i].push(-99);
		lvl[i].push(-99);
	}
	var emptyRow=[];
	for(var i=lvl[0].length;i--;){
		emptyRow[i]=-99;
	}
	lvl.push(emptyRow);
	lvl.push(emptyRow);
	lvl.unshift(emptyRow);
	lvl.unshift(emptyRow);
	
	return lvl;
}

//Bresenham's algo links the rooms
function drawLine(lvl,x0,y0,x1,y1){
	var dx=Math.abs(x1-x0);
	var dy=Math.abs(y1-y0);
	var sx=(x0<x1)?1:-1;
	var sy=(y0<y1)?1:-1;
	var err=dx-dy;
	while(true){
		lvl[y0][x0]=0;
		if(y0>0){lvl[y0-1][x0]=0;}
		if(x0>0){lvl[y0][x0-1]=0;}
		if(y0+1<lvl.length){lvl[y0+1][x0]=0;}
		if(x0+1<lvl[y0].length){lvl[y0][x0+1]=0;}
		if((x0==x1)&&(y0==y1)){break;}
		var e2=2*err;
		if(e2>-dy){err-=dy;x0+=sx;}
		if(e2< dx){err+=dx;y0+=sy;}
	}
	return lvl;
}

//Rotation function helper
function degToRad(degrees){
	return degrees*Math.PI/180;
}
