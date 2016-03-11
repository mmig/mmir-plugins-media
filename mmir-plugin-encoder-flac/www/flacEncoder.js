
importScripts('workerUtil.js');

/**
 * using libflac.js 
 * Copyright (C) 2013-2014 DFKI GmbH, F. Petersen A. Russ
 * BSD and partially MIT license (see GitHub repository)
 * 
 * @see https://github.com/mmig/libflac.js
 */
importScripts('libflac.min.js');

importScripts('silenceDetector.js');
importScripts('encoder.js');


function FlacEncoder(){
	var flac_encoder;
	var flac_ok = 1;
	var INIT = false;
	var recLengthFlac = 0;
	
	var tempBuffer = [];
	this.encoded;
	
	var write_callback_fn = function (buffer, bytes){
	    tempBuffer.push(buffer);
	    recLengthFlac += buffer.byteLength;
//	    console.log("callback: " + tempBuffer);
	};
	
	this.encoderInit = function(){
		//								SAMPLERATE, CHANNELS, BPS, COMPRESSION, 0
		flac_encoder = Flac.init_libflac(44100, 1, 16, 5, 0);
		
		if (flac_encoder != 0){
			var status_encoder = Flac.init_encoder_stream(flac_encoder, write_callback_fn);
			flac_ok &= (status_encoder == 0);
			INIT = true;
		} else {
			console.log("Error initializing the encoder.");
		}
	};
	
	this.encodeBuffer = function(buff){		    
//		console.log("call encodeToFlac");
	    //var buff = mergeBuffersFloat(recBuffersL, recLength);
	    var buf_length = buff.length;
	    
	    //console.log("bufflen: " + buf_length);
	    
	    var buffer_i32 = new Uint32Array(buf_length);
	    var view = new DataView(buffer_i32.buffer);
	    var volume = 1;
	    var index = 0;
	    for (var i = 0; i < buf_length; i++){
	        view.setInt32(index, (buff[i] * (0x7FFF * volume)), true);
	        index += 4;
	    }
	    
	    //clear();//TODO move clear
	   
	    // WAVE - PCM
	    var flac_return = Flac.encode_buffer_pcm_as_flac(flac_encoder, buffer_i32, 1, buf_length);
	    if (flac_return != true){
	            console.log("Error: encode_buffer_pcm_as_flac returned false. " + flac_return);
	    }
//	    else { //PB DEBUB
//	    	console.log("OK: encode_buffer_pcm_as_flac returned true. " + flac_return);
//	    	
//	    }
    
	 };
	 this.encoderFinish = function(){
	        flac_ok &= Flac.FLAC__stream_encoder_finish(flac_encoder);
//	        console.log("flac finish: " + flac_ok);
	        INIT = false;
	       
	        var totalBufferSize = recLengthFlac;
	        //reset current buffers size 
	        recLengthFlac = 0;
	        //get & reset current buffer content
	        var buffers = tempBuffer.splice(0, tempBuffer.length);
	        this.encoded = mergeBuffersUint( buffers, totalBufferSize);
//	        console.log("encoded: " + this.encoded);
	        	        
	 };
	 this.encoderCleanUp = function(){
		 this.encoderInit(); 
	 };
}

//export into global instance variable (see encoder.js for sending/receiving messages on this)
encoderInstance = new FlacEncoder();
