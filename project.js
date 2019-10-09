//THEMISTOKLIS KOUTSOURIS - TUC - GRAPHICS COURSE - BLOXORZ IMPLEMENTED WITH WEBGL

var glob={};//Singleton pattern: namespacing vars as object properties, prevents global scope cluttering/overwriting
glob.gl=null;//webGl context, every call to the state machine will be done through this variable
glob.rCube=0;//for rotation independant of framerate
glob.xTrans=0.0;//x,y pos for transformation matrix
glob.yTrans=0.0;
glob.xTransStart=0.0;
glob.yTransStart=0.0;
glob.currPressedKeys={};//array of integers for currently pressed keycode
glob.currPressedKeysDoc={};//array of booleans for document events
glob.lastTime=0;//last frame time
glob.shaderProgram=null;
glob.mvMatrix=mat4.create();//ModelView and Projection matrices, mat4 comes from the external library
glob.mvMatrixStack=[];
glob.normalMatrix = mat3.create();
glob.pMatrix=mat4.create();
glob.cubeVertexPosBuf=null; //contains coordinates
glob.cubeVertexColorBuf=null; //contains color per vertex
glob.cubeVertexIndexBuf=null; //contains indices for chains of vertices to draw triangles/other geometry
glob.glQuality=1; //quality of webGL canvas (higher numbers lower resolution, heighten performance)
glob.canvas=null;	//our canvas element
glob.count=-1;	//count frames for discrete movements/animation
glob.heroHeight=0;		//hero height
glob.hpp=glob.heroHeight;//hero height temp
glob.heroFixPos=[0,0];	//hero x,y pos fix before rotation
glob.heroFixPosPrev=glob.heroFixPos;
glob.emptyPos=[];		//empty positions
glob.rotX=0;	//hero rotation
glob.rotXprev=0;	//hero previous rotation
glob.rotY=0;
glob.rotYprev=0;
glob.rotZ=0;
glob.rotZprev=0;
glob.heroPos=[0,0,0,0];	//heroPos (x , y , {0:stand 1:horiz right -1:horiz left 2:verti down -2:verti up},{moving 0:no 1:Up 2:Right 3:Down 4:Left})
glob.heroPosPrev=null;	//previous hero position
glob.hp=null;//temp heroPos variables
glob.hpp=null;
glob.finishPos=[0,0];	//end position
glob.newGame = 100;	//countdown for starting animation
glob.wonGame = -1;		//countdown for winning animation
glob.lostGame = -1;		//countdown for losing animation
glob.score=0;	//levels won
glob.topScore=0;
glob.lvl=null;	//the level matrix
glob.startTime=null;	//counter for fast! bonus / waiting animation
glob.randEffect=null;	//animation type (random discrete value from 0 ~ 3)
glob.volume=0.1;	//global volume parameter
glob.newGameFlag=true;	//true if started new game, helps to prebuffer sounds


//manipulates the web page
function pageUI(result){

	var promptArr=document.getElementsByClassName("prompt");
	var help=document.getElementById("help");
	for(var i=promptArr.length;i--;){	//handler for click event on a prompt
		promptArr[i].onmousedown=function(e){
			this.style.WebkitTransform='scale(200)';
			this.style.mozTransform='scale(200)';
			this.style.transform='scale(200)';
			this.style.oTransform='scale(200)';
			help.style.opacity=0;
			window.setTimeout('webGLStart();',500);
		}
		disableSelection(promptArr[i]); //prevent selection
	}
	disableSelection(document.getElementById("score")); //prevent selection
	
	document.onkeydown=function(e){	//handler for enter or space key to start canvas

		if((e.keyCode===13||e.keyCode===32)&&document.getElementById("c")){
			for(var i=promptArr.length;i--;){
				promptArr[i].style.WebkitTransform='scale(200)';
				promptArr[i].style.mozTransform='scale(200)';
				promptArr[i].style.transform='scale(200)';
				promptArr[i].style.oTransform='scale(200)';
			}
			help.style.opacity=0;
			window.setTimeout('webGLStart();',500);
		}
	}
	document.getElementById("c").style.display="none";
	document.getElementById("help").style.display="block";
	if(result===-1){	//if game lost
		document.getElementById("promptLose").style.display="block";
	}else if(localStorage["bloxorzGL.gameInProgress.lvl"]&&localStorage["bloxorzGL.gameInProgress.lvl"]!=null&&glob.lvl==null){
		document.getElementById("promptCont").style.display="block";//if game was stopped
	}else{
		document.getElementById("promptPlay").style.display="block";
	}
	refreshScore();
}

//to prevent selecting prompt text
function disableSelection(element){
	if (typeof element.onselectstart!='undefined'){
		element.onselectstart=function(){return false;};
	}else if(typeof element.style.MozUserSelect!='undefined'){
		element.style.MozUserSelect='none';
	}else{
		element.onmousedown=function(){return false;};
	}
}
			
//starts the webGL game
function webGLStart(){
	initGL("c");
	initShaders();
	initBuffers();
	initTextures();
	window.setTimeout(function(){
		//global object properties saved in local vars for performance optimization (when 2+ global scope lookups)
		var min,max,gl=glob.gl,canvas=document.getElementById("c"),glQuality=glob.glQuality;
		gl.clearColor(0.0, 0.0, 0.0, 0.0);//Background Color: Color assigned for all pixels with no corresponding fragments
		gl.enable(gl.DEPTH_TEST);//Enable z-buffer for depth sorting
		eventHandlers(document.body);//defines event handlers for the element
		if(localStorage["bloxorzGL.gameInProgress.lvl"]&&localStorage["bloxorzGL.gameInProgress.lvl"]!=null&&glob.lvl==null){
			loadGameState();//if game was stopped
		}else{//else loads a new randomly generated level (size is partially determined by score thus far), and sets new start time
			max=Math.floor((glob.score/5)+5)*2;
			min=Math.floor((glob.score/5)+5);
			glob.lvl=loadLevel((Math.floor(Math.random()*(max-min+1))+min), (Math.floor(Math.random()*(max-min+1))+min));
		}
		glob.randEffect=Math.floor(Math.random()*4);	//create a random effect for loading the level
		canvas.setAttribute("width",window.innerWidth/glQuality);	//set quality
		canvas.setAttribute("height",window.innerHeight/glQuality);
		scoreCheck();	//checks if time bonus / top score apply
		tick();//the first tick of our application
	},250);
}

