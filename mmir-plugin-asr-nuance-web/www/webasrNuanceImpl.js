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
 * @requries jQuery.ajax
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
	 * legacy mode: use pre-v4 API of mmir-lib
	 * @memberOf NuanceWebAudioInputImpl#
	 */
	var _isLegacyMode = true;
	/** 
	 * Reference to the mmir-lib core (only available in non-legacy mode)
	 * @type mmir
	 * @memberOf NuanceWebAudioInputImpl#
	 */
	var _mmir = null;
	
	//get mmir-lib core from global namespace:
	_mmir = window[typeof MMIR_CORE_NAME === 'string'? MMIR_CORE_NAME : 'mmir'];
	if(_mmir){
		// set legacy-mode if version is < v4
		_isLegacyMode = _mmir? _mmir.isVersion(4, '<') : true;
	}
	
	/**
	 * HELPER for require(): 
	 * 		use module IDs (and require instance) depending on legacy mode
	 * 
	 * @param {String} id
	 * 			the require() module ID
	 * 
	 * @returns {any} the require()'ed module
	 * 
	 * @memberOf NuanceWebAudioInputImpl#
	 */
	var _req = function(id){
		var name = (_isLegacyMode? '' : 'mmirf/') + id;
		return _mmir? _mmir.require(name) : require(name);
	};
	
	/** 
	 * @type mmir.ConfigurationManager
	 * @memberOf NuanceWebAudioInputImpl#
	 */
	var mediaManager = _req('mediaManager');

	/** 
	 * @type mmir.LanguageManager
	 * @memberOf NuanceWebAudioInputImpl#
	 */
	var languageManager = _req('languageManager');
	/** 
	 * @type mmir.ConfigurationManager
	 * @memberOf NuanceWebAudioInputImpl#
	 */
	var configurationManager = _req('configurationManager');
	/** 
	 * AJAX loader functions (similar to jQuery.ajax)
	 * @type Function
	 * @memberOf NuanceWebAudioInputImpl#
	 */
	var ajax = _isLegacyMode? _req('jquery').ajax : _req('util/loadFile');
	
	/** @memberOf NuanceWebAudioInputImpl# */
	var result_types = {
			"FINAL": 				"FINAL",
			"INTERIM": 				"INTERIM",
			"INTERMEDIATE":			"INTERMEDIATE",
			"RECOGNITION_ERROR": 	"RECOGNITION_ERROR",
			"RECORDING_BEGIN": 		"RECORDING_BEGIN",
			"RECORDING_DONE": 		"RECORDING_DONE"
	};

	/** @memberOf NuanceWebAudioInputImpl# */
	var lastBlob = false;
	
	/** @memberOf NuanceWebAudioInputImpl# */
	var isUseIntermediateResults = false;

	/** @memberOf NuanceWebAudioInputImpl# */
	var closeMicFunc = void(0);
	
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
	var asrErrorWrapper = function(ajax,blobsize){

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
		
		//TODO verify that these are "non fatal" and add others that may be non-fatal in "continuous" or "intermediate" asr mode
		var isFatal = ! (status == '500' || status === '413' || status === '204' || status === '403');

		return {
			status: status,
			message: msg,
			fatal: isFatal
		};
	};

	/** @memberOf NuanceWebAudioInputImpl# */
	var doSend = function(msg, successCallback, errorCallback){
		
		var ajaxSuccess = function(data, textStatus, jqXHR) {

//			console.log("AJAXSubmit - Success!");
//			console.log("ResonseText in input");

			var respText = (jqXHR.responseText).split("\n");
			if(!respText){
				respText = '';
			}

//			console.log("ResonseText:"+this.responseText);
//			console.log("ResonseArray:"+respText);

			//jsonResp = JSON.parse(this.responseText);


			//[asr_result, asr_score, asr_type, asr_alternatives, asr_unstable]
			//[ text, number, STRING (enum/CONST), Array<(text, number)>, text ]
			//                ["FINAL" | "INTERIM"...]
			if(successCallback){
				
				var altRes;
				if(respText.length > 1){
					altRes = [];
					for(var i=1,size=respText.length; i < size; ++i){
						
						if(respText[i]){//<- ignore empty lines
							altRes.push({text: respText[i]});
						}
					}
				}
				
				type = lastBlob? result_types.FINAL : result_types.INTERMEDIATE;
				
				successCallback(respText[0],1,type,altRes);
			}

		};

		var ajaxFail = function(jqXHR, textStatus, errorThrown) {
			
			var err = asrErrorWrapper(jqXHR, dataSize);
			
			//FIXME find solution for case that there was an error/problem, but ASR was not stopped
			var asrStopped = false;
			if(!isUseIntermediateResults || err.isFatal){
				asrStopped = true;
				closeMicFunc();
			}
			
			if(errorCallback && asrStopped){//FIXME find solution for case that there was an error/problem, but ASR was not stopped
				errorCallback(err.message, err.status, asrStopped);
			} else {
				console.error('Error response from server (status '+err.status+'): '+err.message);
			}
		};

		var data = msg.buf; //is a blob
		var dataSize = data.size;

		var apiLang = getFixedLang();//TODO use options parameter from startRecord-/recognize-invocation

		var appKey = configurationManager.getString( [_pluginName, "appKey"] );
		var appId = configurationManager.getString( [_pluginName, "appId"] ); 
		var baseUrl = "https://dictation.nuancemobility.net/NMDPAsrCmdServlet/dictation";

		var options = {
			url: baseUrl+"?appId="+appId+"&appKey="+appKey,
			type: 'POST',
			headers: {
				'Content-Type': 'audio/amr',
				'Accept': 'text/plain',			//NOTE cannot use jQuery option dataType='text', since jQuery automatically adds some Accept-entries which will result in an error-response
				'Accept-Language': apiLang
			},
			processData: false,					//prevent jQuery from trying to process the (binary) data
			data: data,
			mmirSendType: 'binary',				//add custom "marker" to signify that we are sending binary data
			
			success: ajaxSuccess,
			error: ajaxFail
		};
		
		ajax(options);

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
		onstarted: function(data, successCallback, errorCallback){
			successCallback && successCallback('',-1,result_types.RECORDING_BEGIN)
			return false;
		},
		onaudiostarted: doStopPropagation,
		onstopped: function(data, successCallback, errorCallback){
			successCallback && successCallback('',-1,result_types.RECORDING_DONE)
			return false;
		},
		onsendpart: doStopPropagation,
		onsilencedetected: onSilenceDetected,
		onclear: onClear,
		getPluginName: function(){
			return _pluginName;
		},
		setCallbacks: function(successCallback, failureCallback, stopUserMedia, isIntermediateResults){

//			currentSuccessCallback = successCallback;//needs to be set in doSend() only
//			currentFailureCallback = failureCallback;//needs to be set in doSend() only
			closeMicFunc = stopUserMedia;
			isUseIntermediateResults = isIntermediateResults;
		},
			
			function(successCallback, failureCallback){},//NOOP these need to be set in doSend() only
//
//			textProcessor = successCallback;
//			currentFailureCallback = failureCallback;
//		},
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