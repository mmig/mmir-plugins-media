/*
 * 	Copyright (C) 2012-2016 DFKI GmbH
 * 	Deutsches Forschungszentrum fuer Kuenstliche Intelligenz
 * 	German Research Center for Artificial Intelligence
 * 	http://www.dfki.de
 * 
 * 	Permission is hereby granted, free of charge, to any person obtaining a 
 * 	copy of this software and associated documentation files (the 
 * 	"Software"), to deal in the Software without restriction, including 
 * 	without limitation the rights to use, copy, modify, merge, publish, 
 * 	distribute, sublicense, and/or sell copies of the Software, and to 
 * 	permit persons to whom the Software is furnished to do so, subject to 
 * 	the following conditions:
 * 
 * 	The above copyright notice and this permission notice shall be included 
 * 	in all copies or substantial portions of the Software.
 * 
 * 	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
 * 	OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
 * 	MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
 * 	IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY 
 * 	CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, 
 * 	TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
 * 	SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


/**
 * Media Module: Implementation for Speech Recognition via the Google Web Speech Recognition service v1 using a proxy/mediator server
 * 
 * 
 * @requires Cross-Domain access, if proxy/mediator server is not located in the same domain as the web app
 * @requires CSP for accessing the proxy/mediator server via ws: or wss:, e.g. "connect-src ws://server-address" or "default-src connect-src ws://server-address"
 * 
 */