//Save game state, using local storage
function saveGameState() {
	if (window['localStorage']===null) { return false; }
	localStorage["bloxorzGL.gameInProgress.lvl"]		=JSON.stringify(glob.lvl);
	localStorage["bloxorzGL.gameInProgress.topScore"]	=glob.topScore;
	localStorage["bloxorzGL.gameInProgress.score"]		=glob.score;
	localStorage["bloxorzGL.gameInProgress.emptyPos"]	=JSON.stringify(glob.emptyPos);
	localStorage["bloxorzGL.gameInProgress.heroPos"]	=JSON.stringify(glob.heroPos);
	localStorage["bloxorzGL.gameInProgress.heroPosPrev"]=JSON.stringify(glob.heroPosPrev);
	localStorage["bloxorzGL.gameInProgress.rotX"]		=glob.rotX;
	localStorage["bloxorzGL.gameInProgress.rotXprev"]	=glob.rotXprev;
	localStorage["bloxorzGL.gameInProgress.rotY"]		=glob.rotY;
	localStorage["bloxorzGL.gameInProgress.rotYprev"]	=glob.rotYprev;
	localStorage["bloxorzGL.gameInProgress.rotZ"]		=glob.rotZ;
	localStorage["bloxorzGL.gameInProgress.rotZprev"]	=glob.rotZprev;
	localStorage["bloxorzGL.gameInProgress.finishPos"]	=JSON.stringify(glob.finishPos);
	return true;
}
//loads save data from local storage
function loadGameState() {
	if (window['localStorage']===null) { return false; }
	glob.lvl		=JSON.parse(localStorage["bloxorzGL.gameInProgress.lvl"]);
	glob.topScore	=parseInt(localStorage["bloxorzGL.gameInProgress.topScore"]);
	glob.score		=parseInt(localStorage["bloxorzGL.gameInProgress.score"]);
	glob.emptyPos	=JSON.parse(localStorage["bloxorzGL.gameInProgress.emptyPos"]);
	glob.heroPos	=JSON.parse(localStorage["bloxorzGL.gameInProgress.heroPos"]);
	glob.heroPosPrev=JSON.parse(localStorage["bloxorzGL.gameInProgress.heroPosPrev"]);
	glob.rotX		=parseInt(localStorage["bloxorzGL.gameInProgress.rotX"]);
	glob.rotXprev	=parseInt(localStorage["bloxorzGL.gameInProgress.rotXprev"]);
	glob.rotY		=parseInt(localStorage["bloxorzGL.gameInProgress.rotY"]);
	glob.rotYprev	=parseInt(localStorage["bloxorzGL.gameInProgress.rotYprev"]);
	glob.rotZ		=parseInt(localStorage["bloxorzGL.gameInProgress.rotZ"]);
	glob.rotZprev	=parseInt(localStorage["bloxorzGL.gameInProgress.rotZprev"]);
	glob.finishPos	=JSON.parse(localStorage["bloxorzGL.gameInProgress.finishPos"]);
	return true;
}
//resets save data
function resetGameState() {
	if(window['localStorage']===null){return false;}
	for (var i=localStorage.length,key;i--;){	//remove local storage entries for current game
		key=localStorage.key(i);
		if(key.slice(0,25)==="bloxorzGL.gameInProgress."){
			localStorage.removeItem(key);
		}
	}
	glob.lvl=null;
	glob.emptyPos=[];
	glob.heroPos=[0,0,0,0];
	glob.heroPosPrev=[0,0,0,0];
	glob.rotX=0;
	glob.rotXprev=0;
	glob.rotY=0;
	glob.rotYprev=0;
	glob.rotZ=0;
	glob.rotZprev=0;
	glob.finishPos=[0,0];
	glob.currPressedKeys={};
	return true;
}

//check and update the player's score
function scoreCheck(){
	var currTime=new Date().getTime();	//if quick enough, add extra point
	if(glob.startTime&&glob.lvl&&(currTime-glob.startTime)/1000<(3+glob.lvl.length+glob.lvl[0].length)/3){
		sounds.score.volume=glob.volume;	//play score sound
		sounds.score.play();
		var glassImg=document.getElementById("glass").style;
		glassImg.display='block';
		glassImg.opacity=1;
		var promptTimeStyle=document.getElementById("promptTime").style;
		promptTimeStyle.display='block';
		window.setTimeout(function(){	//show fast prompt & play sound, wait 0.5 sec, scale up, wait 0.5 sec, reset prompt
			glassImg.opacity=0;
			promptTimeStyle.WebkitTransform='scale(1)';
			promptTimeStyle.mozTransform='scale(1)';
			promptTimeStyle.transform='scale(1)';
			promptTimeStyle.oTransform='scale(1)';
			promptTimeStyle.bottom='0.2em';
			promptTimeStyle.left='0.4em';
			window.setTimeout(function(){
				glob.score++;
				resetPrompt();
				refreshScore();
			},600);	//wait, reset prompts and check for top score
		},500);
	}else{
		refreshScore();	//else check for top score and update
	}
	glob.startTime=new Date().getTime();	//time restarts
}


//Refreshes score
function refreshScore(){
	if (window['localStorage']!==null){
		if(glob.topScore===0&&localStorage["bloxorzGL.score"]<=glob.score-1){	//if top score surpassed, show top score prompt
			sounds.score.volume=glob.volume;	//play score sound
			sounds.score.play();
			glob.topScore=1;
			var glassImg=document.getElementById("glass").style;
			glassImg.display='block';
			glassImg.opacity=1;
			var promptTopStyle=document.getElementById("promptTop").style;
			promptTopStyle.display='block';
			window.setTimeout(function(){	//show top score & play sound, wait 0.5 sec, scale up, wait 0.5 sec, reset prompt
				glassImg.opacity=0;
				promptTopStyle.WebkitTransform='scale(1)';
				promptTopStyle.mozTransform='scale(1)';
				promptTopStyle.transform='scale(1)';
				promptTopStyle.oTransform='scale(1)';
				promptTopStyle.bottom='0.2em';
				promptTopStyle.left='0.4em';
				window.setTimeout(function(){
					resetPrompt();
				},600);
			},500);
		}
		if(localStorage["bloxorzGL.score"]<glob.score){	//if current score superior, make changes to top score
			localStorage["bloxorzGL.score"]=glob.score;
		}
	
		if(!localStorage["bloxorzGL.score"]){localStorage["bloxorzGL.score"]=0;}	//shows score
		if(document.getElementById("c").style.display=="none"||glob.topScore===1){
			document.getElementById("score").innerHTML="TOP SCORE: "+localStorage["bloxorzGL.score"];
		}else{
			document.getElementById("score").innerHTML="SCORE: "+glob.score;
		}
		return true;
	}
	return false;
}


//reset and hide prompts
function resetPrompt(){
	var glassImg=document.getElementById("glass").style;
	glassImg.display='none';
	glassImg.opacity=1;
	var promptArr=document.getElementsByClassName("prompt");
	for(var i=promptArr.length;i--;){
			promptArr[i].style.display="none";
			promptArr[i].style.WebkitTransform='scale(1.9)';
			promptArr[i].style.mozTransform='scale(1.9)';
			promptArr[i].style.transform='scale(1.9)';
			promptArr[i].style.oTransform='scale(1.9)';
	}
	promptArr=document.getElementsByClassName("scorePrompt");
	for(var i=promptArr.length;i--;){
		promptArr[i].style.display="none";
		promptArr[i].style.WebkitTransform='scale(4)';
		promptArr[i].style.mozTransform='scale(4)';
		promptArr[i].style.transform='scale(4)';
		promptArr[i].style.oTransform='scale(4)';
		promptArr[i].style.bottom='50%';
		promptArr[i].style.left='20%';
	}
	document.getElementById("help").style.opacity="0.5";
}

//Initialize WebGL
function initGL(canvasId){
	var canvas;
	resetPrompt();
	if(document.getElementById(canvasId)){//get or create the canvas element
		canvas=document.getElementById(canvasId);
	}else{
		canvas=document.createElement("canvas");
		document.body.appendChild(canvas);
		canvas.setAttribute("id",canvasId);
	}
	var glContext=canvas.getContext("webgl"),glExContext=canvas.getContext("experimental-webgl");
	if(!glContext&&!glExContext){
		alert("Browser does not support webGL");
		return null;
	}else{//get appropriate webgl context from canvas, assign to gl var
		glob.gl=(glContext)?glContext:glExContext;
	}
	canvas.style.display="block";
	document.getElementById("help").style.display="none";
	glob.canvas=canvas;
	handleResize();	//viewport/canvas size
	window.onresize=handleResize;	//when browser throws resize event, change viewport/canvas size
	glob.newGame=100;	//reset animation counters
	glob.wonGame=-1;
	glob.lostGame=-1;
	glob.xTrans=0;	//reset mouse position
	glob.yTrans=0;
}


