//THEMISTOKLIS KOUTSOURIS - TUC - GRAPHICS COURSE - BLOXORZ IMPLEMENTED WITH WEBGL
import { glob as game } from './state';
import { beginLevel, startLoop, stopLoop, saveCurrentGame } from './loop';
import { loadGame, getTopScore, setTopScore } from './save';
import { play } from './audio';
import { initRenderer, resizeCanvas } from './renderer';

var starting=false;	//true from a start request until the level runs, so a double Enter can't start two loops


//binds the menu handlers, once
export function initUI(){
	var promptArr=document.getElementsByClassName("prompt");
	for(var i=promptArr.length;i--;){
		promptArr[i].addEventListener("pointerdown",startFromMenu);
	}
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
export async function webGLStart(){
	resetPrompt();
	if(!(await initRenderer(game.canvas))){
		showError("WEBGL2 NOT SUPPORTED");
		return;
	}
	game.canvas.style.display="block";
	document.getElementById("help").style.display="none";
	var min,max,save=loadGame();
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
}

function showError(text){
	var prompt=document.getElementById("promptPlay");
	prompt.textContent=text;
	prompt.style.display="block";
	prompt.style.transform="scale(1)";
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

