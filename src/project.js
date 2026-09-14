//THEMISTOKLIS KOUTSOURIS - TUC - GRAPHICS COURSE - BLOXORZ IMPLEMENTED WITH WEBGL
import { glob as game } from './state';
import { beginLevel, startLoop, stopLoop, saveCurrentGame } from './loop';
import { loadGame, getTopScore, setTopScore } from './save';
import { play, getVolume, setVolume as setAudioVolume, toggleMute as toggleAudioMute, isMuted } from './audio';
import { initRenderer, resizeCanvas } from './renderer';
import { levelFor } from './level';
import { clearGame } from './save';
import { randomSeed, seedToString } from './rng';

var starting=false;	//true from a start request until the level runs, so a double Enter can't start two loops


//binds the menu handlers, once
export function initUI(){
	var promptArr=document.getElementsByClassName("prompt");
	for(var i=promptArr.length;i--;){
		promptArr[i].addEventListener("pointerdown",startFromMenu);
	}
	document.getElementById("newSeed").addEventListener("click",newSeed);
	document.getElementById("pause").addEventListener("click",pause);
	document.getElementById("mute").addEventListener("click",toggleMute);
	refreshMute();
	document.getElementById("shareSeed").addEventListener("click",shareSeed);
}

//manipulates the web page
export function pageUI(result){
	refreshSeed();
	document.body.classList.remove("playing");
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
	document.body.classList.remove("playing");
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
	var vol=isMuted()?0:getVolume(),next=digit/10;
	if(vol!==next){
		if(digit===0)popup("Volume down (mute)");
		else if(digit===9)popup("Volume up (max)");
		else popup((vol>next?"Volume down (":"Volume up (")+digit+")");
	}
	setAudioVolume(next);
	refreshMute();
}

//[M] or the speaker button : mute / unmute, remembering the volume
export function toggleMute(){
	popup(toggleAudioMute()?"Sound off":"Sound on");
	refreshMute();
}

function refreshMute(){
	document.getElementById("mute").classList.toggle("muted",isMuted()||getVolume()===0);
}

//starts the webGL game
export async function webGLStart(){
	resetPrompt();
	if(!(await initRenderer(game.canvas))){
		showError("WEBGL2 NOT SUPPORTED");
		return;
	}
	game.canvas.style.display="block";
	document.body.classList.add("playing");
	document.getElementById("help").style.display="none";
	var save=loadGame(),next;
	if(save){	//if game was stopped
		game.runSeed=save.runSeed;
		game.level=save.level;
		game.score=save.score;
		game.topScoreShown=save.topScoreShown;
		next=levelFor(game.runSeed,game.level);
		beginLevel(save.lvl,save.heroPos);
	}else{//else generates the run's next level (size grows with the level number)
		next=levelFor(game.runSeed,game.level);
		beginLevel(next.lvl,null);
	}
	game.randEffect=next.randEffect;	//the effect for loading the level
	refreshSeed();
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
		if(popStyle.display!=="block"){
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

//shows the run's seed and level, and keeps ?seed= in the address bar so the URL is always shareable
function refreshSeed(){
	var url=new URL(location.href);
	url.searchParams.set("seed",seedToString(game.runSeed));
	history.replaceState(null,"",url);
	document.getElementById("seedValue").textContent=seedToString(game.runSeed)+" · LEVEL "+(game.level+1);
	document.getElementById("newSeed").style.display=isPlaying()?"none":"inline";
}

//menu only: abandon the current run and roll a fresh seed
export function newSeed(){
	if(isPlaying()||starting)return;
	clearGame();
	game.runSeed=randomSeed();
	game.level=0;
	game.score=0;
	game.topScoreShown=false;
	resetPrompt();
	pageUI();
}

function shareSeed(){
	var url=location.href;
	if(navigator.share){
		navigator.share({title:"Bloxorz",url:url}).catch(function(){});
	}else{
		navigator.clipboard.writeText(url).then(function(){ popup("Link copied"); },function(){});
	}
}
