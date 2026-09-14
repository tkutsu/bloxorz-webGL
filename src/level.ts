import { mulberry32 } from './rng'
import type { Level } from './state'

/** Level `levelIndex` of the run started with `runSeed`: same inputs, same level, on every machine. */
export function levelFor(runSeed: number, levelIndex: number): { lvl: Level; randEffect: number } {
  const rng = mulberry32(runSeed + Math.imul(levelIndex, 0x9e3779b9))
  const min = Math.floor(levelIndex / 5 + 5) //levels grow every 5 levels
  const max = min * 2
  const width = Math.floor(rng() * (max - min + 1)) + min
  const height = Math.floor(rng() * (max - min + 1)) + min
  return { lvl: randomLevelGenerator(width, height, rng), randEffect: Math.floor(rng() * 4) }
}

//Randomly creates rooms and connects them
function randomLevelGenerator(x: number, y: number, rng: () => number): Level {
	let startX=0,startY=0,endX=x,endY=y,room1X=0,room1Y=0,room2X=0,room2Y=0,room3X=0,room3Y=0,lvl: Level=[],x1PadS=0,y1PadS=0,x1PadE=0,y1PadE=0,x1Pad1=0,y1Pad1=0,x1Pad2=0,y1Pad2=0,x1Pad3=0,y1Pad3=0,x2PadS=0,y2PadS=0,x2PadE=0,y2PadE=0,x2Pad1=0,y2Pad1=0,x2Pad2=0,y2Pad2=0,x2Pad3=0,y2Pad3=0;
	x--,y--; //arrays start from 0
	
	do{	//calculate random start/end positions (and room padding). Must be at least 1/2.5 of the level apart
		startX=Math.floor(rng()*x)+1;
		startY=Math.floor(rng()*y)+1;
		endX=Math.floor(rng()*x)+1;
		endY=Math.floor(rng()*y)+1;
		x1PadS=Math.floor(rng()*3); //Math.floor(rng()*(max-min+1))+min
		y1PadS=Math.floor(rng()*3);
		x2PadS=Math.floor(rng())+4-x1PadS;
		y2PadS=Math.floor(rng())+4-y1PadS;
		x1PadE=Math.floor(rng()*3);
		y1PadE=Math.floor(rng()*3);
		x2PadE=Math.floor(rng())+4-x1PadE;
		y2PadE=Math.floor(rng())+4-y1PadE;
	}while(endY-(y/2.5)<=startY&&startY<=endY+(y/2.5)&&endX-(x/2.5)<=startX&&startX<=endX+(x/2.5));
	
	if(x*y>=81){
		do{	//calculate random room center. Must be at least 1/5 of the previous positions apart
			room1X=Math.floor(rng()*(x+1));
			room1Y=Math.floor(rng()*(y+1));
			x1Pad1=Math.floor(rng()*3);
			y1Pad1=Math.floor(rng()*3);
			x2Pad1=Math.floor(rng()*2)+3-x1Pad1;
			y2Pad1=Math.floor(rng()*2)+3-y1Pad1;
		}while((endY-(y/5)<=room1Y&&room1Y<=endY+(y/5)&&endX-(x/5)<=room1X&&room1X<=endX+(x/5))||
		(startY-(y/5)<=room1Y&&room1Y<=startY+(y/5)&&startX-(x/5)<=room1X&&room1X<=startX+(x/5)));
	}
	
	if(x*y>=196){
		do{	//calculate more random room centers. Must be at least 1/5 of the previous positions apart
			room2X=Math.floor(rng()*(x+1));
			room2Y=Math.floor(rng()*(y+1));
			x1Pad2=Math.floor(rng()*3);
			y1Pad2=Math.floor(rng()*3);
			x2Pad2=Math.floor(rng()*2)+3-x1Pad2;
			y2Pad2=Math.floor(rng()*2)+3-y1Pad2;
		}while((endY-(y/5)<=room2Y&&room2Y<=endY+(y/5)&&endX-(x/5)<=room2X&&room2X<=endX+(x/5))||
		(startY-(y/5)<=room2Y&&room2Y<=startY+(y/5)&&startX-(x/5)<=room2X&&room2X<=startX+(x/5))||
		(room1Y-(y/5)<=room2Y&&room2Y<=room1Y+(y/5)&&room1X-(x/5)<=room2X&&room2X<=room1X+(x/5)));
	}
	
	if(x*y>=361){
		do{	//calculate more random room centers. Must be at least 1/5 of the previous positions apart
			room3X=Math.floor(rng()*(x+1));
			room3Y=Math.floor(rng()*(y+1));
			x1Pad3=Math.floor(rng()*3);
			y1Pad3=Math.floor(rng()*3);
			x2Pad3=Math.floor(rng()*2)+3-x1Pad3;
			y2Pad3=Math.floor(rng()*2)+3-y1Pad3;
		}while((endY-(y/5)<=room3Y&&room3Y<=endY+(y/5)&&endX-(x/5)<=room3X&&room3X<=endX+(x/5))||
		(startY-(y/5)<=room3Y&&room3Y<=startY+(y/5)&&startX-(x/5)<=room3X&&room3X<=startX+(x/5))||
		(room2Y-(y/5)<=room3Y&&room3Y<=room2Y+(y/5)&&room2X-(x/5)<=room3X&&room3X<=room2X+(x/5))||
		(room1Y-(y/5)<=room3Y&&room3Y<=room1Y+(y/5)&&room1X-(x/5)<=room3X&&room3X<=room1X+(x/5)));
	}
	
	//98: start, 99: end, -99: empty, else height of level
	for(let i=y+1;i--;){	//create map with rooms
		lvl[i]=[];
		const row=lvl[i];
		for(let j=x+1;j--;){
			if(i-y1PadS<=startY&&startY<=i+y2PadS&&j-x1PadS<=startX&&startX<=j+x2PadS){ row[j]=0; }	//fill around start
			else if(i-y1PadE<=endY&&endY<=i+y2PadE&&j-x1PadE<=endX&&endX<=j+x2PadE){ row[j]=0; }	//fill around end
			else if(y1Pad1>0&&i-y1Pad1<=room1Y&&room1Y<=i+y2Pad1&&j-x1Pad1<=room1X&&room1X<=j+x2Pad1){ row[j]=0; }	//fill around room1
			else if(y1Pad2>0&&i-y1Pad2<=room2Y&&room2Y<=i+y2Pad2&&j-x1Pad2<=room2X&&room2X<=j+x2Pad2){ row[j]=0; }	//fill around room2
			else if(y1Pad3>0&&i-y1Pad3<=room3Y&&room3Y<=i+y2Pad3&&j-x1Pad3<=room3X&&room3X<=j+x2Pad3){ row[j]=0; }	//fill around room3
			else{ row[j]=-99; } //else is empty
		}
	}
	
	let arrMid=[[startX,startY],[endX,endY]];	//find shortest path between rooms for one of 3 sizes of map
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
	for(let i=arrMid.length-1;i--;){
		lvl=drawLine(lvl,arrMid[i][0],arrMid[i][1],arrMid[i+1][0],arrMid[i+1][1]);
	}
	
	lvl[startY][startX]=98; //set start
	lvl[endY][endX]=99; //set end
	
	//empty padding around map
	for(let i=lvl.length;i--;){
		lvl[i].unshift(-99);
		lvl[i].unshift(-99);
		lvl[i].push(-99);
		lvl[i].push(-99);
	}
	const emptyRow: number[]=[];
	for(let i=lvl[0].length;i--;){
		emptyRow[i]=-99;
	}
	lvl.push(emptyRow);
	lvl.push(emptyRow);
	lvl.unshift(emptyRow);
	lvl.unshift(emptyRow);
	
	return lvl;
}

//Bresenham's algo links the rooms
function drawLine(lvl: Level,x0: number,y0: number,x1: number,y1: number): Level {
	const dx=Math.abs(x1-x0);
	const dy=Math.abs(y1-y0);
	const sx=(x0<x1)?1:-1;
	const sy=(y0<y1)?1:-1;
	let err=dx-dy;
	while(true){
		lvl[y0][x0]=0;
		if(y0>0){lvl[y0-1][x0]=0;}
		if(x0>0){lvl[y0][x0-1]=0;}
		if(y0+1<lvl.length){lvl[y0+1][x0]=0;}
		if(x0+1<lvl[y0].length){lvl[y0][x0+1]=0;}
		if((x0==x1)&&(y0==y1)){break;}
		const e2=2*err;
		if(e2>-dy){err-=dy;x0+=sx;}
		if(e2< dx){err+=dx;y0+=sy;}
	}
	return lvl;
}

