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
 * Media Module: Implementation for Speech Recognition via Nuance ASR over HTTPS/POST
 * 
 * @requires AMR encoder (workers/amrEncoder.js)
 * @requires Cross-Domain access
 * @requires CSP for accessing the Nuance ASR server, e.g. "connect-src https://dictation.nuancemobility.net" or "default-src https://dictation.nuancemobility.net"
 * 
 */
newWebAudioAsrImpl = (function NuanceWebAudioInputImpl(){
		
	/**  @memberOf NuanceWebAudioInputImpl# */
	var MODE = 'nuance';

	/**  @memberOf NuanceWebAudioInputImpl# */
	var _pluginName = 'nuanceWebAudioInput';

	/** 
	 * @type mmir.ConfigurationManager
	 * @memberOf NuanceWebAudioInputImpl#
	 */
	var mediaManager = require('mediaManager');

	/** 
	 * @type mmir.LanguageManager
	 * @memberOf NuanceWebAudioInputImpl#
	 */
	var languageManager = require('languageManager');
	/** 
	 * @type mmir.ConfigurationManager
	 * @memberOf NuanceWebAudioInputImpl#
	 */
	var configurationManager = require('configurationManager');
	
	/**
	 * HELPER retrieve language setting and apply impl. specific corrections/adjustments
	 * (i.e. deal with Nuance specific quirks for language/country codes)
	 *   
	 * @memberOf NuanceWebAudioInputImpl#
	 */
	var getFixedLang = function(options){
		
		var lang = options && options.language? options.language : languageManager.getLanguageConfig(_pluginName, 'long');

		return languageManager.fixLang('nuance', lang);
	};
	
//	var textProcessor, currentFailureCallback;
	
	/** 
	 * @returns {Error} an error description, that is a PlainObject with properties
	 * 					message: STRING
	 * 					status: NUMBER
	 * @memberOf NuanceWebAudioInputImpl#
	 */
	var asrErrorWrapper = function(ajax,response,blobsize){

		var status = (ajax.status).toString(), msg;

		switch (status) {
		//2xx "Success"
		case '204': //NO CONTENT
			msg = 'The server successfully processed the request but is not returning any content.';
			break;
			//4xx Client Error
		case '400':
			msg = 'The request cannot be fulfilled due to bad syntax.';
			break;
		case '401':
			msg = 'Used when authentication is possible but has failed or not yet been provided.';
			break;
		case '403':
			msg = 'The request was a legal request, but the server is refusing to respond to it';
			break;
		case '404':
			msg = 'The ASR resource could not be found but may be available again in the future.';
			// TODO add code notify the user
			break;
		case '405':
			msg = 'A request was made for an ASR resource using a request method not supported;' +
			' for example, using GET instead of POST.';
			break;
		case '406':
			msg = 'The ASR resource is only capable of generating content not acceptable according' +
			' to the Accept headers sent in the request.';
			break;
		case '408':
			msg = 'The server timed out waiting for the request.';
			break;
		case '410':
			msg = 'The resource requested is no longer available and will not be available again.';
			break;
		case '413':
			msg = 'The request is larger than the server is willing or able to process.';
			break;
		case '414':
			msg = 'The URI provided was too long for the server to process.';
			break;
		case '415':
			msg = 'The request entity has a media type that the server or resource does not support.';
			break;
			// 5xx Server Error
		case '500': //maybe most important
			//A generic error message, given when no more specific message is suitable.
			msg = 'Nuance could not recognize any words.';
			if(blobsize < 480) { // < 60ms
				msg += '\n\t -> Message was most likely to short';
			} else {
				msg += '\n\t -> Maybe you mumbled';
			}
			break;
		case '501':
			msg = 'The server either does not recognize the request method, or it lacks the ability' +
			' to fulfill the request.';
			break;
		case '503':
			msg = 'The server is currently unavailable (because it is overloaded or down for maintenance).' +
			' Generally, this is a temporary state.';
			break;
		case '504':
			msg = 'The server was acting as a proxy and did not receive a timely response' +
			' from the upstream server.';
			break;
		case '505':
			msg = 'The server was acting as a proxy and did not receive a timely response from' +
			' the upstream server.';
			break;
		default:
			msg = 'UNKNOWN ERROR';
		break;
		}

		console.error('Error response from server (status '+status+'): '+msg);

		return {
			status: status,
			message: msg
		};
	};

	/** @memberOf NuanceWebAudioInputImpl# */
	var doSend = function(msg, successCallback, errorCallback){

//		successCallback = successCallback || textProcessor;
//		errorCallback = errorCallback || currentFailureCallback;
		
		var ajaxSuccess = function() {

			if (oAjaxReq.status == 200) {
//				console.log("AJAXSubmit - Success!");
//				console.log("ResonseText in input");

				var respText = (this.responseText).split("\n");

//				console.log("ResonseText:"+this.responseText);
//				console.log("ResonseArray:"+respText);

				//jsonResp = JSON.parse(this.responseText);


				//[asr_result, asr_score, asr_type, asr_alternatives, asr_unstable]
				//[ text, number, STRING (enum/CONST), Array<(text, number)>, text ]
				//                ["FINAL" | "INTERIM"...]
				if(successCallback && respText){
					successCallback(respText[0],1);
				}

			} else {
				var err = asrErrorWrapper(oAjaxReq, this, dataSize);
				errorCallback && errorCallback(err.message, err.status);
				//TODO invoke error-callback for some of the error-codes (?)
			}

		};

		var ajaxFail = function(e) {
			console.error("error ajax", e);
			errorCallback && errorCallback(e);
		};

		var data = msg.buf; //is a blob
		var dataSize = data.size;
		//var sample_rate = 44100; //PB TODO do not "hard-code" this!
//		console.log("Ajax-Data: ");
//		console.log(data);

		var oAjaxReq = new XMLHttpRequest();

		var apiLang = getFixedLang();//TODO use options parameter from startRecord-/recognize-invocation

		var appKey = configurationManager.getString( [_pluginName, "appKey"] );
		var appId = configurationManager.getString( [_pluginName, "appId"] ); 
		var baseUrl = "https://dictation.nuancemobility.net/NMDPAsrCmdServlet/dictation";

		//oAjaxReq.open("POST", "http://localhost:8080", true);
		oAjaxReq.open("POST", baseUrl+"?appId="+appId+"&appKey="+appKey, true);

		oAjaxReq.setRequestHeader("Content-Type", "audio/amr");
		oAjaxReq.setRequestHeader("Accept", "text/plain");
		//oAjaxReq.setRequestHeader("Accept-Language", apiLang);
		oAjaxReq.setRequestHeader("Accept-Language", apiLang);

		//oAjaxReq.setRequestHeader("Transfer-Encoding", "chunked"); //chrome does not allow this :/

		oAjaxReq.onload = ajaxSuccess;
		oAjaxReq.onerror = ajaxFail;

		// oAjaxReq.responseType = 'json';
		// oAjaxReq.setRequestHeader("User-Agent", "Mozilla/5.0 (Windows NT 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36;");
		oAjaxReq.send(data);

//		//FIXM russa DEBUG:
//		if(typeof fileNameCounter !== 'undefined'){
//			++fileNameCounter;
//		} else {
//			fileNameCounter = 0;
//		}
//		Recorder.forceDownload(data, 'speechAsr_'+fileNameCounter+'.amr');
//		//FIXM russa DEBUG (END)

		return; 

	};

	/** initializes the connection to the googleMediator-server, 
	 * where the audio will be sent in order to be recognized.
	 * 
	 * @memberOf NuanceWebAudioInputImpl#
	 */
	var doInitSend = function(oninit){

		//DISABLED: not needed for nuance
	};

	/** @memberOf NuanceWebAudioInputImpl# */
	var onSilenceDetected = function(evt){

		var recorder = evt.recorder;

		//encode all buffered audio now
		recorder.doEncode();
		recorder.doFinish();

		//FIXME experimental callback/listener for on-detect-sentence -> API may change!
		var onDetectSentenceListeners = mediaManager.getListeners('ondetectsentence');
		for(var i=0, size = onDetectSentenceListeners.length; i < size; ++i){
			onDetectSentenceListeners[i]();//blob, inputId);
		}

		return false;
	};

	/** @memberOf NuanceWebAudioInputImpl# */
	var onClear = function(evt){

		evt.recorder && evt.recorder.clear();
		return false;
	};

	/** @memberOf NuanceWebAudioInputImpl# */
	var doStopPropagation = function(){
		return false;
	};

	/**  @memberOf NuanceWebAudioInputImpl# */
	return {
		/** @memberOf NuanceWebAudioInputImpl.AudioProcessor# */
		_init: doInitSend,
//		initRec: function(){},
		sendData: doSend,
		oninit: doStopPropagation,
		onstarted: doStopPropagation,
		onaudiostarted: doStopPropagation,
		onstopped: doStopPropagation,
		onsendpart: doStopPropagation,
		onsilencedetected: onSilenceDetected,
		onclear: onClear,
		getPluginName: function(){
			return _pluginName;
		},
		setCallbacks: function(successCallback, failureCallback){}//NOOP these need to be set in doSend() only
//
//			textProcessor = successCallback;
//			currentFailureCallback = failureCallback;
//		}
	};
		
})();