//Creates a program from a vertex + fragment shader pair
function initShaders(){
	var local=glob,gl=local.gl,fragmentShader=getShader(gl,"fShader"), vertexShader=getShader(gl,"vShader");
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


//Find and compile shaders (vertex + fragment shader)
function getShader(gl,id){
	var shaderScript,code="",el,shader,doc=document;
	if(doc.getElementById(id)){
		shaderScript=doc.getElementById(id);
	}else{
		return null;
	}
	el=shaderScript.firstChild;
	while(el){
		if(el.nodeType===3){
			code+=el.textContent;
		}
		el = el.nextSibling;
	}
	if (shaderScript.type === "x-shader/x-fragment") {	//create shader
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	}else if (shaderScript.type === "x-shader/x-vertex") {
		shader = gl.createShader(gl.VERTEX_SHADER);
	}else{
		return null;
	}
	gl.shaderSource(shader, code);	//give code and ask WebGL to compile shader
	gl.compileShader(shader);
	if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){	//check for errors
		console.log("Shader compilation error:\n"+gl.getShaderInfoLog(shader));
		return null;
	}else{
		return shader;
	}
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
	colors=[
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
	
	/*
	cubeVertexNormalBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexNormalBuffer);
	var vertexNormals = [	//the verticals to the surface of the vertices
	0.0,  0.0,  1.0,	0.0,  0.0,  1.0,	0.0,  0.0,  1.0,// Front
	0.0,  0.0,  1.0,	0.0,  0.0,  1.0,	0.0,  0.0,  1.0,
	0.0,  0.0,  1.0,	0.0,  0.0,  1.0,	0.0,  0.0,  1.0,
	0.0,  0.0,  1.0,	0.0,  0.0,  1.0,	0.0,  0.0,  1.0,
	
	0.0,  0.0, -1.0,	0.0,  0.0, -1.0,	0.0,  0.0, -1.0,// Back
	0.0,  0.0, -1.0,	0.0,  0.0, -1.0,	0.0,  0.0, -1.0,
	0.0,  0.0, -1.0,	0.0,  0.0, -1.0,	0.0,  0.0, -1.0,
	0.0,  0.0, -1.0,	0.0,  0.0, -1.0,	0.0,  0.0, -1.0,
	
	0.0,  1.0,  0.0,	0.0,  1.0,  0.0,	0.0,  1.0,  0.0,// Top
	0.0,  1.0,  0.0,	0.0,  1.0,  0.0,	0.0,  1.0,  0.0,
	0.0,  1.0,  0.0,	0.0,  1.0,  0.0,	0.0,  1.0,  0.0,
	0.0,  1.0,  0.0,	0.0,  1.0,  0.0,	0.0,  1.0,  0.0,
	
	0.0, -1.0,  0.0,	0.0, -1.0,  0.0,	0.0, -1.0,  0.0,// Bottom
	0.0, -1.0,  0.0,	0.0, -1.0,  0.0,	0.0, -1.0,  0.0,
	0.0, -1.0,  0.0,	0.0, -1.0,  0.0,	0.0, -1.0,  0.0,
	0.0, -1.0,  0.0,	0.0, -1.0,  0.0,	0.0, -1.0,  0.0,
	
	1.0,  0.0,  0.0,	1.0,  0.0,  0.0,	1.0,  0.0,  0.0,// Right
	1.0,  0.0,  0.0,	1.0,  0.0,  0.0,	1.0,  0.0,  0.0,
	1.0,  0.0,  0.0,	1.0,  0.0,  0.0,	1.0,  0.0,  0.0,
	1.0,  0.0,  0.0,	1.0,  0.0,  0.0,	1.0,  0.0,  0.0,
	
	-1.0,  0.0,  0.0,	-1.0,  0.0,  0.0,	-1.0,  0.0,  0.0,// Left
	-1.0,  0.0,  0.0,	-1.0,  0.0,  0.0,	-1.0,  0.0,  0.0,
	-1.0,  0.0,  0.0,	-1.0,  0.0,  0.0,	-1.0,  0.0,  0.0,
	-1.0,  0.0,  0.0,	-1.0,  0.0,  0.0,	-1.0,  0.0,  0.0];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals), gl.STATIC_DRAW);
    cubeVertexNormalBuffer.itemSize = 3;
    cubeVertexNormalBuffer.numItems = 72;
	*/
	
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

//tick function, gets recursive
function tick(){
	if(glob.lvl){
		var requestId=requestAnimFrame(tick);//For every tick, request another frame (callback func)
		saveGameState();//save state to resume
		if(glob.newGame===-1&&glob.wonGame===-1&&glob.lostGame===-1){	//handle input if animation not playing
			handleKeys(requestId);//check keyboard handlers response
		}
		if(glob.lvl){//checking again if key handler handled an esc key
			drawScene();//draw the scene
			animate();//animate (update animation variables)
			checkConditions(requestId);	//check for win or loss
		}else{return;}
	}else{return;}
}


//define the keyboard/mouse handlers (not using closures, to prevent performance hit from big scope stack)
function eventHandlers(el){
	el.onkeydown=handleKeyDown;
	el.onkeyup=handleKeyUp;
	el.onmousedown=handleMouseDown;
	el.onmouseup=handleMouseUp;
	document.onkeydown=handleDocKeyDown;
	document.onkeyup=handleDocKeyUp;
}


//keyboard/mouse handlers - elastic response (quick first and delay for second) to keyboard input
function handleKeyDown(e){glob.currPressedKeys[e.keyCode]=true;}
function handleKeyUp(e){glob.currPressedKeys[e.keyCode]=false;}
function handleDocKeyDown(e){glob.currPressedKeysDoc[e.keyCode]=true;}
function handleDocKeyUp(e){glob.currPressedKeysDoc[e.keyCode]=false;}
function handleMouseDown(e){	//on mouse down add handler for mousemove event to emulate click-drag
	this.onmousemove=handleMouseMove;
	e.preventDefault();	//prevent default behaviour (cursor problems)
	if(document.getElementById("c").style.display!=="none"){
		this.style.cursor="all-scroll";
	}
	glob.xTransStart=-glob.xTransStart+window.event.clientX;	//keep current mouse position
	glob.yTransStart=-glob.yTransStart+window.event.clientY;	//for a smooth transition
}
function handleMouseUp(e){
	this.onmousemove=null;
	this.style.cursor="default";
	glob.xTransStart=glob.xTrans*100;	//save last pos for a smooth transition for following click-drag
	glob.yTransStart=-glob.yTrans*100;
}
function handleMouseMove(e){	//the click-drag mechanic utilizes the appropriate event, saving the pos of the mouse
	glob.xTrans=(window.event.clientX-glob.xTransStart)/100;	//smoothed by already known information
	glob.yTrans=(window.event.clientY-glob.yTransStart)/-100;
}
function handleResize(){
	var canvas=glob.canvas,gl=glob.gl;
	canvas.setAttribute("width",window.innerWidth);//set canvas resolution same as window dimensions
	canvas.setAttribute("height",window.innerHeight);
	gl.viewportWidth=canvas.offsetWidth;	//use the whole canvas
	gl.viewportHeight=canvas.offsetHeight;
}


//Key pressed callback
//37-40 = arrow keys
//heroPos (x , y , {0:standing 1:fallen horiz right -1:fallen horiz left 2:fallen verti down -2:fallen verti up},{moving 0:not yet 1:Up 2:Right 3:Down 4:Left})
function handleKeys(requestId){
	var local=glob,currPressedKeys=local.currPressedKeys,currPressedKeysDoc=local.currPressedKeysDoc,glQuality=local.glQuality,canvas=glob.canvas,prev=local.heroPosPrev,windowWidth=window.innerWidth,windowHeight=window.innerHeight,vol=local.volume;
	if(currPressedKeys[37]||currPressedKeys[65]){// Left cursor key or A
		//using 2 chained ternary operators to prevent if/else cluster
		//translation 1st integer: if standing, or horiz right, move 2 to the left, else 1 to the left
		//translation 3rd integer: if standing, you are now horiz left, else if horizontal, now standing, else if vertical, you are still vertical
		glob.heroPos=[prev[2]===0||prev[2]===1?prev[0]-2:prev[0]-1 , prev[1] , prev[2]===0?-1:prev[2]===1||prev[2]===-1?0:prev[2] , 4];
	}else if(currPressedKeys[38]||currPressedKeys[87]){// Up cursor key or W
		glob.heroPos=[prev[0] , prev[2]===0||prev[2]===2?prev[1]-2:prev[1]-1 , prev[2]===0?-2:prev[2]===2||prev[2]===-2?0:prev[2] , 1];
	}else if(currPressedKeys[39]||currPressedKeys[68]){// Right cursor key or D
		glob.heroPos=[prev[2]===0||prev[2]===-1?prev[0]+2:prev[0]+1 , prev[1] , prev[2]===0?1:prev[2]===1||prev[2]===-1?0:prev[2] , 2];
	}else if(currPressedKeys[40]||currPressedKeys[83]){// Down cursor key or S
		glob.heroPos=[prev[0] , prev[2]===0||prev[2]===-2?prev[1]+2:prev[1]+1 , prev[2]===0?2:prev[2]===2||prev[2]===-2?0:prev[2] , 3];
	}
	if(currPressedKeys[81]){//[Q] : changes quality
		if(glQuality>2){
			glQuality=1;
			popup("Quality up");
		}else{
			glQuality=glQuality+0.34;
			popup("Quality down");
		}
		canvas.setAttribute("width",windowWidth/glQuality);//set canvas resolution same as window dimensions, 
		canvas.setAttribute("height",windowHeight/glQuality);//or lower for faster performance
		glob.glQuality=glQuality;
		currPressedKeys[81]=false;
	}
	if(currPressedKeys[48]){//0~9 : changes volume
		if(vol!==0.0)popup("Volume down (mute)");
		glob.volume=0.0;
		currPressedKeys[48]=false;
	}
	if(currPressedKeys[49]){
		if(vol!==0.1)vol>0.1?popup("Volume down (1)"):popup("Volume up (1)");
		glob.volume=0.1;
		currPressedKeys[49]=false;
	}
	if(currPressedKeys[50]){
		if(vol!==0.2)vol>0.2?popup("Volume down (2)"):popup("Volume up (2)");
		glob.volume=0.2;
		currPressedKeys[50]=false;
	}
	if(currPressedKeys[51]){
		if(vol!==0.3)vol>0.3?popup("Volume down (3)"):popup("Volume up (3)");
		glob.volume=0.3;
		currPressedKeys[51]=false;
	}
	if(currPressedKeys[52]){
		if(vol!==0.4)vol>0.4?popup("Volume down (4)"):popup("Volume up (4)");
		glob.volume=0.4;
		currPressedKeys[52]=false;
	}
	if(currPressedKeys[53]){
		if(vol!==0.5)vol>0.5?popup("Volume down (5)"):popup("Volume up (5)");
		glob.volume=0.5;
		currPressedKeys[53]=false;
	}
	if(currPressedKeys[54]){
		if(vol!==0.6)vol>0.6?popup("Volume down (6)"):popup("Volume up (6)");
		glob.volume=0.6;
		currPressedKeys[54]=false;
	}
	if(currPressedKeys[55]){
		if(vol!==0.7)vol>0.7?popup("Volume down (7)"):popup("Volume up (7)");
		glob.volume=0.7;
		currPressedKeys[55]=false;
	}
	if(currPressedKeys[56]){
		if(vol!==0.8)vol>0.8?popup("Volume down (8)"):popup("Volume up (8)");
		glob.volume=0.8;
		currPressedKeys[56]=false;
	}
	if(currPressedKeys[57]){
		if(vol!==0.9)popup("Volume up (max)");
		glob.volume=0.9;
		currPressedKeys[57]=false;
	}
	
	
	
	//doc pressed key events
	if(currPressedKeysDoc[27]&&glob.canvas&&glob.canvas.style.display!="none"){	//press esc when in canvas to exit
		var cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.msCancelAnimationFrame || window.oCancelAnimationFrame;
		document.getElementById("c").style.display="none";
		document.getElementById("help").style.display="block";
		document.getElementById("promptCont").style.display="block";
		glob.startTime=null;
		glob.lvl=null;
		cancelAnimationFrame(requestId);
		document.onkeydown= function(e){	//change handler for enter or space key to restart canvas
			e=e||window.event;
			if((e.keyCode===13||e.keyCode===32)&&glob.canvas&&glob.canvas.style.display==="none"){
				webGLStart();
			}
		}
	}
}

//deploy imformation popup
function popup(text){
	var pop=document.getElementById("popup"),popStyle=pop.style,wait,canvas=document.getElementById("c");
	popStyle.opacity>0?wait=1000:wait=0;//if popup deployed already, wait
	window.setTimeout(function(){
		if(canvas.style.display!=="none"&&popStyle.display!=="block"){
			popStyle.display="block";	//show popup to let user know of the change
			pop.innerHTML=text;
			window.setTimeout(function(){
				popStyle.opacity=0.5;
				window.setTimeout(function(){
					popStyle.opacity=0;
					window.setTimeout(function(){
						popStyle.display="none";
						pop.innerHTML="";
					},300);
				},1000);
			},10);
		}
	},wait);
}

//Loads a new level
function loadLevel(x,y){
	lvl=randomLevelGenerator(x,y);
	
//lvl=[[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,99],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,-98,0,0,0,0,98,0,0,0,0,0,0,0,0,0,-99],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]];
/*
for(i=0;i<10;i++){console.log(lvl[i][0]+"\t"+ lvl[i][1]+"\t"+ lvl[i][2]+"\t"+ lvl[i][3]+"\t"+ lvl[i][4]+"\t"+ lvl[i][5]+"\t"+ lvl[i][6]+"\t"+ lvl[i][7]+"\t"+ lvl[i][8]+"\t"+ lvl[i][9]);}
*/
	for(var i=lvl.length;i--;){	//iterate level rows
		var row=lvl[i];
		for(var j=lvl[0].length;j--;){	//iterate level cells per row
			if(row[j]===-99){	//empty tile
				glob.emptyPos[glob.emptyPos.length]=new Array(j,i);
			}else if(row[j]===98){	//start tile
				glob.heroPos=[j,i,0,0];
				glob.heroPosPrev=[j,i,0,0];
			}else if(row[j]===99){	//finish tile
				glob.finishPos=[j,i];
			}
		}
	}
	return lvl;
}
	

//initiate textures, provide handling on load event
//NOTE1: texture width and height must be pow of 2, in px
//NOTE2: --allow-file-access-from-files must be added to chrome, to bypass same origin policy
function initTextures(){
  glob.block = glob.gl.createTexture();
  blockImage = new Image();
  blockImage.onload = function() { handleTextureLoaded(blockImage, glob.block); }
  blockImage.src = "projectTextures/block.bmp";
  
  glob.end = glob.gl.createTexture();
  endImage = new Image();
  endImage.onload = function() { handleTextureLoaded(endImage, glob.end); }
  endImage.src = "projectTextures/end.bmp";
  
  glob.endD = glob.gl.createTexture();
  endDImage = new Image();
  endDImage.onload = function() { handleTextureLoaded(endDImage, glob.endD); }
  endDImage.src = "projectTextures/endD.bmp";
  
  glob.endDL = glob.gl.createTexture();
  endDLImage = new Image();
  endDLImage.onload = function() { handleTextureLoaded(endDLImage, glob.endDL); }
  endDLImage.src = "projectTextures/endDL.bmp";
  
  glob.endDR = glob.gl.createTexture();
  endDRImage = new Image();
  endDRImage.onload = function() { handleTextureLoaded(endDRImage, glob.endDR); }
  endDRImage.src = "projectTextures/endDR.bmp";
  
  glob.endL = glob.gl.createTexture();
  endLImage = new Image();
  endLImage.onload = function() { handleTextureLoaded(endLImage, glob.endL); }
  endLImage.src = "projectTextures/endL.bmp";
  
  glob.endR = glob.gl.createTexture();
  endRImage = new Image();
  endRImage.onload = function() { handleTextureLoaded(endRImage, glob.endR); }
  endRImage.src = "projectTextures/endR.bmp";
  
  glob.endU = glob.gl.createTexture();
  endUImage = new Image();
  endUImage.onload = function() { handleTextureLoaded(endUImage, glob.endU); }
  endUImage.src = "projectTextures/endU.bmp";
  
  glob.endUL = glob.gl.createTexture();
  endULImage = new Image();
  endULImage.onload = function() { handleTextureLoaded(endULImage, glob.endUL); }
  endULImage.src = "projectTextures/endUL.bmp";
  
  glob.endUR = glob.gl.createTexture();
  endURImage = new Image();
  endURImage.onload = function() { handleTextureLoaded(endURImage, glob.endUR); }
  endURImage.src = "projectTextures/endUR.bmp";
  
  glob.start = glob.gl.createTexture();
  startImage = new Image();
  startImage.onload = function() { handleTextureLoaded(startImage, glob.start); }
  startImage.src = "projectTextures/start.bmp";
  
  glob.hero = glob.gl.createTexture();
  heroImage = new Image();
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
function drawScene() {
	var gl=glob.gl,lvl=glob.lvl,centerY=Math.ceil(lvl.length/2), centerX=Math.ceil(lvl[0].length/2),heroPos=glob.heroPos,heroPosPrev=glob.heroPosPrev,finishPos=glob.finishPos,randEffect=glob.randEffect;
	
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);	//viewport gets canvas values (assigned to the gl context variable)
	gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);	//frame & depth buffers cleaned (depth buf for sorting fragments, find visible one per pixel)
	mat4.perspective(45,gl.viewportWidth/gl.viewportHeight,0.1,100.0,glob.pMatrix);	//projection matrix: FoV deg, aspect ratio, near & far plane
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
				mat4.identity(glob.mvMatrix);	//modelview Matrix initialized with Identity Matrix
				
				mat4.translate(glob.mvMatrix, [0, -(centerY+centerX)/3.5, -(centerY+centerX)*1.75]);	
				mat4.rotate(glob.mvMatrix, degToRad(glob.xTrans*centerX*8), [0, 1, 0]);//rotations with mouse events
				mat4.rotate(glob.mvMatrix, degToRad(glob.yTrans*centerY*8), [-1, 0, 0.3]);
				
				if(glob.lostGame>0){	//Animation for losing the game
					mat4.rotate(glob.mvMatrix, degToRad(-(100-glob.lostGame)/4+Math.pow(100-glob.lostGame,2)/(20*4)), [-0.3, 0.3, 0]);
				}
				if(glob.newGame>33){	//Animation for starting the game
					if(randEffect===1||randEffect===2){
						mat4.translate(glob.mvMatrix, [0, 0, -Math.pow(glob.newGame-33,2)/50]);
					}
					if(randEffect===2||randEffect===3){
						mat4.rotate(glob.mvMatrix, degToRad((glob.newGame-33)*360/66),[0,1,1]);
					}
				}
				mat4.translate(glob.mvMatrix, [0, 0, (centerY+centerX)*2]);
				mat4.rotate(glob.mvMatrix, degToRad(-66), [1, 0, 0]);
				mat4.rotate(glob.mvMatrix, degToRad(25), [0, 0, 1]);
				if(glob.newGame>0){	//Animation for starting the game
					mat4.translate(glob.mvMatrix, [j+centerX*0.2, -i+centerY*4, (-5+height)+
						Math.max(0,glob.newGame-33)/(Math.log(2+Math.abs((j-heroPos[0])*(i-heroPos[1])))/Math.LN2)]);
						//pseudorandom numbers, but static for the two seeds, through three linear congruential generators
					mat4.rotate(glob.mvMatrix, degToRad(Math.pow(Math.max(0,glob.newGame-33),1.5)) , [ ((97*i+j)%23) , ((79*i+j)%11) , ((83*i+j)%17) ]);
				}else if(glob.wonGame>0){	//Animation for winning the level
					if(glob.wonGame===100){	//play next level sound
						if(randEffect===0){
							sounds.newLvl1.volume=glob.volume;
							sounds.newLvl1.play();
						}else if(randEffect===1){
							sounds.newLvl2.volume=glob.volume;
							sounds.newLvl2.play();
						}else if(randEffect===2){
							sounds.newLvl3.volume=glob.volume;
							sounds.newLvl3.play();
						}else{
							sounds.newLvl4.volume=glob.volume;
							sounds.newLvl4.play();
						}
					}
					
					if(row[j]===99){	//Animation for finish tile when winning the level
						mat4.translate(glob.mvMatrix,[
							j+centerX*0.2, 
							-i+centerY*4, 
							(-5+height)+(100-glob.wonGame)/5-Math.pow(100-glob.wonGame,2)/150
						]);
					}else{
						mat4.translate(glob.mvMatrix,[
							j+centerX*0.2, 
							-i+centerY*4, 
							(-5+height)-Math.pow(100-glob.wonGame,2)/(40*Math.log(2+Math.abs((j-heroPos[0])*(i-heroPos[1])))/Math.LN2)
						]);
					}
					mat4.rotate(glob.mvMatrix, degToRad((100-glob.wonGame)*5), [j-finishPos[0], i-finishPos[1], 1]);
				}else if(glob.lostGame>0){	//Animation for losing the game
					mat4.translate(glob.mvMatrix, [j+centerX*0.2, -i+centerY*4, (-5+height)+
					Math.pow(100-glob.lostGame,2)/150]);
				}else{
					mat4.translate(glob.mvMatrix, [j+centerX*0.2, -i+centerY*4, -5+height]);
				}
				if(row[j]===99){	//finish tile
					mat4.translate(glob.mvMatrix, [0, 0, 0.3+Math.sin(degToRad(glob.rCube))/6]);
					mat4.rotate(glob.mvMatrix, degToRad(glob.rCube), [Math.sin(degToRad(glob.rCube/2)), Math.sin(degToRad(glob.rCube*4)), Math.sin(degToRad(glob.rCube*2))]);
					mat4.scale(glob.mvMatrix, [0.35, 0.35, height]);
				}else{
					mat4.scale(glob.mvMatrix, [0.5, 0.5, height]);
				}
				gl.bindBuffer(gl.ARRAY_BUFFER, glob.cubeVertexPosBuf);	//we bind the buffer for the cube vertices
				gl.vertexAttribPointer(glob.shaderProgram.vertexPositionAttribute, glob.cubeVertexPosBuf.itemSize, gl.FLOAT, false, 0, 0);
				gl.bindBuffer(gl.ARRAY_BUFFER, glob.cubeVertexColorBuf);	//we bind the buffer for the cube colors
				gl.vertexAttribPointer(glob.shaderProgram.vertexColorAttribute, glob.cubeVertexColorBuf.itemSize, gl.FLOAT, false, 0, 0);
				//gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexNormalBuffer);// Bind the normals buffer to the shader attribute.
				//gl.vertexAttribPointer(glob.shaderProgram.vertexNormalAttribute, cubeVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);
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
				/*
				if(row[j]===-98){//if is crystal
					mvPushMatrix();	//stack to employ a local transformation
					mat4.identity(glob.mvMatrix);	//modelview Matrix initialized with Identity Matrix
					mat4.translate(glob.mvMatrix, [0, -(centerY+centerX)/3, -(centerY+centerX)*2]);	
					mat4.rotate(glob.mvMatrix, degToRad(glob.xTrans*centerX*8), [0, 1, 0]);//rotations with mouse events
					mat4.rotate(glob.mvMatrix, degToRad(glob.yTrans*centerY*8), [-1, 0, 0.3]);
					mat4.translate(glob.mvMatrix, [0, 0, (centerY+centerX)*2]);
					mat4.rotate(glob.mvMatrix, degToRad(-66), [1, 0, 0]);
					mat4.rotate(glob.mvMatrix, degToRad(25), [0, 0, 1]);
					mat4.translate(glob.mvMatrix, [j+centerX*0.2, -i+centerY*4, -4.4]);
					mat4.rotate(glob.mvMatrix, degToRad(glob.rCube),[0, 0, 1]);
					mat4.rotate(glob.mvMatrix, degToRad(45), 		[0, 1, 0]);
					mat4.rotate(glob.mvMatrix, degToRad(45), 		[1, 0, 0]);
					mat4.scale(glob.mvMatrix, [0.35, 0.35, 0.35]);
					gl.bindBuffer(gl.ARRAY_BUFFER, glob.cubeVertexPosBuf);	//we bind the buffer for the cube vertices
					gl.vertexAttribPointer(glob.shaderProgram.vertexPositionAttribute, glob.cubeVertexPosBuf.itemSize, gl.FLOAT, false, 0, 0);
					gl.bindBuffer(gl.ARRAY_BUFFER, glob.cubeVertexColorBuf);	//we bind the buffer for the cube colors
					gl.vertexAttribPointer(glob.shaderProgram.vertexColorAttribute, glob.cubeVertexColorBuf.itemSize, gl.FLOAT, false, 0, 0);
					gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glob.cubeVertexIndexBuf);	//we bind the buffer for the cube vertex indices
					setMatrixUniforms();	//we update the uniforms for the shaders
					gl.drawElements(gl.TRIANGLES, glob.cubeVertexIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);	//webGL draw call, Triangles mode
					mvPopMatrix();	//we pop the matrix and now the active ModelView matrix is the global one
				}*/
			}
		}
	}	

	//hero
	mvPushMatrix();	//we use the matrix stack to employ a local transformation to the cube
	mat4.identity(glob.mvMatrix);	//the modelview Matrix is initialized with the Identity Matrix	
	mat4.translate(glob.mvMatrix, [0, -(centerY+centerX)/3.5, -(centerY+centerX)*1.75]);	
	mat4.rotate(glob.mvMatrix, degToRad(glob.xTrans*centerX*8), [0, 1, 0]);//rotations with mouse events
	mat4.rotate(glob.mvMatrix, degToRad(glob.yTrans*centerY*8), [-1, 0, 0.3]);
	mat4.translate(glob.mvMatrix, [0, 0, (centerY+centerX)*2]);
	mat4.rotate(glob.mvMatrix, degToRad(-66), [1, 0, 0]);
	mat4.rotate(glob.mvMatrix, degToRad(25), [0, 0, 1]);
	
	var animT=8;	//length of animation
	if(glob.count===-1){	//Set variables
		hp=glob.heroPos;
		glob.heroPosPrev?hpp=glob.heroPosPrev:hpp=hp;
		if(hp[2]===0){				//standing
			if(hp[0]>hpp[0]){glob.rotY+=90;}		//if was going down
			else if(hp[0]<hpp[0]){glob.rotY-=90;}	//if was going up
			else if(hp[1]>hpp[1]){glob.rotX+=90;}	//if was going right
			else if(hp[1]<hpp[1]){glob.rotX-=90;}	//if was going left
			glob.heroHeight=0;
			glob.heroFixPos=[0,0];
		}else if(hp[2]===1){		//fallen horiz right
			if(hp[0]>hpp[0]){glob.rotY+=90;}		//if was going down
			else if(hp[0]<hpp[0]){glob.rotY-=90;}	//if was going up
			else if(hp[1]>hpp[1]){glob.rotZ+=90;}	//if was going right
			else if(hp[1]<hpp[1]){glob.rotZ-=90;}	//if was going left (shouldn't happen)
			glob.heroHeight=-0.5;
			glob.heroFixPos=[-0.5,0];
		}else if(hp[2]===-1){		//fallen horiz left
			if(hp[0]>hpp[0]){glob.rotY+=90;}		//if was going down
			else if(hp[0]<hpp[0]){glob.rotY-=90;}	//if was going up
			else if(hp[1]>hpp[1]){glob.rotZ-=90;}	//if was going right (shouldn't happen)
			else if(hp[1]<hpp[1]){glob.rotZ+=90;}	//if was going left
			glob.heroHeight=-0.5;
			glob.heroFixPos=[0.5,0];
		}else if(hp[2]===2){		//fallen verti down
			if(hp[0]>hpp[0]){glob.rotZ-=90;}		//if was going down
			else if(hp[0]<hpp[0]){glob.rotZ+=90;}	//if was going up (shouldn't happen)
			else if(hp[1]>hpp[1]){glob.rotX+=90;}	//if was going right
			else if(hp[1]<hpp[1]){glob.rotX-=90;}	//if was going left
			glob.heroHeight=-0.5;
			glob.heroFixPos=[0,0.5];
		}else if(hp[2]===-2){		//fallen verti up
			if(hp[0]>hpp[0]){glob.rotZ+=90;}		//if was going down (shouldn't happen)
			else if(hp[0]<hpp[0]){glob.rotZ-=90;}	//if was going up
			else if(hp[1]>hpp[1]){glob.rotX+=90;}	//if was going right
			else if(hp[1]<hpp[1]){glob.rotX-=90;}	//if was going left
			glob.heroHeight=-0.5;
			glob.heroFixPos=[0,-0.5];
		}
		glob.currPressedKeys[37]=false;	//reset pressed keycodes
		glob.currPressedKeys[38]=false;
		glob.currPressedKeys[39]=false;
		glob.currPressedKeys[40]=false;
		glob.currPressedKeys[65]=false;
		glob.currPressedKeys[87]=false;
		glob.currPressedKeys[68]=false;
		glob.currPressedKeys[83]=false;
	}
	
	if(++glob.count<=animT){	//Animation draw
		if(glob.newGame===0){
			sounds.landing.volume=glob.volume;
			sounds.landing.play();	//play landing sound
			glob.newGame--;	//end new game animation
			hp=heroPos;	//reset variables
			hpp=hp;
			glob.hhp=0.1;
			glob.heroPos[2]!==0?glob.heroHeight=-0.5:glob.heroHeight=0;
			glob.heroFixPos=[0,0];
			if(glob.heroPos[2]===1){	  glob.heroFixPos=[-0.5, 0];}
			else if(glob.heroPos[2]===-1){glob.heroFixPos=[ 0.5, 0];}
			else if(glob.heroPos[2]=== 2){glob.heroFixPos=[ 0, 0.5];}
			else if(glob.heroPos[2]===-2){glob.heroFixPos=[ 0,-0.5];}
			glob.heroPosPrev=glob.heroPos;
			glob.heroFixPosPrev=glob.heroFixPos;
		}else if(glob.lostGame===0){
			glob.lostGame--;	//end lost game animation
			hp=heroPos;	//reset variables
			hpp=hp;
			glob.heroHeight=glob.hhp;
			glob.heroFixPosPrev=glob.heroFixPosPrev;
		}
		
		if(glob.newGame>0){	//Animation for starting the game
			if(glob.newGame===7&&glob.newGameFlag){
				sounds.landing.volume=glob.volume;
				sounds.landing.play();	//play landing sound for first time (to fix slow buffer issue)
				glob.newGameFlag=false;
			}
			glob.newGame--;
			glob.count=0;	//stay at animation phase
			mat4.translate(glob.mvMatrix,[
				heroPosPrev[0]+glob.heroFixPos[0]+centerX*0.2, 
				-heroPosPrev[1]+glob.heroFixPos[1]+centerY*4,
				-3.9+glob.heroHeight+glob.newGame+2	//add extra height to smooth transition
			]);
			mat4.rotate(glob.mvMatrix, degToRad(glob.rotX), [1, 0, 0]);
			mat4.rotate(glob.mvMatrix, degToRad(glob.rotY), [0, 1, 0]);
			mat4.rotate(glob.mvMatrix, degToRad(glob.rotZ), [0, 0, 1]);
		}else if(glob.wonGame>0){	//Animation for winning the level
			glob.wonGame--;
			glob.count=0;	//stay at animation phase
			mat4.translate(glob.mvMatrix,[
				finishPos[0]+glob.heroFixPos[0]+centerX*0.2, 
				-finishPos[1]+glob.heroFixPos[1]+centerY*4,
				-3.9+glob.heroHeight+(100-glob.wonGame)/3-Math.pow(100-glob.wonGame,2)/150
			]);
			mat4.rotate(glob.mvMatrix, degToRad(Math.pow(100-glob.wonGame,2)/20), [finishPos[0]/2, finishPos[1]/2, 1]);
		}else if(glob.lostGame>0){	//Animation for losing the game
			var distJump=[0,0];	//extra distance to jump
			if(heroPos[1]<lvl.length-1 && lvl[heroPos[1]+1][heroPos[0]]!==-99){		distJump[1]+=-1; }
			if(heroPos[1]>0 && lvl[heroPos[1]-1][heroPos[0]]!==-99){				distJump[1]+= 1; }
			if(heroPos[0]<lvl[0].length-1 && lvl[heroPos[1]][heroPos[0]+1]!==-99){	distJump[0]+=-1; }
			if(heroPos[0]>0 && lvl[heroPos[1]][heroPos[0]-1]!==-99){				distJump[0]+= 1; }
			if(heroPos[1]<lvl.length-2 && lvl[heroPos[1]+2][heroPos[0]]!==-99){		distJump[1]+=-1; }
			if(heroPos[1]>1 && lvl[heroPos[1]-2][heroPos[0]]!==-99){				distJump[1]+= 1; }
			if(heroPos[0]<lvl[0].length-2 && lvl[heroPos[1]][heroPos[0]+2]!==-99){	distJump[0]+=-1; }
			if(heroPos[0]>1 && lvl[heroPos[1]][glob.heroPos[0]-2]!==-99){			distJump[0]+= 1; }
			
			
			glob.lostGame--;
			glob.count=0;	//stay at animation phase
			mat4.translate(glob.mvMatrix,[
				(distJump[0]*(100-glob.lostGame)/20+hp[0])+glob.heroFixPos[0]+centerX*0.2, 
				-(distJump[1]*(100-glob.lostGame)/20+hp[1])+glob.heroFixPos[1]+centerY*4, 
				-3.9+glob.heroHeight-Math.pow(95-glob.lostGame,2)/120
			]);
			mat4.rotate(glob.mvMatrix, degToRad((glob.rotX*(100-glob.lostGame)/15)+(glob.rotXprev*glob.lostGame/100)), [1, 0, 0]);
			mat4.rotate(glob.mvMatrix, degToRad((glob.rotY*(100-glob.lostGame)/15)+(glob.rotYprev*glob.lostGame/100)), [0, 1, 0]);
			mat4.rotate(glob.mvMatrix, degToRad((glob.rotZ*(100-glob.lostGame)/15)+(glob.rotZprev*glob.lostGame/100)), [0, 0, 1]);
			mat4.rotate(glob.mvMatrix, degToRad(Math.pow(100-glob.lostGame,2)/30), [1, 1, 1]);
		}
		if(glob.lostGame<=-1&&glob.wonGame<=-1&&glob.newGame<=-1){	//translation/rotation associated with keypress events
			if(hp!==hpp){glob.hhp=glob.hhp+0.1;}	//add "spring" to step
			mat4.translate(glob.mvMatrix,[
				(hp[0]*glob.count/animT)+(hpp[0]*(animT-glob.count)/animT)+(glob.heroFixPos[0]*glob.count/animT)+(glob.heroFixPosPrev[0]*(animT-glob.count)/animT)+centerX*0.2, 
				-(hp[1]*glob.count/animT+hpp[1]*(animT-glob.count)/animT)+(glob.heroFixPos[1]*glob.count/animT)+(glob.heroFixPosPrev[1]*(animT-glob.count)/animT)+centerY*4, 
				-3.9+(glob.heroHeight*(glob.count)/animT)-((glob.hhp)*(glob.count-animT)/animT)
			]);
			mat4.rotate(glob.mvMatrix, degToRad((glob.rotX*glob.count/animT)+(glob.rotXprev*(animT-glob.count)/animT)), [1, 0, 0]);
			mat4.rotate(glob.mvMatrix, degToRad((glob.rotY*glob.count/animT)+(glob.rotYprev*(animT-glob.count)/animT)), [0, 1, 0]);
			mat4.rotate(glob.mvMatrix, degToRad((glob.rotZ*glob.count/animT)+(glob.rotZprev*(animT-glob.count)/animT)), [0, 0, 1]);
		}
	}
	
	if(glob.count===animT){	//Reset variables
		if(hp!==hpp&&lvl[hp[1]][hp[0]]!==-99){
			sounds.fallVerti.volume=glob.volume;
			sounds.fallVerti.play();
		}
		if(hp[2]===0){	//standing
			glob.rotX=0;
			glob.rotY=0;
			glob.rotZ=0;
		}else if(hp[2]===1){//fallen horiz right
			glob.rotX=0;
			glob.rotY=90;
			glob.rotZ=0;
		}else if(hp[2]===-1){//fallen horiz left
			glob.rotX=0;
			glob.rotY=-90;
			glob.rotZ=0;
		}else if(hp[2]===2){//fallen verti down
			glob.rotX=90;
			glob.rotY=0;
			glob.rotZ=0;
		}else if(hp[2]===-2){//fallen verti up
			glob.rotX=-90;
			glob.rotY=0;
			glob.rotZ=0;
		}
		glob.count=-1;		//Reset & save past variables
		glob.rotXprev=glob.rotX;
		glob.rotYprev=glob.rotY;
		glob.rotZprev=glob.rotZ;
		glob.heroPosPrev=hp;
		glob.hhp=glob.heroHeight;
		glob.heroFixPosPrev=glob.heroFixPos;
		glob.hpp=glob.hp;
	}
	
	mat4.scale(glob.mvMatrix, [0.5, 0.5, 1]);
	gl.bindBuffer(gl.ARRAY_BUFFER, glob.cubeVertexPosBuf);	//we bind the buffer for the cube vertices
	gl.vertexAttribPointer(glob.shaderProgram.vertexPositionAttribute, glob.cubeVertexPosBuf.itemSize, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, glob.cubeVertexColorBuf);	//we bind the buffer for the cube colors
	gl.vertexAttribPointer(glob.shaderProgram.vertexColorAttribute, glob.cubeVertexColorBuf.itemSize, gl.FLOAT, false, 0, 0);
	//gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexNormalBuffer);// Bind the normals buffer to the shader attribute.
	//gl.vertexAttribPointer(glob.shaderProgram.vertexNormalAttribute, cubeVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer);
	gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);
	gl.bindTexture(gl.TEXTURE_2D, glob.hero);
	gl.uniform1i(gl.getUniformLocation(glob.shaderProgram, "uSampler"), 0);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glob.cubeVertexIndexBuf);	//we bind the buffer for the cube vertex indices
	setMatrixUniforms();	//we update the uniforms for the shaders
	gl.drawElements(gl.TRIANGLES, glob.cubeVertexIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);	//webGL draw call, Triangles mode
	mvPopMatrix();	//we pop the matrix and now the active ModelView matrix is the global one
}