newWebAudioAsrImpl = (function NuanceWsWebAudioInputImpl() {
	

	/**  @memberOf NuanceWsWebAudioInputImpl# */
	var MODE = 'nuanceWs';

	/**  @memberOf NuanceWsWebAudioInputImpl# */
	var _pluginName = 'nuanceWsWebAudioInput';

	/** 
	 * @type mmir.LanguageManager
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var languageManager = require('languageManager');
	/** 
	 * @type mmir.ConfigurationManager
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var configurationManager = require('configurationManager');
	
	/**
	 * Result types (returned by the native/Cordova plugin)
	 * 
	 * @type Enum
	 * @constant
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var RESULT_TYPES = {
		"FINAL": 				"FINAL",
		"INTERIM": 				"INTERIM",
		"INTERMEDIATE":			"INTERMEDIATE",
		"RECOGNITION_ERROR": 	"RECOGNITION_ERROR",
		"RECORDING_BEGIN": 		"RECORDING_BEGIN",
		"RECORDING_DONE": 		"RECORDING_DONE"
	};

	/** 
	 * @type mmir.ConfigurationManager
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var mediaManager = require('mediaManager');

	/** @memberOf NuanceWsWebAudioInputImpl# */
	var inputId = 0;
	
	/** @memberOf NuanceWsWebAudioInputImpl# */
	var lastBlob = false;

	/** @memberOf NuanceWsWebAudioInputImpl# */
	var isUseIntermediateResults = false;	
	
	/** 
	 * @type WebSocket
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var webSocket = null;
	
	var stopped = true;
	
	var textProcessor, currentFailureCallback, closeMicFunc;
	
	var WS_STATUS_ENUM = {OPENING : "opening",
						SETUP : "setup",
						WORKING : "working",
						CLOSED : "closed",
						SEALED : "sealed",
						NEXT_QUERY : "next_query"
						};
	
	var wsStatus = WS_STATUS_ENUM.CLOSED;
	var msgBuffer = [];
	var connectionAttempt = 0;
    var _ttsTransactionId = 0;
    var _asrTransactionId = 1;
    var _nluTransactionId = 2;
    var _asrRequestId = 0;
    
	var encoderStr = configurationManager.getString( [_pluginName, "encoder"] );
	
	var codecTyp = "audio/L16;rate=16000";
	
	if(encoderStr.includes("pcm")){
		codecTyp = "audio/L16;rate=16000";
	}else if (encoderStr.includes("speex")){
		codecTyp = "audio/x-speex;mode=wb";
	}else if (encoderStr.includes("opus")){
		codecTyp = "audio/opus;rate=16000";
	}
    
	
    var streaming = "true"; //FIXME read from config
    
    //register listener to get the recorder
	var _recorder;
	var onAudioChunkStored = function(){
		_recorder.doEncode();
		_recorder.doFinish();
	};
	
	mediaManager.on('webaudioinputstarted', function(input, audio_context, recorder){
		_recorder = recorder;
		var hasListener = recorder.hasListeners("onchunkstored");
		if(!hasListener){
			recorder.on('onchunkstored', onAudioChunkStored);
		}
	});
    
    
    var changeWsStatus = function(newStatus){
    	//console.log("change wsStatus from "+wsStatus+" to " + newStatus);
    	
    	if(wsStatus == WS_STATUS_ENUM.SEALED){
    		return;
    	}else{
    		wsStatus = newStatus;
    	}
    }

	/** @memberOf NuanceWsWebAudioInputImpl# */
	var doSend = function(msg, successCallback, failureCallback){
		//string or object{cmd: 'string', buff:<data>}
		if(successCallback){
			textProcessor = successCallback;
		}
		if(failureCallback){
			currentFailureCallback = failureCallback;
		}
		
		var data; 
		
		if(msg.cmd !== undefined){
			data = msg.buf;
		}else{
			data = msg;
		}
		
		
		if(wsStatus != WS_STATUS_ENUM.WORKING){
			if (typeof data === 'string' || data instanceof String){
			msgBuffer.push(data);
			}else{
				msgBuffer.push(data); //Patbit TODO this is ugly logic
			}
			if(wsStatus == WS_STATUS_ENUM.CLOSED){
				buildConnection();
			}
		}else{
			try{//FIXME this should not be necessary...
				if (typeof data === 'string' || data instanceof String){
				//console.log("ws dosend string : "+msg);
					webSocket.send(data);
				}else if(typeof data === 'ArrayBuffer' || data instanceof ArrayBuffer) {
					//console.log("ws dosend ArrayBuffer");
					webSocket.send(data);
				}else if(typeof data === 'Array' || data instanceof Array){
					//console.log("ws dosend buffers from a array");
					data.forEach(function(typedArray){
						doSend(typedArray.buffer);
	                });
				}else if(data !== undefined){
					console.warn("buffer is an unknowen typ");
						doSend(data);
					
				}else{
					//console.log("skip data sending -> undefined");
				}
				//webSocket.send(msg);
			} catch(err){
				console.log("Error while send");
				console.error(err);
			}
		}
		
	};
	
	var setupNuance = function(){
		connectionAttempt = 0;
		
		if(wsStatus != WS_STATUS_ENUM.NEXT_QUERY){
			changeWsStatus(WS_STATUS_ENUM.SETUP);
		}
         _asrTransactionId += 2;
         _asrRequestId++;
         
         //request long-variant of language code:
         var lang = languageManager.getLanguageConfig(_pluginName, 'long');
         
         //console.log("cur lang: "+lang);

            var _query_begin = {
                'message': 'query_begin',
                'transaction_id': _asrTransactionId,
                'language': lang, 
                'codec':  codecTyp, 
                'command': 'NVC_ASR_CMD',
                'recognition_type': 'dictation'
            };

            var _request_info = {
                'message': 'query_parameter',
                'transaction_id': _asrTransactionId,

                'parameter_name': 'REQUEST_INFO',
                'parameter_type': 'dictionary',
                'dictionary': {
                    'start': 0,
                    'end': 0,
                    'text': ''
                }
            };
            
            var _audio_info = {
                'message': 'query_parameter',
                'transaction_id': _asrTransactionId,

                'parameter_name': 'AUDIO_INFO',
                'parameter_type': 'audio',

                'audio_id': _asrRequestId
            };
            var _query_end = {
                'message': 'query_end',
                'transaction_id': _asrTransactionId
            };
            var _audio_begin = {
                'message': 'audio',
                'audio_id': _asrRequestId
            };
                
            //console.log("send setup nuance");
            webSocket.send(JSON.stringify(_query_begin));
            webSocket.send(JSON.stringify(_request_info));
            webSocket.send(JSON.stringify(_audio_info));
            webSocket.send(JSON.stringify(_query_end));
            webSocket.send(JSON.stringify(_audio_begin));
            
            if(wsStatus == WS_STATUS_ENUM.NEXT_QUERY){
            	//send buffer because no connect msg will come
            	//console.log("nuancesetup sendMsgBuffer");
            	sendMsgBuffer();
            }else{
            	//console.log("send NO msg buffer");
            	//changeWsStatus(WS_STATUS_ENUM.WORKING);
            }
	}

	var sendMsgBuffer = function(){
		var audioEndFlag = false;
		
		if(msgBuffer.length > 0){
			var audioEndFlag = false;
			for(var i=0; i < msgBuffer.length; ++i){
				if(typeof msgBuffer[i] === "string"){
					//console.log("sendMsgBuffer string: "+ msgBuffer[i]);
					audioEndFlag = true;
				}else{
					//console.log("sendMsgBuffer BLOB");
					//PatBit debug webSocket.send(msgBuffer[i]);
				}
			}
			
			msgBuffer = [];			
		}
		if(audioEndFlag){
			var _audio_end = {
	                'message': 'audio_end',
	                'audio_id': _asrRequestId
	            };
	        websocket.send(JSON.stringify(_audio_end));
	        //console.log("send audioEnd because of silence when msg was buffered");
	        changeWsStatus(WS_STATUS_ENUM.NEXT_QUERY);
	       
		}else{
			//console.log("no audioendFlag in msgBuffer")
			changeWsStatus(WS_STATUS_ENUM.WORKING);
		}
	}
	
	/** initializes the connection to the Nuance-server, 
	 * where the audio will be sent in order to be recognized.
	 * 
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var buildConnection = function(oninit){ 
		if(wsStatus == WS_STATUS_ENUM.OPENING || wsStatus == WS_STATUS_ENUM.SETUP || wsStatus == WS_STATUS_ENUM.WORKING || wsStatus == WS_STATUS_ENUM.SEALED ){
		//if(!(wsStatus == WS_STATUS_ENUM.NEXT_QUERY || wsStatus == WS_STATUS_ENUM.CLOSED)){
			//console.log("canceled buildConnection: " + wsStatus);
			return;
		}
		
		wsStatus = WS_STATUS_ENUM.OPENING;
		connectionAttempt++;
		
		if (webSocket){
			webSocket = undefined;
		}
		
		var serviceUrl = configurationManager.getString( [_pluginName, "webSocketAddress"] ) + "?app_id=" + configurationManager.getString( [_pluginName, "appId"] ) + "&algorithm=key&app_key=" + configurationManager.getString( [_pluginName, "appKey"] ); 
		webSocket = new WebSocket(serviceUrl);
		webSocket.binaryType = 'arraybuffer';

		/**  @memberOf NuanceWsWebAudioInputImpl.webSocket# */
		webSocket.onopen = function () {
			
			//PatBit TODO use another method for unique id
	        var nav = window.navigator;
	           var deviceId = [
	               nav.platform,
	               nav.vendor,
	               nav.language
	           ].join('_').replace(/\s/g,'');
	           
			var _connect = {
	            'message': 'connect',
	            'user_id': configurationManager.getString( [_pluginName, "userId"] ),
	            'codec':  codecTyp,
	            'device_id': deviceId
	        };
			
			//console.log("buildconnect send");
			webSocket.send(JSON.stringify(_connect));
			setupNuance();
		};
		/**  @memberOf NuanceWsWebAudioInputImpl.webSocket# */
		webSocket.onmessage = function(msg) {
			
			var msg = JSON.parse(msg.data);
			var cmd = msg.message;
			//console.log("debug info: " + JSON.stringify(msg));
            
			switch(cmd){
				case 'connected':
					//console.log("connected sendMsgBuffer");
					sendMsgBuffer();
					changeWsStatus(WS_STATUS_ENUM.WORKING);
					return;
					
				case 'disconnect':
					if(wsStatus != WS_STATUS_ENUM.SEALED){
						changeWsStatus(WS_STATUS_ENUM.CLOSED);
					}
					
					if(typeof websocket !== 'undefined' && websocket != null){
						websocket.close();
						websocket = null;
					}
	                return;
				case 'query_error': //mostly does not understood the spoken speech/sentence
					if (currentFailureCallback){
						currentFailureCallback(msg.reason);
					}
	                return;
				case "query_end":
					changeWsStatus(WS_STATUS_ENUM.NEXT_QUERY);
					setupNuance();                   
					return;
				case "query_response":
					if(textProcessor){	
	            		var size = msg.transcriptions.length;
	            		var alt;
	            		
	            		if(size > 1){
		            		alt = [];
		            		for(var i=1; i < size; ++i){
		            			alt.push({	"text" : msg.transcriptions[i],
		            						"score" : msg.confidences[i]});
		            		}
	            		}
	            		if(stopped){
	            			textProcessor(msg.transcriptions[0], msg.confidences[0], RESULT_TYPES.FINAL, alt);
	            		}else{
	            			textProcessor(msg.transcriptions[0], msg.confidences[0], RESULT_TYPES.INTERMEDIATE, alt);
	            		}
	            	}
	                return;
				default:
					console.warn("unhandled webSocket.onmessage");
			}
			console.warn("unhandled webSocket.onmessage"); 
            
		};
		/**  @memberOf NuanceWsWebAudioInputImpl.webSocket# */
		webSocket.onerror = function(e) {
			//console.log("ws.onerror called");
			websocket = null;
			//try to filter:
			//WebSocket connection to ... failed: One or more reserved bits are on: reserved1 = 0, reserved2 = 1, reserved3 = 1
			//
			// -> error but websocket stays open
			
			if(wsStatus == WS_STATUS_ENUM.OPENING){
				if(connectionAttempt > 1){
					//console.log("failed while reopening");
				}else{
					//console.log("failed while opening");
				}
				changeWsStatus(WS_STATUS_ENUM.CLOSED);
				return;
			}
			
			if(wsStatus == WS_STATUS_ENUM.CLOSED){
				//console.log("failed after closed ws -> ignored");
				return;
			}
			
			closeMicFunc();
			lastBlob=false;

			if (currentFailureCallback){
				currentFailureCallback(e);
			}
			else {
				console.error('Websocket Error: '+e  + (e.code? ' CODE: '+e.code : '')+(e.reason? ' REASON: '+e.reason : ''));
			}
		};
		/**  @memberOf NuanceWsWebAudioInputImpl.webSocket# */
		webSocket.onclose = function(e) {
			console.info('Websocket closed!'+(e.code? ' CODE: '+e.code : '')+(e.reason? ' REASON: '+e.reason : ''));
			websocket = null;
		};
	};
	
	/** @memberOf NuanceWsWebAudioInputImpl# */
	var buffer = 0;
	
	/** @memberOf NuanceWsWebAudioInputImpl# */
	var onSendPart = function(evt){		
			var recorder = evt.recorder;
			
			recorder.doEncode();
			recorder.doFinish();

	
			
//			recorder && recorder.exportMonoPCM(
//					/** @memberOf NuanceWsWebAudioInputImpl.recorder# */
//					function onSendPartial(view){ //blob, id
//							doSend(view.buffer);
//					},
//					buffer,
//					inputId
//			);

		return false;
	};

	/** @memberOf NuanceWsWebAudioInputImpl# */
	var onSilence = function(evt){

		var recorder = evt.recorder;

		if(streaming != "true"){
			//PatBit TODO implement
			console.warn("onSilence not-streaming mode not tested");
			recorder.doEncode();
			recorder.doFinish();
			
			var _audio_end = {
	                'message': 'audio_end',
	                'audio_id': _asrRequestId
	            };
			
			doSend(JSON.stringify(_audio_end));
			
			
			// send record to server!
			//console.log("onSilence NOT STREAMING !!!");
			//recorder && recorder.exportMonoPCM(
			//		/** @memberOf NuanceWsWebAudioInputImpl.recorder# */
			//		function onSilenceDetected(view){ //blob,id
			//			console.log("onSilenceDetected entered Method");
			//			console.log("buffersize: " + view.buffer.byteLength);
			//			if(mediaManager._log.isDebug()) mediaManager._log.log("monoPCM exported");
			//				doSend(view.buffer);
			//				
			//				//TODO make code cleaner
			//				var _audio_end = {
			//		                'message': 'audio_end',
			//		                'audio_id': _asrRequestId
			//		            };
			//				
			//		        doSend(JSON.stringify(_audio_end));
			//				hasActiveId = false;
			//		},
			//		buffer,
			//		inputId
			//);
		}else{ //we are streaming
			//TODO make code cleaner
			var _audio_end = {
	                'message': 'audio_end',
	                'audio_id': _asrRequestId
	            };
			
			doSend(JSON.stringify(_audio_end));
	        //console.log("audio end send streaming: "+ JSON.stringify(_audio_end));
	        changeWsStatus(WS_STATUS_ENUM.NEXT_QUERY);
		}

		return false;
	};

	/** @memberOf NuanceWsWebAudioInputImpl# */
	var onClear = function(evt){

		evt.recorder && evt.recorder.clear();
		return false;
	};
	
	var sealWebsocket = function(){
		
		if(wsStatus == WS_STATUS_ENUM.WORKING){
            var _audio_end = {
	                'message': 'audio_end',
	                'audio_id': _asrRequestId
	            };
	        doSend(JSON.stringify(_audio_end));
		}
		changeWsStatus(WS_STATUS_ENUM.SEALED);
	}

	var buildConnectionWrapper = function(){
		buildConnection();
		return false;
	}
	
	var pseudoInit = function(){
		//console.log("pseudoInit called teste");
		return false;
	}
	/**  @memberOf NuanceWsWebAudioInputImpl# */
	return {
		/** @memberOf NuanceWsWebAudioInputImpl.AudioProcessor# */
		_init: pseudoInit,
		initRec: pseudoInit,
		sendData: doSend,
		oninit: pseudoInit,
		onstarted: function(data, successCallback, errorCallback){
			stopped = false;
			wsStatus = WS_STATUS_ENUM.CLOSED;
			successCallback && successCallback('',-1,RESULT_TYPES.RECORDING_BEGIN)
			return false;
		},
		onaudiostarted: buildConnectionWrapper,
		onstopped: function(data, successCallback, errorCallback){
			stopped = true;
			sealWebsocket();
			successCallback && successCallback('',-1,RESULT_TYPES.RECORDING_DONE);
			return false;
		},
		onsendpart: onSendPart,
		onsilencedetected: onSilence,
		onclear: onClear,
		getPluginName: function(){
			return _pluginName;
		},
		setCallbacks: function(successCallback, failureCallback, stopUserMedia, isIntermediateResults){

			textProcessor = successCallback;
			currentFailureCallback = failureCallback;
			closeMicFunc = stopUserMedia;
			isUseIntermediateResults = isIntermediateResults;
		},
		setLastResult: function(){
			lastBlob = true;
		},
		resetLastResult: function(){
			lastBlob = false;
		},
		isLastResult: function(){
			return lastBlob;
		}
	};
	
})();