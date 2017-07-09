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
newWebAudioAsrImpl = (function BingWsWebAudioInputImpl() {
	

	/**  @memberOf BingWsWebAudioInputImpl# */
	var MODE = 'bingWs';

	/**  @memberOf BingWsWebAudioInputImpl# */
	var _pluginName = 'bingWsWebAudioInput';

	/** 
	 * @type mmir.LanguageManager
	 * @memberOf BingWsWebAudioInputImpl#
	 */
	var languageManager = require('languageManager');
	/** 
	 * @type mmir.ConfigurationManager
	 * @memberOf BingWsWebAudioInputImpl#
	 */
	var configurationManager = require('configurationManager');
	
	/**
	 * Result types (returned by the native/Cordova plugin)
	 * 
	 * @type Enum
	 * @constant
	 * @memberOf BingWsWebAudioInputImpl#
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
	 * @memberOf BingWsWebAudioInputImpl#
	 */
	var mediaManager = require('mediaManager');

	/** @memberOf BingWsWebAudioInputImpl# */
	var inputId = 0;
	
	/** @memberOf BingWsWebAudioInputImpl# */
	var lastBlob = false;

	/** @memberOf BingWsWebAudioInputImpl# */
	var isUseIntermediateResults = false;	
	
	/** 
	 * @type WebSocket
	 * @memberOf BingWsWebAudioInputImpl#
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
	
	var access_token;
	var expireTime;
	
	var lang = languageManager.getLanguageConfig(_pluginName); //'en-us';
	
    var firstAudioData = true;
    
    var crlf = "\r\n";
    
    var audioPath = "path: audio" + crlf;
    var speechConfigPath = "path: speech.config" + crlf;
    var getTimestamp = function(){return "x-timestamp: " + new Date().toISOString() + crlf; }
    var guid;
    var guidHeader;
    var createRequestId = function(){
    					//TODO improve + check new id != old id
    					var rand = Math.floor((Math.random() * 900000) + 100000 );
    					guid = "123E4567E89B12D3A456426655" + rand;
    					guidHeader = "x-requestid: " + guid + crlf;
    	}
    
    
    var contentTypeJson = "Content-Type: application/json; charset=utf-8" + crlf;
    var contentTypeAudio = "Content-Type: audio/x-wav" + crlf;
    
    var setString = function (view , offset, str){
        for (var i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }
    
    //from https://gist.github.com/72lions/4528834
    var appendBuffer = function(buffer1, buffer2) {
    	  var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    	  tmp.set(new Uint8Array(buffer1), 0);
    	  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    	  return tmp.buffer;
    	};
    
    var createRiffHeader = function(){
    	var buffer = new ArrayBuffer(44);
		const fileLength = 0;

        const view = new DataView(buffer);
        
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const channelCount = 1;
        const desiredSampleRate = 16000;
        

	    /* RIFF identifier */
	    setString(view, 0, "RIFF");
	    /* file length */
	    view.setUint32(4, fileLength, true);
	    /* RIFF type & Format */
	    setString(view, 8, "WAVEfmt ");
	    /* format chunk length */
	    view.setUint32(16, 16, true);
	    /* sample format (raw) */
	    view.setUint16(20, 1, true);
	    /* channel count */
	    view.setUint16(22, 1, true);
	    /* sample rate */
	    view.setUint32(24, desiredSampleRate, true);
	    /* byte rate (sample rate * block align) */
	    view.setUint32(28, this.desiredSampleRate * this.channelCount * bytesPerSample, true);
	    /* block align (channel count * bytes per sample) */
	    view.setUint16(32, channelCount * bytesPerSample, true);
	    /* bits per sample */
	    view.setUint16(34, bitsPerSample, true);
	    /* data chunk identifier */
	    setString(view, 36, "data");
	    /* data chunk length */
	    view.setUint32(40, fileLength, true);
	    
	    return view.buffer;
    }
    
    var riffHeader = createRiffHeader();
	
    var _ttsTransactionId = 0;
    var _asrTransactionId = 1;
    var _nluTransactionId = 2;
    var _asrRequestId = 0;
    
	var encoderStr = configurationManager.getString( [_pluginName, "encoder"] );
	
    var streaming = "true"; //FIXME read from config
    
    var startTimestamp;
    var endTimestamp;
    var telemetryMsg;
    var createTelemetryMsg = function(){
    	
    	var endTimestamp = new Date().toISOString();
    	
    	var jsonHeader = "Path: telemetry"+crlf+"Content-Type: application/json; charset=utf-8"+crlf+guidHeader+getTimestamp()+crlf;
    	
    	var jsonBody = {
			  "ReceivedMessages": [
			    { "speech.hypothesis": hypothesisTimestampArray },
			    { "speech.endDetected": recMesArray["speech.endDetected"] },
			    { "speech.phrase": recMesArray["speech.phrase"] },
			    { "turn.end": recMesArray["turn.end"] }
			  ],
			  "Metrics": [
			    {
			      "Name": "Connection",
			      "Id": guid,
			      "Start": startTimestamp,
			      "End": endTimestamp,
			    },
			    {
			      "Name": "ListeningTrigger",
			      "Start": startTimestamp,
			      "End": endTimestamp,
			    },
			    {
			      "Name": "Microphone",
			      "Start": startTimestamp,
			      "End": endTimestamp,
			    },
			  ],
			};
    	
    	var jsonString = jsonHeader + crlf + JSON.stringify(jsonBody);   	
    	return jsonString;
    	
    };
       
    var mesArray = new Array();
    var recMesArray = new Array();
    var hypothesisTimestampArray = new Array();
    var metricsArray = new Array();
    
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

	/** @memberOf BingWsWebAudioInputImpl# */
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
				//console.log("push non string");
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
					data = createBinaryAudioMessage(data);
					webSocket.send(data);
				}else if(typeof data === 'Array' || data instanceof Array){
					//console.log("ws dosend buffers from a array");
					data.forEach(function(typedArray){
						console,log("typedArray");
						console,log(typedArray);
						var msgAudio = createBinaryAudioMessage(typedArray.buffer);
						webSocket.send(msgAudio);
	                });
				}else if(data !== undefined){
					console.warn("buffer is an unknowen typ");
				}else{
					console.warn("skip data sending -> undefined");
				}
			} catch(err){
				console.log("Error while send");
				console.error(err);
			}
		}
		
	};
	
	var createBinaryAudioMessage = function(buffer){
		
		if(firstAudioData){
			//console.log("first audio data append Riffheader");
			firstAudioData = false;
			buffer = appendBuffer(riffHeader,buffer);
		}
		
		var headersStr = audioPath+guidHeader+getTimestamp()+contentTypeAudio+crlf;
		var messageLength = 2+(headersStr.length*2);
		var messageAsBuffer = new ArrayBuffer(messageLength);
		var view = new DataView(messageAsBuffer);
		var headerLength = (headersStr.length-2)*2;
		view.setInt16(0,headerLength);
		setString(view,2,headersStr);
		messageAsBuffer = appendBuffer(messageAsBuffer,buffer);
		
		//console.log("messageAsBuffer.byteLength: "+messageAsBuffer.byteLength);
		
		return messageAsBuffer;
	}
	
	
	var sendMsgBuffer = function(){
		if(msgBuffer.length > 0){
			for(var i=0; i < msgBuffer.length; ++i){
				if(typeof msgBuffer[i] === "string"){
					//console.log("sendMsgBuffer string: "+ msgBuffer[i]);
				}else{
					data = msgBuffer[i];
					console.log("sendMsgBuffer audiodata");
					var message =  createBinaryAudioMessage(data);
					webSocket.send(message);
				}
			}
			
			msgBuffer = [];			
		}
		
		changeWsStatus(WS_STATUS_ENUM.WORKING);
		
	}
	
	/** initializes the connection to the Bing-server, 
	 * where the audio will be sent in order to be recognized.
	 * 
	 * @memberOf BingWsWebAudioInputImpl#
	 */
	var buildConnection = function(oninit){ 
		if(wsStatus == WS_STATUS_ENUM.OPENING || wsStatus == WS_STATUS_ENUM.SETUP || wsStatus == WS_STATUS_ENUM.WORKING || wsStatus == WS_STATUS_ENUM.SEALED ){
			//console.log("canceled buildConnection: " + wsStatus);
			return;
		}
		
		wsStatus = WS_STATUS_ENUM.OPENING;
		connectionAttempt++;
		
		if (webSocket){
			webSocket = undefined;
		}
		var formatParam = "?format=detailed"; //or "?format=simple"
		var langParam = "&language="+lang;//"&language=en-us";
		createRequestId();
		var guidParam = "&X-ConnectionId="+guid;
		var authParam = "&Ocp-Apim-Subscription-Key=df0ce509aa7d451494b9752636e59e24";
		
		var serviceUrl = configurationManager.getString( [_pluginName, "webSocketAddress"] );
		var uri = serviceUrl + formatParam + langParam + guidParam + authParam;
		console.log("constructed uri: " + uri);
		webSocket = new WebSocket(uri);
		webSocket.binaryType = 'arraybuffer';

		/**  @memberOf BingWsWebAudioInputImpl.webSocket# */
		webSocket.onopen = function () {
			//console.log("webSocket opened");
			//build speech config message
			//TODO read navigator.userAgent
			var speechConfigStr = JSON.stringify({
				  "context": {
					    "system": {
					      "version": "1.0.00000",
					    },
					    "os": {
					      "platform": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36",
					      "name": "Browser",
					      "version": "null"
					    },
					    "device": {
					      "manufacturer": "SpeechSample",
					      "model": "SpeechSample",
					      "version": "1.0.00000"
					      }
					    },
					  });
			
			var mesStr = speechConfigPath+guidHeader+getTimestamp()+contentTypeJson+crlf+speechConfigStr;
			//console.log("send speech.config message: ");
			//console.log(mesStr);
			webSocket.send(mesStr);
			sendMsgBuffer();
		};
		/**  @memberOf BingWsWebAudioInputImpl.webSocket# */
		webSocket.onmessage = function(msg) {
			//console.log("ws got message.");
			//console.log(msg);
			var data = msg.data;
			
			var receivedTime = new Date().toISOString();
			
			//console.log("data is: " + (typeof data));
			
			if(typeof data === "string"){
				var cmd;
				//console.log("got a string");
				var paras = data.split(crlf+crlf); //headers=[0] jsonpayload=[1] 
				var headers = paras[0].split(crlf);
				for(var i=0; i<headers.length; i++){
					if(headers[i].indexOf("Path:") != -1){
						cmd = headers[i].substr(5);
						switch(cmd){
							case "speech.startDetected":
								//console.log("speech.startDetected");
								recMesArray[cmd] = receivedTime;
								return;
							case "speech.endDetected":
								changeWsStatus(WS_STATUS_ENUM.NEXT_QUERY);
								//console.log("speech.endDetected");
								recMesArray[cmd] = receivedTime;
								return;
							case "speech.hypothesis": 
								var hypothesis = JSON.parse(paras[1]);
								//console.log("hypothesis:");
								//console.log(hypothesis);
								//console.log("hypothesis.Text:");
								//console.log(hypothesis.Text);
								hypothesisTimestampArray.push(receivedTime);
								//textProcessor(hypothesis.Text, 1.0, RESULT_TYPES.INTERIM, null);
								return;
							case "speech.phrase":
								var phrase = JSON.parse(paras[1]);
								//console.log("phrase: ");
								//console.log(phrase); //phrase.Text -> best guess
								recMesArray[cmd] = receivedTime;
								
								if(textProcessor){	
				            		var size = 0;
				            		if(phrase && phrase.NBest && phrase.NBest.length){
				            			size = phrase.NBest.length;
				            		}
				            		var alt;
				            		
				            		if(size > 1){
					            		alt = [];
					            		for(var i=1; i < size; ++i){
					            			alt.push({	"text" : phrase.NBest[i].Display,
					            						"score" : phrase.NBest[i].Confidence});
					            		}
					            		
					            		if(stopped){
					            			textProcessor(phrase.NBest[0].Display, phrase.NBest[0].Confidence, RESULT_TYPES.FINAL, alt);
					            		}else{
					            			textProcessor(phrase.NBest[0].Display, phrase.NBest[0].Confidence, RESULT_TYPES.INTERMEDIATE, alt);
					            		}
				            		}
				            	}
								
								changeWsStatus(WS_STATUS_ENUM.WORKING);
								
								return;
							case "turn.start": 
								//console.log("turn.start"); 
								recMesArray[cmd] = receivedTime;
								return;
							case "turn.end":
								//console.log("turn.end");
								recMesArray[cmd] = receivedTime;
								var telemetryMsg = createTelemetryMsg();
								webSocket.send(telemetryMsg);
								
								hypothesisTimestampArray = new Array();
								createRequestId();
											
								return;
								
							default: console.warn("no switchstatement for: "+cmd); return;
						}
						
					}
				}
			}else if(typeof data === "ArrayBuffer"){
				console.warn("got a ArrayBuffer");
			}  
			console.warn("unhandled webSocket.onmessage"); 
            
		};
		/**  @memberOf BingWsWebAudioInputImpl.webSocket# */
		webSocket.onerror = function(e) {
			//console.log("ws.onerror called");
			websocket = null;
			//try to filter:
			//WebSocket connection to ... failed: One or more reserved bits are on: reserved1 = 0, reserved2 = 1, reserved3 = 1
			//
			// -> error but websocket stays open
			
			if(wsStatus == WS_STATUS_ENUM.OPENING){
				if(connectionAttempt > 1){
					console.log("failed while reopening");
				}else{
					console.log("failed while opening");
				}
				changeWsStatus(WS_STATUS_ENUM.CLOSED);
				return;
			}
			
			if(wsStatus == WS_STATUS_ENUM.CLOSED){
				console.log("failed after closed ws -> ignored");
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
		/**  @memberOf BingWsWebAudioInputImpl.webSocket# */
		webSocket.onclose = function(e) {
			console.info('Websocket closed!'+(e.code? ' CODE: '+e.code : '')+(e.reason? ' REASON: '+e.reason : ''));
			websocket = null;
		};
	};
	
	/** @memberOf BingWsWebAudioInputImpl# */
	var buffer = 0;
	
	/** @memberOf BingWsWebAudioInputImpl# */
	var onSendPart = function(evt){		
			var recorder = evt.recorder;
			
			recorder.doEncode();
			recorder.doFinish();

		return false;
	};

	/** @memberOf BingWsWebAudioInputImpl# */
	var onSilence = function(evt){

		var recorder = evt.recorder;

		if(streaming != "true"){
			console.warn("onSilence non-streaming not implemented")
		}else{ //we are streaming
			console.warn("onSilence streaming not implemented")
		}

		return false;
	};

	/** @memberOf BingWsWebAudioInputImpl# */
	var onClear = function(evt){

		evt.recorder && evt.recorder.clear();
		return false;
	};
	
	var sealWebsocket = function(){
		changeWsStatus(WS_STATUS_ENUM.SEALED);
	}

	var buildConnectionWrapper = function(){
		buildConnection();
		return false;
	}
	
	var pseudoInit = function(){
		return false;
	}
	
	var tokenInit = function (){
		var primaryKey = configurationManager.getString( [_pluginName, "appKey"] );//"df0ce509aa7d451494b9752636e59e24"; //TODO read from config
		var responseText;
		
		var xhr = new XMLHttpRequest();
        xhr.open('POST', "https://api.cognitive.microsoft.com/sts/v1.0/issueToken", true);
        xhr.onload = function () {
            if (xhr.readyState == 4) {
                if (xhr.status === 200) {
					console.log("got auth token");
                    access_token = xhr.response;
					console.log(xhr.response);
				}
            }
        };
        xhr.onerror = function () {
            console.error("xhr response error");
        };
        xhr.setRequestHeader("Ocp-Apim-Subscription-Key", primaryKey);
        xhr.send();
        
        
		return false;		
	}
	/**  @memberOf BingWsWebAudioInputImpl# */
	return {
		/** @memberOf BingWsWebAudioInputImpl.AudioProcessor# */
		_init: pseudoInit,//tokenInit,
		initRec: pseudoInit,
		sendData: doSend,
		oninit: pseudoInit,//tokenInit,
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