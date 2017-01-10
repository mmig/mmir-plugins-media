/*
 * based on speakWorker.js from:
 * 
 * speak.js
 * https://github.com/logue/speak.js
 * License: GPL-3.0
 */

importScripts('speakGenerator.js');

onmessage = function(event) {
	
	var msg = event.data;
	var id = msg.id;
	
	try { 
		var audioData = generateSpeech(msg.text, msg.options)
		postMessage({id: id, data: audioData});
	} catch(ex){
		postMessage({id: id, error: true, message: ex.stack? ex.stack : ex.toString()});
	}
  
};