//Win-loss conditions
function checkConditions(requestId){
	var heroPos=glob.heroPos,heroPosPrev=glob.heroPosPrev,finishPos=glob.finishPos,emptyPos=glob.emptyPos;
	if(finishPos[0]===heroPosPrev[0]&&finishPos[1]===heroPosPrev[1]&&heroPosPrev[2]===0){
		//glob.sndWin.play();
		if(glob.wonGame===-1){	//if player reached objective cancel requestAnimFrame and restart
			glob.wonGame=100;	//begin win animation
		}else if(glob.wonGame===0){	//when ends continue
		var cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.msCancelAnimationFrame || window.oCancelAnimationFrame;
		cancelAnimationFrame(requestId);
		resetGameState();
		glob.score++;
		webGLStart();
		}
	}else{	//check for loss
		for(var i=emptyPos.length;i--;){
			var empty=emptyPos[i];
			if((empty[0]===heroPosPrev[0]&&empty[1]===heroPosPrev[1])||	
			(heroPosPrev[2]===1&&empty[0]===heroPosPrev[0]-1&&empty[1]===heroPosPrev[1])||
			(heroPosPrev[2]===-1&&empty[0]===heroPosPrev[0]+1&&empty[1]===heroPosPrev[1])||
			(heroPosPrev[2]===2&&empty[0]===heroPosPrev[0]&&empty[1]===heroPosPrev[1]-1)||
			(heroPosPrev[2]===-2&&empty[0]===heroPosPrev[0]&&empty[1]===heroPosPrev[1]+1)||
			(glob.lvl&&(heroPos[0]<0||heroPos[1]<0))){
				if(glob.lostGame===-1){
					glob.lostGame=100;	//begin lose animation
				}else if(glob.lostGame===0){	//when ends continue
					//glob.sndLose.play();
					var cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.msCancelAnimationFrame || window.oCancelAnimationFrame;
					cancelAnimationFrame(requestId);	//if player reached empty space cancel requestAnimFrame and return
					resetGameState();
					glob.startTime=null;
					glob.score=0;
					glob.topScore=0;
					pageUI(-1);
				}
			}
		}
	}
}
	
