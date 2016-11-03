#!/usr/bin/env node

var npmOptions = require('../util/npm-config.js');

//TODO add cmd support?
//var args = process.argv;
//for(var i=args.length-1; i >= 0; --i){
//	console.log('  arg '+i+': '+args[i]);
//}

function doStart(){
	
	var installAssets = require('mmir-install-cordova-assets');
	
	//TODO add cmd support?
	
	var options = npmOptions.getConfigOptions();
	
	options.callback = function onComplete(error){
		if(error){
			//-> an error occurred
			process.exit(1);
		} else {
			process.exit(0);
		}
	}
	
	installAssets.copyAssets(options);
	
	
}

doStart();