//The matrix stack operation are implemented below to handle local transformations
function mvPushMatrix(){	//Push Matrix Operation
	var copy=mat4.create();
	mat4.set(glob.mvMatrix,copy);
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
	
	//mat4.toInverseMat3(glob.mvMatrix, glob.normalMatrix);
	//glob.normalMatrix = mat3.toMat4(glob.normalMatrix);
	//mat4.transpose(glob.normalMatrix);
	//shProgram.nUniform = gl.getUniformLocation(shProgram, "uNormalMatrix");
	//gl.uniformMatrix4fv(shProgram.nUniform,false,glob.normalMatrix);
}

//Randomly creates rooms and connects them
function randomLevelGenerator(x,y){
	var startX=0,startY=0,endX=x,endY=y,room1X,room1Y,room2X,room2Y,room3X,room3Y,lvl=[],x1PadS=0,y1PadS=0,x1PadE=0,y1PadE=0,x1Pad1=0,y1Pad1=0,x1Pad2=0,y1Pad2=0,x1Pad3=0,y1Pad3=0,x2PadS=0,y1PadS=0,x1PadE=0,y1PadE=0,x1Pad1=0,y1Pad1=0,x1Pad2=0,y1Pad2=0,x1Pad3=0,y1Pad3=0;
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
	
	//98: start, 99: end, -99: empty, -98:crystal, else height of level
	for(var i=y+1;i--;){	//create map with rooms
		lvl[i]=[];
		row=lvl[i];
		for(var j=x+1;j--;){
			if(i-y1PadS<=startY&&startY<=i+y2PadS&&j-x1PadS<=startX&&startX<=j+x2PadS){ row[j]=0; }	//fill around start
			else if(i-y1PadE<=endY&&endY<=i+y2PadE&&j-x1PadE<=endX&&endX<=j+x2PadE){ row[j]=0; }	//fill around end
			else if((i===room1Y&&j===room1X)||(i===room2Y&&j===room2X)||(i===room3Y&&j===room3X)){ row[j]=-98; }//crystal
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

//Animate function
function animate(){
	var timeNow=new Date().getTime(),lastTime=glob.lastTime;
	if(lastTime!=0){	//adjust a constant rotation speed independently of platform/framerate
		glob.rCube-=(timeNow-lastTime)*0.075;
	}
	glob.lastTime=timeNow;
}